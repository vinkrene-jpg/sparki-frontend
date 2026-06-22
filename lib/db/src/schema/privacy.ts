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
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  consentVersion: text("consent_version").notNull().default("1"),
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
  acceptedPrivacyAt: timestamp("accepted_privacy_at", { withTimezone: true }),
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
  aiMemoryEnabled: boolean("ai_memory_enabled").notNull().default(true),
  aiSensitiveAnalysisEnabled: boolean("ai_sensitive_analysis_enabled")
    .notNull()
    .default(true),
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

// Append-only audit trail for consent / privacy changes.
export const consentAuditLogTable = pgTable("consent_audit_log", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
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
