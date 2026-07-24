import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { userProfilesTable } from "./users";

// ─────────────────────────────────────────────────────────────────────────────
// Data Origin — herleidbaarheid van BEREKENDE waarden.
//
// Ruwe herkomst van gemeten data leeft al op de rijen zelf (training_sessions:
// source/sources/fieldSources/manualFields/mergeLog/externalRef/dedupeKey;
// sync_runs; connector_activities; passport_value_events; ai_observations:
// engine/ruleKey/engineVersion/signals/missingData). Deze tabel vult het gat
// voor PERSISTENTE afgeleide waarden: welke engine rekende, met welke
// parameters, op welke brondata. Uitsluitend additief — geen bestaande
// functionaliteit vervangen.
// ─────────────────────────────────────────────────────────────────────────────

/** Verwijzing naar één gebruikt brongegeven (echte rij, nooit verzonnen). */
export interface ComputationInputRef {
  /** Bron zoals de gebruiker die kent: strava, garmin, fit, gpx, tcx, handmatig, sensor, berekening. */
  bron: string;
  /** Tabel waar het brongegeven staat (bv. training_sessions, ftp_history). */
  tabel: string;
  /** Record-id indien één rij; null bij een reeks. */
  recordId?: number | string | null;
  /** Veldnaam indien één veld gebruikt is. */
  veld?: string | null;
  /** Periode "YYYY-MM-DD..YYYY-MM-DD" bij reeksen. */
  periode?: string | null;
  /** Aantal gebruikte rijen bij reeksen. */
  aantal?: number | null;
}

export const computationTracesTable = pgTable(
  "computation_traces",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Wat is er berekend: "derived_tss", "ftp_floor", "load_series", …
    subjectType: text("subject_type").notNull(),
    // Id van de rij waarop de uitkomst is geland (bv. training_sessions.id),
    // als tekst zodat ook samengestelde sleutels kunnen.
    subjectId: text("subject_id"),
    // Welke engine rekende, welke versie, met welke parameters.
    engine: text("engine").notNull(),
    engineVersion: text("engine_version").notNull().default("1"),
    parameters: jsonb("parameters").$type<Record<string, unknown>>(),
    // Welke brondata gebruikt is (echte verwijzingen).
    inputs: jsonb("inputs").$type<ComputationInputRef[]>(),
    // Eerlijke kwalificatie: "gemeten" | "afgeleid" | "geschat".
    reliability: text("reliability").notNull().default("afgeleid"),
    // Of een taalmodel betrokken was bij de VERWOORDING (nooit bij het rekenen).
    aiUsed: text("ai_used").notNull().default("nee"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("computation_traces_user_subject_idx").on(
      t.clerkId,
      t.subjectType,
      t.subjectId,
    ),
  ],
);

export const insertComputationTraceSchema = createInsertSchema(
  computationTracesTable,
);
export const selectComputationTraceSchema = createSelectSchema(
  computationTracesTable,
);
export type ComputationTrace = typeof computationTracesTable.$inferSelect;
export type NewComputationTrace = typeof computationTracesTable.$inferInsert;
