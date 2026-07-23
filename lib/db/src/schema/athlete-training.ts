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
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
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
  // Canonical Sparki sport family (see engines/data-hub/sports.ts). Lets one
  // athlete hold cycling/running/etc sessions side by side without ambiguity.
  sport: text("sport").notNull().default("cycling"),
  avgCadence: integer("avg_cadence"),
  avgSpeedKph: numeric("avg_speed_kph", { precision: 5, scale: 2 }),
  maxHR: integer("max_hr"),
  // Best average power (watts) over fixed windows, computed from REAL
  // per-sample power data at file ingest (FIT/TCX). Keys are window seconds
  // ("5", "10", "20", "60", "300", "1200"). Null/absent = the source carried
  // no per-sample power — never estimated from averages.
  powerBests: jsonb("power_bests").$type<Record<string, number>>(),
  source: text("source").notNull().default("manual"),
  // Data Hub provenance. `externalRef` = "<provider>:<externalActivityId>" of the
  // primary source; `sources` = every connector that contributed to this row
  // (set when the hub merges the same activity imported from several platforms);
  // `dedupeKey` = the cross-source key used to recognise that duplicate.
  externalRef: text("external_ref"),
  dedupeKey: text("dedupe_key"),
  sources: jsonb("sources").$type<string[]>().default([]),
  // Per-veld herkomst: welke bron (provider of "handmatig") dit veld als
  // eerste leverde, bijv. { "avgPower": "garmin", "notes": "handmatig" }.
  // Alleen gezet voor velden met een echte waarde — nooit aspirationeel.
  fieldSources: jsonb("field_sources").$type<Record<string, string>>(),
  // Velden die de sporter zelf heeft gecorrigeerd. Een merge vanuit een
  // connector mag deze velden NOOIT overschrijven of opnieuw vullen — ook
  // niet wanneer de sporter het veld bewust heeft leeggemaakt.
  manualFields: jsonb("manual_fields").$type<string[]>(),
  // Mechanieker: welke fiets is voor deze rit gebruikt. Auto-gekoppeld
  // (Strava-gear of enige actieve fiets) of handmatig gecorrigeerd; km/uren
  // per fiets/component worden hier ALTIJD uit afgeleid (idempotent — een
  // verwijderde activiteit corrigeert de stand vanzelf). Geen FK-referentie
  // om een import-cyclus tussen schema-bestanden te vermijden; koppeling is
  // "set null"-gedrag via de route (fiets weg ⇒ sessie ontkoppeld).
  bikeId: integer("bike_id"),
  // "auto" | "handmatig" — handmatige keuze wordt nooit door auto-koppeling
  // overschreven.
  bikeLinkSource: text("bike_link_source"),
  // Rit inkorten: actieve trim-bewerking (start/eind-index in de bewaarde
  // track-geometrie) mét de OORSPRONKELIJKE statistieken zodat inkorten
  // altijd volledig terug te draaien is. Null = geen trim actief. De ruwe
  // opname in activity_imports.parsed_summary blijft ALTIJD onaangetast.
  trimEdit: jsonb("trim_edit").$type<{
    startIndex: number;
    endIndex: number;
    trimmedAt: string;
    durationEstimated: boolean;
    original: {
      durationMin: number | null;
      distanceKm: string | null;
      elevationM: number | null;
      avgSpeedKph: string | null;
    };
  }>(),
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
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  scheduledDate: date("scheduled_date").notNull(),
  type: text("type").notNull().default("ride"),
  title: text("title").notNull(),
  description: text("description"),
  targetDurationMin: integer("target_duration_min"),
  targetTSS: integer("target_tss"),
  structure: jsonb("structure"),
  status: text("status").notNull().default("planned"),
  source: text("source").notNull().default("sparki"),
  // Bij source="coach": welke coach deze training heeft aangemaakt. Alleen die
  // coach mag de training wijzigen/herhalen (cross-coach isolatie). Nullable
  // voor bestaande rijen van vóór deze kolom (legacy: elke gekoppelde coach).
  coachClerkId: text("coach_clerk_id"),
  sessionId: integer("session_id").references(() => trainingSessionsTable.id, {
    onDelete: "set null",
  }),
  // Autonomous-coaching links (task #17). planId ties a committed session to the
  // generated training plan; routeId attaches a real ORS-generated route to a
  // route-needed session. routeId is a soft reference (plain int) to avoid a
  // circular schema import; ownership is enforced in the route layer.
  planId: integer("plan_id"),
  routeId: integer("route_id"),
  // Planningsdetails (Training inplannen-flow): uitsluitend vooraf-velden —
  // fietsdiscipline, doel, geplande afstand, intensiteit/zones, materiaal
  // (bikeId, soft ref net als routeId) en voedingsinstructie. Uitgevoerde
  // ervaring (gevoel, werkelijke belasting) hoort hier NOOIT in; die leeft
  // in training_sessions. Null = gewoon geen extra details.
  planDetails: jsonb("plan_details").$type<{
    discipline?: string;
    goal?: string;
    targetDistanceKm?: number;
    intensity?: string;
    bikeId?: number;
    nutritionNote?: string;
  }>(),
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
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
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
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
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
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => plannedWorkoutsTable.id, { onDelete: "cascade" }),
  // done | missed | too_hard | too_light | pain | tired | move
  feedbackType: text("feedback_type").notNull(),
  note: text("note"),
  // Compacte na-training-feedback (Golf 23, additief; null = niet ingevuld):
  // ervaren zwaarte 1–10 (RPE).
  rpe: integer("rpe"),
  // Uitvoering: volledig | gedeeltelijk | niet.
  completion: text("completion"),
  // Korte reden van afwijking in eigen woorden (bijv. "te weinig tijd").
  deviationReason: text("deviation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Wijzigingshistorie per geplande training (Golf 23) ───────────────────────
// Append-only. Iedere inhoudelijke wijziging aan een planned_workout is
// herleidbaar: wat was het (before), wat werd het (after), wie deed het
// (actor: sporter | coach | sparki), waarom (reason) en wanneer. Auto-koppeling
// van een uitgevoerde activiteit en het lazy "gemist"-oordeel loggen hier ook.
export const plannedWorkoutChangesTable = pgTable("planned_workout_changes", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => plannedWorkoutsTable.id, { onDelete: "cascade" }),
  // aangemaakt | gewijzigd | verplaatst | geannuleerd | gemist |
  // gekoppeld | ontkoppeld | status
  action: text("action").notNull(),
  // sporter | coach | sparki
  actor: text("actor").notNull(),
  reason: text("reason"),
  // Alleen de gewijzigde velden (voor/na) — geen volledige rijsnapshots.
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Optional, first-person mental reflection on a completed workout. Where
// workout_feedback records execution (done/missed/too_hard…), this captures the
// subjective signal that never shows up in the numbers: how motivated the
// athlete felt beforehand, how mentally taxing the session was, and one free
// note about what went on in their head. Exactly one reflection per workout
// (upserted), so the Mentale Weerbaarheid engine can reason with real feeling
// data when present and stay honest when it is absent.
export const workoutMentalReflectionsTable = pgTable(
  "workout_mental_reflections",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workoutId: integer("workout_id")
      .notNull()
      .unique()
      .references(() => plannedWorkoutsTable.id, { onDelete: "cascade" }),
    // 1 (heel weinig zin) – 5 (heel gemotiveerd). Null = niet ingevuld.
    motivationBefore: integer("motivation_before"),
    // 1 (mentaal makkelijk) – 5 (mentaal loodzwaar). Null = niet ingevuld.
    mentalEffort: integer("mental_effort"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

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

export const insertPlannedWorkoutChangeSchema = createInsertSchema(
  plannedWorkoutChangesTable,
).omit({ id: true });
export type PlannedWorkoutChange =
  typeof plannedWorkoutChangesTable.$inferSelect;
export type InsertPlannedWorkoutChange = z.infer<
  typeof insertPlannedWorkoutChangeSchema
>;

export const insertWorkoutMentalReflectionSchema = createInsertSchema(
  workoutMentalReflectionsTable,
).omit({ id: true });
export type WorkoutMentalReflection =
  typeof workoutMentalReflectionsTable.$inferSelect;
export type InsertWorkoutMentalReflection = z.infer<
  typeof insertWorkoutMentalReflectionSchema
>;

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
