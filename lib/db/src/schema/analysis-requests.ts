// ANALYSE_UITBREIDING §3 — Analyse op verzoek.
//
// Elke door de gebruiker gevraagde analyse wordt bewaard mét de selectie en de
// periode, zodat hij terugleesbaar is en dezelfde selectie over dezelfde
// periode hetzelfde antwoord geeft (geen gokautomaat): bij een ongewijzigde
// data-digest wordt de bewaarde tekst teruggegeven in plaats van een nieuwe
// modelaanroep.

import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const analysisRequestsTable = pgTable(
  "analysis_requests",
  {
    id: serial("id").primaryKey(),
    clerkId: varchar("clerk_id", { length: 64 }).notNull(),
    /** Gekozen kaarten (registry-keys), gesorteerd — onderdeel van de sleutel. */
    kaarten: jsonb("kaarten").notNull(),
    periodeDays: integer("periode_days").notNull(),
    /** Digest over de deterministische uitkomsten + selectie + periode. */
    dataDigest: varchar("data_digest", { length: 64 }).notNull(),
    /** Deterministische engine-uitkomsten waarop de tekst is gebaseerd. */
    uitkomsten: jsonb("uitkomsten").notNull(),
    /** De geformuleerde analyse (model formuleert, engines rekenen). */
    tekst: text("tekst").notNull(),
    adviceDossierId: integer("advice_dossier_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("analysis_requests_clerk_idx").on(t.clerkId, t.createdAt),
    index("analysis_requests_digest_idx").on(t.clerkId, t.dataDigest),
  ],
);

export type AnalysisRequestRow = typeof analysisRequestsTable.$inferSelect;
