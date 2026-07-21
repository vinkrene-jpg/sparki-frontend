import {
  pgTable,
  serial,
  text,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// ── Leefagenda ───────────────────────────────────────────────────────────────
// Real life-context events the athlete shares (toetsweek, familieweekend,
// drukke werkweek). Sparki's plan generator reads these and honestly adapts
// the schedule around them — nothing is fabricated: an event only influences
// the plan when the athlete entered it.

// What the event means for training on those days.
export const LIFE_EVENT_IMPACTS = [
  "geen_training", // no training at all that day
  "minder_tijd", // shorter session (time-capped)
  "alleen_licht", // only light/recovery work
] as const;
export type LifeEventImpact = (typeof LIFE_EVENT_IMPACTS)[number];

export const LIFE_EVENT_KINDS = [
  "school",
  "familie",
  "werk",
  "anders",
] as const;
export type LifeEventKind = (typeof LIFE_EVENT_KINDS)[number];

export const lifeEventsTable = pgTable("life_events", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  kind: text("kind").$type<LifeEventKind>().notNull(),
  // Short Dutch label the athlete gave, e.g. "Toetsweek", "Verjaardag oma".
  title: text("title").notNull(),
  startDate: date("start_date").notNull(),
  // Inclusive; null = single day.
  endDate: date("end_date"),
  impact: text("impact").$type<LifeEventImpact>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertLifeEventSchema = createInsertSchema(lifeEventsTable);
export const selectLifeEventSchema = createSelectSchema(lifeEventsTable);
export type LifeEvent = z.infer<typeof selectLifeEventSchema>;
export type InsertLifeEvent = z.infer<typeof insertLifeEventSchema>;
