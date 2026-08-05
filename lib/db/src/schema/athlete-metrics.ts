import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  date,
  timestamp,
  unique,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

export const athleteDailyMetricsTable = pgTable(
  "athlete_daily_metrics",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    metricDate: date("metric_date").notNull(),
    hrv: integer("hrv"),
    restingHR: integer("resting_hr"),
    sleepHours: numeric("sleep_hours", { precision: 4, scale: 2 }),
    sleepQuality: integer("sleep_quality"),
    fatigueScore: integer("fatigue_score"),
    feelScore: integer("feel_score"),
    sorenessScore: integer("soreness_score"),
    stressScore: integer("stress_score"),
    notes: text("notes"),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("unique_daily_metric").on(t.clerkId, t.metricDate)],
);

export const ftpHistoryTable = pgTable("ftp_history", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  measuredAt: date("measured_at").notNull(),
  ftpWatts: integer("ftp_watts").notNull(),
  testType: text("test_type").notNull().default("manual"),
  // DATABRONNEN_EN_FTP_01 (05-08-2026) D2/H2: elke FTP-rij legt vast waar hij
  // vandaan komt en of hij leidend is. Rangorde: trainer > sporter >
  // sparki_afgeleid > import — een lagere bron overschrijft nooit een hogere.
  bron: text("bron").notNull().default("sporter"),
  leidend: boolean("leidend").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAthleteDailyMetricsSchema = createInsertSchema(
  athleteDailyMetricsTable,
).omit({ id: true });
export const selectAthleteDailyMetricsSchema = createSelectSchema(
  athleteDailyMetricsTable,
);
export const insertFtpHistorySchema = createInsertSchema(ftpHistoryTable).omit({
  id: true,
});
export const selectFtpHistorySchema = createSelectSchema(ftpHistoryTable);

export type AthleteDailyMetric = typeof athleteDailyMetricsTable.$inferSelect;
export type InsertAthleteDailyMetric = z.infer<
  typeof insertAthleteDailyMetricsSchema
>;
export type FtpHistoryEntry = typeof ftpHistoryTable.$inferSelect;
export type InsertFtpHistoryEntry = z.infer<typeof insertFtpHistorySchema>;
