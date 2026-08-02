import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Onveranderbaar beveiligings-auditlog ─────────────────────────────────────
// Append-only: er bestaat bewust GEEN update/delete-pad in de applicatie.
// clerk_id-kolommen zijn hier met opzet NIET foreign-keyed: het auditlog moet
// een verwijderd account blijven documenteren (het verwijderverzoek zelf staat
// erin). PII wordt geminimaliseerd: geen inhoud, alleen gebeurtenis + context.
export const securityEventKinds = [
  "login",
  "login_failed",
  "consent_change",
  "role_change",
  // SPARKI_BUILD_04: zelfstandige trainer registreert / wijzigt bedrijfsgegevens.
  "trainer_register",
  "trainer_business_update",
  "link_change",
  "data_export",
  "delete_requested",
  "delete_cancelled",
  "delete_executed",
  "sessions_ended",
  "connector_revoked",
  "viewed_by_coach",
  "changed_by_coach",
  "viewed_by_parent",
  "reported_by_parent",
  "parent_permissions_changed",
  "viewed_by_admin",
  "rate_limited",
  "auth_denied",
  "upload_rejected",
  "suspicious",
  // Golf 14 — beheeracties voor gecontroleerde uitrol (append-only vastgelegd).
  "flag_changed",
  "kill_switch_changed",
  "pilot_access_changed",
  "version_requirement_changed",
  "rollout_autostop",
  "rollback_recorded",
  "release_note_published",
  // Golf 18 — Sparki World (veilige sociale omgeving).
  "share_changed",
  "user_blocked",
  "user_unblocked",
  "content_reported",
  "moderation_action",
  // Golf 27 — AI-helpdesk & supportautomatisering (beheeracties).
  "support_ticket_changed",
  "support_reply_sent",
  "support_known_issue_changed",
  "support_article_published",
  // Entitlement-fundament — commerciële rechten gescheiden van feature-flags.
  "entitlement_mode_changed",
  "entitlement_granted",
  "entitlement_revoked",
  "entitlements_viewed_by_admin",
] as const;
export type SecurityEventKind = (typeof securityEventKinds)[number];

export const securityAuditLogTable = pgTable("security_audit_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  event: text("event").notNull(),
  // Wie handelde (kan admin/coach/ouder zijn) en over wie het gaat.
  actorClerkId: text("actor_clerk_id"),
  subjectClerkId: text("subject_clerk_id"),
  // Korte, PII-arme context (route, doel, uitzonderingen). Nooit tokens,
  // wachtwoorden of gezondheids-/prestatie-inhoud.
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  ip: text("ip"),
});

export const insertSecurityAuditLogSchema = createInsertSchema(
  securityAuditLogTable,
);
export type SecurityAuditLogEntry = typeof securityAuditLogTable.$inferSelect;
export type InsertSecurityAuditLog = z.infer<
  typeof insertSecurityAuditLogSchema
>;

// ── Juridische documenten (privacyverklaring, gebruiksvoorwaarden) ───────────
// Definitieve, configureerbare teksten met versiebeheer. De hoogste
// published_at per kind is de actieve versie.
export const legalDocumentKinds = ["privacy", "terms"] as const;
export type LegalDocumentKind = (typeof legalDocumentKinds)[number];

export const legalDocumentsTable = pgTable(
  "legal_documents",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    version: text("version").notNull(),
    title: text("title").notNull(),
    // Markdown-inhoud, volledig en definitief (geen placeholders).
    bodyMd: text("body_md").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("legal_documents_kind_version").on(t.kind, t.version)],
);

export type LegalDocument = typeof legalDocumentsTable.$inferSelect;
