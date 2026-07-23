import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { racesTable } from "./races";

// Exporthistorie van het wedstrijd-exportcentrum. Iedere export (GPX, Garmin
// FIT Course, FIT Workout) wordt vastgelegd mét versienummer, bestandsnaam,
// validatie- en round-trip-uitslag. De bestandsinhoud zelf wordt bij download
// opnieuw deterministisch opgebouwd uit de actuele wedstrijdgegevens — het
// versienummer + de vingerafdruk vertellen eerlijk of een eerder gedownload
// bestand nog actueel is.
//
// status: "actueel" zolang de onderliggende punten/route niet zijn gewijzigd;
// "verouderd" zodra een nieuwe gids-analyse of puntwijziging de export inhaalt.

export const raceExportTypes = ["gpx", "fit-course", "fit-workout"] as const;
export type RaceExportTypeDb = (typeof raceExportTypes)[number];

export const raceExportStatuses = ["actueel", "verouderd"] as const;
export type RaceExportStatus = (typeof raceExportStatuses)[number];

export const raceExportsTable = pgTable(
  "race_exports",
  {
    id: serial("id").primaryKey(),
    raceId: integer("race_id")
      .notNull()
      .references(() => racesTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    exportType: text("export_type").notNull(), // RaceExportTypeDb
    version: integer("version").notNull(),
    fileName: text("file_name").notNull(),
    // Vingerafdruk van de inhoud (punten + route) op exportmoment — hiermee
    // stellen we eerlijk vast of een export is ingehaald door wijzigingen.
    contentFingerprint: text("content_fingerprint").notNull(),
    status: text("status").notNull().default("actueel"), // RaceExportStatus
    staleReason: text("stale_reason"),
    // Validatie-uitslag (§8) en round-trip-uitslag (§9) op exportmoment.
    validationOk: boolean("validation_ok").notNull(),
    validationWarnings: text("validation_warnings").array(),
    roundTripOk: boolean("round_trip_ok").notNull(),
    roundTripDetail: text("round_trip_detail"),
    pointCount: integer("point_count").notNull().default(0),
    trackPointCount: integer("track_point_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("race_exports_race_idx").on(t.raceId)],
);

export const insertRaceExportSchema = createInsertSchema(raceExportsTable).omit({
  id: true,
});
export const selectRaceExportSchema = createSelectSchema(raceExportsTable);

export type RaceExport = typeof raceExportsTable.$inferSelect;
export type InsertRaceExport = z.infer<typeof insertRaceExportSchema>;
