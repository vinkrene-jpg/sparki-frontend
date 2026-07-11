import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Per-athlete reminder preferences. Honoured by the scheduled reminder-delivery
// job: `enabled=false` (the master switch) means NOTHING is ever delivered to
// this athlete; the per-type flags let an athlete keep some kinds and drop
// others. A missing row = all defaults on (an athlete who never touched the
// settings still gets the helpful reminders, but can always turn them off).

export const reminderPreferencesTable = pgTable("reminder_preferences", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Master switch — off means no reminders at all (any channel).
  enabled: boolean("enabled").notNull().default(true),
  // Per-type switches.
  checkins: boolean("checkins").notNull().default(true),
  followups: boolean("followups").notNull().default(true),
  training: boolean("training").notNull().default(true),
  races: boolean("races").notNull().default(true),
  // One-question nudges for genuinely-missing core profile data
  // (gewicht, FTP, lengte, geboortejaar, doel, thuislocatie).
  profile: boolean("profile").notNull().default(true),
  // Smartly-timed "er is iets nieuws voor je" nudge — only fires when there is
  // genuinely new content, at a moment the athlete tends to be receptive.
  pulse: boolean("pulse").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertReminderPreferencesSchema = createInsertSchema(
  reminderPreferencesTable,
);
export const selectReminderPreferencesSchema = createSelectSchema(
  reminderPreferencesTable,
);

export type ReminderPreferences = typeof reminderPreferencesTable.$inferSelect;
export type InsertReminderPreferences = z.infer<
  typeof insertReminderPreferencesSchema
>;

// The reminder kinds an athlete can toggle (maps to per-type columns above).
export const reminderKinds = [
  "checkins",
  "followups",
  "training",
  "races",
  "profile",
  "pulse",
] as const;
export type ReminderKind = (typeof reminderKinds)[number];
