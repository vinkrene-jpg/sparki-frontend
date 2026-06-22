import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
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
