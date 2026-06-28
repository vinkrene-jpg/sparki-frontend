import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Per-athlete audio / Sound Studio preferences. The Sparki Sound Studio plays
// original, royalty-free audio feedback for app events and powers an in-app
// wekker. A missing row = sensible defaults (sound on, no wekker armed) so an
// athlete who never opened the settings still hears event feedback but is never
// woken unexpectedly.
//
// `alarmDays` uses JS getDay() numbering: 0=zondag .. 6=zaterdag. An empty array
// means "every day" (a daily wekker). `alarmTime` is local "HH:MM".
export const audioPreferencesTable = pgTable("audio_preferences", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Master switch + volume for all event sounds (0-100).
  enabled: boolean("enabled").notNull().default(true),
  volume: integer("volume").notNull().default(70),
  // Active audio pack id (e.g. "performance").
  pack: text("pack").notNull().default("performance"),
  // Wekker.
  alarmEnabled: boolean("alarm_enabled").notNull().default(false),
  alarmTime: text("alarm_time").notNull().default("07:00"),
  alarmDays: integer("alarm_days").array().notNull().default([]),
  alarmSound: text("alarm_sound").notNull().default("wekker-energie"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAudioPreferencesSchema =
  createInsertSchema(audioPreferencesTable);
export const selectAudioPreferencesSchema =
  createSelectSchema(audioPreferencesTable);

export type AudioPreferences = typeof audioPreferencesTable.$inferSelect;
export type InsertAudioPreferences = z.infer<
  typeof insertAudioPreferencesSchema
>;
