import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Feedbacklus op analyses (Afbouwgolf 4).
//
// Eén tabel is zowel de feedback-registratie als de kwaliteitsregistratie:
// bij ieder oordeel wordt de volledige berekeningscontext (engine, regel,
// zekerheid, versie, ontbrekende data) als momentopname in `context` bewaard,
// zonder persoonsinhoud (geen observatietekst, geen gezondheidsdetails).
//
// Idempotentie: één rij per (actor, subjectType, subjectKey) — nieuwe feedback
// op hetzelfde onderwerp overschrijft het eerdere oordeel (upsert), er ontstaan
// nooit dubbele meldingen.
//
// VEILIGHEIDSREGEL: feedback wordt UITSLUITEND geregistreerd en geaggregeerd.
// Geen enkel schrijfpad mag op basis van deze tabel automatisch medische,
// trainings- of veiligheidsregels aanpassen.

export const analysisFeedbackVerdicts = [
  "nuttig",
  "al_bekend",
  "niet_relevant",
  "onjuist",
  "opgevolgd",
  "niet_opgevolgd",
] as const;
export type AnalysisFeedbackVerdict = (typeof analysisFeedbackVerdicts)[number];

// Welke soort conclusie beoordeeld wordt. subjectKey identificeert het concrete
// onderwerp binnen dat type (bijv. observation:<id>, analysis:<datum>,
// proposal:<workoutId>).
export const analysisFeedbackSubjectTypes = [
  "observation",
  "coach_analysis",
  "recovery_advice",
  "plan_adjustment",
  "coach_proposal",
  "state",
] as const;
export type AnalysisFeedbackSubjectType =
  (typeof analysisFeedbackSubjectTypes)[number];

// Vaste redenen bij "onjuist" / "niet_relevant" (vrije tekst mag ook).
export const analysisFeedbackReasonCodes = [
  "klopt_niet_met_gevoel",
  "data_onvolledig",
  "verouderd",
  "verkeerde_situatie",
  "te_voorzichtig",
  "te_streng",
  "anders",
] as const;
export type AnalysisFeedbackReasonCode =
  (typeof analysisFeedbackReasonCodes)[number];

// Werkelijk uitgevoerde actie (punt 8) — registratie, geen causale conclusie.
export const analysisFeedbackActionKinds = [
  "training_aangepast",
  "rust_genomen",
  "training_uitgevoerd",
  "materiaal_gecontroleerd",
] as const;
export type AnalysisFeedbackActionKind =
  (typeof analysisFeedbackActionKinds)[number];

// Momentopname van de berekeningscontext waarop het oordeel sloeg.
export type AnalysisFeedbackContext = {
  engine: string | null;
  ruleKey: string | null;
  engineVersion: string | null;
  confidenceScore: number | null;
  confidenceLevel: string | null;
  severity: string | null;
  category: string | null;
  missingData: string[];
  computedAt: string | null;
};

export const analysisFeedbackTable = pgTable(
  "analysis_feedback",
  {
    id: serial("id").primaryKey(),
    /** De sporter over wie de conclusie ging. */
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    /** Wie het oordeel gaf (sporter zelf of een gekoppelde coach). */
    actorClerkId: text("actor_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    actorRole: text("actor_role").notNull().default("athlete"),
    subjectType: text("subject_type").notNull(),
    subjectKey: text("subject_key").notNull(),
    verdict: text("verdict").notNull(),
    reasonCode: text("reason_code"),
    reasonText: text("reason_text"),
    actionKind: text("action_kind"),
    /** Momentopname van de berekeningscontext (kwaliteitsregistratie). */
    context: jsonb("context").$type<AnalysisFeedbackContext>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("analysis_feedback_actor_subject_uq").on(
      t.actorClerkId,
      t.subjectType,
      t.subjectKey,
    ),
    index("analysis_feedback_clerk_idx").on(t.clerkId),
    index("analysis_feedback_verdict_idx").on(t.verdict),
  ],
);

export const insertAnalysisFeedbackSchema = createInsertSchema(
  analysisFeedbackTable,
).omit({ id: true });
export const selectAnalysisFeedbackSchema =
  createSelectSchema(analysisFeedbackTable);

export type AnalysisFeedback = typeof analysisFeedbackTable.$inferSelect;
export type InsertAnalysisFeedback = z.infer<
  typeof insertAnalysisFeedbackSchema
>;
