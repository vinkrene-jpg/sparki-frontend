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
import { activityImportsTable } from "./activity-imports";
import { plannedWorkoutsTable } from "./athlete-training";

// Saved routes. Built honestly from real data — for GPX uploads, distance,
// elevation gain, and the elevation profile are computed from <ele>/<trkpt>
// points. For generated routes, geometry/distance/elevation/duration and
// turn-by-turn navigation all come from the routing provider (lib/routing),
// never fabricated. A bare GPX track has no turn semantics, so nav stays null
// for GPX (the UI shows "niet beschikbaar" rather than inventing directions).

export const routeSurfaces = ["asfalt", "gravel", "mtb", "mixed", "pad", "unknown"] as const;
export type RouteSurface = (typeof routeSurfaces)[number];

export const routeStatuses = ["ready", "draft", "archived"] as const;
export type RouteStatus = (typeof routeStatuses)[number];

export const routeVisibilities = ["private", "team", "club", "public"] as const;
export type RouteVisibility = (typeof routeVisibilities)[number];

// Detected climb segment (sustained positive gradient over a stretch).
export type RouteClimb = {
  name: string;
  lengthKm: number;
  avgGradePct: number;
};

// Turn-by-turn navigation cue — reserved for a future routing-engine import.
export type RouteNavCue = {
  km: number;
  dir: string;
  note: string;
};

// A single geographic point along a route path: [lat, lon].
export type RoutePathPoint = [number, number];

// A user-placed shaping point for an interactive route ([lat, lon]). The stored
// geometry is still the real provider-routed path through these points — the
// waypoints are kept so the route can be reopened and re-shaped later.
export type RouteWaypoint = [number, number];

// A named meeting point ("verzamelpunt") — a user annotation, not provider data:
// where a group gathers before/along the ride. lat/lon come from a map click or
// geocode; name/note are authored by the user.
export type RouteMeetpoint = {
  lat: number;
  lon: number;
  name: string;
  note: string | null;
};

export const routesTable = pgTable("routes", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text("name").notNull(),
  surface: text("surface").notNull().default("unknown"),
  status: text("status").notNull().default("ready"),
  visibility: text("visibility").notNull().default("private"),
  distanceKm: real("distance_km"),
  elevationGainM: real("elevation_gain_m"),
  // Estimated moving time (seconds), from the routing provider. Null for GPX.
  durationSec: integer("duration_sec"),
  // Normalized elevation profile points (downsampled, real ele values).
  profile: jsonb("profile"),
  // Detected climbs (RouteClimb[]).
  climbs: jsonb("climbs"),
  // Turn-by-turn cues (RouteNavCue[]) — null until a routing import exists.
  nav: jsonb("nav"),
  // Full path geometry (RoutePathPoint[] — [lat, lon]) so a generated route can
  // be redrawn on a map. Null for GPX routes (we don't store the raw track).
  geometry: jsonb("geometry"),
  // User-placed shaping points (RouteWaypoint[]) for an interactive route, so it
  // can be reopened and re-shaped. Null for loop/ptp/GPX routes.
  waypoints: jsonb("waypoints"),
  // Named meeting points (RouteMeetpoint[]) — "verzamelpunten" the user adds.
  // User annotations (not provider geometry); null when none were placed.
  meetpoints: jsonb("meetpoints"),
  // Short Dutch explanation of why this route fits the workout. Only present on
  // generated routes; honesty caveats are baked into this text.
  rationale: text("rationale"),
  source: text("source").notNull().default("manual"),
  // Gebruikstype van de route: "training" | "toertocht" | "wedstrijd".
  // Wedstrijd activeert Wedstrijdmodus in de live navigatie (rondetelling,
  // wedstrijdpunten, onderdrukking van toeristische lagen).
  usageType: text("usage_type").notNull().default("training"),
  // Favoriet-markering voor de routebibliotheek.
  favorite: boolean("favorite").notNull().default(false),
  // Versienummer: start op 1, +1 bij iedere inhoudelijke wijziging. Trainingen,
  // wedstrijden en activiteiten leggen vast welke versie zij gebruikten
  // (route_version_usages), zodat "welke versie reed ik?" altijd eerlijk is.
  version: integer("version").notNull().default(1),
  // Soft delete: gezet wanneer de route verwijderd wordt terwijl er nog
  // historie (wedstrijddossier, activiteit, versiegebruik) aan hangt. De rij
  // blijft bestaan zodat historie nooit beschadigt; de bibliotheek verbergt
  // verwijderde routes.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  linkedActivityImportId: integer("linked_activity_import_id").references(
    () => activityImportsTable.id,
    { onDelete: "set null" },
  ),
  // Planned workout this route was generated/saved for ("save with the
  // training"). Null for unattached routes.
  linkedPlannedWorkoutId: integer("linked_planned_workout_id").references(
    () => plannedWorkoutsTable.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertRouteSchema = createInsertSchema(routesTable).omit({
  id: true,
});
export const selectRouteSchema = createSelectSchema(routesTable);

export type Route = typeof routesTable.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;
