// Server-side route generation + persistence for the autonomous training plan.
// Reuses the same provider-backed routing and real-geometry stats math as the
// manual route planner (lib/routing): geometry/distance/elevation all come from
// the routing provider — nothing is fabricated. When the provider has no key or
// fails, the caller gets a null routeId and the UI honestly shows "geen route
// voorgesteld".

import { and, eq } from "drizzle-orm";
import {
  db,
  routesTable,
  plannedWorkoutsTable,
  type RoutePathPoint,
  type RouteEngineSurface,
} from "@workspace/db";
import { aiMessage } from "./ai/gateway";
import { summarizeTrack } from "./gpx-parse";
import { checkOpslag } from "./route-limits";
import {
  getRoutingProvider,
  generateVariedLoop,
  selectRoutingProfile,
  profileToSurface,
  profileCruisingSpeedKmh,
  activityLabel,
  type BikeType,
  type LatLon,
  type RoutingProfile,
} from "./routing";
import { getRouteEnvironment } from "./route-insight";
import { routeObstaclesOf } from "./route-remarks";

// Bewaarbare motor-wegdekmeting uit een providerresultaat (zelfde vorm als de
// routeplanner, taak #492): stuurt de racefiets-verificatie op automatisch
// gegenereerde routes. null als de motor geen wegdek-details levert — er
// wordt nooit een meting verzonnen.
export function planRouteEngineSurface(
  result: {
    pavedFraction?: number | null;
    surfaceKnownFraction?: number | null;
  },
  providerName: string,
): RouteEngineSurface | null {
  const paved = result.pavedFraction ?? null;
  const known = result.surfaceKnownFraction ?? null;
  if (paved == null && known == null) return null;
  return {
    provider: providerName,
    pavedPct: paved != null ? Math.round(paved * 1000) / 10 : null,
    knownPct: known != null ? Math.round(known * 1000) / 10 : null,
    measuredAt: new Date().toISOString(),
  };
}

// Training types the plan engine can request a route for. Steady outdoor rides
// (duur/tempo) get a route; intervals/recovery/race are handled by the caller's
// KIND_ROUTE_NEEDED gate.
export type TrainingType =
  | "duur"
  | "herstel"
  | "tempo"
  | "interval"
  | "wedstrijd";

// Map an athlete discipline (sport) to the bike type the routing profile
// understands. Default to a road race bike — the safest, most common.
export function disciplineToBike(discipline: string | null): BikeType {
  const d = (discipline ?? "").toLowerCase();
  if (d.includes("mtb") || d.includes("mountain")) return "mtb";
  if (d.includes("gravel") || d.includes("cross") || d.includes("cx"))
    return "gravel";
  return "racefiets";
}

// Direct bike → routing profile map, used to size a loop's target distance from
// a workout's duration. The actual distance always comes back from the provider.
function bikeProfile(bike: BikeType): RoutingProfile {
  if (bike === "mtb") return "cycling-mountain";
  if (bike === "gravel") return "cycling-gravel";
  return "cycling-road";
}

// Convert a workout's target duration into a target loop distance (km) using a
// conservative cruising speed for the bike. Only sizes the request — the
// provider returns the real distance.
export function estimateDistanceKm(
  bike: BikeType,
  durationMin: number | null,
): number {
  const speed = profileCruisingSpeedKmh(bikeProfile(bike));
  const minutes = durationMin && durationMin > 0 ? durationMin : 60;
  return Math.round((minutes / 60) * speed);
}

// Fewer waypoints → longer uninterrupted stretches (better for interval blocks);
// more waypoints → a more varied, scenic loop (better for endurance).
function loopPoints(training: TrainingType): number {
  if (training === "interval") return 2;
  if (training === "herstel") return 4;
  return 5;
}

// Short Dutch rationale for why the route fits the workout. Uses the AI
// integration to phrase it, but NEVER to invent geometry — only real numbers
// are passed in. Deterministic fallback if the AI call fails.
async function buildRationale(input: {
  training: TrainingType;
  profile: RoutingProfile;
  distanceKm: number | null;
  elevationGainM: number | null;
  climbCount: number;
  startName: string | null;
}): Promise<string> {
  const label = activityLabel(input.profile);
  const shape = `een lus${input.startName ? ` vanuit ${input.startName}` : ""}`;
  const facts = [
    input.distanceKm != null && `${input.distanceKm} km`,
    input.elevationGainM != null && `${input.elevationGainM} hoogtemeters`,
    input.climbCount > 0 && `${input.climbCount} gedetecteerde klim(men)`,
  ]
    .filter(Boolean)
    .join(", ");

  const fallback = `Deze ${shape} van ${facts || "de gevraagde afstand"} past bij een ${input.training} (${label}).`;

  try {
    const message = await aiMessage("route_rationale", null, {
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system:
        "Je bent Sparki, een Nederlandstalige duursportcoach. Schrijf bondig en feitelijk. Verzin NOOIT cijfers, plaatsnamen of garanties die niet in de gegevens staan. Maximaal 2 zinnen.",
      messages: [
        {
          role: "user",
          content: `Leg in 1-2 Nederlandse zinnen uit waarom deze gegenereerde route past bij de geplande training. Gebruik alleen deze gegevens:\n- Trainingstype: ${input.training}\n- Sport/profiel: ${label}\n- Vorm: ${shape}\n- Afstand: ${input.distanceKm ?? "onbekend"} km\n- Hoogtemeters: ${input.elevationGainM ?? "onbekend"}\n- Klimmen: ${input.climbCount}\nSchrijf geen garanties over verkeer of stadscentra.`,
        },
      ],
    });
    const block = message.content[0];
    const body =
      block && block.type === "text" && block.text.trim()
        ? block.text.trim()
        : fallback;
    return body;
  } catch {
    return fallback;
  }
}

export type GeneratedPlanRoute = {
  routeId: number;
  distanceKm: number | null;
  elevationGainM: number | null;
  startName: string | null;
};

// Generate a real provider-backed loop route from the athlete's home location
// and save it as one of their routes, returning the new route id. The route is
// owned by the athlete (clerkId) exactly like a manually generated route.
// Returns null when the provider is unavailable or returns no usable geometry —
// callers must degrade honestly and never invent a route.
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
  const provider = getRoutingProvider();
  if (!provider.isConfigured()) return null;
  try {
    const profile = selectRoutingProfile({
      sport: "cycling",
      bikeType: bike,
      trainingType: training,
    });
    // Intervaltraining: selecteer op bochtarme kandidaten en (via echte
    // OpenStreetMap-data) op zo min mogelijk verkeerslichten — elke bocht of
    // stop onderbreekt een blok. Alleen rangschikken van echte kandidaten.
    const interval = training === "interval";
    const routeResult = await generateVariedLoop(
      provider,
      {
        start,
        distanceKm: targetKm,
        profile,
        seed,
        points: loopPoints(training),
      },
      interval
        ? {
            preferUninterrupted: true,
            scenery: { nature: false, avoidTrafficLights: true },
            environmentOf: getRouteEnvironment,
            // Obstakel-poort: trap/fietsverbod/afgesloten poort = harde
            // afkeur; minste poorten wint (grenzen René 30-07-2026).
            obstaclesOf: routeObstaclesOf(),
          }
        : { obstaclesOf: routeObstaclesOf() },
    );
    if (routeResult.path.length < 2) return null;

    const summary = summarizeTrack(routeResult.points);
    const distanceKm = summary.distanceKm ?? routeResult.distanceKm;
    const elevationGainM = summary.elevationGainM ?? routeResult.ascentM;
    const startName = await provider.reverseGeocode(start);

    const rationale = await buildRationale({
      training,
      profile,
      distanceKm,
      elevationGainM,
      climbCount: summary.climbs.length,
      startName,
    });

    const geometry: RoutePathPoint[] = routeResult.path;
    const distLabel = distanceKm != null ? ` · ${Math.round(distanceKm)} km` : "";
    const routeName = startName ? `${name} vanuit ${startName}${distLabel}` : `${name}${distLabel}`;

    // 02c — ook automatisch gegenereerde planroutes van Gratis-gebruikers
    // krijgen de 30-dagen-bewaartermijn mee (betaald/legacy blijft null).
    // Plannen zelf blokkeren we bewust niet — dat is coaching, geen beheer.
    const planBesluit = await checkOpslag(clerkId, {});
    const planSavedUntil = planBesluit.allowed ? planBesluit.savedUntil : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name: routeName,
        savedUntil: planSavedUntil,
        surface: profileToSurface(profile),
        visibility: "private",
        status: "ready",
        distanceKm,
        elevationGainM,
        durationSec: routeResult.durationSec,
        profile: summary.profile,
        climbs: summary.climbs,
        nav: routeResult.steps,
        geometry,
        rationale,
        // Motor-wegdekmeting mee opslaan (taak #492): een racefietsroute met
        // knownPct<100 wordt bij presentatie eerlijk als "Niet volledig
        // geverifieerd" gelabeld — nooit stil als geschikt gepresenteerd.
        engineSurface: planRouteEngineSurface(routeResult, provider.name),
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
    // Missing key / no route / network — degrade to no route honestly.
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
