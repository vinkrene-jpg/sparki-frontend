import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// ── Adaptive coaching profile (begeleidingsprofiel) ──────────────────────────
// The behavioural/motivational/social side of the Athlete Profile engine. Eight
// dimensions describe HOW an athlete wants to be guided (distinct from the
// physical metrics in athlete_profiles). Each dimension's current best value is
// stored in its own column; `tallies` holds the weighted evidence gathered over
// time from onboarding answers, daily check-ins, completed trainings and
// connector imports — so the profile updates continuously and is explainable,
// never a one-shot survey dump. One row per athlete (clerkId).
export const coachingProfilesTable = pgTable("coaching_profiles", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .unique()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),

  // 1. How the athlete approaches training: structured | flexible | spontaneous
  behaviorStyle: text("behavior_style"),
  // 2. What drives them: intrinsic | competitive | social | health
  motivationType: text("motivation_type"),
  // 3. How much hands-on guidance they want: high | medium | low
  guidanceNeed: text("guidance_need"),
  // 4. Preferred coaching voice: direct | supportive | analytical
  communicationStyle: text("communication_style"),
  // 5. How they take in advice: practical | visual | theoretical | data
  learningPreference: text("learning_preference"),
  // 6. How decisions get made: autonomous | collaborative | directed
  decisionMaking: text("decision_making"),
  // 7. Need for mental/emotional support: high | medium | low
  mentalSupportNeed: text("mental_support_need"),
  // 8. What success means to them: process | outcome | mastery
  goalOrientation: text("goal_orientation"),

  // Weighted evidence per dimension: { [dimensionKey]: { [optionValue]: weight } }.
  // The column value above is the running arg-max of its tally. Confidence is
  // derived from the tally (total samples + winning margin) at read time.
  tallies: jsonb("tallies")
    .$type<Record<string, Record<string, number>>>()
    .notNull()
    .default({}),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCoachingProfileSchema = createInsertSchema(
  coachingProfilesTable,
).omit({ id: true });
export const selectCoachingProfileSchema =
  createSelectSchema(coachingProfilesTable);

export type CoachingProfile = typeof coachingProfilesTable.$inferSelect;
export type InsertCoachingProfile = z.infer<typeof insertCoachingProfileSchema>;
