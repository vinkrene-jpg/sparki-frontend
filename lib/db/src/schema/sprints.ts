import {
  pgTable,
  serial,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { routesTable } from "./routes";

// "Bordjes sprinten" — young riders love sprinting for the town/village name
// signs. A sprint board ("bordje") is the point where a route crosses into a
// new named place, detected honestly from real geometry via reverse geocoding
// (OpenRouteService). Never fabricated: when geocoding is unavailable the
// detection is stored as empty + unavailable, and the UI says so plainly.

export type SprintBoard = {
  // Name of the place whose sign you're sprinting for (e.g. "Nistelrode").
  placeName: string;
  // Where the sign sits, from the reverse-geocode transition point.
  lat: number;
  lon: number;
  // Distance along the route (km) where the place is entered.
  km: number;
};

// Cached per-route detection of sprint boards. Route-intrinsic (same for every
// rider), so keyed by routeId, not by user.
export const routeSprintBoardsTable = pgTable(
  "route_sprint_boards",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .notNull()
      .references(() => routesTable.id, { onDelete: "cascade" }),
    // SprintBoard[] — ordered by km. Empty array when none/undetectable.
    boards: jsonb("boards").notNull(),
    // False when reverse geocoding could not run (honest "kan nu niet bepalen").
    available: text("available").notNull().default("true"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("route_sprint_boards_route_idx").on(t.routeId)],
);

export const sprintRideTypes = ["planned", "free"] as const;
export type SprintRideType = (typeof sprintRideTypes)[number];

export const sprintStatuses = ["scored", "cancelled"] as const;
export type SprintStatus = (typeof sprintStatuses)[number];

// One rider's attempt at one bordje-sprint. All numbers are real: speed from
// GPS, watts only when a Bluetooth power meter was actually connected (else
// null — never a fabricated wattage).
export const sprintResultsTable = pgTable(
  "sprint_results",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Null for a free ride (no saved route).
    routeId: integer("route_id").references(() => routesTable.id, {
      onDelete: "set null",
    }),
    rideType: text("ride_type").notNull().default("free"),
    placeName: text("place_name").notNull(),
    // Distance along the route (km), null for free rides.
    km: real("km"),
    // Peak GPS speed during the sprint window (km/h).
    speedKmhPeak: real("speed_kmh_peak"),
    // Speed gain over the run-in (km/h) — the "how hard did you go" signal.
    speedGainKmh: real("speed_gain_kmh"),
    // Real power, only when a BLE meter was connected. Null otherwise.
    avgWatts: real("avg_watts"),
    peakWatts5s: real("peak_watts_5s"),
    basePoints: integer("base_points").notNull().default(0),
    bonusPoints: integer("bonus_points").notNull().default(0),
    totalPoints: integer("total_points").notNull().default(0),
    status: text("status").notNull().default("scored"),
    // Client-side idempotency key (per sprint-moment, assigned at detection).
    // A retried upload of the same sprint never creates a duplicate row.
    // Null for legacy rows and clients that don't send one.
    clientKey: text("client_key"),
    // Whether the rider chose to share this sprint to their Samen-overzicht.
    shared: text("shared").notNull().default("false"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sprint_results_clerk_idx").on(t.clerkId, t.occurredAt),
    // Partial unique index: dedupe only when a clientKey is present.
    uniqueIndex("sprint_results_client_key_uq")
      .on(t.clerkId, t.clientKey)
      .where(sql`client_key IS NOT NULL`),
  ],
);

export const insertSprintResultSchema = createInsertSchema(
  sprintResultsTable,
).omit({ id: true });
export const selectSprintResultSchema = createSelectSchema(sprintResultsTable);

export type RouteSprintBoards = typeof routeSprintBoardsTable.$inferSelect;
export type SprintResult = typeof sprintResultsTable.$inferSelect;
export type InsertSprintResult = z.infer<typeof insertSprintResultSchema>;
