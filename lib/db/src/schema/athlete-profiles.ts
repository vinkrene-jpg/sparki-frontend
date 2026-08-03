import { pgTable, serial, text, integer, numeric, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

export const athleteProfilesTable = pgTable("athlete_profiles", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .unique()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  ftp: integer("ftp"),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
  discipline: text("discipline"),
  goals: text("goals"),
  // Structured long-term development ambition (Ontwikkelmodel) — the reference
  // point every coaching decision is weighed against. One of:
  // recreatief | granfondo | topamateur | elite_u23 | prof | persoonlijk.
  // "persoonlijk" reuses the free-text `goals` field for the athlete's own words.
  developmentGoal: text("development_goal"),
  weeklyHourTarget: integer("weekly_hour_target"),

  // ── Phased adaptive onboarding (task #18) ──────────────────────────────────
  // Sport is modelled for future multi-sport support; only "cycling" is
  // implemented today. The 4 core quick-start answers are: sport, goals (above),
  // experienceLevel (below), trainingDaysPerWeek. Estimated flags mark values
  // Sparki derived from those answers so later check-ins can refine them.
  sport: text("sport"),
  trainingDaysPerWeek: integer("training_days_per_week"),
  // Onboarding V2 self-claim: what kind of athlete the rider *thinks* they are,
  // before Sparki has evidence. Free-form key (diesel | sprinter | alleskunner |
  // geen_idee | ik_zie_wel). Sparki forms its own theory from real data later.
  selfType: text("self_type"),
  // Coaching path chosen by the athlete: "sparki" (autonomous engine) or
  // "coach" (human coach via the invitation/link flow). Null = not yet chosen.
  coachingMode: text("coaching_mode"),
  // Progressive profile facts gathered gradually during normal use.
  birthYear: integer("birth_year"),
  // Full date of birth (YYYY-MM-DD). When present, exact age is derived from
  // this (accounting for whether the birthday has already passed this year);
  // birthYear stays as a backward-compatible fallback for profiles that only
  // ever supplied a year/age (which can be off by up to one year).
  birthDate: date("birth_date"),
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

  // TRAINEN_DOELEN_SEIZOEN_01 F2: meetniveau — wat komt er binnen. Zelf te
  // kiezen; null = nog niet gekozen (dan geldt het feitelijke niveau per rit).
  // De keuze "pro" is een voorwaarde, geen status: een rit zonder meter valt
  // eerlijk terug op het feitelijke niveau, met melding (TD-17).
  // pro | hartslag | tijd_gevoel | aanwezigheid
  measurementLevel: text("measurement_level").$type<
    "pro" | "hartslag" | "tijd_gevoel" | "aanwezigheid"
  >(),
  // TRAINEN_DOELEN_SEIZOEN_01 F3: hartslagzones uit rust- en maximale hartslag
  // voor de hartslagbelasting van sessies zonder vermogen. Sporter-ingevuld,
  // nullable — zonder deze waarden blijft zo'n sessie eerlijk zonder belasting.
  restingHr: integer("resting_hr"),
  maxHr: integer("max_hr"),

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
  // Object path of a photo the athlete chose (from the Foto-lab) to dress up
  // their profile as an atmosphere/hero image. Null = none chosen → no fake
  // hero is shown. Points at an owner-gated stored object (original or styled).
  decorPhotoPath: text("decor_photo_path"),
  // Routeplanner-weergaveniveau (besluit B6, 30/31-07-2026). Handmatige keuze
  // van de rijder: gratis | go_fietser | go_sport | wedstrijd. NULL betekent
  // "automatisch": de weergave wordt dan uit het profiel voorgesteld. Staat
  // volledig los van het abonnement; veiligheid geldt op elk niveau.
  plannerView: text("planner_view"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAthleteProfileSchema = createInsertSchema(athleteProfilesTable)
  .omit({ id: true })
  // F2: strikte enum — zod-inferentie van een text-kolom zou `string` geven en
  // de union op de tabelkolom breken.
  .extend({
    measurementLevel: z
      .enum(["pro", "hartslag", "tijd_gevoel", "aanwezigheid"])
      .nullable()
      .optional(),
  });
export const selectAthleteProfileSchema = createSelectSchema(athleteProfilesTable);

export type InsertAthleteProfile = z.infer<typeof insertAthleteProfileSchema>;
export type AthleteProfile = typeof athleteProfilesTable.$inferSelect;
