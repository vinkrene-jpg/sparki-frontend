import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { racesTable } from "./races";
import { documentAnalysesTable } from "./document-analyses";

// Wedstrijdpunten — één centraal model voor alle punten van een wedstrijd:
// wedstrijdpunten (start, einde neutralisatie, sprint, bergprijs, laatste
// kilometer, finish, lokale ronde), informatiepunten (bevoorrading, afvalzone,
// gevaar, wegdek, spoorwegovergang) en overige info. Routevormingspunten en
// navigatiemanoeuvres leven al in routes.waypoints resp. routes.nav en worden
// hier bewust NIET gedupliceerd — pointClass verwijst er alleen naar.
//
// Eerlijkheid: punten uit de technische gids komen binnen als status
// "voorgesteld" mét bron (analyse, bestand, pagina) en betrouwbaarheid; alleen
// door de renner bevestigde/aangepaste punten zijn actief (live weergave,
// wedstrijdmodus). Coördinaten en kilometers zijn alleen gevuld als ze echt
// gevonden of door de renner gezet zijn — nooit verzonnen.

export const racePointKinds = [
  "start",
  "neutralisatie_einde",
  "sprint",
  "bergprijs",
  "bevoorrading",
  "afvalzone",
  "gevaar",
  "wegdek",
  "spoorwegovergang",
  "laatste_km",
  "lokale_ronde",
  "finish",
  "info",
] as const;
export type RacePointKind = (typeof racePointKinds)[number];

// Technische indeling (opdracht §3): A route (vormgeving), B nav (manoeuvres),
// C info, D wedstrijd. A en B bestaan als route-data; deze tabel bevat C en D.
export const racePointClasses = ["info", "wedstrijd"] as const;
export type RacePointClass = (typeof racePointClasses)[number];

export const racePointStatuses = [
  "voorgesteld",
  "bevestigd",
  "aangepast",
  "afgewezen",
] as const;
export type RacePointStatus = (typeof racePointStatuses)[number];

export const racePointsTable = pgTable(
  "race_points",
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
    kind: text("kind").notNull(), // RacePointKind
    pointClass: text("point_class").notNull(), // RacePointClass (afgeleid van kind)
    label: text("label").notNull(),
    description: text("description"),
    // Bron (alleen bij gids-extractie; handmatige punten hebben geen bron).
    sourceAnalysisId: integer("source_analysis_id").references(
      () => documentAnalysesTable.id,
      { onDelete: "set null" },
    ),
    sourceFile: text("source_file"),
    sourcePage: integer("source_page"),
    // Wedstrijdkilometer op het parcours (null = locatie niet bevestigd).
    raceKm: real("race_km"),
    lat: real("lat"),
    lng: real("lng"),
    // Betrouwbaarheid van de extractie ("high"|"medium"|"low"); null bij
    // handmatige punten (de renner stelt het zelf vast).
    confidence: text("confidence"),
    status: text("status").notNull().default("voorgesteld"), // RacePointStatus
    // Nieuwe-gids-diff: true wanneer een latere technische gids dit punt op
    // een andere plek/kilometer zet — het punt blijft actief maar vraagt om
    // herbevestiging door de renner. reviewNote legt in gewone taal uit wat
    // er in de nieuwe gids anders is (nooit automatisch overschreven).
    needsReconfirm: boolean("needs_reconfirm").notNull().default(false),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("race_points_race_idx").on(t.raceId)],
);

export const insertRacePointSchema = createInsertSchema(racePointsTable).omit({
  id: true,
});
export const selectRacePointSchema = createSelectSchema(racePointsTable);

export type RacePoint = typeof racePointsTable.$inferSelect;
export type InsertRacePoint = z.infer<typeof insertRacePointSchema>;

// Kandidaat-punt zoals uit de technische gids gelezen (opgeslagen in
// document_analyses.candidatePoints vóór koppeling aan een wedstrijd).
export type CandidateRacePoint = {
  kind: RacePointKind;
  description: string;
  page: number | null;
  raceKm: number | null;
  lat: number | null;
  lng: number | null;
  confidence: "high" | "medium" | "low" | null;
};
