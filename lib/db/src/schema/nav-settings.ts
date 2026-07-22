import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Per-athlete navigatie-instellingen voor het navigatiescherm (welke
// datavelden, lettergrootte, balkpositie, kaartoriëntatie en automatische
// meldingen). Additief: één rij per atleet. Een ontbrekende rij betekent
// "nog nooit ingesteld" — de client toont dan eerlijk zijn eigen defaults.
export const navSettingsTable = pgTable("nav_settings", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  settings: jsonb("settings").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertNavSettingsSchema = createInsertSchema(navSettingsTable);
export const selectNavSettingsSchema = createSelectSchema(navSettingsTable);

export type NavSettingsRow = typeof navSettingsTable.$inferSelect;
export type InsertNavSettings = z.infer<typeof insertNavSettingsSchema>;
