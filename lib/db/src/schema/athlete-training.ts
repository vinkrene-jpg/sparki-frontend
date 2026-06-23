import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

export const trainingSessionsTable = pgTable("training_sessions", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  sessionDate: date("session_date").notNull(),
  type: text("type").notNull().default("ride"),
  title: text("title"),
  durationMin: integer("duration_min"),
  distanceKm: numeric("distance_km", { precision: 7, scale: 2 }),
  elevationM: integer("elevation_m"),
  normalizedPower: integer("normalized_power"),
  avgPower: integer("avg_power"),
  avgHR: integer("avg_hr"),
  tss: integer("tss"),
  intensityFactor: numeric("intensity_factor", { precision: 4, scale: 3 }),
  notes: text("notes"),
  feelScore: integer("feel_score"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const plannedWorkoutsTable = pgTable("planned_workouts", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  scheduledDate: date("scheduled_date").notNull(),
  type: text("type").notNull().default("ride"),
  title: text("title").notNull(),
  description: text("description"),
  targetDurationMin: integer("target_duration_min"),
  targetTSS: integer("target_tss"),
  structure: jsonb("structure"),
  status: text("status").notNull().default("planned"),
  source: text("source").notNull().default("sparki"),
  sessionId: integer("session_id").references(() => trainingSessionsTable.id, {
    onDelete: "set null",
  }),
  // Autonomous-coaching links (task #17). planId ties a committed session to the
  // generated training plan; routeId attaches a real ORS-generated route to a
  // route-needed session. routeId is a soft reference (plain int) to avoid a
  // circular schema import; ownership is enforced in the route layer.
  planId: integer("plan_id"),
  routeId: integer("route_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Autonomous training plan (task #17) ──────────────────────────────────────
// Header row for a Sparki-generated plan. Stores the input snapshot used, an
// honest plain-language summary, and adaptation state. `mode` records whether
// the plan was produced autonomously (no coach) or as advisory-only output for
// a coached athlete — the autonomous commit path is gated on no accepted coach.
export const trainingPlansTable = pgTable("training_plans", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"), // active | archived
  mode: text("mode").notNull().default("autonomous"), // autonomous | advisory
  weekStartDate: date("week_start_date").notNull(),
  horizonEndDate: date("horizon_end_date").notNull(),
  weeklyHourTarget: integer("weekly_hour_target"),
  // Snapshot of the planning inputs (profile fields + derived phase) used to
  // generate this plan, so we can show what it was based on and adapt honestly.
  inputSnapshot: jsonb("input_snapshot"),
  // Honest plain-language summary of the plan and its reasoning.
  summary: text("summary"),
  // Adaptation bookkeeping: { lastAdaptedAt, adaptationCount, notes[] }.
  adaptationState: jsonb("adaptation_state"),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// One row per day across the ~3-week horizon. The first 7 days are committed
// (also written as planned_workouts); later days are provisional and adapt.
export const planDaysTable = pgTable("plan_days", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => trainingPlansTable.id, { onDelete: "cascade" }),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  dayDate: date("day_date").notNull(),
  weekIndex: integer("week_index").notNull().default(0), // 0,1,2
  // Short focus label, e.g. "Duurtraining", "Intervallen", "Rust", "Herstel".
  focus: text("focus").notNull(),
  // Route-generator training type (duur|interval|herstel|tempo|wedstrijd) or null
  // for rest days. Drives the ORS profile when a route is needed.
  trainingType: text("training_type"),
  // Human intensity label, e.g. "Zone 2 · rustig", "Zone 4 · intervallen".
  intensityLabel: text("intensity_label"),
  estDurationMin: integer("est_duration_min"),
  isRest: boolean("is_rest").notNull().default(false),
  routeNeeded: boolean("route_needed").notNull().default(false),
  // Short plain-language explanation of why this day looks the way it does.
  rationale: text("rationale"),
  // Honest reason shown when adaptation changed this provisional day.
  adaptationReason: text("adaptation_reason"),
  committed: boolean("committed").notNull().default(false),
  // Set for committed days — the planned_workouts row this day was written to.
  plannedWorkoutId: integer("planned_workout_id").references(
    () => plannedWorkoutsTable.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Athlete feedback on a planned workout — drives Sparki's adjustment proposals
// (blueprint: interactive coaching). One workout can collect several feedback
// events over time (pre-session "te zwaar?", post-session "gedaan/gemist").
export const workoutFeedbackTable = pgTable("workout_feedback", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => plannedWorkoutsTable.id, { onDelete: "cascade" }),
  // done | missed | too_hard | too_light | pain | tired | move
  feedbackType: text("feedback_type").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTrainingSessionSchema = createInsertSchema(
  trainingSessionsTable,
).omit({ id: true });
export const selectTrainingSessionSchema =
  createSelectSchema(trainingSessionsTable);
export const insertPlannedWorkoutSchema = createInsertSchema(
  plannedWorkoutsTable,
).omit({ id: true });
export const selectPlannedWorkoutSchema =
  createSelectSchema(plannedWorkoutsTable);

export const insertTrainingPlanSchema = createInsertSchema(
  trainingPlansTable,
).omit({ id: true });
export const selectTrainingPlanSchema = createSelectSchema(trainingPlansTable);
export const insertPlanDaySchema = createInsertSchema(planDaysTable).omit({
  id: true,
});
export const selectPlanDaySchema = createSelectSchema(planDaysTable);

export type TrainingSession = typeof trainingSessionsTable.$inferSelect;
export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;
export type PlannedWorkout = typeof plannedWorkoutsTable.$inferSelect;
export type InsertPlannedWorkout = z.infer<typeof insertPlannedWorkoutSchema>;
export type TrainingPlan = typeof trainingPlansTable.$inferSelect;
export type InsertTrainingPlan = z.infer<typeof insertTrainingPlanSchema>;
export type PlanDay = typeof planDaysTable.$inferSelect;
export type InsertPlanDay = z.infer<typeof insertPlanDaySchema>;

export const insertWorkoutFeedbackSchema = createInsertSchema(
  workoutFeedbackTable,
).omit({ id: true });
export type WorkoutFeedback = typeof workoutFeedbackTable.$inferSelect;
export type InsertWorkoutFeedback = z.infer<typeof insertWorkoutFeedbackSchema>;

// ── Canonical structure stored in planned_workouts.structure (jsonb) ─────────
// Computed by the plan generator from the athlete's real numbers. Shared between
// the generator (api-server) and any consumer that imports @workspace/db.
export type WorkoutPhase = "base" | "build" | "peak" | "recovery";

export type WorkoutBlockKind =
  | "warmup"
  | "interval"
  | "recovery"
  | "steady"
  | "cooldown";

export type WorkoutBlock = {
  kind: WorkoutBlockKind;
  label: string;
  durationMin: number;
  zone: number; // 1–6
  /** Mid-target as % of FTP; null for free/easy spin blocks. */
  targetPctFtp: number | null;
  /** Informational rep count for grouped intervals. */
  reps?: number;
};

export type WorkoutRouteNeed = "outdoor_long" | "outdoor" | "indoor_ok" | "none";

export type WorkoutRationale = {
  whyToday: string;
  supportsGoal: string;
  whatToFeel: string;
  tooHardSigns: string;
  tooLightSigns: string;
  safeAdjust: string;
};

export type WorkoutStructure = {
  phase: WorkoutPhase;
  week: number; // 1-based block index within the plan
  intensity: string; // human label, e.g. "Drempel", "VO2max", "Duur Z2"
  primaryZone: number; // dominant zone 1–6
  routeNeed: WorkoutRouteNeed;
  equipment: string[];
  blocks: WorkoutBlock[];
  recoveryAdvice: string;
  rationale: WorkoutRationale;
};
