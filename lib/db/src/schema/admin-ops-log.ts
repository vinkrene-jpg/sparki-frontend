/**
 * admin_ops_log — onveranderlijk auditlogboek voor beheerdersacties.
 * Registreert ALLE acties van beheerders (modus-wijzigingen, kill-switch-
 * wijzigingen, entitlement-acties, etc.). Rijen worden NOOIT verwijderd.
 *
 * Gebaseerd op ai_operations_and_technical_helpdesk.security_baseline
 * (YAML v2.84): "FULL_AUDIT_LOG", "LOG_TAMPER_RESISTANCE".
 *
 * Verschil met security_audit_log (lib/security): die logt veiligheidsgebeurtenissen
 * (rate-limit, auth-fouten). admin_ops_log logt beheerdersbesluiten.
 */

import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const adminOpsLogTable = pgTable("admin_ops_log", {
  id: serial("id").primaryKey(),
  /** Soort actie, bijv. "system_mode_change", "kill_switch_toggle", "entitlement_revoke". */
  action: text("action").notNull(),
  /** Clerk-ID van de beheerder die de actie uitvoerde. */
  actorClerkId: text("actor_clerk_id").notNull(),
  /** Toestand vóór de wijziging (schema-agnostisch). */
  previousState: jsonb("previous_state"),
  /** Toestand ná de wijziging. */
  newState: jsonb("new_state"),
  /** Optionele toelichting van de beheerder. */
  reason: text("reason"),
  /** IP-adres van de beheerder (alleen voor auditdoeleinden, nooit in antwoorden). */
  actorIp: text("actor_ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const selectAdminOpsLogSchema = createSelectSchema(adminOpsLogTable);

export type AdminOpsLogRow = typeof adminOpsLogTable.$inferSelect;
export type InsertAdminOpsLog = typeof adminOpsLogTable.$inferInsert;

/** Schrijf één admin-ops-logregel. Fire-and-forget — fouten worden gelogd maar niet gegooid. */
export type WriteAdminOpsLogFn = (entry: InsertAdminOpsLog) => Promise<void>;
