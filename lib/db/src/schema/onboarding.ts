import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Persistent onboarding state (replaces fragile localStorage-only completion).
// One row per user. localStorage may cache this, but DB is the source of truth.
export const onboardingStateTable = pgTable("onboarding_state", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  onboardingStartedAt: timestamp("onboarding_started_at", {
    withTimezone: true,
  }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", {
    withTimezone: true,
  }),
  // Phased onboarding (task #18): timestamp the 4-question quick start finished.
  // Once set, the app is usable; remaining profile facts are gathered gradually.
  coreCompletedAt: timestamp("core_completed_at", { withTimezone: true }),
  onboardingVersion: text("onboarding_version").notNull().default("1"),
  completedSteps: jsonb("completed_steps").$type<number[]>().default([]),
  skippedSteps: jsonb("skipped_steps").$type<number[]>().default([]),
  currentStep: integer("current_step").notNull().default(0),
  isComplete: boolean("is_complete").notNull().default(false),
  // Phased onboarding (task #18): per-fact progressive tracking, keyed by fact.
  // Source of truth for "known" is the athlete_profiles value; this records the
  // ask/skip lifecycle so prompts resurface sensibly without nagging.
  progressiveFacts: jsonb("progressive_facts")
    .$type<
      Record<
        string,
        {
          status: "asked" | "answered" | "skipped";
          askedCount?: number;
          lastAskedAt?: string;
          skippedUntil?: string;
        }
      >
    >()
    .default({}),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertOnboardingStateSchema = createInsertSchema(
  onboardingStateTable,
);
export const selectOnboardingStateSchema =
  createSelectSchema(onboardingStateTable);

export type OnboardingState = typeof onboardingStateTable.$inferSelect;
export type InsertOnboardingState = z.infer<
  typeof insertOnboardingStateSchema
>;
