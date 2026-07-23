import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Canonical data types a connector can import. Used both for a connector's
// declared capabilities (registry `provides`) and for what was actually
// imported per connection (`importedDataTypes`).
export const connectorDataTypes = [
  "profile",
  "ftp",
  "hr_zones",
  "max_hr",
  "resting_hr",
  "hrv",
  "weight",
  "sleep",
  "recovery",
  "training_history",
  "training_load",
  "activities",
  "personal_records",
  "injury_fatigue_risk",
] as const;

export type ConnectorDataType = (typeof connectorDataTypes)[number];

// Per-user connection state for a sport/health platform. One row per
// (clerkId, provider). The DB is the source of truth for connection status.
export const connectorConnectionsTable = pgTable(
  "connector_connections",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    // Stable connector id from the backend registry, e.g. "strava".
    provider: text("provider").notNull(),
    // "connected" | "disconnected" | "error" | "revoked"
    status: text("status").notNull().default("disconnected"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    importedDataTypes: jsonb("imported_data_types")
      .$type<ConnectorDataType[]>()
      .default([]),
    // Human/machine readable error when status === "error".
    errorStatus: text("error_status"),
    // True when the user revoked access on the provider side.
    permissionRevoked: boolean("permission_revoked").notNull().default(false),
    // Provider-side athlete/user id, when known.
    externalUserId: text("external_user_id"),
    scopes: jsonb("scopes").$type<string[]>().default([]),
    // Per-user OAuth credentials for providers wired via direct OAuth (not the
    // Replit connector proxy). Nullable; never exposed to the client.
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    // Centraal statusmodel (Sparki Connect): laatste synchronisatiepoging
    // (geslaagd of niet). `lastSyncAt` blijft de laatst GESLAAGDE sync.
    lastSyncAttemptAt: timestamp("last_sync_attempt_at", { withTimezone: true }),
    // Coarse-grained foutcategorie voor de laatste mislukte sync:
    // "auth" | "permission" | "temporary" | "unknown". Nooit een technische
    // foutcode voor de gebruiker — alleen intern voor statusafleiding.
    lastErrorCategory: text("last_error_category"),
    // Wanneer de gebruiker de koppeling zelf heeft verbroken.
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("unique_connector_connection").on(t.clerkId, t.provider)],
);

export const insertConnectorConnectionSchema = createInsertSchema(
  connectorConnectionsTable,
).omit({ id: true });
export const selectConnectorConnectionSchema = createSelectSchema(
  connectorConnectionsTable,
);

export type ConnectorConnection =
  typeof connectorConnectionsTable.$inferSelect;
export type InsertConnectorConnection = z.infer<
  typeof insertConnectorConnectionSchema
>;
