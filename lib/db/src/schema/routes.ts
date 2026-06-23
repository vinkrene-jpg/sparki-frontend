import {
  pgTable,
  serial,
  text,
  integer,
  real,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { activityImportsTable } from "./activity-imports";

// Saved cycling routes. Built honestly from real GPX track data via
// lib/gpx-parse.ts — distance, elevation gain, and a downsampled elevation
// profile are all computed from <ele>/<trkpt> points. Turn-by-turn navigation
// is NOT derivable from a bare GPX track and is left null in v1 (the UI shows
// "niet beschikbaar" rather than fabricating directions).

export const routeSurfaces = ["asfalt", "gravel", "mtb", "mixed", "unknown"] as const;
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

export const routesTable = pgTable("routes", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  name: text("name").notNull(),
  surface: text("surface").notNull().default("unknown"),
  status: text("status").notNull().default("ready"),
  visibility: text("visibility").notNull().default("private"),
  distanceKm: real("distance_km"),
  elevationGainM: real("elevation_gain_m"),
  // Normalized elevation profile points (downsampled, real ele values).
  profile: jsonb("profile"),
  // Detected climbs (RouteClimb[]).
  climbs: jsonb("climbs"),
  // Turn-by-turn cues (RouteNavCue[]) — null until a routing import exists.
  nav: jsonb("nav"),
  source: text("source").notNull().default("manual"),
  linkedActivityImportId: integer("linked_activity_import_id").references(
    () => activityImportsTable.id,
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
