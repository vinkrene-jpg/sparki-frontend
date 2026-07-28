/**
 * system_business_mode — één rij, singleton.
 * Bedrijfsmodus van de hele Sparki-dienst. De frontend toont uitsluitend de
 * toestand en mag hem NOOIT zelf bepalen of overschrijven.
 * Gebaseerd op solo_founder_continuity_and_shutdown.section_1 (YAML v2.84).
 *
 * Lezen: zelfde gecachte patroon als kill_switches (10 s TTL, fail-open).
 * Schrijven: uitsluitend via POST /api/admin/system-mode (admin-gated).
 */

import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Alle geldige modi (volgorde = escalatieniveau).
export const systemBusinessModes = [
  "NORMAL",
  "DEGRADED",
  "MAINTENANCE",
  "SALES_PAUSED",
  "BILLING_PAUSED",
  "SERVICE_SHUTDOWN",
] as const;

export type SystemBusinessMode = (typeof systemBusinessModes)[number];

export const systemBusinessModeTable = pgTable("system_business_mode", {
  /** Altijd 1 — singleton-rij. */
  id: integer("id").primaryKey().default(1),
  mode: text("mode")
    .$type<SystemBusinessMode>()
    .notNull()
    .default("NORMAL"),
  /** Mensleesbare reden voor de modus-wijziging, bijv. voor statusberichten. */
  reason: text("reason"),
  /** Clerk-ID van de beheerder die de wijziging doorvoerde. */
  changedByClerkId: text("changed_by_clerk_id"),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const selectSystemBusinessModeSchema = createSelectSchema(
  systemBusinessModeTable,
);
export const insertSystemBusinessModeSchema = createInsertSchema(
  systemBusinessModeTable,
);

export type SystemBusinessModeRow = typeof systemBusinessModeTable.$inferSelect;
export type InsertSystemBusinessMode =
  typeof systemBusinessModeTable.$inferInsert;
