// Server-side route generation + persistence for the autonomous training plan
// (task #17). Reuses the same provider-backed routing + real-geometry stats math
// as the manual route planner (task #10, lib/routing): geometry/distance/
// elevation/duration all come from the routing provider — nothing is fabricated.
// When the provider has no key or fails, the caller gets a null routeId and the
// UI honestly shows "geen route voorgesteld".

import { and, eq } from "drizzle-orm";
import {
  db,
  routesTable,
  plannedWorkoutsTable,
  type RoutePathPoint,
} from "@workspace/db";
import { summarizeTrack } from "./gpx-parse";
import {
  getRoutingProvider,
  selectRoutingProfile,
  profileToSurface,
  profileCruisingSpeedKmh,
  activityLabel,
  type BikeType,
  type LatLon,
  type RoutingProfile,
} from "./routing";

// Honesty caveat appended to every generated-route rationale: the route is real
// (provider-derived) but Sparki can't guarantee live traffic/road conditions.
const HONESTY_CAVEAT =
  "Let op: afstand, hoogtemeters en route komen rechtstreeks van de routingdienst — Sparki kan geen actuele verkeers- of wegomstandigheden garanderen.";

// Map an athlete discipline (sport) to the bike type the routing profile
// selector understands. Default to a road race bike — the safest, most common.
export function disciplineToBike(discipline: string | null): BikeType {
  const d = (discipline ?? "").toLowerCase();
  if (d.includes("mtb") || d.includes("mountain")) return "mtb";
  if (d.includes("gravel") || d.includes("cross") || d.includes("cx"))
    return "gravel";
  return "racefiets";
}

// Estimate a target loop distance (km) from a workout's duration using the
// routing profile's conservative cruising speed. Only sizes the request — the
// actual distance always comes back from the provider.
export function estimateDistanceKm(
  bike: BikeType,
  durationMin: number | null,
): number {
  const profile = selectRoutingProfile({ sport: "cycling", bikeType: bike });
  const minutes = durationMin ?? 60;
  return Math.round((minutes / 60) * profileCruisingSpeedKmh(profile));
}

// Number of intermediate waypoints for a loop, by training intent. Mirrors the
// manual route planner so generated plan routes have the same loop shape.
function loopPointsFor(trainingType: string): number {
  const t = trainingType.toLowerCase();
  if (t.includes("interval")) return 2;
  if (t.includes("herstel") || t.includes("recovery")) return 4;
  return 5;
}

// Deterministic, honest Dutch rationale built ONLY from the real provider-
// derived numbers. No fabricated figures, no traffic guarantees.
function buildPlanRouteRationale(input: {
  trainingType: string;
  profile: RoutingProfile;
  distanceKm: number | null;
  elevationGainM: number | null;
  climbCount: number;
  startName: string | null;
}): string {
  const label = activityLabel(input.profile);
  const shape = `een lus${input.startName ? ` vanuit ${input.startName}` : ""}`;
  const facts = [
    input.distanceKm != null && `${Math.round(input.distanceKm)} km`,
    input.elevationGainM != null && `${input.elevationGainM} hoogtemeters`,
    input.climbCount > 0 && `${input.climbCount} gedetecteerde klim(men)`,
  ]
    .filter(Boolean)
    .join(", ");
  const body = `Deze ${shape} van ${facts || "de gevraagde afstand"} past bij een ${input.trainingType} (${label}).`;
  return `${body}\n\n${HONESTY_CAVEAT}`;
}

export type GeneratedPlanRoute = {
  routeId: number;
  distanceKm: number | null;
  elevationGainM: number | null;
  startName: string | null;
};

// Generate a real provider loop route from the athlete's home location and save
// it as one of their routes, returning the new route id. The route is owned by
// the athlete (clerkId) exactly like a manually generated route. Returns null
// when the provider is unavailable or returns no usable geometry — callers must
// degrade honestly and never invent a route.
export async function generateAndSavePlanRoute(opts: {
  clerkId: string;
  start: LatLon;
  bike: BikeType;
  training: string;
  targetKm: number;
  seed: number;
  name: string;
}): Promise<GeneratedPlanRoute | null> {
  const { clerkId, start, bike, training, targetKm, seed, name } = opts;
  try {
    const provider = getRoutingProvider();
    if (!provider.isConfigured()) return null;

    const profile = selectRoutingProfile({
      sport: "cycling",
      bikeType: bike,
      trainingType: training,
      targetDistanceKm: targetKm,
    });

    const routeResult = await provider.generateLoop({
      start,
      distanceKm: targetKm,
      profile,
      seed,
      points: loopPointsFor(training),
    });
    if (routeResult.path.length < 2) return null;

    const summary = summarizeTrack(routeResult.points);
    const distanceKm = summary.distanceKm ?? routeResult.distanceKm;
    const elevationGainM = summary.elevationGainM ?? routeResult.ascentM;
    const startName = await provider.reverseGeocode(start);

    const rationale = buildPlanRouteRationale({
      trainingType: training,
      profile,
      distanceKm,
      elevationGainM,
      climbCount: summary.climbs.length,
      startName,
    });

    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name,
        surface: profileToSurface(profile),
        status: "ready",
        visibility: "private",
        distanceKm,
        elevationGainM,
        durationSec: routeResult.durationSec,
        profile: summary.profile,
        climbs: summary.climbs,
        nav: routeResult.steps,
        geometry: routeResult.path as RoutePathPoint[],
        rationale,
        source: "generated",
      })
      .returning({ id: routesTable.id });

    if (!route) return null;
    return {
      routeId: route.id,
      distanceKm,
      elevationGainM,
      startName,
    };
  } catch {
    // Provider missing key / no route / network — degrade to no route honestly.
    return null;
  }
}

// Attach a generated route to a committed planned workout (owner-checked).
export async function attachRouteToWorkout(
  clerkId: string,
  plannedWorkoutId: number,
  routeId: number,
): Promise<void> {
  await db
    .update(plannedWorkoutsTable)
    .set({ routeId, updatedAt: new Date() })
    .where(
      and(
        eq(plannedWorkoutsTable.id, plannedWorkoutId),
        eq(plannedWorkoutsTable.clerkId, clerkId),
      ),
    );
}
