import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Nutrition / hydration v1 — a minimal useful foundation (not a full nutrition
// app). AI nutrition observations are derived from these rows and stored in
// ai_observations (sourceType = nutrition_analysis).

export const nutritionContexts = [
  "normal_day",
  "training_day",
  "race_day",
  "recovery_day",
] as const;
export type NutritionContext = (typeof nutritionContexts)[number];

export const nutritionHydrationLogsTable = pgTable(
  "nutrition_hydration_logs",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    context: text("context").notNull().default("normal_day"),
    preTrainingFood: text("pre_training_food"),
    duringTrainingCarbsGrams: integer("during_training_carbs_grams"),
    duringTrainingFluidMl: integer("during_training_fluid_ml"),
    duringTrainingSodiumMg: integer("during_training_sodium_mg"),
    postTrainingFood: text("post_training_food"),
    bodyWeightBefore: numeric("body_weight_before", {
      precision: 5,
      scale: 2,
    }),
    bodyWeightAfter: numeric("body_weight_after", { precision: 5, scale: 2 }),
    stomachIssues: boolean("stomach_issues").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("nutrition_clerk_date_idx").on(t.clerkId, t.logDate)],
);

export const insertNutritionHydrationLogSchema = createInsertSchema(
  nutritionHydrationLogsTable,
).omit({ id: true });
export const selectNutritionHydrationLogSchema = createSelectSchema(
  nutritionHydrationLogsTable,
);

export type NutritionHydrationLog =
  typeof nutritionHydrationLogsTable.$inferSelect;
export type InsertNutritionHydrationLog = z.infer<
  typeof insertNutritionHydrationLogSchema
>;
