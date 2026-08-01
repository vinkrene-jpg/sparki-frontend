import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Privacy / consent foundation. One row per user (keyed by clerkId).
// Minor athletes set parent_consent_required = true and the parent consent flow
// is represented here (no external legal text — just the product controls).

export const parentConsentStatuses = [
  "not_required",
  "pending",
  "accepted",
  "declined",
] as const;
export type ParentConsentStatus = (typeof parentConsentStatuses)[number];

export const dataSharingCoachLevels = ["none", "summary", "full"] as const;
export type DataSharingCoachLevel = (typeof dataSharingCoachLevels)[number];

export const dataSharingParentLevels = [
  "none",
  "safety_only",
  "summary",
] as const;
export type DataSharingParentLevel = (typeof dataSharingParentLevels)[number];

export const privacySettingsTable = pgTable("privacy_settings", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  consentVersion: text("consent_version").notNull().default("1"),
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
  acceptedPrivacyAt: timestamp("accepted_privacy_at", { withTimezone: true }),
  // Welke documentversie precies is geaccepteerd (gekoppeld aan legal_documents).
  acceptedTermsVersion: text("accepted_terms_version"),
  acceptedPrivacyVersion: text("accepted_privacy_version"),
  parentConsentRequired: boolean("parent_consent_required")
    .notNull()
    .default(false),
  parentConsentStatus: text("parent_consent_status")
    .notNull()
    .default("not_required"),
  dataSharingCoach: text("data_sharing_coach").notNull().default("summary"),
  dataSharingParent: text("data_sharing_parent")
    .notNull()
    .default("safety_only"),
  // ── Aparte, intrekbare toestemmingen voor externe modelverwerking ─────────
  // Fail-closed: ontbrekend bewijs (geen rij, of kolom false) = geen toestemming.
  // Standaard UIT — de gebruiker zet ze expliciet aan in de instellingen.
  aiMemoryEnabled: boolean("ai_memory_enabled").notNull().default(false),
  aiSensitiveAnalysisEnabled: boolean("ai_sensitive_analysis_enabled")
    .notNull()
    .default(false),
  // Gezondheids- en mentale analyse (voeding, vermoeidheid, stemming).
  aiHealthAnalysisEnabled: boolean("ai_health_analysis_enabled")
    .notNull()
    .default(false),
  // Foto-/beeldanalyse (materiaalfoto's, voedingsfoto's, Foto-lab).
  aiVisionEnabled: boolean("ai_vision_enabled").notNull().default(false),
  // Documentanalyse (wedstrijdgidsen, technische documenten).
  aiDocumentAnalysisEnabled: boolean("ai_document_analysis_enabled")
    .notNull()
    .default(false),
  // Gepersonaliseerde coaching-formulering (dagupdate, chat, plan-uitleg).
  aiCoachingEnabled: boolean("ai_coaching_enabled").notNull().default(false),
  // Friend feed sharing. Fail-closed: off by default, so a friend never sees
  // your activity updates (training afgerond, wedstrijd gepland, rustdag) until
  // you explicitly opt in. Sensitive states (ziek/blessure) are never shared.
  shareActivityWithFriends: boolean("share_activity_with_friends")
    .notNull()
    .default(false),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  exportAllowed: boolean("export_allowed").notNull().default(true),
  deleteRequestedAt: timestamp("delete_requested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── SPARKI_BUILD_01 F1 — centrale toestemmingsservice ──────────────────────
// Eén gedeelde consent-status-enumeratie voor frontend én backend (BB-01).
// Legacy-waarden ("accepted") worden via normalizeConsentStatus gemapt; nieuwe
// code gebruikt uitsluitend deze zes statussen.
export const consentStatuses = [
  "not_required",
  "pending",
  "granted",
  "declined",
  "revoked",
  "expired",
] as const;
export type ConsentStatus = (typeof consentStatuses)[number];

/** Map een legacy parent-consent-waarde naar de gedeelde enumeratie. */
export function normalizeConsentStatus(value: string | null | undefined): ConsentStatus {
  if (value === "accepted" || value === "granted") return "granted";
  if (value === "declined") return "declined";
  if (value === "revoked") return "revoked";
  if (value === "expired") return "expired";
  if (value === "not_required") return "not_required";
  // Onbekend of ontbrekend = strengste regime: er is géén toestemming.
  return "pending";
}

export const consentGrantTypes = [
  "parental_consent", // ouderlijke toestemming voor deelname van een minderjarige
  "medical_data_access", // afzonderlijke toestemming voor inzage medisch dossier
  "nutrition_data_access", // afzonderlijke toestemming voedingsbegeleiding
  "media_publication", // beeldmateriaal publiceren
  "data_sharing", // gegevens delen buiten de standaardrelatie
] as const;
export type ConsentGrantType = (typeof consentGrantTypes)[number];

// consent_grant (bouwpakket 01 §4.1): wie (grantor) gaf welke toestemming voor
// wie (subject), op welke grondslag, uit welke bron, tot wanneer geldig.
export const consentGrantsTable = pgTable("consent_grants", {
  id: serial("id").primaryKey(),
  subjectClerkId: text("subject_clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  grantorClerkId: text("grantor_clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  // Grondslag: waarom deze toestemming rechtsgeldig is (bijv. "ouderlijk gezag").
  legalBasis: text("legal_basis"),
  // Bron: waar de toestemming vandaan komt (web/pwa/mobiel/migratie:…).
  source: text("source").notNull().default("web"),
  // Herbevestiging bij de eerstvolgende relevante leeftijdsgrens (16/18).
  reconfirmationDueAt: timestamp("reconfirmation_due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConsentGrant = typeof consentGrantsTable.$inferSelect;

// Append-only audit trail for consent / privacy changes.
export const consentAuditLogTable = pgTable("consent_audit_log", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: text("changed_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPrivacySettingsSchema = createInsertSchema(
  privacySettingsTable,
);
export const selectPrivacySettingsSchema =
  createSelectSchema(privacySettingsTable);
export const insertConsentAuditLogSchema = createInsertSchema(
  consentAuditLogTable,
).omit({ id: true });

export type PrivacySettings = typeof privacySettingsTable.$inferSelect;
export type InsertPrivacySettings = z.infer<typeof insertPrivacySettingsSchema>;
export type ConsentAuditLogEntry = typeof consentAuditLogTable.$inferSelect;
