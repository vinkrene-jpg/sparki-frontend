import {
  pgTable,
  serial,
  text,
  integer,
  real,
  doublePrecision,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import type { RoutePathPoint } from "./routes";

// Sparki-routebibliotheek: door Sparki zelf gegenereerde, kant-en-klare routes
// per gebied ("cel" van ~0,25° ≈ 25 km). Zodra iemand Sparki gaat gebruiken en
// zijn woonlocatie bekend is, vult een achtergrondtaak de cel rond dat adres
// met een startset routes voor racefiets, gravel, mtb en gewone fiets. De
// bibliotheek is gedeeld: één keer gegenereerd per gebied, daarna voor
// iedereen beschikbaar — zo raakt de kaart gaandeweg gevuld.
//
// Eerlijkheid: geometrie/afstand/hoogtemeters komen altijd uit de echte
// routeprovider (ORS). Lukt genereren niet, dan komt er géén rij — nooit een
// verzonnen route.

export const libraryBikeTypes = [
  "racefiets",
  "gravel",
  "mtb",
  "fiets",
] as const;
export type LibraryBikeType = (typeof libraryBikeTypes)[number];

export const routeLibraryTable = pgTable(
  "route_library",
  {
    id: serial("id").primaryKey(),
    // Gebiedscel (grid van 0,25°): "lat-index:lon-index".
    cellKey: text("cell_key").notNull(),
    name: text("name").notNull(),
    // racefiets | gravel | mtb | fiets
    bikeType: text("bike_type").notNull(),
    // Doelafstand van de generatie-opdracht (km) — samen met cel+fietstype de
    // idempotentiesleutel: dezelfde startset wordt nooit dubbel aangemaakt.
    targetKm: integer("target_km").notNull(),
    startLat: doublePrecision("start_lat").notNull(),
    startLon: doublePrecision("start_lon").notNull(),
    distanceKm: real("distance_km"),
    elevationGainM: real("elevation_gain_m"),
    durationSec: integer("duration_sec"),
    geometry: jsonb("geometry").$type<RoutePathPoint[]>().notNull(),
    seed: integer("seed"),
    // Herkomst: sparki_auto (startset/achtergrond) — ruimte voor latere bronnen.
    source: text("source").notNull().default("sparki_auto"),
    // Afgeleide waardering uit gebruikerscommentaar (deterministisch bijgewerkt
    // bij elk commentaar). Null zolang niemand iets zei — nooit een verzonnen
    // score.
    avgRating: real("avg_rating"),
    ratingCount: integer("rating_count").notNull().default(0),
    // Verbeterlus: een slecht beoordeelde route (gem. < 3 bij ≥ 3 stemmen)
    // wordt vervangen door een nieuwe echte variant. De oude rij blijft
    // bestaan (commentaar-historie) maar gaat op status "vervangen" en wijst
    // naar zijn opvolger. Generatie telt op zodat de idempotentiesleutel
    // (cel+fietstype+afstand+generatie) opvolgers toestaat.
    status: text("status").notNull().default("actief"), // actief | vervangen
    generation: integer("generation").notNull().default(1),
    replacedById: integer("replaced_by_id"),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    // Eerlijke uitleg bij een opvolger: welke terugkerende opmerkingen uit
    // écht commentaar de nieuwe kandidaatkeuze stuurden. Null als de
    // vervanging alleen op de lage score gebeurde.
    improveNote: text("improve_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("route_library_cell_bike_target_gen_idx").on(
      t.cellKey,
      t.bikeType,
      t.targetKm,
      t.generation,
    ),
    index("route_library_cell_idx").on(t.cellKey),
    index("route_library_start_idx").on(t.startLat, t.startLon),
  ],
);

// Commentaar van gebruikers die de route gebruikt/gereden hebben. Eén rij per
// gebruiker per route (upsert): de nieuwste mening telt, de gemiddelde score
// op de route wordt deterministisch herberekend.
export const routeLibraryCommentsTable = pgTable(
  "route_library_comments",
  {
    id: serial("id").primaryKey(),
    libraryRouteId: integer("library_route_id")
      .notNull()
      .references(() => routeLibraryTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // 1..5, optioneel — iemand mag ook alleen tekst achterlaten.
    rating: integer("rating"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("route_library_comments_route_user_idx").on(
      t.libraryRouteId,
      t.clerkId,
    ),
  ],
);

export const insertRouteLibrarySchema = createInsertSchema(routeLibraryTable);
export const selectRouteLibrarySchema = createSelectSchema(routeLibraryTable);
export const insertRouteLibraryCommentSchema = createInsertSchema(
  routeLibraryCommentsTable,
);
export const selectRouteLibraryCommentSchema = createSelectSchema(
  routeLibraryCommentsTable,
);
export type RouteLibraryRoute = z.infer<typeof selectRouteLibrarySchema>;
export type RouteLibraryComment = z.infer<
  typeof selectRouteLibraryCommentSchema
>;
