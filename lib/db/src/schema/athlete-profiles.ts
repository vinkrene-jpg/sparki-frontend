import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

export const athleteProfilesTable = pgTable("athlete_profiles", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .unique()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  ftp: integer("ftp"),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
  discipline: text("discipline"),
  goals: text("goals"),
  weeklyHourTarget: integer("weekly_hour_target"),

  // ── Phased adaptive onboarding (task #18) ──────────────────────────────────
  // Sport is modelled for future multi-sport support; only "cycling" is
  // implemented today. The 4 core quick-start answers are: sport, goals (above),
  // experienceLevel (below), trainingDaysPerWeek. Estimated flags mark values
  // Sparki derived from those answers so later check-ins can refine them.
  sport: text("sport"),
  trainingDaysPerWeek: integer("training_days_per_week"),
  // Coaching path chosen by the athlete: "sparki" (autonomous engine) or
  // "coach" (human coach via the invitation/link flow). Null = not yet chosen.
  coachingMode: text("coaching_mode"),
  // Progressive profile facts gathered gradually during normal use.
  birthYear: integer("birth_year"),
  heightCm: integer("height_cm"),
  // Self-reported competition level — drives adaptive question ordering and
  // (later) periodisation: none | recreational | local | regional | national.
  competitionLevel: text("competition_level"),
  // Free-text "why do you ride" motivation (personalises Sparki's coaching).
  motivation: text("motivation"),
  // Typical nightly sleep in hours (recovery context).
  typicalSleepHours: numeric("typical_sleep_hours", { precision: 3, scale: 1 }),
  // True while the value is a quick-start estimate, not athlete-confirmed.
  ftpEstimated: boolean("ftp_estimated").notNull().default(false),
  weeklyHourTargetEstimated: boolean("weekly_hour_target_estimated")
    .notNull()
    .default(false),
  // Athlete-set health status (blueprint §4 #1 Emergency/Health). When "sick" or
  // "injured", the day-type engine routes Home to a calm recovery-only view and
  // blocks training pressure. "ok" (default) is the normal training state.
  healthStatus: text("health_status").notNull().default("ok"),

  // ── Autonomous-coaching planning inputs (task #17) ─────────────────────────
  // Structured fields Sparki needs to build a real training plan when the
  // athlete has no human coach. All nullable — the Train setup form fills them.
  // experienceLevel: beginner | intermediate | advanced | elite
  experienceLevel: text("experience_level"),
  // Weekday keys the athlete can train on, e.g. ["mon","wed","fri","sun"].
  availableDays: text("available_days").array(),
  // Self-assessed load tolerance: low | moderate | high. Scales how aggressively
  // the weekly hour target is distributed (and deload frequency).
  loadCapacity: text("load_capacity"),
  // Free-text injury history / current limitations (honest constraint input).
  injuryHistory: text("injury_history"),
  // Free-text training preferences (terrain, indoor/outdoor, likes/dislikes).
  trainingPreferences: text("training_preferences"),
  // Home / preferred start location for generated routes. Loop routes need a
  // real start coordinate; null means route generation is skipped honestly.
  homeLat: numeric("home_lat", { precision: 9, scale: 6 }),
  homeLon: numeric("home_lon", { precision: 9, scale: 6 }),
  homeLabel: text("home_label"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAthleteProfileSchema = createInsertSchema(athleteProfilesTable).omit({ id: true });
export const selectAthleteProfileSchema = createSelectSchema(athleteProfilesTable);

export type InsertAthleteProfile = z.infer<typeof insertAthleteProfileSchema>;
export type AthleteProfile = typeof athleteProfilesTable.$inferSelect;
