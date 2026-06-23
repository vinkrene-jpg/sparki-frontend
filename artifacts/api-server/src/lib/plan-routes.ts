// Server-side route generation + persistence for the autonomous training plan
// (task #17). Reuses the same ORS routing and real-geometry stats math as the
// manual route planner (task #10): geometry/distance/elevation all come from
// ORS — nothing is fabricated. When ORS has no key or fails, the caller gets a
// null routeId and the UI honestly shows "geen route voorgesteld".

import { and, eq } from "drizzle-orm";
import {
  db,
  routesTable,
  plannedWorkoutsTable,
  type BikeType,
  type TrainingType,
  type RoutePoint,
} from "@workspace/db";
import { bikeProfile, routeLoop, reverseGeocode, type LatLon } from "./ors";
import { computeRouteStats, downsampleGeometry } from "./route-geometry";
import {
  loopPoints,
  preferredSurface,
  generateRationale,
} from "./route-generator";

const MAX_GEOMETRY_POINTS = 4000;

// Map an athlete discipline (sport) to the bike type the route generator and ORS
// profile understand. Default to a road race bike — the safest, most common.
export function disciplineToBike(discipline: string | null): BikeType {
  const d = (discipline ?? "").toLowerCase();
  if (d.includes("mtb") || d.includes("mountain")) return "mtb";
  if (d.includes("gravel") || d.includes("cross") || d.includes("cx"))
    return "gravel";
  return "race";
}

function statsFromGeometry(geometry: RoutePoint[]) {
  const geoPoints = geometry.map((c) => ({
    lon: c[0]!,
    lat: c[1]!,
    ele: c.length >= 3 ? (c[2] as number) : null,
  }));
  return computeRouteStats(geoPoints);
}

export type GeneratedPlanRoute = {
  routeId: number;
  distanceKm: number | null;
  elevationGainM: number | null;
  startName: string | null;
};

// Generate a real ORS loop route from the athlete's home location and save it as
// one of their routes, returning the new route id. The route is owned by the
// athlete (clerkId) exactly like a manually generated route. Returns null when
// ORS is unavailable or returns no usable geometry — callers must degrade
// honestly and never invent a route.
export async function generateAndSavePlanRoute(opts: {
  clerkId: string;
  start: LatLon;
  bike: BikeType;
  training: TrainingType;
  targetKm: number;
  seed: number;
  name: string;
}): Promise<GeneratedPlanRoute | null> {
  const { clerkId, start, bike, training, targetKm, seed, name } = opts;
  try {
    const profile = bikeProfile(bike);
    const orsRoute = await routeLoop(profile, start, targetKm, {
      seed,
      points: loopPoints(training),
    });
    if (orsRoute.geometry.length < 2) return null;

    const stats = statsFromGeometry(orsRoute.geometry);
    const geometry = downsampleGeometry(orsRoute.geometry, MAX_GEOMETRY_POINTS);
    const startName = await reverseGeocode(start);

    const rationale = await generateRationale({
      bike,
      training,
      mode: "loop",
      distanceKm: stats.distanceKm,
      elevationGainM: stats.elevationGainM,
      climbCount: stats.climbs.length,
      startName,
      endName: null,
      fromWorkout: true,
    });

    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name,
        surface: preferredSurface(bike),
        visibility: "private",
        status: "ready",
        distanceKm: stats.distanceKm,
        elevationGainM: stats.elevationGainM,
        profile: stats.profile,
        climbs: stats.climbs,
        nav: null,
        geometry,
        rationale,
        bikeType: bike,
        trainingType: training,
        startName,
        endName: null,
        source: "generated",
      })
      .returning({ id: routesTable.id });

    if (!route) return null;
    return {
      routeId: route.id,
      distanceKm: stats.distanceKm,
      elevationGainM: stats.elevationGainM,
      startName,
    };
  } catch {
    // ORS missing key / no route / network — degrade to no route honestly.
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
