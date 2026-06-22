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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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

export type TrainingSession = typeof trainingSessionsTable.$inferSelect;
export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;
export type PlannedWorkout = typeof plannedWorkoutsTable.$inferSelect;
export type InsertPlannedWorkout = z.infer<typeof insertPlannedWorkoutSchema>;
