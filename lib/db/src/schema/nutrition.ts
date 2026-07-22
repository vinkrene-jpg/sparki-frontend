import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
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
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
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
    // Ervaren energie tijdens/na de inspanning (1 = leeg, 5 = sterk). Optioneel,
    // alleen wat de sporter zelf aangeeft — nooit afgeleid of verzonnen.
    energyFeel: integer("energy_feel"),
    notes: text("notes"),
    // Optional real photos of the meal/drink, stored in object storage (owner ACL).
    // Only normalized object paths ("/objects/...") are kept here, never raw bytes.
    photoPaths: jsonb("photo_paths").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("nutrition_clerk_date_idx").on(t.clerkId, t.logDate)],
);

// Season goal — steers the nutrition day-planning for adult athletes (17+).
// The athlete states when the race season starts, when the season peak lies
// and what their target weight is; Sparki derives an honest, safe steering
// (never crash diets, fueling the training always comes first). One row per
// athlete, always adjustable. NOT used for athletes under 17 (RED-S safety).
export const nutritionSeasonGoalsTable = pgTable("nutrition_season_goals", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .unique()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  seasonStartDate: date("season_start_date"),
  peakDate: date("peak_date"),
  targetWeightKg: numeric("target_weight_kg", { precision: 5, scale: 2 }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type NutritionSeasonGoal = typeof nutritionSeasonGoalsTable.$inferSelect;

// Voedingsvoorkeuren & context van de sporter — alleen relevante velden, door
// de sporter zelf ingevuld. Verwerking in analyses/advies gebeurt uitsluitend
// met expliciete toestemming (consentAt gezet); zonder toestemming worden deze
// velden nergens in prompts of adviezen gebruikt (fail-closed).
export const nutritionPreferencesTable = pgTable("nutrition_preferences", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .unique()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Allergieën/intoleranties in eigen woorden (bv. "lactose, pinda").
  allergies: text("allergies"),
  // Voedingsvoorkeuren (bv. vegetarisch, geen gels).
  preferences: text("preferences"),
  // Producten die de sporter echt in huis/beschikbaar heeft.
  availableProducts: text("available_products"),
  // Persoonlijke maag-darmervaringen (bv. "gels vallen zwaar bij hoge intensiteit").
  gutExperiences: text("gut_experiences"),
  // Toestemming om bovenstaande gegevens te verwerken in advies en analyses.
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NutritionPreferences = typeof nutritionPreferencesTable.$inferSelect;

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
