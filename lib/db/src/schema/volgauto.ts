import {
  pgTable,
  serial,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { routesTable } from "./routes";

// Opdracht 3 — Volgauto. Naast de FIETSroute (die volledig intact blijft in
// `routes`) wordt een afzonderlijke voertuiggeschikte route berekend en hier
// opgeslagen, samen met de vergelijking (gedeelde delen, splitsingen en
// aansluitpunten). Alles komt uit echte routerings- (ORS driving-car) en
// kaartdata (OSM/Overpass); ontbrekende gegevens blijven eerlijk ontbreken en
// worden als dataNotes aan de gebruiker getoond ("Controleer lokale
// verkeersborden. Niet alle voertuigbeperkingen zijn mogelijk beschikbaar.").

// Segment van de FIETSroute, uitgedrukt in km langs de fietsroute.
// "gedeeld" = de autoroute loopt hier vlak langs de fietsroute;
// "gescheiden" = auto en fietsers rijden hier verschillend.
export type VolgautoSegment = {
  kind: "gedeeld" | "gescheiden";
  startKm: number;
  endKm: number;
};

// Aansluit-/wachtpunt waar de volgauto de renners weer kan ontmoeten.
// `source` is eerlijk: "parkeerplaats" komt uit echte OSM-data (Overpass),
// "route" is simpelweg het punt waar auto- en fietsroute weer samenkomen.
export type VolgautoMeetpoint = {
  lat: number;
  lon: number;
  bikeKm: number; // positie langs de fietsroute
  carKm: number | null; // positie langs de autoroute (null = onbekend)
  name: string;
  source: "parkeerplaats" | "route";
};

export const volgautoPlansTable = pgTable(
  "volgauto_plans",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .notNull()
      .references(() => routesTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    enabled: boolean("enabled").notNull().default(true),
    // Autoroute: geometrie [lat,lon][], navigatiestappen ({km,dir,note}[]).
    carGeometry: jsonb("car_geometry"),
    carNav: jsonb("car_nav"),
    carDistanceKm: real("car_distance_km"),
    carDurationSec: integer("car_duration_sec"),
    // Vergelijking fiets vs auto (VolgautoSegment[] / VolgautoMeetpoint[]).
    segments: jsonb("segments"),
    meetpoints: jsonb("meetpoints"),
    // Eerlijke kanttekeningen (string[]): overgeslagen waypoints, geen
    // parkeerdata beschikbaar, beperkingen mogelijk onvolledig, enz.
    dataNotes: jsonb("data_notes"),
    // Versie van de fietsroute waarop dit plan is berekend; wijkt de route
    // later af, dan is het plan "verouderd" en wordt het opnieuw berekend.
    routeVersion: integer("route_version"),
    computedAt: timestamp("computed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("volgauto_plans_route_unique").on(t.routeId)],
);

// Gebruikersmeldingen na de rit. Uitdrukkelijk GEEN universele waarheid:
// status begint op "nieuw" en meldingen passen nooit automatisch kaartdata of
// bestaande plannen aan — ze wachten op controle.
export const volgautoReportKinds = [
  "weg_afgesloten",
  "verboden_voor_autos",
  "niet_praktisch",
  "wachtpunt_ongeschikt",
] as const;
export type VolgautoReportKind = (typeof volgautoReportKinds)[number];

export const volgautoReportsTable = pgTable(
  "volgauto_reports",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .notNull()
      .references(() => routesTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: text("kind").notNull(),
    note: text("note"),
    lat: real("lat"),
    lon: real("lon"),
    // "nieuw" → wacht op controle; nooit automatisch toegepast.
    status: text("status").notNull().default("nieuw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("volgauto_reports_route_idx").on(t.routeId)],
);

// Live posities tijdens de rit, per route per gebruiker per rol. De renner
// deelt zijn positie alleen wanneer hij navigeert met delen aan; geen rij of
// een verouderde rij betekent eerlijk "geen positie bekend".
export const volgautoRoles = ["renner", "volgauto"] as const;
export type VolgautoRole = (typeof volgautoRoles)[number];

export const volgautoPositionsTable = pgTable(
  "volgauto_positions",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .notNull()
      .references(() => routesTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: text("role").notNull(),
    lat: real("lat").notNull(),
    lon: real("lon").notNull(),
    speedMps: real("speed_mps"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("volgauto_positions_route_user_unique").on(t.routeId, t.clerkId),
  ],
);

export const insertVolgautoReportSchema = createInsertSchema(
  volgautoReportsTable,
).omit({ id: true, createdAt: true, status: true });
export const selectVolgautoPlanSchema = createSelectSchema(volgautoPlansTable);

export type VolgautoPlan = typeof volgautoPlansTable.$inferSelect;
export type VolgautoReport = typeof volgautoReportsTable.$inferSelect;
export type VolgautoPosition = typeof volgautoPositionsTable.$inferSelect;
export type InsertVolgautoReport = z.infer<typeof insertVolgautoReportSchema>;
