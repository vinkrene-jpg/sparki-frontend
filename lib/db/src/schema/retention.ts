// SPARKI_BUILD_04 F11 — wettelijke bewaartermijnen, centraal configureerbaar.
//
// Bindend: NERGENS een hardcoded bewaartermijn in de code. Dit register is
// de enige plek; er worden hier bewust GEEN juridische standaardwaarden
// geseed — een termijn is pas van kracht als hij expliciet is vastgelegd
// (open juridisch besluit; zie takenlijst J-besluiten). Consumers die iets
// zouden willen opruimen MOETEN eerst dit register raadplegen en bij een
// ontbrekende termijn niets verwijderen (fail-closed: bewaren).

import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const retentionPoliciesTable = pgTable("retention_policies", {
  // bv. "trainer_invoices", "trainer_clients", "trainer_documents"
  key: text("key").primaryKey(),
  retentionDays: integer("retention_days"), // NULL = nog niet vastgesteld
  note: text("note"),
  updatedByClerkId: text("updated_by_clerk_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RetentionPolicy = typeof retentionPoliciesTable.$inferSelect;
