import {
  pgTable,
  serial,
  text,
  integer,
  date,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Vandaag-weergavehistorie (WP-T1, opdracht "Vandaag als intelligente,
// levende en rolafhankelijke startpagina").
//
// De Today Orchestrator legt hier per gebruiker vast welke boodschap-sleutel
// wanneer getoond is, of erop geklikt is en of de bijbehorende actie is
// afgerond. Daarmee weet Sparki bij elke volgende inlog wat al gezien is:
// urgente/openstaande zaken mogen blijven staan, ondersteunende kaarten
// wisselen slim (geen zinloze herhaling). Dit is presentatiegeheugen — de
// onderliggende data blijft elders het bronsysteem.
//
// Datumvelden zijn Amsterdamse kalenderdagen (YYYY-MM-DD), nooit UTC-dagen.
export const todayDisplayHistoryTable = pgTable(
  "today_display_history",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Stabiele sleutel van de getoonde boodschap/kaart, bijv.
    // "lead:no_plan_advice", "rotating:route_suggestion",
    // "lead:race_countdown:123". Nieuwe situatie ⇒ nieuwe sleutel.
    itemKey: text("item_key").notNull(),
    // In welk vak het item stond (lead | support | insight | rotating).
    slot: text("slot").notNull(),
    firstShownOn: date("first_shown_on").notNull(),
    lastShownOn: date("last_shown_on").notNull(),
    lastShownAt: timestamp("last_shown_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Aantal verschillende Amsterdamse dagen waarop dit item getoond is.
    daysShown: integer("days_shown").notNull().default(1),
    clicked: boolean("clicked").notNull().default(false),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("today_history_user_item_idx").on(t.clerkId, t.itemKey)],
);

export const insertTodayDisplayHistorySchema = createInsertSchema(
  todayDisplayHistoryTable,
);
export const selectTodayDisplayHistorySchema = createSelectSchema(
  todayDisplayHistoryTable,
);
export type TodayDisplayHistory = z.infer<
  typeof selectTodayDisplayHistorySchema
>;
