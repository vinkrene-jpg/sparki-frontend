import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

export const coachAthleteLinksTable = pgTable(
  "coach_athlete_links",
  {
    coachClerkId: text("coach_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.coachClerkId, t.athleteClerkId] })],
);

export const parentAthleteLinksTable = pgTable(
  "parent_athlete_links",
  {
    parentClerkId: text("parent_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.parentClerkId, t.athleteClerkId] })],
);

export const insertCoachAthleteLinkSchema = createInsertSchema(coachAthleteLinksTable);
export const insertParentAthleteLinkSchema = createInsertSchema(parentAthleteLinksTable);

export type CoachAthleteLink = typeof coachAthleteLinksTable.$inferSelect;
export type ParentAthleteLink = typeof parentAthleteLinksTable.$inferSelect;

export type InsertCoachAthleteLink = z.infer<typeof insertCoachAthleteLinkSchema>;
export type InsertParentAthleteLink = z.infer<typeof insertParentAthleteLinkSchema>;
