import {
  pgTable,
  serial,
  text,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// An athlete's answer to one of Sparki's daily follow-up questions. The answer is
// real input from the athlete (never fabricated) and is fed straight back into
// the next coach analysis so the advice can change. One answer per question per
// analysis day; re-answering updates the same row.
export const coachFollowupAnswersTable = pgTable(
  "coach_followup_answers",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // The day the analysis was for (YYYY-MM-DD). Scopes answers to "today".
    analysisDate: date("analysis_date").notNull(),
    // The follow-up question id (engine-internal key, e.g. "fresh_but_fatigued").
    questionId: text("question_id").notNull(),
    // The chosen option value (engine-internal key, e.g. "benen_zwaar").
    answer: text("answer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("unique_followup_answer").on(
      t.clerkId,
      t.analysisDate,
      t.questionId,
    ),
  ],
);

export const insertCoachFollowupAnswerSchema = createInsertSchema(
  coachFollowupAnswersTable,
).omit({ id: true });
export const selectCoachFollowupAnswerSchema = createSelectSchema(
  coachFollowupAnswersTable,
);

export type CoachFollowupAnswer =
  typeof coachFollowupAnswersTable.$inferSelect;
export type InsertCoachFollowupAnswer = z.infer<
  typeof insertCoachFollowupAnswerSchema
>;
