import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { trainingSessionsTable } from "./athlete-training";
import type { ConnectorDataType } from "./connectors";

// ─────────────────────────────────────────────────────────────────────────────
// Sparki Data Hub — the central, platform-agnostic ingest layer.
//
// All sport/health platforms (Garmin, Strava, TrainingPeaks, Apple Health, …)
// funnel through ONE pipeline that normalizes every record into Sparki's own
// canonical tables (`training_sessions`, `athlete_daily_metrics`, `ftp_history`,
// `races`, `routes`, `equipment`). These tables store the *provenance, consent,
// and audit* around that pipeline — never fabricated data.
// ─────────────────────────────────────────────────────────────────────────────

// Raw per-source activity row. One row per (user, provider, externalActivityId).
// Preserves the original source record + the dedup key so the hub can recognise
// the SAME ride imported from several platforms and merge it into a single
// `training_sessions` row without losing where each value came from.
export const connectorActivitiesTable = pgTable(
  "connector_activities",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Registry connector id, e.g. "strava", "garmin".
    provider: text("provider").notNull(),
    // Provider-side activity id (stable, used for idempotent re-imports).
    externalActivityId: text("external_activity_id").notNull(),
    // Canonical Sparki sport family (see engines/data-hub/sports.ts).
    sport: text("sport").notNull().default("cycling"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    // Cross-source dedup key (sport + start bucket + rounded duration/distance).
    dedupeKey: text("dedupe_key"),
    // Original normalized payload as received (for audit / re-processing).
    raw: jsonb("raw"),
    // The merged canonical session this raw row contributed to.
    normalizedSessionId: integer("normalized_session_id").references(
      () => trainingSessionsTable.id,
      { onDelete: "set null" },
    ),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("unique_connector_activity").on(
      t.clerkId,
      t.provider,
      t.externalActivityId,
    ),
  ],
);

// Equipment / materiaal — bikes, shoes, sensors, power meters, trainers.
// Manual now (live, testable today); integration-ready via source/externalId.
export const equipmentKinds = [
  "bike",
  "shoes",
  "sensor",
  "powermeter",
  "trainer",
  "wheels",
  "helmet",
  "other",
] as const;
export type EquipmentKind = (typeof equipmentKinds)[number];

export const equipmentTable = pgTable("equipment", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  kind: text("kind").notNull().default("other"),
  name: text("name").notNull(),
  brand: text("brand"),
  model: text("model"),
  // Where this item came from: "manual" or a connector id.
  source: text("source").notNull().default("manual"),
  externalId: text("external_id"),
  // Accumulated distance (km) for wear tracking; null when unknown.
  distanceKm: numeric("distance_km", { precision: 9, scale: 2 }),
  active: boolean("active").notNull().default(true),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Per-source, per-data-type consent (toestemmingen). The hub refuses to persist
// a data type from a provider unless an explicit grant row exists (default-grant
// on first connect, but the user can revoke any single type per platform).
export const connectorConsentsTable = pgTable(
  "connector_consents",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    provider: text("provider").notNull(),
    dataType: text("data_type").$type<ConnectorDataType>().notNull(),
    granted: boolean("granted").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("unique_connector_consent").on(t.clerkId, t.provider, t.dataType),
  ],
);

// Append-only sync log. One row per sync run per provider — the source of truth
// for error handling and "last sync" status surfaced to the user.
export const syncRunStatuses = [
  "running",
  "success",
  "partial",
  "failed",
] as const;
export type SyncRunStatus = (typeof syncRunStatuses)[number];

export const syncRunTriggers = [
  "manual",
  "scheduled",
  "onboarding",
  "webhook",
  "backfill",
] as const;
export type SyncRunTrigger = (typeof syncRunTriggers)[number];

// Per-data-type counts written from one ingest run.
export type SyncRunCounts = {
  /** Aantal activiteiten dat de bron in deze run aanleverde (vóór dedupe). */
  received?: number;
  activities?: number;
  merged?: number;
  skipped?: number;
  dailyMetrics?: number;
  ftp?: number;
  equipment?: number;
  raceResults?: number;
  errors?: number;
  /** Plain-language samples of per-activity failures (max a handful). */
  errorSamples?: string[];
};

export const syncRunsTable = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  provider: text("provider").notNull(),
  trigger: text("trigger").notNull().default("manual"),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  counts: jsonb("counts").$type<SyncRunCounts>(),
  importedDataTypes: jsonb("imported_data_types").$type<ConnectorDataType[]>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Webhook-events ───────────────────────────────────────────────────────────
// Every inbound push notification (Strava/Garmin/Wahoo) lands here FIRST, with
// a per-provider unique event id. The unique index makes processing idempotent:
// a redelivered webhook inserts nothing and is skipped, never double-ingested.
export const webhookEventStatuses = [
  "received",
  "processed",
  "skipped",
  "failed",
] as const;
export type WebhookEventStatus = (typeof webhookEventStatuses)[number];

export const webhookEventsTable = pgTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    // Provider-side stable event id (e.g. Strava object_id+aspect, Garmin
    // summaryId, Wahoo workout id+event type).
    eventId: text("event_id").notNull(),
    // Resolved Sparki user, when the external user id matched a connection.
    clerkId: text("clerk_id"),
    // External user id as reported by the provider (for diagnostics).
    externalUserId: text("external_user_id"),
    payload: jsonb("payload"),
    status: text("status").notNull().default("received"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [unique("unique_webhook_event").on(t.provider, t.eventId)],
);

export const insertWebhookEventSchema = createInsertSchema(
  webhookEventsTable,
).omit({ id: true });
export const selectWebhookEventSchema = createSelectSchema(webhookEventsTable);
export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;

export const insertConnectorActivitySchema = createInsertSchema(
  connectorActivitiesTable,
).omit({ id: true });
export const selectConnectorActivitySchema = createSelectSchema(
  connectorActivitiesTable,
);
export const insertEquipmentSchema = createInsertSchema(equipmentTable).omit({
  id: true,
});
export const selectEquipmentSchema = createSelectSchema(equipmentTable);
export const insertConnectorConsentSchema = createInsertSchema(
  connectorConsentsTable,
).omit({ id: true });
export const selectConnectorConsentSchema = createSelectSchema(
  connectorConsentsTable,
);
export const insertSyncRunSchema = createInsertSchema(syncRunsTable).omit({
  id: true,
});
export const selectSyncRunSchema = createSelectSchema(syncRunsTable);

export type ConnectorActivity = typeof connectorActivitiesTable.$inferSelect;
export type InsertConnectorActivity = z.infer<
  typeof insertConnectorActivitySchema
>;
export type Equipment = typeof equipmentTable.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type ConnectorConsent = typeof connectorConsentsTable.$inferSelect;
export type InsertConnectorConsent = z.infer<
  typeof insertConnectorConsentSchema
>;
export type SyncRun = typeof syncRunsTable.$inferSelect;
export type InsertSyncRun = z.infer<typeof insertSyncRunSchema>;
