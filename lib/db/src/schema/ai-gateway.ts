// AI-gateway logging (Golf 25) — herleidbaarheid van iedere modelaanroep.
// Bewust GEEN volledige prompt- of antwoordinhoud: alleen metadata (doel,
// provider/model, promptversie, inputcategorieën, toestemming, resultaat,
// latency, tokens en kostenindicatie). Inhoud blijft in de eigen domeintabellen
// (document_analyses, ai_observations, …) waar hij al privacy-gated staat.
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Resultaatstatus van een aanroep via de gateway.
export const AI_CALL_STATUSES = [
  "ok", // geslaagd en gevalideerd
  "fallback", // provider faalde; deterministische fallback gebruikt
  "rejected", // uitvoer afgekeurd door validatie (schema/lengte/inhoud)
  "blocked_consent", // niet uitgevoerd: toestemming ontbreekt of ingetrokken
  "blocked_minor", // niet uitgevoerd: strengere jeugdbegrenzing
  "blocked_killswitch", // niet uitgevoerd: kill switch actief
  "blocked_flag", // niet uitgevoerd: featureflag uit
  "timeout", // provider antwoordde niet binnen de limiet
  "error", // provider- of netwerkfout
] as const;
export type AiCallStatus = (typeof AI_CALL_STATUSES)[number];

export const aiCallLogsTable = pgTable(
  "ai_call_logs",
  {
    id: serial("id").primaryKey(),
    // Voor wie de aanroep liep (null bij systeem-/beheerdersjobs).
    clerkId: text("clerk_id"),
    // Doel uit het centrale doelenregister (bijv. "brief", "document_analysis").
    purpose: text("purpose").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    // Toegestane inputcategorieën van dit doel op het moment van aanroep.
    inputCategories: text("input_categories").array().notNull().default([]),
    // Toestemmingsbeoordeling: "granted" | "not_required" | "revoked" | "missing".
    consent: text("consent").notNull(),
    status: text("status").notNull(),
    // Of er identificerende gegevens/geheimen zijn weggehaald vóór verzending.
    redactionApplied: boolean("redaction_applied").notNull().default(false),
    retries: integer("retries").notNull().default(0),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    // Kostenindicatie in microdollars (1e-6 USD) — schatting op tokenprijs.
    costMicroUsd: integer("cost_micro_usd"),
    // Korte technische foutcode — NOOIT gevoelige inhoud.
    errorCode: text("error_code"),
    releaseVersion: text("release_version"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ai_call_logs_purpose_created_idx").on(t.purpose, t.createdAt),
    index("ai_call_logs_created_idx").on(t.createdAt),
  ],
);

export const insertAiCallLogSchema = createInsertSchema(aiCallLogsTable).omit({
  id: true,
});
export const selectAiCallLogSchema = createSelectSchema(aiCallLogsTable);
export type AiCallLog = typeof aiCallLogsTable.$inferSelect;
