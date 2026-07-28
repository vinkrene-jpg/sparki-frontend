import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Account-brede Ontdekken-feedvoorkeuren. Voorheen leefden deze alleen in
// localStorage per apparaat; deze tabel maakt bewaard/"minder hiervan"
// consistent over al je apparaten. Eén rij per account; een ontbrekende rij
// betekent eerlijk "nog geen voorkeuren" (geen defaults verzonnen).
//
// `bewaard` is een jsonb-array van bewaarde kaart-items (key/titel/categorie/
// url/bron/bewaardOp) — dezelfde vorm als de client altijd al opsloeg, zodat
// bestaande localStorage-voorkeuren verliesloos migreren.
export type SavedFeedItemRow = {
  key: string;
  titel: string;
  categorie: string;
  url?: string;
  bron?: string;
  bewaardOp: string; // ISO
};

export const feedPrefsTable = pgTable("feed_prefs", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  bewaard: jsonb("bewaard")
    .$type<SavedFeedItemRow[]>()
    .notNull()
    .default([]),
  minderCategorie: text("minder_categorie").array().notNull().default([]),
  minderBron: text("minder_bron").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFeedPrefsSchema = createInsertSchema(feedPrefsTable);
export const selectFeedPrefsSchema = createSelectSchema(feedPrefsTable);

export type FeedPrefsRow = typeof feedPrefsTable.$inferSelect;
export type InsertFeedPrefs = z.infer<typeof insertFeedPrefsSchema>;
