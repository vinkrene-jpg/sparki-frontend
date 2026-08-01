import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { userProfilesTable } from "./users";

// MEDIA_UITLEG_01 F1 — per-gebruiker UI-voorkeuren (weergavelaag).
// Eén rij per gebruiker; een ontbrekende rij = veilige defaults.
//
// `reduceMotion` is de Sparki-eigen instelling "Verminder beweging" (T-2/T-4):
// hij werkt onafhankelijk van de systeeminstelling `prefers-reduced-motion` en
// wordt server-side bewaard zodat hij op elk toestel geldt. Staat één van
// beide aan, dan is beweging uit (OR, nooit AND).
export const uiPreferencesTable = pgTable("ui_preferences", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  reduceMotion: boolean("reduce_motion").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUiPreferencesSchema = createInsertSchema(uiPreferencesTable);
export const selectUiPreferencesSchema = createSelectSchema(uiPreferencesTable);
export type UiPreferences = typeof uiPreferencesTable.$inferSelect;
