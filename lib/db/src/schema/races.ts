import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { plannedWorkoutsTable } from "./athlete-training";

// Races / events — the athlete's competition calendar (task #4). Entered by the
// athlete now; the typed shape (typed columns + structured jsonb) is designed so
// an integration adapter (TrainingPeaks / Coach Portal) can populate the same
// rows later without a homepage redesign. No live data is stored — weather and
// logistics are athlete-entered or computed estimates, never fetched feeds.
export const racesTable = pgTable("races", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),

  // Core (athlete add/edit form)
  name: text("name").notNull(),
  raceDate: date("race_date").notNull(),
  startTime: text("start_time"), // "HH:MM" local, nullable
  location: text("location"),
  priority: text("priority").notNull().default("B"), // A | B | C
  discipline: text("discipline"),
  notes: text("notes"),
  plannedWorkoutId: integer("planned_workout_id").references(
    () => plannedWorkoutsTable.id,
    { onDelete: "set null" },
  ),

  // Travel day (optional) — when set and equal to today, Home becomes Travel Day.
  travelDate: date("travel_date"),

  // Race info (race-day blocks)
  course: text("course"),
  distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
  elevationM: integer("elevation_m"),
  technicalSections: text("technical_sections"),
  weatherNote: text("weather_note"), // athlete-entered, no live feed

  // Team / coach
  teamName: text("team_name"),
  teamInfo: text("team_info"),
  coachInstructions: text("coach_instructions"),

  // Finished-race outcome (uitslag) — athlete-entered now, integration-ready so
  // a results feed (UCI/club/TrainingPeaks) can populate the same shape later.
  raceType: text("race_type"), // e.g. "wegwedstrijd", "criterium", "tijdrit"
  result: jsonb("result").$type<RaceResult>(),

  // Structured, integration-ready sub-objects
  logistics: jsonb("logistics"), // RaceLogisticsInput
  checklist: jsonb("checklist"), // Record<string, boolean> — persisted per race
  teamRiders: jsonb("team_riders"), // TeamRider[]

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Finished-race outcome. Stored in races.result (jsonb). All fields optional so
// a planned (not-yet-raced) event simply has no result.
export type RaceResult = {
  status?: "finished" | "dnf" | "dns" | "dsq";
  position?: number | null;
  fieldSize?: number | null;
  timeSec?: number | null;
  points?: number | null;
  note?: string | null;
};

export const insertRaceSchema = createInsertSchema(racesTable).omit({
  id: true,
});
export const selectRaceSchema = createSelectSchema(racesTable);

export type Race = typeof racesTable.$inferSelect;
export type InsertRace = z.infer<typeof insertRaceSchema>;
