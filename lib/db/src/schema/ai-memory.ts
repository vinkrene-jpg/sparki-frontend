import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Persistent AI memory (Sprint: AI Memory & Core Data Foundation).
//
// NOTE ON IDENTITY: the sprint spec uses `athlete_id`. We deliberately key off
// `clerkId` (text FK → user_profiles) like every other table to avoid creating a
// second, parallel identity concept. "athlete_id" in the spec == clerkId here.
//
// Persistence is privacy-gated: when privacy_settings.ai_memory_enabled is false,
// only `system` source observations may be written (see ai-memory service).

export const aiObservationSourceTypes = [
  "daily_briefing",
  "ai_chat",
  "training_analysis",
  "recovery_analysis",
  "race_analysis",
  "nutrition_analysis",
  "connection_analysis",
  "manual_note",
  "system",
] as const;
export type AiObservationSourceType = (typeof aiObservationSourceTypes)[number];

export const aiObservationConfidences = ["low", "medium", "high"] as const;
export type AiObservationConfidence = (typeof aiObservationConfidences)[number];

export const aiObservationCategories = [
  "training",
  "recovery",
  "race",
  "nutrition",
  "hydration",
  "equipment",
  "mental",
  "planning",
  "health",
  "general",
] as const;
export type AiObservationCategory = (typeof aiObservationCategories)[number];

export const aiObservationSeverities = [
  "info",
  "watch",
  "important",
  "urgent",
] as const;
export type AiObservationSeverity = (typeof aiObservationSeverities)[number];

// One concrete signal Sparki weighed when forming a connection. `kind` groups the
// signal by domain so the UI can label/color it; `value` is the human-readable
// reading (e.g. "5.4 u", "rustHR 58"); `date` anchors it in time.
export type ObservationSignal = {
  kind:
    | "training"
    | "sleep"
    | "recovery"
    | "race"
    | "feedback"
    | "memory";
  label: string;
  value: string;
  date?: string;
};

export const aiObservationStatuses = [
  "new",
  "acknowledged",
  "saved",
  "dismissed",
  "outdated",
] as const;
export type AiObservationStatus = (typeof aiObservationStatuses)[number];

export const aiObservationsTable = pgTable(
  "ai_observations",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    sourceType: text("source_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    observationText: text("observation_text").notNull(),
    confidence: text("confidence").notNull().default("medium"),
    category: text("category").notNull().default("general"),
    severity: text("severity").notNull().default("info"),
    detectedPattern: text("detected_pattern"),
    supportingDataRefs: jsonb("supporting_data_refs"),
    // Explainable connections: the concrete signals Sparki weighed, a precise
    // 0..1 confidence score, and honest alternative explanations. These power the
    // "which signals / how sure / what else could it be" surface in the UI.
    signals: jsonb("signals").$type<ObservationSignal[]>(),
    alternativeExplanations: jsonb("alternative_explanations").$type<string[]>(),
    confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 }),
    recommendedAction: text("recommended_action"),
    // Herleidbaarheid (Afbouwgolf 4): welke engine en regel deze conclusie
    // produceerde, onder welke softwareversie, en welke data ontbrak. Samen met
    // signals/confidenceScore/createdAt vormt dit de volledige verantwoording.
    engine: text("engine"),
    ruleKey: text("rule_key"),
    engineVersion: text("engine_version"),
    missingData: jsonb("missing_data").$type<string[]>(),
    status: text("status").notNull().default("new"),
    // Stable hash of (category + detectedPattern/title) used to skip re-saving the
    // same observation. Null for free-form manual notes.
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    index("ai_obs_clerk_status_idx").on(t.clerkId, t.status),
    index("ai_obs_dedupe_idx").on(t.clerkId, t.dedupeKey),
  ],
);

export const aiMemoryEventTypes = [
  "briefing_generated",
  "observation_created",
  "user_acknowledged",
  "user_dismissed",
  "user_saved",
  "model_updated",
  "recommendation_followed",
] as const;
export type AiMemoryEventType = (typeof aiMemoryEventTypes)[number];

export const aiMemoryEventsTable = pgTable("ai_memory_events", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  eventType: text("event_type").notNull(),
  relatedObservationId: integer("related_observation_id").references(
    () => aiObservationsTable.id,
    { onDelete: "set null" },
  ),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const aiCommunicationStyles = [
  "direct",
  "supportive",
  "analytical",
  "concise",
  "detailed",
] as const;
export type AiCommunicationStyle = (typeof aiCommunicationStyles)[number];

export const aiCoachingIntensities = ["low", "normal", "high"] as const;
export type AiCoachingIntensity = (typeof aiCoachingIntensities)[number];

export const aiExplanationLevels = ["simple", "normal", "expert"] as const;
export type AiExplanationLevel = (typeof aiExplanationLevels)[number];

// Centraal instelbaar humorniveau — "Instellingen > Sparki-stijl > Humor".
export const humorLevels = ["uit", "subtiel", "normaal", "uitgesproken"] as const;
export type HumorLevel = (typeof humorLevels)[number];

export const aiPreferencesTable = pgTable("ai_preferences", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  communicationStyle: text("communication_style")
    .notNull()
    .default("supportive"),
  coachingIntensity: text("coaching_intensity").notNull().default("normal"),
  explanationLevel: text("explanation_level").notNull().default("normal"),
  humorLevel: text("humor_level").notNull().default("normaal"),
  sensitiveTopics: jsonb("sensitive_topics").$type<string[]>().default([]),
  preferredUnits: text("preferred_units").notNull().default("metric"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAiObservationSchema = createInsertSchema(
  aiObservationsTable,
).omit({ id: true });
export const selectAiObservationSchema = createSelectSchema(aiObservationsTable);
export const insertAiMemoryEventSchema = createInsertSchema(
  aiMemoryEventsTable,
).omit({ id: true });
export const insertAiPreferenceSchema = createInsertSchema(aiPreferencesTable);
export const selectAiPreferenceSchema = createSelectSchema(aiPreferencesTable);

export type AiObservation = typeof aiObservationsTable.$inferSelect;
export type InsertAiObservation = z.infer<typeof insertAiObservationSchema>;
export type AiMemoryEvent = typeof aiMemoryEventsTable.$inferSelect;
export type InsertAiMemoryEvent = z.infer<typeof insertAiMemoryEventSchema>;
export type AiPreference = typeof aiPreferencesTable.$inferSelect;
export type InsertAiPreference = z.infer<typeof insertAiPreferenceSchema>;
