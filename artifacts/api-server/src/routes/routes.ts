import { Router } from "express";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  routesTable,
  trainingSessionsTable,
  activityImportsTable,
  plannedWorkoutsTable,
  routeSurfaces,
  routeVisibilities,
  routeSharesTable,
  routeVersionUsagesTable,
  routeShareAudiences,
  racesTable,
  racePointsTable,
  sprintResultsTable,
  coachAthleteLinksTable,
  clubMembersTable,
  athleteProfilesTable,
  userProfilesTable,
  routeLibraryTable,
  routeLibraryCommentsTable,
  privacyZonesTable,
  privacyZoneKinds,
  PRIVACY_ZONE_MIN_RADIUS_M,
  PRIVACY_ZONE_MAX_RADIUS_M,
  PRIVACY_ZONE_DEFAULT_RADIUS_M,
  type RouteShareAudience,
  type RouteSurface,
  type RouteVisibility,
  type RoutePathPoint,
  type RouteWaypoint,
  type RouteMeetpoint,
  type RouteEngineSurface,
} from "@workspace/db";
import {
  applyLocationPrivacy,
  type PrivacyZoneCircle,
} from "../lib/world-social/location";
import {
  loadOwnerPrivacyZones,
  HOME_ZONE_RADIUS_M,
} from "../lib/world-social/privacy-zones";
import { sanitizeNavSteps } from "../lib/routing/nav-sanitize";
import { controlUnpavedShare } from "../lib/surface-control";
import { activeRacePoints } from "../lib/race-points";
import { registerRouteUsage } from "../lib/route-usage";
import {
  createRouteGenerationJob,
  finishJob,
  getRouteGenerationJob,
  setJobPhase,
} from "../lib/route-generation-jobs";
import { aiMessage } from "../lib/ai/gateway";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isMinorAthlete, isVerifiedAdultAthlete } from "../lib/sharing";
import {
  parseGpxRoute,
  summarizeTrack,
  buildGpx,
  buildTcx,
  putCandidate,
  getCandidate,
  updateCandidateRationale,
  getRoutingProvider,
  bikeSuitabilityConfigError,
  generateVariedLoop,
  NoSuitableRouteError,
  UnverifiableRouteError,
  selectRoutingProfile,
  profileToSurface,
  profileCruisingSpeedKmh,
  activityLabel,
  sports,
  bikeTypes,
  elevationPreferences,
  type Sport,
  type BikeType,
  type ElevationPreference,
  type RoutingProfile,
  type RouteStep,
  type CandidateEnvironment,
} from "../engines/route";
import { getRoadObjectsAlongRoute } from "../engines/road-objects";
import { isSportActive } from "@workspace/feature-flags";
import { getHourlyForecast } from "../lib/weather/open-meteo";
import {
  computeGradeSplit,
  getRouteEnvironment,
  windDirectionLabel,
  beaufort,
} from "../lib/route-insight";
import {
  ensureLibraryRoutes,
  countCellRoutes,
  cellKeyFor,
  routesInBbox,
} from "../lib/route-library";
import {
  filterOpStraal,
  haversineKm,
  parseStraalCentrum,
  straalOphaalBbox,
  type StraalCentrum,
} from "../lib/route-library-straal";
import { maybeReplacePoorRoute } from "../lib/route-improvement";
import { getRoutePois } from "../lib/route-pois";
import {
  getRouteRemarks,
  computeDataRemarks,
  countRouteObstacles,
  remarksSource,
  routeObstaclesOf,
} from "../lib/route-remarks";
import {
  rankKnownRoutes,
  verifyKnownRoutes,
  hybrideViaPunten,
  sharedKnownRouteRow,
  type KnownRouteRow,
} from "../lib/route-search";
import {
  getRouteSurfaces,
  computeBikeSuitability,
  compareSurfaceSources,
  maxSlopePct,
  surfacesSource,
} from "../lib/route-surfaces";

const router = Router();

function coerceSurface(v: unknown): RouteSurface {
  return typeof v === "string" &&
    (routeSurfaces as readonly string[]).includes(v)
    ? (v as RouteSurface)
    : "unknown";
}

function coerceVisibility(v: unknown): RouteVisibility {
  return typeof v === "string" &&
    (routeVisibilities as readonly string[]).includes(v)
    ? (v as RouteVisibility)
    : "private";
}

// Zichtbaarheid bij aanmaken: als "public" gevraagd wordt door een
// minderjarige valt de route stil terug op privé (fail-closed).
async function safeVisibility(
  clerkId: string,
  v: unknown,
): Promise<RouteVisibility> {
  const vis = coerceVisibility(v);
  if (vis === "public" && (await isMinorAthlete(clerkId))) return "private";
  return vis;
}

function coerceSport(v: unknown): Sport {
  return typeof v === "string" && (sports as readonly string[]).includes(v)
    ? (v as Sport)
    : "cycling";
}

function coerceBikeType(v: unknown): BikeType | null {
  return typeof v === "string" && (bikeTypes as readonly string[]).includes(v)
    ? (v as BikeType)
    : null;
}

function coerceElevation(v: unknown): ElevationPreference | null {
  return typeof v === "string" &&
    (elevationPreferences as readonly string[]).includes(v)
    ? (v as ElevationPreference)
    : null;
}

function finiteNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Onverhard-voorkeur (taak #440): percentage (0..100) uit de schuifbalk,
// geldig alleen voor gravel/MTB. Racefiets/gewone fiets: altijd null — daar
// geldt de harde 0%-grens (taak #437). Retourneert een aandeel 0..1.
function coerceUnpavedTargetShare(
  v: unknown,
  bikeType: BikeType | null,
): number | null {
  if (bikeType !== "gravel" && bikeType !== "mtb") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), 100) / 100;
}

// Vermijd drukke N-wegen (taak #462, kalibratie René 30-07-2026): expliciete
// keuze in de route-maken-flow. VOORKEUR via de motor (road_class primary/
// secondary-straf in het GraphHopper custom model) — de harde geschiktheids-
// poorten (0% onverhard racefiets, fietsverbod, trap, poort) blijven
// onaangetast. Alleen fietsen; accepteert zowel body.avoidBusyRoads als
// avoid.drukkeWegen.
function coerceAvoidBusyRoads(
  body: Record<string, unknown>,
  sport: string,
): boolean {
  if (sport !== "cycling") return false;
  if (body.avoidBusyRoads === true) return true;
  const avoid =
    body.avoid && typeof body.avoid === "object"
      ? (body.avoid as Record<string, unknown>)
      : {};
  return avoid.drukkeWegen === true;
}

// Eerlijk rapport voor de N-wegen-keuze op basis van de GEMETEN road_class-
// details van de motor zélf. Boven ~10% N-weg is vermijden in dit gebied
// aantoonbaar niet gelukt — dat zeggen we dan, in plaats van stiekem toch
// N-weg te rijden. Zonder meting (ORS): eerlijk "geen meting".
const BUSY_ROAD_HONESTY_THRESHOLD = 0.10;
function applyBusyRoadReport(
  report: { toegepast: string[]; nietMogelijk: { wens: string; reden: string }[] },
  avoidBusyRoads: boolean,
  busyRoadFraction: number | null | undefined,
): void {
  if (!avoidBusyRoads) return;
  if (busyRoadFraction == null) {
    report.nietMogelijk.push({
      wens: "drukke N-wegen vermijden",
      reden:
        "De routebron gaf voor deze route geen wegtype-meting terug, dus Sparki kan niet controleren of het vermijden gelukt is.",
    });
    return;
  }
  if (busyRoadFraction > BUSY_ROAD_HONESTY_THRESHOLD) {
    report.nietMogelijk.push({
      wens: "drukke N-wegen vermijden",
      reden: `In dit gebied lukte het niet zonder: ongeveer ${Math.round(busyRoadFraction * 100)}% van de route loopt toch over doorgaande wegen (N-wegen). Probeer een ander startpunt of een kortere afstand.`,
    });
    return;
  }
  report.toegepast.push(
    busyRoadFraction > 0
      ? `drukke N-wegen vermeden (nog ~${Math.max(1, Math.round(busyRoadFraction * 100))}% doorgaande weg)`
      : "drukke N-wegen vermeden",
  );
}

// Parse the athlete's free-text wish for the route ("langs de rivier",
// "vermijd drukke wegen", "veel klimwerk"). Trimmed, collapsed and capped so a
// runaway paste can't bloat the prompt. Empty/blank → null.
function parseWish(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/\s+/g, " ").trim().slice(0, 400);
  return cleaned.length > 0 ? cleaned : null;
}

// Parse an ordered list of user-placed waypoints ([lat, lon] pairs) from the
// request body, dropping anything malformed or out of range. Used by the
// interactive (waypoints) generation mode.
function parseWaypoints(v: unknown): { lat: number; lon: number }[] {
  if (!Array.isArray(v)) return [];
  const out: { lat: number; lon: number }[] = [];
  for (const item of v) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const lat = Number(item[0]);
    const lon = Number(item[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.push({ lat, lon });
  }
  return out;
}

// Parse named meeting points ("verzamelpunten") from the request body. These are
// user annotations (not provider geometry), so client-supplied lat/lon/name are
// accepted — but sanitised: coordinates range-checked, names trimmed/capped, and
// malformed entries dropped. Capped to a sensible maximum.
function parseMeetpoints(v: unknown): RouteMeetpoint[] {
  if (!Array.isArray(v)) return [];
  const out: RouteMeetpoint[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const lat = Number(o.lat);
    const lon = Number(o.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    // Strip angle brackets so stored values can never carry HTML/markup into
    // any downstream sink (defence-in-depth alongside client-side escaping).
    const stripMarkup = (s: string) => s.replace(/[<>]/g, "").trim();
    const rawName = typeof o.name === "string" ? stripMarkup(o.name) : "";
    const name = (rawName || "Verzamelpunt").slice(0, 80);
    const rawNote = typeof o.note === "string" ? stripMarkup(o.note) : "";
    const note = rawNote ? rawNote.slice(0, 280) : null;
    out.push({ lat, lon, name, note });
    if (out.length >= 25) break;
  }
  return out;
}

// Detect a scenery wish in the athlete's free text: more nature and/or fewer
// traffic-light crossings. These are the two things the loop selector can
// genuinely steer on (by ranking real candidates on real OpenStreetMap data);
// everything else in the wish stays prompt-only.
function detectSceneryWish(
  wish: string | null,
): { nature: boolean; avoidTrafficLights: boolean } | null {
  if (!wish) return null;
  const w = wish.toLowerCase();
  const nature = /natuur|bos(?:sen|rijk)?\b|groen|park|heide|duinen/.test(w);
  const avoidTrafficLights =
    /verkeerslicht|stoplicht|kruispunt|kruising/.test(w);
  if (!nature && !avoidTrafficLights) return null;
  return { nature, avoidTrafficLights };
}

// Fewer waypoints → longer uninterrupted stretches (better for interval blocks);
// more waypoints → a more varied, scenic loop (better for endurance).
function loopPointsFor(trainingType: string): number {
  const t = trainingType.toLowerCase();
  if (t.includes("interval")) return 2;
  if (t.includes("tempo")) return 3;
  if (t.includes("herstel") || t.includes("recovery")) return 4;
  return 5;
}

// Omgevingsmeting per lus-kandidaat: gedeeld in lib/candidate-environment
// (vaste rustige-wegen-eis geldt voor ÁLLE generatiepaden).
import {
  candidateEnvironmentOf,
  stopObstaclesFrom,
} from "../lib/candidate-environment";
// Achtergrond-warm-up: registreert generate-startgebieden zodat de
// omgevingsmeting daar bij een volgende aanvraag al gecachet is.
import { recordGeneratedArea } from "../lib/route-env-warmup";

// Build a short Dutch rationale for why the route fits the workout. Uses the AI
// integration to phrase it, but NEVER to invent geometry — only the real,
// ORS-derived numbers are passed in. Falls back to a deterministic template if
// the AI call fails. The honesty caveat is always appended server-side.
// Shared input type for both buildRationaleA (AI) and buildRationaleFallback (deterministic).
type RationaleInput = {
  trainingType: string;
  profile: RoutingProfile;
  mode: "loop" | "ptp" | "waypoints";
  distanceKm: number | null;
  durationSec: number | null;
  elevationGainM: number | null;
  climbCount: number;
  startName: string | null;
  endName: string | null;
  wish: string | null;
  environment?: {
    trafficLights: number | null;
    forestSharePct: number | null;
    speedBumps?: number | null;
    roundabouts?: number | null;
    railwayCrossings?: number | null;
    estimatedTimeLossSec?: number | null;
  } | null;
};

// Deterministic rationale — instant, no external calls. Used as the immediate
// response until the AI-enrichment background job finishes.
function buildRationaleFallback(input: RationaleInput): string {
  const label = activityLabel(input.profile);
  const shape =
    input.mode === "loop"
      ? `een lus${input.startName ? ` vanuit ${input.startName}` : ""}`
      : input.mode === "waypoints"
        ? `een zelf uitgestippelde route${input.startName ? ` vanuit ${input.startName}` : ""}`
        : `een route${input.startName ? ` van ${input.startName}` : ""}${input.endName ? ` naar ${input.endName}` : ""}`;
  const parts: string[] = [];
  if (input.distanceKm != null) parts.push(`${Math.round(input.distanceKm)} km`);
  if (input.durationSec != null)
    parts.push(`±${Math.round(input.durationSec / 60)} min`);
  if (input.elevationGainM != null)
    parts.push(`±${Math.round(input.elevationGainM)} hm`);
  if (input.climbCount > 0) parts.push(`${input.climbCount} klim(men)`);
  const facts = parts.join(", ");
  return `Deze ${shape} van ${facts || "de gevraagde afstand"} past bij een ${input.trainingType} (${label}).`;
}

async function buildRationale(input: RationaleInput): Promise<string> {
  const label = activityLabel(input.profile);
  const shape =
    input.mode === "loop"
      ? `een lus${input.startName ? ` vanuit ${input.startName}` : ""}`
      : input.mode === "waypoints"
        ? `een zelf uitgestippelde route${input.startName ? ` vanuit ${input.startName}` : ""}`
        : `een route${input.startName ? ` van ${input.startName}` : ""}${input.endName ? ` naar ${input.endName}` : ""}`;
  const durationLabel =
    input.durationSec != null
      ? `${Math.round(input.durationSec / 60)} min`
      : null;
  const facts = [
    input.distanceKm != null && `${input.distanceKm} km`,
    durationLabel && `±${durationLabel}`,
    input.elevationGainM != null && `${input.elevationGainM} hoogtemeters`,
    input.climbCount > 0 && `${input.climbCount} gedetecteerde klim(men)`,
  ]
    .filter(Boolean)
    .join(", ");

  const fallback = buildRationaleFallback(input);

  // What the routegenerator can actually steer on. Free-text wishes about
  // afstand/hoogte/ondergrond can be honoured; specific roads, plaatsen or
  // "vermijd X" cannot be guaranteed by the round-trip engine. The prompt must
  // say so plainly and never claim the route passes a place it can't verify.
  const env = input.environment;
  const envParts = env
    ? [
        env.forestSharePct != null &&
          `~${env.forestSharePct}% van de route door bos/natuur`,
        env.trafficLights != null &&
          `${env.trafficLights} verkeerslicht(en) op de route`,
        env.roundabouts != null && `${env.roundabouts} rotonde(s)`,
        env.speedBumps != null && `${env.speedBumps} drempel(s)`,
        env.railwayCrossings != null &&
          `${env.railwayCrossings} spoorwegovergang(en)`,
        env.estimatedTimeLossSec != null &&
          env.estimatedTimeLossSec > 0 &&
          `geschat ±${Math.round(env.estimatedTimeLossSec / 60)} min stilstand door verkeerslichten`,
      ].filter(Boolean)
    : [];
  const envFacts =
    envParts.length > 0
      ? `\n- Gemeten omgeving (wegobjecten-database + OpenStreetMap): ${envParts.join(", ")}`
      : "";

  // What the generator can steer on differs per mode: only the loop generator
  // compares multiple real candidates on map data (natuur/verkeerslichten);
  // point-to-point and waypoint routes are a single real route, so claiming
  // scenery steering there would be an overclaim.
  const steerCapability =
    input.mode === "loop"
      ? `De routegenerator kan sturen op afstand, hoeveel klimwerk (vlak/heuvelachtig), de ondergrond/het profiel, en — door meerdere echte kandidaten te vergelijken op kaartgegevens — op meer natuur en minder onderbrekingen (verkeerslichten, rotondes, drempels, spoorwegovergangen). NIET op specifieke wegen, plaatsen of bezienswaardigheden.`
      : `De routegenerator kan alleen sturen op afstand, hoeveel klimwerk (vlak/heuvelachtig) en de ondergrond/het profiel — NIET op specifieke wegen, plaatsen, bezienswaardigheden of "vermijd"-verzoeken.`;
  const wishBlock = input.wish
    ? `\n\nDe renner gaf deze wens op: "${input.wish}".\n${steerCapability} Beoordeel de wens eerlijk:\n- Kon de wens (deels) worden ingevuld? Zeg kort dat het gelukt is; noem bij een natuur-/verkeerslichtenwens alleen de gemeten omgevingscijfers hierboven (als die er zijn).\n- Gaat de wens over een specifieke weg/plaats of een vermijd-verzoek dat de generator niet kan garanderen? Zeg dat eerlijk in gewone taal ("Ik kan de route niet op … sturen") en bied deze route aan als passend alternatief voor de training. Beweer NOOIT dat de route langs een plek gaat die niet in de gegevens staat.`
    : "";

  try {
    const message = await aiMessage("route_rationale", null, {
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system:
        "Je bent Sparki, een Nederlandstalige duursportcoach. Schrijf bondig en feitelijk. Verzin NOOIT cijfers, plaatsnamen of garanties die niet in de gegevens staan. Maximaal 4 zinnen.",
      messages: [
        {
          role: "user",
          content: `Leg in 1-2 Nederlandse zinnen uit waarom deze gegenereerde route past bij de geplande training. Gebruik alleen deze gegevens:\n- Trainingstype: ${input.trainingType}\n- Sport/profiel: ${label}\n- Vorm: ${shape}\n- Afstand: ${input.distanceKm ?? "onbekend"} km\n- Geschatte duur: ${durationLabel ?? "onbekend"}\n- Hoogtemeters: ${input.elevationGainM ?? "onbekend"}\n- Klimmen: ${input.climbCount}${envFacts}\nSchrijf geen garanties over verkeer of stadscentra buiten de gemeten omgevingscijfers.${wishBlock}`,
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

// ── Golf 19: bibliotheek, delen & privacy ──────────────────────────────────

type RouteRow = typeof routesTable.$inferSelect;

// ── Async route enrichment ───────────────────────────────────────────────────
// Every generated route is returned IMMEDIATELY with a deterministic fallback
// rationale so the rider sees geometry within ≤3 s. The AI-phrased rationale and
// road-objects data are computed in the background. The client polls
// GET /candidate/:id/enrich to receive the enriched copy.

type EnrichmentEntry = {
  clerkId: string;
  pending: boolean;
  result?: {
    rationale: string;
    roadObjects: {
      counts: Record<string, number>;
      signalsPerKm: number | null;
      estimatedTimeLossSec: number | null;
    } | null;
  };
  error?: boolean;
  // Deterministic fallback rationale stored when enrichment fails so the
  // client can show it immediately instead of staying in "laden…" forever.
  fallbackRationale?: string;
  at: number;
};

const ENRICHMENT = new Map<string, EnrichmentEntry>();
const ENRICHMENT_TTL_MS = 30 * 60_000;

function evictEnrichment(): void {
  const now = Date.now();
  for (const [id, e] of ENRICHMENT) {
    if (now - e.at > ENRICHMENT_TTL_MS) ENRICHMENT.delete(id);
  }
}

// ── In-process route geometry cache ──────────────────────────────────────────
// Caches ONLY the raw provider geometry (ORS result + geocoding) keyed on the
// parameters that determine road geometry. candidateId and user context are
// NEVER stored: on a cache hit putCandidate is always called fresh so the new
// candidate is owned by the current user with the current plannedWorkoutId.
// This makes cross-user sharing safe — geometry is stateless — and avoids any
// stale-ownership or wrong-workout-linkage bugs.
// TTL: 5 min (same order as ENRICHMENT but shorter; geometry can change on OSM).

type CachedRouteGeometry = {
  path: [number, number][];
  points: Array<{ lat: number; lon: number; ele: number | null }>;
  distanceKm: number | null;
  ascentM: number | null;
  durationSec: number | null;
  steps: RouteStep[];
  // Wegdekmeting van de routemotor zélf (0–1); null als de motor dat niet
  // levert. Meegecachet zodat een cache-hit dezelfde eerlijke meting draagt.
  pavedFraction?: number | null;
  surfaceKnownFraction?: number | null;
  // Gemeten aandeel drukke doorgaande wegen (N-wegen, taak #462); null als de
  // motor geen road_class-details levert. Voedt het eerlijke avoid-rapport.
  busyRoadFraction?: number | null;
};

// Bouw de bewaarbare motor-wegdekmeting uit een providerresultaat. null als de
// motor geen wegdek-details levert — er wordt nooit een meting verzonnen.
function engineSurfaceOf(
  geom: Pick<CachedRouteGeometry, "pavedFraction" | "surfaceKnownFraction">,
): RouteEngineSurface | null {
  const paved = geom.pavedFraction ?? null;
  const known = geom.surfaceKnownFraction ?? null;
  if (paved == null && known == null) return null;
  return {
    provider: getRoutingProvider().name,
    pavedPct: paved != null ? Math.round(paved * 1000) / 10 : null,
    knownPct: known != null ? Math.round(known * 1000) / 10 : null,
    measuredAt: new Date().toISOString(),
  };
}

type RouteGeometryCacheEntry = {
  geometry: CachedRouteGeometry;
  startName: string | null;
  endName: string | null; // populated for PTP/waypoints, null for loop
  at: number;
};

const ROUTE_GEOMETRY_CACHE = new Map<string, RouteGeometryCacheEntry>();
const ROUTE_GEOMETRY_CACHE_TTL_MS = 5 * 60_000;

function evictRouteGeometryCache(): void {
  const now = Date.now();
  for (const [key, e] of ROUTE_GEOMETRY_CACHE) {
    if (now - e.at > ROUTE_GEOMETRY_CACHE_TTL_MS) ROUTE_GEOMETRY_CACHE.delete(key);
  }
}

// Stable, deterministic geometry cache key. Sorted keys so insertion order
// can never produce a different string. Inputs are numbers/strings/null —
// JSON.stringify is deterministic for this value domain.
function routeGeometryCacheKey(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = params[k];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

// Fire background enrichment for a freshly generated candidate. Never throws.
function scheduleEnrichment(
  candidateId: string,
  clerkId: string,
  rationaleInput: RationaleInput,
  routePath: [number, number][],
  hasNature: boolean,
): void {
  evictEnrichment();
  ENRICHMENT.set(candidateId, { clerkId, pending: true, at: Date.now() });

  const _t0 = performance.now();
  // Phase 1: road objects + optional environment (parallel)
  Promise.all([
    hasNature
      ? getRouteEnvironment(routePath).catch(() => null)
      : Promise.resolve(null),
    getRoadObjectsAlongRoute(routePath).catch(() => null),
  ])
    .then(([envRaw, roadObjects]) => {
      const environment =
        envRaw || roadObjects
          ? {
              trafficLights:
                roadObjects?.counts["traffic_signal"] ??
                envRaw?.trafficLights ??
                null,
              forestSharePct: envRaw?.forestSharePct ?? null,
              speedBumps: roadObjects?.counts["speed_bump"] ?? null,
              roundabouts: roadObjects?.counts["roundabout"] ?? null,
              railwayCrossings: roadObjects?.counts["railway_crossing"] ?? null,
              estimatedTimeLossSec: roadObjects?.estimatedTimeLossSec ?? null,
            }
          : null;
      // Phase 2: AI rationale using real environment data
      return Promise.all([
        buildRationale({ ...rationaleInput, environment }),
        Promise.resolve(roadObjects),
      ]);
    })
    .then(([rationale, roadObjects]) => {
      console.log(
        `[PERF] enrich.done cid=${candidateId.slice(0, 8)} ms=${Math.round(performance.now() - _t0)}`,
      );
      updateCandidateRationale(candidateId, clerkId, rationale);
      ENRICHMENT.set(candidateId, {
        clerkId,
        pending: false,
        result: {
          rationale,
          roadObjects: roadObjects
            ? {
                counts: roadObjects.counts,
                signalsPerKm: roadObjects.signalsPerKm,
                estimatedTimeLossSec: roadObjects.estimatedTimeLossSec,
              }
            : null,
        },
        at: Date.now(),
      });
    })
    .catch((err) => {
      console.error(
        `[PERF] enrich.error cid=${candidateId.slice(0, 8)}`,
        err instanceof Error ? err.message : String(err),
      );
      // Store the deterministic fallback so the client can show it permanently
      // instead of staying in an endless "laden…" state.
      ENRICHMENT.set(candidateId, {
        clerkId,
        pending: false,
        error: true,
        fallbackRationale: buildRationaleFallback(rationaleInput),
        at: Date.now(),
      });
    });
}

// Huisadres van de eigenaar (voor de privacyzone bij delen). Null = onbekend;
// applyLocationPrivacy valt dan fail-closed terug op start/einde verbergen.
async function ownerHome(
  clerkId: string,
): Promise<{ lat: number; lon: number } | null> {
  const [p] = await db
    .select({
      homeLat: athleteProfilesTable.homeLat,
      homeLon: athleteProfilesTable.homeLon,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  return p?.homeLat != null && p?.homeLon != null
    ? { lat: Number(p.homeLat), lon: Number(p.homeLon) }
    : null;
}

// Alle privacyzones van de eigenaar: het huisadres (altijd impliciet, 750 m)
// plus de zelf beheerde zones (woning/werk/gevoelig, eigen straal). Gedeelde
// helper met de World Social-rittenweergave zodat "elke gedeelde weergave"
// overal dezelfde zones gebruikt.
const ownerPrivacyZones = loadOwnerPrivacyZones;

// Actieve clubs van een gebruiker.
async function activeClubIds(clerkId: string): Promise<number[]> {
  const rows = await db
    .select({ clubId: clubMembersTable.clubId })
    .from(clubMembersTable)
    .where(
      and(eq(clubMembersTable.clerkId, clerkId), isNull(clubMembersTable.endedAt)),
    );
  return rows.map((r) => r.clubId);
}

// Mag deze kijker (niet-eigenaar) de route zien? Gedeeld met:
// - persoon: expliciet aan deze gebruiker
// - coach: kijker is geaccepteerde coach van de eigenaar
// - club/team: kijker en eigenaar zijn actieve leden van dezelfde club
async function canViewSharedRoute(
  route: RouteRow,
  viewerClerkId: string,
): Promise<boolean> {
  // Openbare routes zijn voor iedere ingelogde gebruiker zichtbaar — altijd in
  // de veilige kijkersweergave. Fail-closed voor minderjarigen: ook als een
  // route (bijv. een oude rij) tóch op openbaar staat, blijft een route van
  // een minderjarige eigenaar onzichtbaar voor anderen.
  if (route.visibility === "public") {
    return !(await isMinorAthlete(route.clerkId));
  }
  const shares = await db
    .select()
    .from(routeSharesTable)
    .where(eq(routeSharesTable.routeId, route.id));
  if (shares.length === 0) return false;
  if (
    shares.some(
      (s) => s.audience === "persoon" && s.targetClerkId === viewerClerkId,
    )
  ) {
    return true;
  }
  if (shares.some((s) => s.audience === "coach")) {
    const [link] = await db
      .select({ status: coachAthleteLinksTable.status })
      .from(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, viewerClerkId),
          eq(coachAthleteLinksTable.athleteClerkId, route.clerkId),
          eq(coachAthleteLinksTable.status, "accepted"),
        ),
      )
      .limit(1);
    if (link) return true;
  }
  if (shares.some((s) => s.audience === "club" || s.audience === "team")) {
    const [mine, theirs] = await Promise.all([
      activeClubIds(viewerClerkId),
      activeClubIds(route.clerkId),
    ]);
    if (mine.some((c) => theirs.includes(c))) return true;
  }
  return false;
}

// Kijkersweergave: exacte privé-startlocaties worden NOOIT automatisch
// gedeeld. Start/einde afgekapt + privacyzone rond het huis van de eigenaar
// (fail-closed wanneer het huisadres onbekend is). Het hoogteprofiel is
// per-punt gekoppeld aan de originele geometrie en zou na afkappen niet meer
// kloppen — dus eerlijk null. Navigatie-aanwijzingen idem (start klopt niet
// meer). Totalen (afstand/hoogtemeters) blijven de echte totalen van de route.
function viewerRouteView(route: RouteRow, zones: PrivacyZoneCircle[]) {
  const raw = Array.isArray(route.geometry)
    ? (route.geometry as RoutePathPoint[]).map((p) => ({
        lat: Number(p[0]),
        lon: Number(p[1]),
      }))
    : [];
  const track = applyLocationPrivacy(
    raw,
    { hideStartEnd: true, privacyZone: true, simplify: true },
    zones,
  );
  return {
    ...route,
    geometry: track ? track.map((p) => [p.lat, p.lon] as RoutePathPoint) : null,
    nav: null,
    waypoints: null,
    profile: null,
    gedeeld: true,
    origineel: false,
    privacyNote:
      "Start en einde van deze route zijn afgeschermd voor de privacy van de maker.",
  };
}

// Wordt deze route nog ergens in historie gebruikt? Dan mag zij nooit hard
// verdwijnen (wedstrijddossier, sprints en versiegebruik blijven kloppen).
async function routeIsReferenced(routeId: number): Promise<boolean> {
  const [race] = await db
    .select({ id: racesTable.id })
    .from(racesTable)
    .where(eq(racesTable.routeId, routeId))
    .limit(1);
  if (race) return true;
  const [sprint] = await db
    .select({ id: sprintResultsTable.id })
    .from(sprintResultsTable)
    .where(eq(sprintResultsTable.routeId, routeId))
    .limit(1);
  if (sprint) return true;
  const [usage] = await db
    .select({ id: routeVersionUsagesTable.id })
    .from(routeVersionUsagesTable)
    .where(eq(routeVersionUsagesTable.routeId, routeId))
    .limit(1);
  return Boolean(usage);
}

// Opruimregel (besloten 22 juli): een bewaard routevoorstel (gegenereerde
// route) dat na 30 dagen nog nooit gereden is, verdwijnt vanzelf. Lui
// uitgevoerd op het leespad van de bibliotheek — geen aparte job nodig.
// Uitdrukkelijk NIET opgeruimd: favorieten, gearchiveerde routes, routes met
// verzendingen/koppelingen (training, activiteit, delen) en routes met
// historie (wedstrijd, sprint, versiegebruik) — die zijn bewust bewaard of
// aantoonbaar gebruikt. Verwijderen is hier definitief veilig omdat alleen
// referentieloze rijen in aanmerking komen.
const PROPOSAL_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

async function cleanupUnriddenProposals(
  clerkId: string,
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - PROPOSAL_MAX_AGE_MS);
    const stale = await db
      .select({ id: routesTable.id })
      .from(routesTable)
      .where(
        and(
          eq(routesTable.clerkId, clerkId),
          eq(routesTable.source, "generated"),
          eq(routesTable.favorite, false),
          ne(routesTable.status, "archived"),
          isNull(routesTable.deletedAt),
          isNull(routesTable.linkedPlannedWorkoutId),
          isNull(routesTable.linkedActivityImportId),
          lt(routesTable.createdAt, cutoff),
        ),
      )
      .limit(25);
    if (stale.length === 0) return;
    const ids = stale.map((r) => r.id);
    // Alles met historie of delingen blijft staan — set-gebaseerd bepalen.
    const [usages, races, sprints, shares] = await Promise.all([
      db
        .select({ routeId: routeVersionUsagesTable.routeId })
        .from(routeVersionUsagesTable)
        .where(inArray(routeVersionUsagesTable.routeId, ids)),
      db
        .select({ routeId: racesTable.routeId })
        .from(racesTable)
        .where(inArray(racesTable.routeId, ids)),
      db
        .select({ routeId: sprintResultsTable.routeId })
        .from(sprintResultsTable)
        .where(inArray(sprintResultsTable.routeId, ids)),
      db
        .select({ routeId: routeSharesTable.routeId })
        .from(routeSharesTable)
        .where(inArray(routeSharesTable.routeId, ids)),
    ]);
    const keep = new Set<number>();
    for (const r of usages) if (r.routeId != null) keep.add(r.routeId);
    for (const r of races) if (r.routeId != null) keep.add(r.routeId);
    for (const r of sprints) if (r.routeId != null) keep.add(r.routeId);
    for (const r of shares) keep.add(r.routeId);
    const removable = ids.filter((id) => !keep.has(id));
    if (removable.length === 0) return;
    await db
      .delete(routesTable)
      .where(
        and(
          eq(routesTable.clerkId, clerkId),
          inArray(routesTable.id, removable),
        ),
      );
  } catch (err) {
    // Opruimen mag het laden van de bibliotheek nooit blokkeren.
    log.warn({ err }, "routes.cleanup-unridden-proposals failed");
  }
}

// GET /api/routes — caller's saved routes, newest first.
//   ?limit=N                 — cap the number of rows (1–100, default 30)
//   ?plannedWorkoutId=N      — only routes linked to that planned workout
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  await cleanupUnriddenProposals(clerkId, req.log);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const plannedWorkoutId =
    Number.isInteger(Number(req.query.plannedWorkoutId)) &&
    Number(req.query.plannedWorkoutId) > 0
      ? Number(req.query.plannedWorkoutId)
      : null;
  // Bibliotheek-parameters: zoeken, scope en sortering.
  const q =
    typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const scope =
    typeof req.query.scope === "string" &&
    ["mijn", "favoriet", "archief", "wedstrijd"].includes(req.query.scope)
      ? req.query.scope
      : "mijn";
  const sort =
    typeof req.query.sort === "string" &&
    ["nieuwste", "afstand", "hoogte", "naam"].includes(req.query.sort)
      ? req.query.sort
      : "nieuwste";
  try {
    const conds = [
      eq(routesTable.clerkId, clerkId),
      isNull(routesTable.deletedAt),
    ];
    if (plannedWorkoutId != null) {
      conds.push(eq(routesTable.linkedPlannedWorkoutId, plannedWorkoutId));
    }
    if (q) conds.push(ilike(routesTable.name, `%${q}%`));
    if (scope === "favoriet") conds.push(eq(routesTable.favorite, true));
    if (scope === "archief") {
      conds.push(eq(routesTable.status, "archived"));
    } else {
      // Gearchiveerde routes blijven bestaan maar staan niet tussen de rest.
      conds.push(ne(routesTable.status, "archived"));
    }
    if (scope === "wedstrijd") {
      const raceRoutes = await db
        .select({ routeId: racesTable.routeId })
        .from(racesTable)
        .where(
          and(eq(racesTable.clerkId, clerkId), isNotNull(racesTable.routeId)),
        );
      const ids = [
        ...new Set(
          raceRoutes.map((r) => r.routeId).filter((v): v is number => v != null),
        ),
      ];
      if (ids.length === 0) {
        res.json({ routes: [] });
        return;
      }
      conds.push(inArray(routesTable.id, ids));
    }
    const orderBy =
      sort === "afstand"
        ? desc(routesTable.distanceKm)
        : sort === "hoogte"
          ? desc(routesTable.elevationGainM)
          : sort === "naam"
            ? asc(routesTable.name)
            : desc(routesTable.createdAt);
    const routes = await db
      .select()
      .from(routesTable)
      .where(and(...conds))
      .orderBy(orderBy)
      .limit(limit);
    res.json({
      routes: routes.map((r) =>
        Array.isArray(r.nav)
          ? {
              ...r,
              nav: sanitizeNavSteps(
                r.nav as { km: number; dir: string; note: string }[],
              ),
            }
          : r,
      ),
    });
  } catch (err) {
    req.log.error({ err }, "routes.list failed");
    res.status(500).json({ error: "Kon routes niet laden" });
  }
});

// GET /api/routes/gedeeld — routes die MET de aanvrager gedeeld zijn:
// rechtstreeks (persoon), als geaccepteerde coach van de eigenaar, of via een
// gedeelde club/team. Geeft de veilige kijkersweergave in lijstvorm (alleen
// metadata — geometrie wordt pas bij het detail opgehaald, getransformeerd).
router.get("/gedeeld", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const shares = await db
      .select({
        share: routeSharesTable,
        route: routesTable,
      })
      .from(routeSharesTable)
      .innerJoin(routesTable, eq(routeSharesTable.routeId, routesTable.id))
      .where(
        and(
          isNull(routesTable.deletedAt),
          ne(routesTable.clerkId, clerkId),
        ),
      )
      .orderBy(desc(routeSharesTable.createdAt))
      .limit(300);
    if (shares.length === 0) {
      res.json({ routes: [] });
      return;
    }
    // Coach- en clubrelaties één keer ophalen, daarna lokaal filteren.
    const [coachOf, myClubs] = await Promise.all([
      db
        .select({ athleteClerkId: coachAthleteLinksTable.athleteClerkId })
        .from(coachAthleteLinksTable)
        .where(
          and(
            eq(coachAthleteLinksTable.coachClerkId, clerkId),
            eq(coachAthleteLinksTable.status, "accepted"),
          ),
        ),
      activeClubIds(clerkId),
    ]);
    const coachedIds = new Set(coachOf.map((r) => r.athleteClerkId));
    const ownerIds = [...new Set(shares.map((s) => s.route.clerkId))];
    const clubmates = new Set<string>();
    if (myClubs.length > 0 && ownerIds.length > 0) {
      const rows = await db
        .select({ clerkId: clubMembersTable.clerkId })
        .from(clubMembersTable)
        .where(
          and(
            inArray(clubMembersTable.clubId, myClubs),
            inArray(clubMembersTable.clerkId, ownerIds),
            isNull(clubMembersTable.endedAt),
          ),
        );
      for (const r of rows) clubmates.add(r.clerkId);
    }
    const seen = new Set<number>();
    const routes: unknown[] = [];
    for (const { share, route } of shares) {
      if (seen.has(route.id)) continue;
      const visible =
        (share.audience === "persoon" && share.targetClerkId === clerkId) ||
        (share.audience === "coach" && coachedIds.has(route.clerkId)) ||
        ((share.audience === "club" || share.audience === "team") &&
          clubmates.has(route.clerkId));
      if (!visible) continue;
      seen.add(route.id);
      // Lijstweergave: metadata zonder geometrie/nav — nooit exacte punten.
      routes.push({
        id: route.id,
        name: route.name,
        surface: route.surface,
        distanceKm: route.distanceKm,
        durationSec: route.durationSec,
        elevationGainM: route.elevationGainM,
        source: route.source,
        version: route.version,
        createdAt: route.createdAt,
        gedeeld: true,
        gedeeldVia: share.audience,
      });
    }
    res.json({ routes });
  } catch (err) {
    req.log.error({ err }, "routes.shared-with-me failed");
    res.status(500).json({ error: "Kon gedeelde routes niet laden" });
  }
});

// GET /api/routes/ontdek — openbaar gemaakte, echt gereden routes van andere
// gebruikers, op de kaart te tonen. Alleen routes die de eigenaar bewust
// openbaar heeft gezet én die aantoonbaar gereden zijn (bron "ridden" of met
// versiegebruik). Geometrie altijd in de veilige kijkersweergave (start/einde
// afgeschermd, privacyzone, vereenvoudigd). Routes van minderjarige eigenaren
// verschijnen nooit (fail-closed). Gedeclareerd vóór "/:id".
router.get("/ontdek", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rows = await db
      .select()
      .from(routesTable)
      .where(
        and(
          eq(routesTable.visibility, "public"),
          ne(routesTable.clerkId, clerkId),
          isNull(routesTable.deletedAt),
          ne(routesTable.status, "archived"),
          isNotNull(routesTable.geometry),
        ),
      )
      .orderBy(desc(routesTable.createdAt))
      .limit(100);
    if (rows.length === 0) {
      res.json({ routes: [] });
      return;
    }
    const ids = rows.map((r) => r.id);
    const usages = await db
      .select({ routeId: routeVersionUsagesTable.routeId })
      .from(routeVersionUsagesTable)
      .where(inArray(routeVersionUsagesTable.routeId, ids));
    const usedIds = new Set(usages.map((u) => u.routeId));
    const ridden = rows.filter(
      (r) => r.source === "ridden" || usedIds.has(r.id),
    );
    if (ridden.length === 0) {
      res.json({ routes: [] });
      return;
    }
    // Eigenaren één keer beoordelen: minderjarig ⇒ nooit openbaar tonen.
    const ownerIds = [...new Set(ridden.map((r) => r.clerkId))];
    const minorByOwner = new Map<string, boolean>();
    await Promise.all(
      ownerIds.map(async (owner) => {
        minorByOwner.set(owner, await isMinorAthlete(owner));
      }),
    );
    const owners = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
      })
      .from(userProfilesTable)
      .where(inArray(userProfilesTable.clerkId, ownerIds));
    const nameByOwner = new Map(owners.map((o) => [o.clerkId, o.displayName]));
    const zonesByOwner = new Map<string, PrivacyZoneCircle[]>();
    await Promise.all(
      ownerIds.map(async (owner) => {
        zonesByOwner.set(owner, await ownerPrivacyZones(owner));
      }),
    );
    const routes = ridden
      .filter((r) => minorByOwner.get(r.clerkId) !== true)
      .map((r) => {
        const view = viewerRouteView(r, zonesByOwner.get(r.clerkId) ?? []);
        return {
          id: r.id,
          name: r.name,
          surface: r.surface,
          distanceKm: r.distanceKm,
          elevationGainM: r.elevationGainM,
          source: r.source,
          createdAt: r.createdAt,
          eigenaarNaam: nameByOwner.get(r.clerkId) ?? "Onbekende renner",
          geometry: view.geometry,
          privacyNote: view.privacyNote,
        };
      });
    res.json({ routes });
  } catch (err) {
    req.log.error({ err }, "routes.discover failed");
    res.status(500).json({ error: "Kon openbare routes niet laden" });
  }
});

// GET /api/routes/geocode?q=… — forward-geocode an address to coordinates.
// Used by the home-location picker so athletes can search a place instead of
// only dropping a pin. Returns best-first candidates; empty list on no match.
// Declared BEFORE "/:id" so "geocode" is never parsed as a route id.
router.get("/geocode", requireAuth, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    res.json({ results: [] });
    return;
  }
  const provider = getRoutingProvider();
  if (!provider.isConfigured()) {
    res.status(503).json({
      error: "Adres zoeken is nog niet beschikbaar — de routeservice-sleutel ontbreekt.",
    });
    return;
  }
  try {
    // Woonplaats-bewust zoeken (correctie René 31-07-2026): als het huisadres
    // bekend is, krijgt de provider dat als voorkeurslocatie mee én sorteren
    // we de kandidaten zelf deterministisch op afstand tot huis. Zo staat bij
    // "Hengelo" Hengelo (OV/GLD) voorop en nooit Hengelo in Indonesië.
    const home = await ownerHome(getClerkUserId(req)!);
    let results = await provider.geocodeSearch(q, 6, home ?? undefined);
    if (home) {
      const met = results.map((r) => ({
        r,
        d: haversineKm(home.lat, home.lon, r.lat, r.lon),
      }));
      met.sort((a, b) => a.d - b.d);
      // Alleen wanneer er een geloofwaardige kandidaat in de buurt is
      // (≤300 km), laten we naamgenoten op andere continenten (>2000 km)
      // weg — een keuzelijst met Indonesië naast Overijssel helpt niemand.
      // Is er níets dichtbij, dan blijft alles staan (eerlijk: misschien
      // zoekt de renner echt een verre plaats voor een trainingskamp).
      const filtered =
        met.length > 0 && met[0]!.d <= 300
          ? met.filter((m) => m.d <= 2000)
          : met;
      results = filtered.map((m) => m.r);
    }
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "routes.geocode failed");
    res.status(500).json({ error: "Kon adres niet zoeken" });
  }
});

// GET /api/routes/pace — the athlete's own realistic riding pace, derived from
// REAL recent ride data (avg speed of rides in the last 120 days with enough
// distance to be representative). Used to personalise a route's expected
// duration honestly: when there is no ride data, personalKph is null and the
// frontend says so instead of pretending. Declared BEFORE "/:id".
router.get("/pace", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const cutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const rows = await db
      .select({
        avgSpeedKph: trainingSessionsTable.avgSpeedKph,
        distanceKm: trainingSessionsTable.distanceKm,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          eq(trainingSessionsTable.sport, "cycling"),
          isNotNull(trainingSessionsTable.avgSpeedKph),
          gte(trainingSessionsTable.sessionDate, cutoff),
        ),
      )
      .orderBy(desc(trainingSessionsTable.sessionDate))
      .limit(200);

    // Only rides long enough to reflect a sustainable pace (≥15 km) and with a
    // plausible speed. Median, not mean, so one fast group ride can't skew it.
    const speeds = rows
      .filter((r) => {
        const d = r.distanceKm != null ? Number(r.distanceKm) : null;
        const s = r.avgSpeedKph != null ? Number(r.avgSpeedKph) : null;
        return d != null && d >= 15 && s != null && s >= 8 && s <= 60;
      })
      .map((r) => Number(r.avgSpeedKph))
      .sort((a, b) => a - b);

    if (speeds.length < 3) {
      // Fewer than 3 representative rides: an honest "not enough data".
      res.json({ personalKph: null, sampleCount: speeds.length, windowDays: 120 });
      return;
    }
    const mid = Math.floor(speeds.length / 2);
    const median =
      speeds.length % 2 === 1
        ? speeds[mid]
        : (speeds[mid - 1] + speeds[mid]) / 2;
    res.json({
      personalKph: Math.round(median * 10) / 10,
      sampleCount: speeds.length,
      windowDays: 120,
    });
  } catch (err) {
    req.log.error({ err }, "routes.pace failed");
    res.status(500).json({ error: "Kon je eigen tempo niet berekenen" });
  }
});

// ── Privacyzones ────────────────────────────────────────────────────────────
// Gebruikersbeheerde gevoelige locaties (woning/werk/gevoelig). Elke gedeelde
// of getoonde routeweergave voor niet-eigenaren verwijdert punten binnen de
// zone — op leesmoment (nooit een "veilige kopie" opslaan). Het huisadres uit
// het profiel telt daarnaast ALTIJD impliciet mee (750 m). Gedeclareerd VÓÓR
// "/:id" zodat "privacyzones" nooit als route-id wordt gelezen.

// GET /api/routes/privacyzones — eigen zones + of het huisadres bekend is.
router.get("/privacyzones", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [zones, home] = await Promise.all([
      db
        .select()
        .from(privacyZonesTable)
        .where(eq(privacyZonesTable.clerkId, clerkId))
        .orderBy(asc(privacyZonesTable.createdAt)),
      ownerHome(clerkId),
    ]);
    res.json({
      zones,
      // Alleen ÓF het huisadres beschermd is — nooit de coördinaten zelf terug
      // over de lijn sturen; dit antwoord voedt puur de beheer-UI.
      thuisBeschermd: home !== null,
      thuisStraalM: HOME_ZONE_RADIUS_M,
    });
  } catch (err) {
    req.log.error({ err }, "routes.privacyzones.list failed");
    res.status(500).json({ error: "Kon privacyzones niet laden" });
  }
});

// POST /api/routes/privacyzones — nieuwe zone (max 10 per gebruiker).
router.post("/privacyzones", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const label =
    typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
  const kind = typeof body.kind === "string" ? body.kind : "gevoelig";
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const radiusRaw =
    body.radiusM === undefined ? PRIVACY_ZONE_DEFAULT_RADIUS_M : Number(body.radiusM);
  if (!label) {
    res.status(400).json({ error: "Een zone heeft een naam nodig" });
    return;
  }
  if (!(privacyZoneKinds as readonly string[]).includes(kind)) {
    res.status(400).json({ error: "Ongeldig zonetype" });
    return;
  }
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    res.status(400).json({ error: "Ongeldige locatie" });
    return;
  }
  if (
    !Number.isFinite(radiusRaw) ||
    radiusRaw < PRIVACY_ZONE_MIN_RADIUS_M ||
    radiusRaw > PRIVACY_ZONE_MAX_RADIUS_M
  ) {
    res.status(400).json({
      error: `Straal moet tussen ${PRIVACY_ZONE_MIN_RADIUS_M} en ${PRIVACY_ZONE_MAX_RADIUS_M} meter liggen`,
    });
    return;
  }
  try {
    const existing = await db
      .select({ id: privacyZonesTable.id })
      .from(privacyZonesTable)
      .where(eq(privacyZonesTable.clerkId, clerkId));
    if (existing.length >= 10) {
      res.status(400).json({ error: "Maximaal 10 privacyzones" });
      return;
    }
    const [zone] = await db
      .insert(privacyZonesTable)
      .values({
        clerkId,
        label,
        kind,
        lat,
        lon,
        radiusM: Math.round(radiusRaw),
      })
      .returning();
    res.status(201).json({ zone });
  } catch (err) {
    req.log.error({ err }, "routes.privacyzones.create failed");
    res.status(500).json({ error: "Kon privacyzone niet opslaan" });
  }
});

// DELETE /api/routes/privacyzones/:zoneId — eigen zone verwijderen. Het
// impliciete huisadres is hier bewust NIET verwijderbaar; dat hoort bij het
// profiel en blijft altijd beschermd.
router.delete("/privacyzones/:zoneId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const zoneId = Number(String(req.params.zoneId));
  if (!Number.isInteger(zoneId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(privacyZonesTable)
      .where(
        and(
          eq(privacyZonesTable.id, zoneId),
          eq(privacyZonesTable.clerkId, clerkId),
        ),
      )
      .returning({ id: privacyZonesTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Zone niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "routes.privacyzones.delete failed");
    res.status(500).json({ error: "Kon privacyzone niet verwijderen" });
  }
});

// ── Sparki-routebibliotheek ────────────────────────────────────────────────
// Door Sparki gegenereerde, kant-en-klare routes per gebied. Gedeclareerd
// VÓÓR "/:id" (anders slikt die deze paden op).

// GET /api/routes/bibliotheek — twee vormen:
// - ?minLat=&maxLat=&minLon=&maxLon= : routes binnen de kaartuitsnede
//   ("laat hier de routes zien", kaartgestuurd).
// - ?lat=&lon=&radiusKm= : routes waarvan de START binnen de straal rond een
//   gezocht startpunt ligt (correctie René 31-07-2026: bij zoeken op plaats
//   nooit stilzwijgend routes tientallen km verderop tonen). Antwoord bevat
//   dan per route startAfstandKm en is gesorteerd op afstand.
// Geometrie gaat mee: dit zijn Sparki's eigen routes, zonder privégegevens
// van gebruikers.
router.get("/bibliotheek", requireAuth, async (req, res) => {
  let bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  let centrum: StraalCentrum | null = null;
  if (req.query.lat != null || req.query.lon != null || req.query.radiusKm != null) {
    centrum = parseStraalCentrum(req.query.lat, req.query.lon, req.query.radiusKm);
    if (!centrum) {
      res.status(400).json({ error: "Ongeldig startpunt of ongeldige straal" });
      return;
    }
    // Ruime ophaal-bbox rond het startpunt; de exacte straal-filter volgt
    // hieronder op werkelijke afstand.
    bbox = straalOphaalBbox(centrum);
  } else {
    const minLat = Number(req.query.minLat);
    const maxLat = Number(req.query.maxLat);
    const minLon = Number(req.query.minLon);
    const maxLon = Number(req.query.maxLon);
    if (
      ![minLat, maxLat, minLon, maxLon].every(Number.isFinite) ||
      minLat >= maxLat ||
      minLon >= maxLon ||
      maxLat - minLat > 6 ||
      maxLon - minLon > 8
    ) {
      res.status(400).json({ error: "Ongeldige of te grote kaartuitsnede" });
      return;
    }
    bbox = { minLat, maxLat, minLon, maxLon };
  }
  try {
    // Straal-vorm: onbeperkt ophalen en pas ná de afstandssortering tot 60
    // beperken — de rating-gesorteerde DB-limiet mag nooit dichtbijgelegen
    // routes verdringen (en zo een vals-lege uitslag geven).
    let rows = await routesInBbox(bbox, { unlimited: centrum != null });
    const afstanden = new Map<number, number>();
    if (centrum) {
      const binnen = filterOpStraal(rows, centrum, 60);
      for (const r of binnen) afstanden.set(r.id, r.startAfstandKm);
      rows = binnen;
    }
    res.json({
      routes: rows.map((r) => ({
        id: r.id,
        name: r.name,
        bikeType: r.bikeType,
        distanceKm: r.distanceKm,
        elevationGainM: r.elevationGainM,
        durationSec: r.durationSec,
        startLat: r.startLat,
        startLon: r.startLon,
        geometry: r.geometry,
        avgRating: r.avgRating,
        ratingCount: r.ratingCount,
        // Eerlijke uitleg bij een verbeterde variant: welke terugkerende
        // feedback de nieuwe kandidaatkeuze stuurde (null bij een startset-
        // route of vervanging puur op score).
        improveNote: r.improveNote,
        generation: r.generation,
        // Motor-wegdekmeting (taak #492): een racefietsroute met knownPct<100
        // wordt in de bibliotheek eerlijk als "Niet volledig geverifieerd"
        // gelabeld — nooit stil als geschikt gepresenteerd.
        engineSurface: r.engineSurface ?? null,
        // Alleen bij straal-zoeken: eerlijke afstand van het gekozen
        // startpunt tot de start van deze route (km, 1 decimaal).
        startAfstandKm: afstanden.get(r.id) ?? null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "routes.bibliotheek failed");
    res.status(500).json({ error: "Kon bibliotheekroutes niet laden" });
  }
});

// POST /api/routes/bibliotheek/hier { lat, lon } — vraag Sparki om dit gebied
// te vullen. Start de generatie op de achtergrond en antwoordt direct met de
// eerlijke stand; de gebruiker wacht nooit op ORS.
router.post("/bibliotheek/hier", requireAuth, async (req, res) => {
  const lat = Number(req.body?.lat);
  const lon = Number(req.body?.lon);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -60 ||
    lat > 75 ||
    lon < -30 ||
    lon > 60
  ) {
    res.status(400).json({ error: "Ongeldige locatie" });
    return;
  }
  try {
    // Startpunt: ligt de woonlocatie van de gebruiker in ditzelfde gebied,
    // dan starten de routes exact bij huis — die zijn direct vanaf de voordeur
    // te rijden. Elders start de lus op het kaartmiddelpunt (een gedeelde
    // bibliotheek in een ander gebied kan niet bij iemands huis beginnen).
    let startLat = lat;
    let startLon = lon;
    const clerkId = getClerkUserId(req);
    if (clerkId) {
      const home = await ownerHome(clerkId);
      if (home && cellKeyFor(home.lat, home.lon) === cellKeyFor(lat, lon)) {
        startLat = home.lat;
        startLon = home.lon;
      }
    }
    const { cellKey, status } = await ensureLibraryRoutes(startLat, startLon);
    const count = await countCellRoutes(cellKey);
    res.json({ status, count });
  } catch (err) {
    req.log.error({ err }, "routes.bibliotheek.hier failed");
    res.status(500).json({ error: "Kon generatie niet starten" });
  }
});

// GET /api/routes/bibliotheek/:id — één bibliotheekroute met commentaar.
router.get("/bibliotheek/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routeLibraryTable)
      .where(eq(routeLibraryTable.id, id))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const comments = await db
      .select({
        rating: routeLibraryCommentsTable.rating,
        comment: routeLibraryCommentsTable.comment,
        updatedAt: routeLibraryCommentsTable.updatedAt,
        displayName: userProfilesTable.displayName,
      })
      .from(routeLibraryCommentsTable)
      .leftJoin(
        userProfilesTable,
        eq(userProfilesTable.clerkId, routeLibraryCommentsTable.clerkId),
      )
      .where(eq(routeLibraryCommentsTable.libraryRouteId, id))
      .orderBy(desc(routeLibraryCommentsTable.updatedAt))
      .limit(50);
    res.json({ route, comments });
  } catch (err) {
    req.log.error({ err }, "routes.bibliotheek.detail failed");
    res.status(500).json({ error: "Kon route niet laden" });
  }
});

// POST /api/routes/bibliotheek/:id/commentaar { rating?, comment? } — één
// mening per gebruiker per route (upsert); de gemiddelde score wordt in
// dezelfde transactie deterministisch herberekend. Hierop rangschikt de
// bibliotheek — zo verbeteren routes lokaal op basis van echte ervaringen.
router.post("/bibliotheek/:id/commentaar", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  const rawRating = req.body?.rating;
  const rating =
    rawRating == null
      ? null
      : Number.isInteger(Number(rawRating)) &&
          Number(rawRating) >= 1 &&
          Number(rawRating) <= 5
        ? Number(rawRating)
        : undefined;
  const comment =
    typeof req.body?.comment === "string"
      ? req.body.comment.trim().slice(0, 1000) || null
      : null;
  if (!Number.isInteger(id) || rating === undefined) {
    res.status(400).json({ error: "Ongeldige invoer (score 1–5 of leeg)" });
    return;
  }
  if (rating == null && comment == null) {
    res.status(400).json({ error: "Geef een score of een opmerking" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [route] = await tx
        .select({ id: routeLibraryTable.id })
        .from(routeLibraryTable)
        .where(eq(routeLibraryTable.id, id))
        .limit(1);
      if (!route) return null;
      await tx
        .insert(routeLibraryCommentsTable)
        .values({ libraryRouteId: id, clerkId, rating, comment })
        .onConflictDoUpdate({
          target: [
            routeLibraryCommentsTable.libraryRouteId,
            routeLibraryCommentsTable.clerkId,
          ],
          set: { rating, comment, updatedAt: new Date() },
        });
      // Herberekenen uit de echte rijen — nooit incrementeel bijhouden.
      const [agg] = await tx
        .select({
          avg: sql<number | null>`avg(${routeLibraryCommentsTable.rating})::real`,
          n: sql<number>`count(*) filter (where ${routeLibraryCommentsTable.rating} is not null)::int`,
        })
        .from(routeLibraryCommentsTable)
        .where(eq(routeLibraryCommentsTable.libraryRouteId, id));
      await tx
        .update(routeLibraryTable)
        .set({ avgRating: agg?.avg ?? null, ratingCount: agg?.n ?? 0 })
        .where(eq(routeLibraryTable.id, id));
      return { avgRating: agg?.avg ?? null, ratingCount: agg?.n ?? 0 };
    });
    if (!result) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    // Verbeterlus: is de route nu aantoonbaar slecht beoordeeld (gem. < 3 bij
    // ≥ 3 echte stemmen), dan vervangt Sparki hem op de achtergrond door een
    // nieuwe echte variant — terugkerende opmerkingen sturen de keuze. De
    // gebruiker wacht daar nooit op; falen laat de oude route gewoon staan.
    void maybeReplacePoorRoute(id).catch((err) =>
      req.log.error({ err, id }, "routes.bibliotheek.verbeteren failed"),
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "routes.bibliotheek.commentaar failed");
    res.status(500).json({ error: "Kon commentaar niet opslaan" });
  }
});

// POST /api/routes/bibliotheek/:id/gebruik — zet een bibliotheekroute in de
// eigen routebibliotheek van de gebruiker (kopie, privé). Daarna werken alle
// bestaande functies: navigeren, GPX-download, delen.
router.post("/bibliotheek/:id/gebruik", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routeLibraryTable)
      .where(eq(routeLibraryTable.id, id))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const surface: RouteSurface =
      route.bikeType === "mtb"
        ? "mtb"
        : route.bikeType === "gravel"
          ? "gravel"
          : "asfalt";
    const [saved] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name: route.name,
        surface,
        status: "ready",
        visibility: "private",
        source: "library",
        distanceKm: route.distanceKm,
        elevationGainM: route.elevationGainM,
        durationSec: route.durationSec,
        geometry: route.geometry,
        // Verificatiestatus reist mee met de kopie (taak #492): de motor-
        // wegdekmeting blijft de racefiets-verificatie sturen in de eigen
        // bibliotheek en bij Navigeer.
        engineSurface: route.engineSurface ?? null,
      })
      .returning({ id: routesTable.id });
    res.json({ routeId: saved!.id });
  } catch (err) {
    req.log.error({ err }, "routes.bibliotheek.gebruik failed");
    res.status(500).json({ error: "Kon route niet overnemen" });
  }
});

// GET /api/routes/:id — a single route (owner only).
router.get("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), isNull(routesTable.deletedAt)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    if (route.clerkId === clerkId) {
      // Oude opgeslagen routes kunnen nog tussen-"Aankomst"-stappen van
      // waypoints bevatten — opschonen bij het lezen (presentatie, DB blijft).
      const nav = Array.isArray(route.nav)
        ? sanitizeNavSteps(route.nav as { km: number; dir: string; note: string }[])
        : route.nav;
      // Wedstrijdmodus: bij usageType "wedstrijd" gaat de gekoppelde wedstrijd
      // mee (eerstvolgende op datum) met UITSLUITEND actieve punten
      // (bevestigd/aangepast) — voorgestelde of afgewezen punten sturen nooit
      // de live weergave.
      let race: unknown = null;
      if (route.usageType === "wedstrijd") {
        const [linkedRace] = await db
          .select()
          .from(racesTable)
          .where(
            and(
              eq(racesTable.routeId, route.id),
              eq(racesTable.clerkId, clerkId),
              eq(racesTable.status, "gepland"),
            ),
          )
          .orderBy(asc(racesTable.raceDate))
          .limit(1);
        if (linkedRace) {
          const points = await db
            .select()
            .from(racePointsTable)
            .where(eq(racePointsTable.raceId, linkedRace.id))
            .orderBy(asc(racePointsTable.raceKm), asc(racePointsTable.id));
          race = {
            id: linkedRace.id,
            name: linkedRace.name,
            raceDate: linkedRace.raceDate,
            localLaps: linkedRace.localLaps,
            assignment: linkedRace.assignment,
            points: activeRacePoints(points),
          };
        }
      }
      res.json({ route: { ...route, nav }, race });
      return;
    }
    // Niet-eigenaar: alleen zichtbaar wanneer expliciet gedeeld, en dan altijd
    // in de veilige kijkersweergave (start/einde afgeschermd). Geen deelrecht
    // ⇒ 404 (bestaan niet lekken).
    const allowed = await canViewSharedRoute(route, clerkId);
    if (!allowed) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const zones = await ownerPrivacyZones(route.clerkId);
    res.json({ route: viewerRouteView(route, zones) });
  } catch (err) {
    req.log.error({ err }, "routes.get failed");
    res.status(500).json({ error: "Kon route niet laden" });
  }
});

// GET /api/routes/:id/insight?departAt=ISO — route-paspoort: honest, real
// facts about a saved route. Grade split is deterministic from the stored
// elevation profile; weather comes live from Open-Meteo for the start point at
// the chosen departure hour; environment (traffic lights, forest share) comes
// from OpenStreetMap via Overpass. Every block is null when its source can't
// answer — nothing is fabricated.
router.get("/:id/insight", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }

    const profile = Array.isArray(route.profile)
      ? (route.profile as number[])
      : null;
    const geometry = Array.isArray(route.geometry)
      ? (route.geometry as RoutePathPoint[])
      : null;
    const distanceKm =
      route.distanceKm != null ? Number(route.distanceKm) : null;

    const grade = computeGradeSplit(profile, distanceKm);

    // Departure time: valid ISO within the forecast window, else next hour.
    const departRaw = req.query.departAt
      ? String(req.query.departAt)
      : null;
    let depart = departRaw ? new Date(departRaw) : null;
    if (!depart || Number.isNaN(depart.getTime())) {
      depart = new Date(Date.now() + 60 * 60_000);
    }
    const maxAhead = new Date(Date.now() + 15 * 24 * 60 * 60_000);
    if (depart.getTime() > maxAhead.getTime()) depart = maxAhead;
    if (depart.getTime() < Date.now() - 60 * 60_000) depart = new Date();

    const start = geometry && geometry.length > 0 ? geometry[0] : null;

    const [hours, environment, roadObjects] = await Promise.all([
      start
        ? getHourlyForecast(start[0], start[1], 16)
        : Promise.resolve([]),
      getRouteEnvironment(geometry),
      // Eigen wegobjecten-database (verkeerslichten, rotondes, drempels,
      // spoorwegovergangen) langs deze route — honest null bij een stille bron.
      getRoadObjectsAlongRoute(geometry).catch(() => null),
    ]);

    // Match the requested hour in the location's local time. Open-Meteo hourly
    // "time" is local ISO without offset; compare on epoch proximity instead:
    // pick the forecast hour closest to the requested moment (≤90 min apart).
    let weather: null | {
      timeLocal: string;
      tempC: number | null;
      uvIndex: number | null;
      windKmh: number | null;
      windGustKmh: number | null;
      windBft: number | null;
      windDirDeg: number | null;
      windDirLabel: string | null;
      precipProbPct: number | null;
    } = null;
    if (hours.length > 0) {
      // Pick the forecast slot closest to the requested absolute moment;
      // epochMs comes from Open-Meteo's utc_offset_seconds, so this is
      // timezone-correct for any coordinate. Honest null when >90 min away.
      const wantMs = depart.getTime();
      let hour: (typeof hours)[number] | null = null;
      let best = Infinity;
      for (const h of hours) {
        const diff = Math.abs(h.epochMs - wantMs);
        if (diff < best) {
          best = diff;
          hour = h;
        }
      }
      if (best > 90 * 60_000) hour = null;
      if (hour) {
        weather = {
          timeLocal: hour.time,
          tempC: hour.tempC,
          uvIndex: hour.uvIndex,
          windKmh: hour.windKmh,
          windGustKmh: hour.windGustKmh,
          windBft: beaufort(hour.windKmh),
          windDirDeg: hour.windDirDeg,
          windDirLabel: windDirectionLabel(hour.windDirDeg),
          precipProbPct: hour.precipProbPct,
        };
      }
    }

    res.json({
      insight: {
        grade,
        weather,
        environment,
        roadObjects: roadObjects
          ? {
              counts: roadObjects.counts,
              signalsPerKm: roadObjects.signalsPerKm,
              estimatedTimeLossSec: roadObjects.estimatedTimeLossSec,
            }
          : null,
        hasGeometry: !!(geometry && geometry.length > 1),
        hasProfile: !!(profile && profile.length > 1),
      },
    });
  } catch (err) {
    req.log.error({ err }, "routes.insight failed");
    res.status(500).json({ error: "Kon route-paspoort niet laden" });
  }
});

// Haversine distance in metres between two [lat, lon] points — used to find
// the nearest point of a stored route to the rider's live position.
function haversineMeters(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Routes don't store the routing profile they were generated with; derive a
// sensible one from the stored surface so a rejoin path fits the terrain.
function profileForSurface(surface: string): RoutingProfile {
  if (surface === "mtb") return "cycling-mountain";
  if (surface === "gravel") return "cycling-gravel";
  if (surface === "gravel" || surface === "pad" || surface === "mixed")
    return "cycling-regular";
  return "cycling-road";
}

// POST /api/routes/:id/rejoin — the rider has deviated from the planned route
// and chooses how to get back: "terug" routes to the NEAREST point of the
// original route (shortest real way back), "verder" routes to a point FURTHER
// AHEAD on the original route (a logical continuation — no backtracking to the
// deviation point). The connector path comes entirely from the routing
// provider (real roads); nothing is fabricated. 503 honest when no provider.
router.post("/:id/rejoin", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const lat = finiteNum(body.lat);
  const lon = finiteNum(body.lon);
  const mode =
    body.mode === "verder" || body.mode === "bestemming"
      ? (body.mode as "verder" | "bestemming")
      : "terug";
  if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    res.status(400).json({ error: "Ongeldige positie" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
    if (geometry.length < 2) {
      res.status(422).json({
        error:
          "Deze route heeft geen opgeslagen lijn op de kaart, dus er kan geen vervolg berekend worden.",
      });
      return;
    }
    const provider = getRoutingProvider();
    if (!provider.isConfigured()) {
      res.status(503).json({
        error:
          "Een vervolg berekenen is nu niet beschikbaar — de routedienst is niet gekoppeld.",
      });
      return;
    }

    // Nearest point of the original route + cumulative distance along it.
    const cumKm: number[] = [0];
    for (let i = 1; i < geometry.length; i++) {
      cumKm.push(
        cumKm[i - 1]! +
          haversineMeters(
            geometry[i - 1]![0],
            geometry[i - 1]![1],
            geometry[i]![0],
            geometry[i]![1],
          ) /
            1000,
      );
    }
    let nearestIdx = 0;
    let nearestM = Number.POSITIVE_INFINITY;
    for (let i = 0; i < geometry.length; i++) {
      const d = haversineMeters(lat, lon, geometry[i]![0], geometry[i]![1]);
      if (d < nearestM) {
        nearestM = d;
        nearestIdx = i;
      }
    }

    // "terug" targets the nearest point; "verder" targets a point far enough
    // ahead that the connector is a genuine continuation, not a U-turn: at
    // least 1 km ahead, or twice the current deviation if that's larger.
    // "bestemming" berekent een nieuw vervolg rechtstreeks naar het EINDPUNT
    // van de originele route — de opgeslagen route zelf (incl. eventuele
    // wedstrijdpunten) blijft onaangeroerd; dit is altijd een overlay.
    let targetIdx = nearestIdx;
    if (mode === "bestemming") {
      targetIdx = geometry.length - 1;
    } else if (mode === "verder") {
      const aheadKm = Math.max(1, (nearestM * 2) / 1000);
      targetIdx = geometry.length - 1;
      for (let i = nearestIdx; i < geometry.length; i++) {
        if (cumKm[i]! - cumKm[nearestIdx]! >= aheadKm) {
          targetIdx = i;
          break;
        }
      }
    }
    const target = geometry[targetIdx]!;

    const result = await provider.routePointToPoint({
      start: { lat, lon },
      end: { lat: target[0], lon: target[1] },
      profile: profileForSurface(route.surface),
    });
    res.json({
      mode,
      path: result.path,
      distanceKm: result.distanceKm,
      durationSec: result.durationSec,
      nav: result.steps,
      rejoinKm: Math.round(cumKm[targetIdx]! * 10) / 10,
    });
  } catch (err) {
    req.log.error({ err }, "routes.rejoin failed");
    res.status(502).json({
      error:
        "Kon geen vervolg berekenen — de routedienst gaf geen bruikbaar antwoord.",
    });
  }
});

// Tijdsbudget voor de preview-endpoints van de routebouwer: de Overpass-laag
// mag intern (mirrors + retries) tot ~40s doen, maar de reverse proxy kapt
// rond de ~25s — de browser ziet dan een kale 502 zonder onze eerlijke
// foutmelding. Antwoord daarom zelf binnen het budget met hetzelfde eerlijke
// "bron gaf geen antwoord"-contract (null). De upstream-call loopt op de
// achtergrond door en vult gewoon de cache voor een volgende poging.
const PREVIEW_BUDGET_MS = 18_000;
// Sentinel: het budget verstreek terwijl de meting nog LOOPT. Dat is géén
// bronfout — de achtergrond-meting vult de cache en een volgende poging kan
// wél slagen (Proof #439: trage mirrors, latere poging gaf direct 200).
const PREVIEW_PENDING = Symbol("preview-pending");
function withPreviewBudget<T>(
  p: Promise<T | null>,
  log: { error: (obj: unknown, msg?: string) => void },
): Promise<T | null | typeof PREVIEW_PENDING> {
  return Promise.race([
    // Log de echte reject-oorzaak vóór we hem als "bron gaf geen antwoord"
    // (null → 502) maskeren — anders worden interne regressies onzichtbaar.
    p.catch((err) => {
      log.error({ err }, "routes.preview upstream failed");
      return null;
    }),
    new Promise<typeof PREVIEW_PENDING>((resolve) => {
      const t = setTimeout(() => resolve(PREVIEW_PENDING), PREVIEW_BUDGET_MS);
      if (typeof t === "object" && "unref" in t) t.unref();
    }),
  ]);
}

// POST /api/routes/remarks-preview — routeopmerkingen voor een NOG NIET
// opgeslagen route (routebouwer): de client stuurt de echte provider-geometrie
// mee. Zelfde eerlijke bron/contract als GET /:id/remarks. Declared before the
// /:id routes so "remarks-preview" never parses as an id.
router.post("/remarks-preview", requireAuth, async (req, res) => {
  try {
    const raw = (req.body ?? {}) as { geometry?: unknown };
    const geomIn = Array.isArray(raw.geometry) ? raw.geometry : null;
    if (!geomIn || geomIn.length < 2 || geomIn.length > 20000) {
      res.status(400).json({ error: "Ongeldige routegeometrie" });
      return;
    }
    const geometry: RoutePathPoint[] = [];
    for (const p of geomIn) {
      if (!Array.isArray(p) || p.length < 2) {
        res.status(400).json({ error: "Ongeldige routegeometrie" });
        return;
      }
      const la = Number(p[0]);
      const lo = Number(p[1]);
      if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
        res.status(400).json({ error: "Ongeldige routegeometrie" });
        return;
      }
      geometry.push([la, lo]);
    }
    const budgeted = await withPreviewBudget(getRouteRemarks(geometry), req.log);
    const remarks = budgeted === PREVIEW_PENDING ? null : budgeted;
    if (remarks == null) {
      res.status(502).json({
        error:
          "Routeopmerkingen konden nu niet opgehaald worden — de kaartbron gaf geen antwoord.",
      });
      return;
    }
    res.json({
      remarks,
      dataRemarks: computeDataRemarks({
        hasProfile: true, // builder preview: hoogte wordt apart getoond
        hasDistance: true,
        pointCount: geometry.length,
      }),
      source: remarksSource(),
    });
  } catch (err) {
    req.log.error({ err }, "routes.remarks-preview failed");
    res.status(500).json({ error: "Kon routeopmerkingen niet laden" });
  }
});

// POST /api/routes/surfaces-preview — wegtypen/ondergrond-analyse voor een NOG
// NIET opgeslagen route (routebouwer). Zelfde eerlijke bron/contract als
// GET /:id/surfaces. Declared before the /:id routes.
router.post("/surfaces-preview", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const raw = (req.body ?? {}) as {
      geometry?: unknown;
      profile?: unknown;
      distanceKm?: unknown;
      candidateId?: unknown;
    };
    const geomIn = Array.isArray(raw.geometry) ? raw.geometry : null;
    if (!geomIn || geomIn.length < 2 || geomIn.length > 20000) {
      res.status(400).json({ error: "Ongeldige routegeometrie" });
      return;
    }
    const geometry: RoutePathPoint[] = [];
    for (const p of geomIn) {
      if (!Array.isArray(p) || p.length < 2) {
        res.status(400).json({ error: "Ongeldige routegeometrie" });
        return;
      }
      const la = Number(p[0]);
      const lo = Number(p[1]);
      if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
        res.status(400).json({ error: "Ongeldige routegeometrie" });
        return;
      }
      geometry.push([la, lo]);
    }
    const analysis = await withPreviewBudget(getRouteSurfaces(geometry), req.log);
    if (analysis === PREVIEW_PENDING) {
      // Het previewbudget verstreek maar de meting loopt nog (trage mirrors);
      // de achtergrond-meting vult de cache. Geen fout en géén verzonnen
      // tussenresultaat: de client mag zo dadelijk opnieuw vragen.
      res.status(202).json({
        pending: true,
        error:
          "De wegdekmeting loopt nog — de kaartbron antwoordt traag. Probeer zo opnieuw.",
      });
      return;
    }
    if (analysis == null) {
      res.status(502).json({
        error: "Wegtypen konden nu niet opgehaald worden — de kaartbron gaf geen antwoord.",
      });
      return;
    }
    const profile = Array.isArray(raw.profile)
      ? (raw.profile as unknown[]).map(Number).filter(Number.isFinite)
      : [];
    const distanceKm = Number(raw.distanceKm);
    const slope = maxSlopePct(profile, Number.isFinite(distanceKm) ? distanceKm : null);
    // Bronvergelijking: de motor-wegdekmeting hoort bij een server-vertrouwde
    // kandidaat (eigenaar-gescoped) — nooit uit de request-body zelf.
    const candidate =
      typeof raw.candidateId === "string" && raw.candidateId
        ? getCandidate(raw.candidateId, clerkId)
        : null;
    res.json({
      surfaces: analysis,
      suitability: computeBikeSuitability(analysis, { maxSlopePct: slope }),
      maxSlopePct: slope,
      vergelijking: compareSurfaceSources(candidate?.engineSurface ?? null, analysis),
      source: surfacesSource(),
    });
  } catch (err) {
    req.log.error({ err }, "routes.surfaces-preview failed");
    res.status(500).json({ error: "Kon wegtypen niet laden" });
  }
});

// GET /api/routes/:id/surfaces — wegtypen/ondergrond van de volledige route
// uit OpenStreetMap-tags + deterministische geschiktheid per fietstype.
// Eerlijke 502 als de bron niet antwoordt; er wordt nooit een wegtype verzonnen.
router.get("/:id/surfaces", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
    if (geometry.length < 2) {
      res.json({ surfaces: null, suitability: null, maxSlopePct: null, source: surfacesSource() });
      return;
    }
    const analysis = await getRouteSurfaces(geometry);
    if (analysis == null) {
      res.status(502).json({
        error: "Wegtypen konden nu niet opgehaald worden — de kaartbron gaf geen antwoord.",
      });
      return;
    }
    const profile = (route.profile as number[] | null) ?? [];
    const slope = maxSlopePct(profile, route.distanceKm ?? null);
    res.json({
      surfaces: analysis,
      suitability: computeBikeSuitability(analysis, { maxSlopePct: slope }),
      maxSlopePct: slope,
      vergelijking: compareSurfaceSources(
        (route.engineSurface as RouteEngineSurface | null) ?? null,
        analysis,
      ),
      source: surfacesSource(),
    });
  } catch (err) {
    req.log.error({ err }, "routes.surfaces failed");
    res.status(500).json({ error: "Kon wegtypen niet laden" });
  }
});

// GET /api/routes/:id/remarks — echte waarschuwingen/bijzonderheden op de
// route (veerpont, trap, poort, onverhard/slecht wegdek, beperkte toegang,
// natuurgebied, voorde) uit OpenStreetMap-tags. Eerlijke 502 als de bron niet
// antwoordt; er wordt nooit een waarschuwing verzonnen.
router.get("/:id/remarks", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
    const profile = (route.profile as number[] | null) ?? [];
    const dataRemarks = computeDataRemarks({
      hasProfile: profile.length > 1,
      hasDistance: route.distanceKm != null && route.distanceKm > 0,
      pointCount: geometry.length,
    });
    if (geometry.length < 2) {
      res.json({ remarks: null, dataRemarks, source: remarksSource() });
      return;
    }
    const remarks = await getRouteRemarks(geometry);
    if (remarks == null) {
      res.status(502).json({
        error:
          "Routeopmerkingen konden nu niet opgehaald worden — de kaartbron gaf geen antwoord.",
      });
      return;
    }
    // Blokkade-samenvatting uit exact dezelfde meting (geen extra bron-call):
    // fietsverbod, trap en afgesloten poort/privéterrein zijn hard. De klant
    // gebruikt dit om KLAAR en NAVIGEER eerlijk te blokkeren op routes die
    // vóór de generatiepoort zijn opgeslagen.
    const obstacles = countRouteObstacles(remarks);
    const hard =
      obstacles.forbidden > 0 ||
      obstacles.steps > 0 ||
      obstacles.blockedGates > 0;
    const blockage = { ...obstacles, hard };
    // Verificatiestatus (taak #505): geslaagde meting is hier gegarandeerd
    // (remarks==null gaf hierboven al een eerlijke 502 = unverifiable voor de
    // klant). De klant toont KLAAR/NAVIGEER uitsluitend bij verified_clear.
    const verification = hard ? "hard_blocked" : "verified_clear";
    res.json({
      remarks,
      dataRemarks,
      blockage,
      verification,
      source: remarksSource(),
    });
  } catch (err) {
    req.log.error({ err }, "routes.remarks failed");
    res.status(500).json({ error: "Kon routeopmerkingen niet laden" });
  }
});

// GET /api/routes/:id/pois — named sights and cafés/restaurants within ~250m
// of the route line (OpenStreetMap). Honest 502 when the source doesn't
// answer; the list is never fabricated.
router.get("/:id/pois", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
    if (geometry.length < 2) {
      res.status(422).json({
        error:
          "Deze route heeft geen opgeslagen lijn op de kaart, dus er kunnen geen plekken langs de route gevonden worden.",
      });
      return;
    }
    const pois = await getRoutePois(geometry);
    if (pois == null) {
      res.status(502).json({
        error:
          "Plekken langs de route konden nu niet opgehaald worden — de kaartbron gaf geen antwoord.",
      });
      return;
    }
    res.json({ pois });
  } catch (err) {
    req.log.error({ err }, "routes.pois failed");
    res.status(500).json({ error: "Kon plekken langs de route niet laden" });
  }
});

// POST /api/routes/:id/detour-via — reroute the ride VIA a chosen place (sight
// or café): a real routed leg from the rider's position to the place, then a
// real leg from the place back onto the original route at (or ahead of) the
// place. The target must lie AHEAD of the rider on the route — never routes a
// rider backwards. Both legs come from the routing provider; nothing is drawn.
router.post("/:id/detour-via", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const lat = finiteNum(body.lat);
  const lon = finiteNum(body.lon);
  const targetLat = finiteNum(body.targetLat);
  const targetLon = finiteNum(body.targetLon);
  if (
    lat == null ||
    lon == null ||
    targetLat == null ||
    targetLon == null ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    Math.abs(targetLat) > 90 ||
    Math.abs(targetLon) > 180
  ) {
    res.status(400).json({ error: "Ongeldige positie" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
    if (geometry.length < 2) {
      res.status(422).json({
        error:
          "Deze route heeft geen opgeslagen lijn op de kaart, dus er kan geen omweg berekend worden.",
      });
      return;
    }
    const provider = getRoutingProvider();
    if (!provider.isConfigured()) {
      res.status(503).json({
        error:
          "Een omweg berekenen is nu niet beschikbaar — de routedienst is niet gekoppeld.",
      });
      return;
    }

    const cumKm: number[] = [0];
    for (let i = 1; i < geometry.length; i++) {
      cumKm.push(
        cumKm[i - 1]! +
          haversineMeters(
            geometry[i - 1]![0],
            geometry[i - 1]![1],
            geometry[i]![0],
            geometry[i]![1],
          ) /
            1000,
      );
    }
    const nearestIdxTo = (pLat: number, pLon: number): number => {
      let idx = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < geometry.length; i++) {
        const d = haversineMeters(pLat, pLon, geometry[i]![0], geometry[i]![1]);
        if (d < best) {
          best = d;
          idx = i;
        }
      }
      return idx;
    };
    const riderIdx = nearestIdxTo(lat, lon);
    const placeIdx = nearestIdxTo(targetLat, targetLon);
    // Never route a rider backwards along the route.
    if (cumKm[placeIdx]! < cumKm[riderIdx]! - 0.1) {
      res.status(422).json({
        error: "Deze plek ligt achter je op de route — kies een plek vooruit.",
      });
      return;
    }
    const rejoinIdx = Math.max(placeIdx, riderIdx);
    const rejoin = geometry[rejoinIdx]!;
    const profile = profileForSurface(route.surface);

    // Two real legs: rider → place, place → back onto the route.
    const leg1 = await provider.routePointToPoint({
      start: { lat, lon },
      end: { lat: targetLat, lon: targetLon },
      profile,
    });
    const leg2 = await provider.routePointToPoint({
      start: { lat: targetLat, lon: targetLon },
      end: { lat: rejoin[0], lon: rejoin[1] },
      profile,
    });

    const path = [...leg1.path, ...leg2.path.slice(1)];
    // The provider can theoretically omit distance/duration; fall back to the
    // real path length so the cue offsets stay correct, and be honest (null)
    // about a missing duration instead of inventing one.
    const pathKm = (pts: [number, number][]): number => {
      let km = 0;
      for (let i = 1; i < pts.length; i++) {
        km +=
          haversineMeters(
            pts[i - 1]![0],
            pts[i - 1]![1],
            pts[i]![0],
            pts[i]![1],
          ) / 1000;
      }
      return km;
    };
    const leg1Km = leg1.distanceKm ?? pathKm(leg1.path);
    const leg2Km = leg2.distanceKm ?? pathKm(leg2.path);
    const durationSec =
      leg1.durationSec != null && leg2.durationSec != null
        ? leg1.durationSec + leg2.durationSec
        : null;
    // De bewuste tussenstop is géén finish: neutrale "Tussenstop"-stap, en de
    // sanitizer haalt de aankomststap van het eerste been weg zodat alleen het
    // echte einde (terug op de route) een aankomst blijft.
    const nav = sanitizeNavSteps([
      ...leg1.steps,
      ...leg2.steps.map((s) => ({
        ...s,
        km: Math.round((s.km + leg1Km) * 100) / 100,
      })),
    ]);
    nav.push({
      km: Math.round(leg1Km * 100) / 100,
      dir: "Tussenstop",
      note: "Je bent bij je tussenstop.",
    });
    nav.sort((a, b) => a.km - b.km);
    res.json({
      mode: "poi",
      path,
      distanceKm: Math.round((leg1Km + leg2Km) * 100) / 100,
      durationSec,
      nav,
      stopKm: Math.round(leg1Km * 100) / 100,
      rejoinKm: Math.round(cumKm[rejoinIdx]! * 10) / 10,
    });
  } catch (err) {
    req.log.error({ err }, "routes.detour-via failed");
    res.status(502).json({
      error:
        "Kon geen omweg berekenen — de routedienst gaf geen bruikbaar antwoord.",
    });
  }
});

// GET /api/routes/:id/gpx — download a saved route as a GPX file (owner only).
// Geometry, elevation and turn-by-turn cues are serialized from the route's real
// stored data. Routes without geometry (e.g. GPX imports, where we don't store
// the raw track) cannot be re-exported and return 422.
router.get("/:id/gpx", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }

    const gpx = buildGpx({
      name: route.name,
      geometry: (route.geometry as RoutePathPoint[] | null) ?? [],
      profile: (route.profile as number[] | null) ?? null,
      nav: (route.nav as { km: number; dir: string; note: string }[] | null) ?? null,
      climbs:
        (route.climbs as { name: string; summitKm: number }[] | null) ?? null,
    });
    if (!gpx) {
      res.status(422).json({
        error:
          "Deze route heeft geen opgeslagen geometrie en kan niet als GPX worden geëxporteerd.",
      });
      return;
    }

    const safeName =
      (route.name || "sparki-route")
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase() || "sparki-route";

    res.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.gpx"`,
    );
    res.send(gpx);
  } catch (err) {
    req.log.error({ err }, "routes.gpx failed");
    res.status(500).json({ error: "Kon GPX niet genereren" });
  }
});

// GET /api/routes/:id/tcx — download a saved route as a TCX Course file (owner
// only). Garmin Edge / Wahoo ELEMNT devices read embedded turn-by-turn most
// reliably from a TCX <CoursePoint>, so this is the most dependable on-device
// navigation export. Same honesty/graceful-fallback rules as the GPX export:
// real stored data only, no cues → plain course, no geometry → 422.
router.get("/:id/tcx", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }

    const tcx = buildTcx({
      name: route.name,
      geometry: (route.geometry as RoutePathPoint[] | null) ?? [],
      profile: (route.profile as number[] | null) ?? null,
      nav:
        (route.nav as { km: number; dir: string; note: string }[] | null) ??
        null,
      durationSec: route.durationSec ?? null,
    });
    if (!tcx) {
      res.status(422).json({
        error:
          "Deze route heeft geen opgeslagen geometrie en kan niet als TCX worden geëxporteerd.",
      });
      return;
    }

    const safeName =
      (route.name || "sparki-route")
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase() || "sparki-route";

    res.setHeader(
      "Content-Type",
      "application/vnd.garmin.tcx+xml; charset=utf-8",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.tcx"`,
    );
    res.send(tcx);
  } catch (err) {
    req.log.error({ err }, "routes.tcx failed");
    res.status(500).json({ error: "Kon TCX niet genereren" });
  }
});

// GET /api/routes/candidate/:candidateId/gpx — download a not-yet-saved
// generated proposal as GPX. Serialized from the server-trusted candidate store
// (same honesty guarantee as saving), so the export uses real provider data.
router.get("/candidate/:candidateId/gpx", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const candidateId = String(req.params.candidateId);
  const stored = getCandidate(candidateId, clerkId);
  if (!stored) {
    res.status(410).json({
      error:
        "Routevoorstel is verlopen of niet gevonden — genereer de route opnieuw.",
    });
    return;
  }

  const gpx = buildGpx({
    name: stored.name,
    geometry: stored.geometry,
    profile: stored.profile,
    nav: stored.nav,
    climbs: stored.climbs as { name: string; summitKm: number }[],
  });
  if (!gpx) {
    res
      .status(422)
      .json({ error: "Dit voorstel heeft geen geometrie om te exporteren." });
    return;
  }

  const safeName =
    (stored.name || "sparki-route")
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "sparki-route";

  res.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.gpx"`);
  res.send(gpx);
});

// GET /api/routes/candidate/:candidateId/enrich — poll for async AI enrichment
// (AI-phrased rationale + road-objects data). Returns immediately:
//   { ready: false }                    — enrichment still running
//   { ready: false, failed: true }      — enrichment failed (use fallback)
//   { ready: true, rationale, roadObjects } — enrichment complete
router.get("/candidate/:candidateId/enrich", requireAuth, (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const candidateId = String(req.params.candidateId);

  // Ownership check — also validates the candidate hasn't expired.
  const stored = getCandidate(candidateId, clerkId);
  if (!stored) {
    res.status(410).json({
      error: "Routevoorstel verlopen of niet gevonden — genereer de route opnieuw.",
    });
    return;
  }

  const entry = ENRICHMENT.get(candidateId);
  if (!entry || entry.pending) {
    res.json({ ready: false });
    return;
  }
  if (entry.error || !entry.result) {
    res.json({
      ready: false,
      failed: true,
      // Deterministic fallback so the client can display it permanently
      // instead of staying in "laden…" forever.
      rationale: entry.fallbackRationale ?? null,
    });
    return;
  }

  res.json({ ready: true, ...entry.result });
});

// GET /api/routes/candidate/:candidateId/tcx — download a not-yet-saved
// generated proposal as a TCX Course file. Serialized from the server-trusted
// candidate store (same honesty guarantee as saving), so the export uses real
// provider data. TCX <CoursePoint> is the most dependable on-device turn-by-turn
// format for Garmin/Wahoo.
router.get("/candidate/:candidateId/tcx", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const candidateId = String(req.params.candidateId);
  const stored = getCandidate(candidateId, clerkId);
  if (!stored) {
    res.status(410).json({
      error:
        "Routevoorstel is verlopen of niet gevonden — genereer de route opnieuw.",
    });
    return;
  }

  const tcx = buildTcx({
    name: stored.name,
    geometry: stored.geometry,
    profile: stored.profile,
    nav: stored.nav,
    durationSec: stored.durationSec,
  });
  if (!tcx) {
    res
      .status(422)
      .json({ error: "Dit voorstel heeft geen geometrie om te exporteren." });
    return;
  }

  const safeName =
    (stored.name || "sparki-route")
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "sparki-route";

  res.setHeader("Content-Type", "application/vnd.garmin.tcx+xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.tcx"`);
  res.send(tcx);
});

// POST /api/routes/generate — propose a real, provider-backed route WITHOUT
// saving.
//   body: { mode: "loop"|"ptp", startLat, startLon,
//           sport?, bikeType?, elevationPreference?,
//           trainingType?, plannedWorkoutId?, targetDistanceKm?,
//           endLat?, endLon?, destinationText?, seed?,
//           unpavedPreferencePct? (0..100, alleen gravel/MTB — voorkeur,
//           geen garantie; racefiets negeert dit: harde 0%-grens) }
// Returns a candidate route (geometry, distance, duration, elevation profile,
// climbs, surface, turn-by-turn nav, rationale). Geometry/distance/duration/
// elevation/nav come straight from the routing provider — the AI only phrases
// the rationale, it never invents geometry. The athlete does NOT pick a routing
// profile: Sparki auto-selects it from sport + bike type + training + elevation.
// Persist later via POST /api/routes with source="generated".

// Fully-resolved context for building a loop candidate. Shared by the single-
// route endpoint (/generate) and the 3-distance chooser (/generate/options) so
// the two paths can never drift apart. All geometry/metrics come straight from
// the routing provider; the model only phrases the rationale.
type LoopCandidateContext = {
  clerkId: string;
  provider: ReturnType<typeof getRoutingProvider>;
  start: { lat: number; lon: number };
  profile: ReturnType<typeof selectRoutingProfile>;
  surface: string;
  sport: string;
  bikeType: string | null;
  workoutTrainingType: string;
  linkedWorkoutTitle: string | null;
  elevationPreference: "flat" | "hilly" | "any";
  seed: number | undefined;
  points: number;
  startName: string | null;
  plannedWorkoutId: number | null;
  wish: string | null;
  // Hoogtemeter-doel: rangschikt echte kandidaten, garandeert niets.
  targetElevationGainM?: number | null;
  // Onverhard-voorkeur (taak #440, gravel/MTB): gewenst aandeel onverhard
  // (0..1) uit de schuifbalk. Voorkeur, geen garantie. Racefiets: altijd null
  // (harde 0%-grens, taak #437).
  unpavedTargetShare?: number | null;
  // Vermijd drukke N-wegen (taak #462): voorkeur-straf in de motor + selectie
  // op het gemeten N-weg-aandeel. Nooit een harde poort.
  avoidBusyRoads?: boolean;
  // Meerdere voorstellen (kaart-planner): laat de motor naast de winnaar ook
  // max 2 écht anders lopende, niet-afgekeurde kandidaten uit zijn interne
  // pool teruggeven. Alleen op het interactieve /generate-pad; de
  // 3-afstanden-kiezer (/generate/options) toont al varianten per afstand.
  collectAlternates?: boolean;
  // WP-1: eerlijke fasemelding richting de klant (berekenen →
  // veiligheidscontrole). Optioneel; het synchrone pad geeft niets door.
  onPhase?: (p: "berekenen" | "veiligheidscontrole") => void;
};

// Build one real loop candidate at a specific target distance, store it server-
// side and return the response shape. Never fabricates geometry or metrics.
async function buildLoopCandidate(
  ctx: LoopCandidateContext,
  targetDistanceKm: number,
) {
  // Interval- en tempotraining: elke onderbreking (bocht, verkeerslicht,
  // rotonde, drempel, spoorwegovergang) breekt een blok. Selecteer daarom op
  // bochtarme kandidaten (echte ORS-afslagen) én — via de eigen wegobjecten-
  // database + OpenStreetMap — op zo min mogelijk onderbrekende wegobjecten.
  // Alleen rangschikken van echte kandidaten; ORS kan dit nooit garanderen en
  // dat beloven we dus ook nergens.
  const trainingLower = ctx.workoutTrainingType.toLowerCase();
  const wantsUninterrupted =
    trainingLower.includes("interval") || trainingLower.includes("tempo");
  const wishScenery = detectSceneryWish(ctx.wish);
  const scenery = wantsUninterrupted
    ? {
        nature: wishScenery?.nature ?? false,
        avoidTrafficLights: true,
      }
    : wishScenery;

  // Geometry-only cache key: parameters that determine ORS road geometry.
  // clerkId and plannedWorkoutId are intentionally excluded — they do not
  // affect which roads ORS picks. putCandidate is always called fresh below,
  // so the new candidate is always owned by the correct user/workout.
  evictRouteGeometryCache();
  const loopGeomKey = routeGeometryCacheKey({
    mode: "loop",
    startLat: ctx.start.lat,
    startLon: ctx.start.lon,
    targetDistanceKm,
    seed: ctx.seed ?? null,
    profile: ctx.profile,
    elevationPreference: ctx.elevationPreference,
    workoutTrainingType: ctx.workoutTrainingType,
    targetElevationGainM: ctx.targetElevationGainM ?? null,
    unpavedTargetShare: ctx.unpavedTargetShare ?? null,
    avoidBusyRoads: ctx.avoidBusyRoads === true,
    wish: ctx.wish,
  });
  const loopGeomCached = ROUTE_GEOMETRY_CACHE.get(loopGeomKey);

  let routeResult: CachedRouteGeometry;
  let startName: string | null;
  // Extra voorstellen uit de interne kandidaten-pool (alleen vers gegenereerd;
  // een geometrie-cache-hit levert eerlijk geen alternatieven — nooit oude
  // pools verzinnen).
  const altResults: Awaited<ReturnType<typeof generateVariedLoop>>[] = [];

  if (loopGeomCached) {
    // Geometry cache hit: skip ORS entirely (~1.5–2.8 s saved).
    console.log(
      `[PERF] buildLoopCandidate.CACHE_HIT key=${loopGeomKey.slice(0, 60)}`,
    );
    routeResult = loopGeomCached.geometry;
    startName = loopGeomCached.startName;
  } else {
    // Cache miss: fire reverseGeocode CONCURRENTLY with ORS loop generation —
    // geocoding (~750 ms) is hidden behind the longer ORS call (~1800 ms). When
    // the caller already resolved startName (options endpoint), this resolves
    // instantly from the provider's own cache.
    const startNamePromise: Promise<string | null> =
      ctx.startName != null
        ? Promise.resolve(ctx.startName)
        : ctx.provider.reverseGeocode(ctx.start).catch(() => null);

    const _t_loop0 = performance.now();
    const orsResult = await generateVariedLoop(
      ctx.provider,
      {
        start: ctx.start,
        distanceKm: targetDistanceKm,
        profile: ctx.profile,
        seed: ctx.seed,
        points: ctx.points,
        elevationPreference: ctx.elevationPreference,
        avoidBusyRoads: ctx.avoidBusyRoads === true,
        // Gravel/MTB-onverhard-voorkeur: laat de motor zélf onverhard opzoeken
        // (voorheen alleen nakeuze tussen — vaak louter verharde — kandidaten).
        unpavedTargetShare: ctx.unpavedTargetShare ?? null,
      },
      {
        scenery,
        // Vaste eis: kandidaten worden ALTIJD vergeleken op stoplichten,
        // wegobstakels en bebouwing — niet alleen bij een expliciete wens.
        // Interactief pad: strak tijdbudget zodat de gebruiker nooit op een
        // trage Overpass/OSM-sync wacht (cache-hits + eigen DB tellen mee).
        environmentOf: candidateEnvironmentOf(scenery?.nature ?? false, {
          budgetMs: 2000,
        }),
        preferUninterrupted: wantsUninterrupted,
        targetAscentM: ctx.targetElevationGainM ?? null,
        // Officiële-kaart-controlelaag (BGT alleen Nederland, GRB alleen Vlaanderen): racefietskandidaten worden
        // way-voor-way naast de officiële overheidswegenkaart gelegd; een
        // kandidaat die daar onverhard blijkt, verliest. Buiten NL of bij een
        // bronfout weegt dit eerlijk niet mee.
        unpavedShareOf: controlUnpavedShare,
        // Onverhard-voorkeur (gravel/MTB, taak #440): rangschikt echte
        // kandidaten op hun gemeten onverhard-aandeel — voorkeur, geen
        // garantie. Racefiets: altijd null (harde 0%-grens).
        unpavedTargetShare: ctx.unpavedTargetShare ?? null,
        // Obstakel-poort (kort tijdbudget, interactief): trap/fietsverbod/
        // afgesloten poort = harde afkeur; minste poorten wint (grenzen
        // René 30-07-2026).
        obstaclesOf: routeObstaclesOf({ budgetMs: 2500 }),
        // Fail-closed eindverificatie (taak #505): de WINNAAR wordt vóór
        // levering BLOKKEREND gemeten — het 2500 ms-budget hierboven is
        // alleen een selectie-heuristiek en liet 11/12 lussen met blokkades
        // door (Overpass 14–98 s, timeout was fail-open). Hard geblokkeerd ⇒
        // volgende kandidaat; meting definitief mislukt ⇒ eerlijke fout,
        // nooit een ongecontroleerde route leveren.
        verifyObstaclesOf: routeObstaclesOf(),
        // Meerdere voorstellen: naast de winnaar ook max 2 écht anders
        // lopende, niet-afgekeurde kandidaten uit de interne pool teruggeven
        // — die werden voorheen stil weggegooid.
        alternatesOut: ctx.collectAlternates ? altResults : undefined,
        alternatesMax: 2,
        // WP-1: eerlijke fasemelding — de motor meldt wanneer de blokkerende
        // veiligheidscontrole van de winnaar begint.
        onPhase: ctx.onPhase,
      },
    );
    console.log(
      `[PERF] buildLoopCandidate.CACHE_MISS ms=${Math.round(performance.now() - _t_loop0)}`,
    );

    // Geocoding runs concurrently with ORS, so it's usually already done here.
    startName = await startNamePromise;

    // Store only the raw geometry — no user context, no candidateId.
    routeResult = {
      path: orsResult.path,
      points: orsResult.points,
      distanceKm: orsResult.distanceKm,
      ascentM: orsResult.ascentM,
      durationSec: orsResult.durationSec,
      steps: orsResult.steps,
      pavedFraction: orsResult.pavedFraction ?? null,
      surfaceKnownFraction: orsResult.surfaceKnownFraction ?? null,
      busyRoadFraction: orsResult.busyRoadFraction ?? null,
    };
    evictRouteGeometryCache();
    ROUTE_GEOMETRY_CACHE.set(loopGeomKey, {
      geometry: routeResult,
      startName,
      endName: null,
      at: Date.now(),
    });
  }

  const summary = summarizeTrack(routeResult.points);
  const distanceKm = summary.distanceKm ?? routeResult.distanceKm;
  const elevationGainM = summary.elevationGainM ?? routeResult.ascentM;
  const durationSec = routeResult.durationSec;
  const nav: RouteStep[] = routeResult.steps;

  const distLabel = distanceKm != null ? `${Math.round(distanceKm)} km` : "";
  const name = `${ctx.workoutTrainingType}-lus${startName ? ` vanuit ${startName}` : ""}${distLabel ? ` · ${distLabel}` : ""}`;

  const rationaleInput: RationaleInput = {
    trainingType: ctx.linkedWorkoutTitle
      ? `${ctx.workoutTrainingType} (${ctx.linkedWorkoutTitle})`
      : ctx.workoutTrainingType,
    profile: ctx.profile,
    mode: "loop",
    distanceKm,
    durationSec,
    elevationGainM,
    climbCount: summary.climbs.length,
    startName,
    endName: null,
    wish: ctx.wish,
  };

  // Immediate deterministic rationale — no external call, ≤1 ms.
  // AI-phrased rationale (with road-objects context) arrives via GET /candidate/:id/enrich.
  const rationale = buildRationaleFallback(rationaleInput);

  const engineSurface = engineSurfaceOf(routeResult);

  const candidateId = putCandidate({
    clerkId: ctx.clerkId,
    name,
    surface: ctx.surface,
    distanceKm,
    durationSec,
    elevationGainM,
    profile: summary.profile,
    climbs: summary.climbs,
    nav,
    geometry: routeResult.path,
    waypoints: [],
    rationale,
    plannedWorkoutId: ctx.plannedWorkoutId,
    engineSurface,
  });

  // Fire background enrichment — does NOT block the response.
  scheduleEnrichment(
    candidateId,
    ctx.clerkId,
    rationaleInput,
    routeResult.path,
    scenery?.nature ?? false,
  );

  // Extra voorstellen: dezelfde echte pool-kandidaten die de motor toch al
  // bouwde, nu als volwaardige kiesbare kandidaten (eigen candidateId, eigen
  // verrijking). Namen krijgen een letter zodat de renner ze uit elkaar houdt.
  const alternates = altResults.map((r, i) => {
    const altSummary = summarizeTrack(r.points);
    const altDistanceKm = altSummary.distanceKm ?? r.distanceKm;
    const altElevationGainM = altSummary.elevationGainM ?? r.ascentM;
    const altDistLabel =
      altDistanceKm != null ? `${Math.round(altDistanceKm)} km` : "";
    const letter = String.fromCharCode(66 + i); // B, C
    const altName = `${ctx.workoutTrainingType}-lus ${letter}${startName ? ` vanuit ${startName}` : ""}${altDistLabel ? ` · ${altDistLabel}` : ""}`;
    const altRationaleInput: RationaleInput = {
      ...rationaleInput,
      distanceKm: altDistanceKm,
      durationSec: r.durationSec,
      elevationGainM: altElevationGainM,
      climbCount: altSummary.climbs.length,
    };
    const altRationale = buildRationaleFallback(altRationaleInput);
    const altId = putCandidate({
      clerkId: ctx.clerkId,
      name: altName,
      surface: ctx.surface,
      distanceKm: altDistanceKm,
      durationSec: r.durationSec,
      elevationGainM: altElevationGainM,
      profile: altSummary.profile,
      climbs: altSummary.climbs,
      nav: r.steps,
      geometry: r.path,
      waypoints: [],
      rationale: altRationale,
      plannedWorkoutId: ctx.plannedWorkoutId,
      engineSurface: engineSurfaceOf(r),
    });
    scheduleEnrichment(
      altId,
      ctx.clerkId,
      altRationaleInput,
      r.path,
      scenery?.nature ?? false,
    );
    return {
      candidateId: altId,
      name: altName,
      surface: ctx.surface,
      sport: ctx.sport,
      bikeType: ctx.bikeType,
      routingProfile: ctx.profile,
      trainingType: ctx.workoutTrainingType,
      mode: "loop" as const,
      distanceKm: altDistanceKm,
      durationSec: r.durationSec,
      elevationGainM: altElevationGainM,
      profile: altSummary.profile,
      climbs: altSummary.climbs,
      nav: r.steps,
      geometry: r.path,
      waypoints: [] as [number, number][],
      rationale: altRationale,
      startName,
      endName: null,
      plannedWorkoutId: ctx.plannedWorkoutId,
      engineSurface: engineSurfaceOf(r),
      targetDistanceKm,
      busyRoadFraction: r.busyRoadFraction ?? null,
      roadObjects: null,
    };
  });

  return {
    candidateId,
    name,
    surface: ctx.surface,
    sport: ctx.sport,
    bikeType: ctx.bikeType,
    routingProfile: ctx.profile,
    trainingType: ctx.workoutTrainingType,
    mode: "loop" as const,
    distanceKm,
    durationSec,
    elevationGainM,
    profile: summary.profile,
    climbs: summary.climbs,
    nav,
    geometry: routeResult.path,
    waypoints: [] as [number, number][],
    rationale,
    startName,
    endName: null,
    plannedWorkoutId: ctx.plannedWorkoutId,
    engineSurface,
    targetDistanceKm,
    // Gemeten N-weg-aandeel (0..1) voor het eerlijke avoid-rapport; null als
    // de motor geen road_class-details leverde.
    busyRoadFraction: routeResult.busyRoadFraction ?? null,
    // Road objects are delivered asynchronously via GET /candidate/:id/enrich.
    roadObjects: null,
    // Extra echte voorstellen uit dezelfde pool (leeg bij cache-hit of als de
    // andere kandidaten te veel op de winnaar leken / afgekeurd werden).
    alternates,
  };
}

// POST /api/routes/zoek — zoeklaag voor routeaanvragen (taak #512, opdracht
// René 31-07-2026 §4–6): vind PASSENDE bestaande routes vóórdat er nieuw
// gegenereerd wordt. Zoekt in (1) eerder gereden routes (ritgeschiedenis),
// (2) bewust opgeslagen routes en (3) met de aanvrager gedeelde routes —
// gerangschikt op startplaats/afstand/hoogte/fietssoort/lus-of-A-B. Elke
// gevonden route gaat vóór levering door dezelfde fail-closed blokkadepoort
// als een nieuw gegenereerde route: geblokkeerd of niet-controleerbaar wordt
// eerlijk gemarkeerd en is niet bruikbaar. GEEN parallelle motor — nieuwe
// voorstellen blijven uit /generate komen; deze laag levert alleen écht
// bestaande routes met herkomstlabel + motivering.
//   body: { startLat, startLon, mode?: "loop"|"ptp", targetDistanceKm?,
//           targetDurationMin?, sport?, bikeType?, elevationPreference?,
//           trainingType?, unpavedPreferencePct? }
router.post("/zoek", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const startLat = finiteNum(body.startLat);
  const startLon = finiteNum(body.startLon);
  if (
    startLat == null ||
    startLon == null ||
    Math.abs(startLat) > 90 ||
    Math.abs(startLon) > 180
  ) {
    res.status(400).json({ error: "Geldig startpunt is verplicht" });
    return;
  }
  const mode = body.mode === "ptp" ? ("ptp" as const) : ("loop" as const);
  const sport = coerceSport(body.sport);
  const bikeType = coerceBikeType(body.bikeType);
  const elevationPreference = coerceElevation(body.elevationPreference) ?? "any";
  const trainingType =
    typeof body.trainingType === "string" && body.trainingType.trim()
      ? body.trainingType.trim()
      : null;
  const unpavedTargetShare = coerceUnpavedTargetShare(
    body.unpavedPreferencePct,
    bikeType,
  );

  // Afstandsdoel: expliciet > tijdsduur × kruissnelheid > standaard 40 km —
  // dezelfde maatvoering als de generator, zodat "past bij je aanvraag" voor
  // bekende en nieuwe voorstellen hetzelfde betekent.
  let targetDistanceKm = finiteNum(body.targetDistanceKm);
  const targetDurationMin = finiteNum(body.targetDurationMin);
  if (targetDistanceKm == null && targetDurationMin != null) {
    const profile = selectRoutingProfile({
      sport,
      bikeType,
      trainingType: trainingType ?? "duurtraining",
      durationMin: targetDurationMin,
      targetDistanceKm: null,
      elevationPreference:
        elevationPreference === "any" ? null : elevationPreference,
    });
    targetDistanceKm =
      Math.round((targetDurationMin / 60) * profileCruisingSpeedKmh(profile)) ||
      null;
  }
  if (targetDistanceKm == null) targetDistanceKm = 40;
  targetDistanceKm = Math.min(Math.max(targetDistanceKm, 3), 300);

  try {
    // (1)+(2) Eigen routes: gereden (ritgeschiedenis) én bewust opgeslagen.
    const own = await db
      .select()
      .from(routesTable)
      .where(
        and(
          eq(routesTable.clerkId, clerkId),
          isNull(routesTable.deletedAt),
          ne(routesTable.status, "archived"),
          isNotNull(routesTable.geometry),
        ),
      )
      .orderBy(desc(routesTable.createdAt))
      .limit(400);
    const rows: KnownRouteRow[] = own.map((r) => ({
      id: r.id,
      name: r.name,
      source: r.source,
      linkedActivityImportId: r.linkedActivityImportId,
      distanceKm: r.distanceKm,
      elevationGainM: r.elevationGainM,
      durationSec: r.durationSec,
      surface: r.surface,
      favorite: r.favorite,
      geometry: Array.isArray(r.geometry)
        ? (r.geometry as RoutePathPoint[])
        : null,
      ownership: "eigen",
    }));

    // (3) Toegestane gedeelde routes — zelfde zichtbaarheidsregels als
    // GET /gedeeld, en ALTIJD de veilige kijkersgeometrie (start/einde
    // afgekapt, privacyzone rond het huis van de eigenaar; fail-closed
    // wanneer dat huisadres onbekend is: dan geen geometrie ⇒ niet
    // voorstelbaar).
    const shares = await db
      .select({ share: routeSharesTable, route: routesTable })
      .from(routeSharesTable)
      .innerJoin(routesTable, eq(routeSharesTable.routeId, routesTable.id))
      .where(
        and(
          isNull(routesTable.deletedAt),
          ne(routesTable.clerkId, clerkId),
          isNotNull(routesTable.geometry),
        ),
      )
      .orderBy(desc(routeSharesTable.createdAt))
      .limit(200);
    if (shares.length > 0) {
      const [coachOf, myClubs] = await Promise.all([
        db
          .select({ athleteClerkId: coachAthleteLinksTable.athleteClerkId })
          .from(coachAthleteLinksTable)
          .where(
            and(
              eq(coachAthleteLinksTable.coachClerkId, clerkId),
              eq(coachAthleteLinksTable.status, "accepted"),
            ),
          ),
        activeClubIds(clerkId),
      ]);
      const coachedIds = new Set(coachOf.map((r) => r.athleteClerkId));
      const ownerIds = [...new Set(shares.map((s) => s.route.clerkId))];
      const clubmates = new Set<string>();
      if (myClubs.length > 0 && ownerIds.length > 0) {
        const clubRows = await db
          .select({ clerkId: clubMembersTable.clerkId })
          .from(clubMembersTable)
          .where(
            and(
              inArray(clubMembersTable.clubId, myClubs),
              inArray(clubMembersTable.clerkId, ownerIds),
              isNull(clubMembersTable.endedAt),
            ),
          );
        for (const r of clubRows) clubmates.add(r.clerkId);
      }
      const homeByOwner = new Map<
        string,
        { lat: number; lon: number } | null
      >();
      // Fail-closed voor eigenaren die niet AANTOONBAAR volwassen zijn
      // (minderjarig ÓF onbekende leeftijd): hun routes verschijnen NOOIT in
      // andermans zoekresultaten, ongeacht het deelniveau. Strikter dan
      // isMinorAthlete, dat onbekende leeftijd als niet-minderjarig telt.
      const adultByOwner = new Map<string, boolean>();
      const seen = new Set<number>();
      for (const { share, route } of shares) {
        if (seen.has(route.id)) continue;
        const visible =
          (share.audience === "persoon" && share.targetClerkId === clerkId) ||
          (share.audience === "coach" && coachedIds.has(route.clerkId)) ||
          ((share.audience === "club" || share.audience === "team") &&
            clubmates.has(route.clerkId));
        if (!visible) continue;
        seen.add(route.id);
        if (!adultByOwner.has(route.clerkId)) {
          adultByOwner.set(
            route.clerkId,
            await isVerifiedAdultAthlete(route.clerkId),
          );
        }
        if (adultByOwner.get(route.clerkId) !== true) continue;
        if (!homeByOwner.has(route.clerkId)) {
          homeByOwner.set(route.clerkId, await ownerHome(route.clerkId));
        }
        // Fail-closed: zonder bekend huisadres van de eigenaar is geen
        // veilige kijkersgeometrie te garanderen ⇒ de route doet niet mee
        // (sharedKnownRouteRow geeft dan null en transformeert niets).
        const rij = sharedKnownRouteRow(
          route,
          share.audience,
          homeByOwner.get(route.clerkId) ?? null,
          () => {
            const veilig = viewerRouteView(
              route,
              homeByOwner.get(route.clerkId)!,
            );
            return Array.isArray(veilig.geometry)
              ? (veilig.geometry as RoutePathPoint[])
              : null;
          },
        );
        if (rij) rows.push(rij);
      }
    }

    const ranked = rankKnownRoutes(rows, {
      start: { lat: startLat, lon: startLon },
      targetDistanceKm,
      mode,
      bikeType,
      elevationPreference,
      unpavedTargetShare,
      trainingType,
    });

    // Fail-closed blokkadepoort (taak #505/#512): dezelfde blokkerende
    // meting als bij nieuwe generatie — nooit een bekende route ongecheckt
    // leveren, ook niet als hij ooit probleemloos gereden is. De limiet van
    // 5 geldt voor BRUIKBARE voorstellen (ná verificatie): een lager
    // gerangschikte maar schone route verdringt zo een geblokkeerde top-5.
    // Geblokkeerde/niet-controleerbare treffers blijven beperkt zichtbaar,
    // eerlijk gemarkeerd met hun reden.
    const verified = await verifyKnownRoutes(ranked, routeObstaclesOf(), {
      maxBruikbaar: 5,
    });
    const bekend = [
      ...verified.filter((m) => m.bruikbaar).slice(0, 5),
      ...verified.filter((m) => !m.bruikbaar).slice(0, 3),
    ];

    res.json({
      bekend,
      criteria: {
        targetDistanceKm,
        mode,
        bikeType,
        elevationPreference,
      },
    });
  } catch (err) {
    req.log.error({ err }, "routes.zoek failed");
    res.status(500).json({ error: "Kon bekende routes niet doorzoeken" });
  }
});

// WP-1 (31-07-2026): fasemelding voor de routebouwer. De job-endpoints hangen
// een callback aan het request; het synchrone pad heeft er geen — dan is dit
// een no-op. Zo blijven beide paden exact dezelfde handler delen.
type GeneratePhaseFn = (p: "berekenen" | "veiligheidscontrole") => void;
function onPhaseOf(req: unknown): GeneratePhaseFn | undefined {
  return (req as { sparkiOnPhase?: GeneratePhaseFn }).sparkiOnPhase;
}

const generateHandler: import("express").RequestHandler = async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const provider = getRoutingProvider();
  if (!provider.isConfigured()) {
    res.status(503).json({
      error:
        "Routegeneratie is nog niet beschikbaar — de routeservice-sleutel ontbreekt.",
    });
    return;
  }

  const mode =
    body.mode === "ptp"
      ? "ptp"
      : body.mode === "waypoints"
        ? "waypoints"
        : "loop";
  // Phased rollout: route generation is only available for active sports
  // (currently cycling). Validate the RAW input before coercion — coerceSport
  // would otherwise silently map an explicit inactive sport (e.g. "triathlon",
  // "running") to cycling and let it through. Absent sport defaults to cycling.
  if (
    typeof body.sport === "string" &&
    !isSportActive(body.sport.toLowerCase())
  ) {
    res
      .status(400)
      .json({ error: "Deze sport is nog niet beschikbaar in Sparki." });
    return;
  }
  const sport = coerceSport(body.sport);
  const bikeType = coerceBikeType(body.bikeType);
  const elevationPreference = coerceElevation(body.elevationPreference);
  const trainingType =
    typeof body.trainingType === "string" && body.trainingType.trim()
      ? body.trainingType.trim()
      : "duurtraining";

  // Interactive mode: an ordered list of user-placed points the provider threads
  // a real road route through. The first point doubles as the start.
  const waypoints = mode === "waypoints" ? parseWaypoints(body.waypoints) : [];
  if (mode === "waypoints" && waypoints.length < 2) {
    res.status(400).json({
      error: "Plaats minstens twee punten op de kaart voor een eigen route",
    });
    return;
  }

  const startLat =
    mode === "waypoints" ? waypoints[0]!.lat : finiteNum(body.startLat);
  const startLon =
    mode === "waypoints" ? waypoints[0]!.lon : finiteNum(body.startLon);
  if (
    startLat == null ||
    startLon == null ||
    Math.abs(startLat) > 90 ||
    Math.abs(startLon) > 180
  ) {
    res.status(400).json({ error: "Geldig startpunt is verplicht" });
    return;
  }

  // Achtergrond-warm-up: registreer dit startgebied en warm het (fire-and-
  // forget, gated in de warm-up-module) zodat een volgende aanvraag in dit
  // gebied op volledige omgevingsdata draait. Raakt dit pad nooit.
  recordGeneratedArea(startLat, startLon);

  const seed = finiteNum(body.seed) ?? undefined;
  const wish = parseWish(body.wish);

  // Hoogtemeter-doel (alleen lus): Sparki kiest de ECHTE kandidaat die het
  // dichtst bij dit doel ligt — nooit een garantie, wel een eerlijke keuze.
  const rawElevTarget = finiteNum(body.targetElevationGainM);
  const targetElevationGainM =
    rawElevTarget != null && rawElevTarget > 0
      ? Math.min(rawElevTarget, 10000)
      : null;

  // Via-punten (alleen lus): de lus wordt als echte wegroute door deze punten
  // gelegd (start → via's → start).
  let viaPoints = mode === "loop" ? parseWaypoints(body.viaPoints) : [];
  let viaLoop = mode === "loop" && viaPoints.length > 0;

  // Vermijd-voorkeuren met een EERLIJK rapport: wat is echt toegepast en wat
  // kan de routebron niet garanderen. Nooit stilletjes negeren.
  const avoidBody =
    body.avoid && typeof body.avoid === "object"
      ? (body.avoid as Record<string, unknown>)
      : {};
  const avoidReport: {
    toegepast: string[];
    nietMogelijk: { wens: string; reden: string }[];
  } = { toegepast: [], nietMogelijk: [] };
  if (avoidBody.veerponten === true) {
    // ORS vermijdt veerponten al in alle fietsprofielen — echt toegepast.
    avoidReport.toegepast.push("veerponten");
  }
  const avoidOnverhard = avoidBody.onverhard === true;
  // Drukke N-wegen vermijden (taak #462): ECHT toegepast als voorkeur-straf
  // in het motor-custom-model (road_class primary/secondary). Het eerlijke
  // rapport (gelukt / niet gelukt in dit gebied / geen meting) volgt ná
  // generatie op basis van het gemeten N-weg-aandeel — nooit stiekem toch
  // N-weg rijden zonder het te zeggen.
  const avoidBusyRoads = coerceAvoidBusyRoads(body, sport);

  try {
    // Resolve target distance + workout context FIRST, so duration-based sizing
    // and profile selection can use the linked workout's intent.
    let targetDistanceKm = finiteNum(body.targetDistanceKm);
    let linkedWorkoutTitle: string | null = null;
    let workoutDurationMin: number | null = null;
    let workoutTrainingType = trainingType;

    const plannedWorkoutId =
      Number.isInteger(Number(body.plannedWorkoutId)) &&
      Number(body.plannedWorkoutId) > 0
        ? Number(body.plannedWorkoutId)
        : null;
    if (plannedWorkoutId != null) {
      const [workout] = await db
        .select()
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.id, plannedWorkoutId),
            eq(plannedWorkoutsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      if (!workout) {
        res.status(400).json({ error: "Ongeldige training-koppeling" });
        return;
      }
      linkedWorkoutTitle = workout.title;
      workoutDurationMin = workout.targetDurationMin;
      if (workout.type && workout.type.trim()) workoutTrainingType = workout.type;
    }

    // Hybride voorstel (taak #512): een EIGEN bekende route als basis — de
    // heenweg volgt de bekende route (via-punten uit de echte geometrie), de
    // terugweg wordt door de motor opnieuw gepland. Herkomst wordt bewaard in
    // naam + motivering ("Gebaseerd op jouw eerdere route …") en reist bij het
    // opslaan mee de bibliotheek in. Het voorstel gaat door exact dezelfde
    // fail-closed blokkadepoort als elke andere route — nooit omzeilen.
    let hybrideBase: { id: number; name: string } | null = null;
    const rawBaseRouteId = finiteNum(body.baseRouteId);
    if (
      mode === "loop" &&
      rawBaseRouteId != null &&
      Number.isInteger(rawBaseRouteId) &&
      rawBaseRouteId > 0
    ) {
      const [base] = await db
        .select()
        .from(routesTable)
        .where(
          and(
            eq(routesTable.id, rawBaseRouteId),
            // Alleen eigen routes als hybride basis: gedeelde routes hebben
            // een privacy-afgeschermde geometrie (start/einde afgekapt) en
            // zouden een oneerlijke basis vormen.
            eq(routesTable.clerkId, clerkId),
            isNull(routesTable.deletedAt),
          ),
        )
        .limit(1);
      const baseGeom =
        base && Array.isArray(base.geometry)
          ? (base.geometry as RoutePathPoint[])
          : null;
      if (!base || !baseGeom || baseGeom.length < 4) {
        res.status(400).json({
          error:
            "Basisroute voor het hybride voorstel niet gevonden of zonder bruikbare geometrie.",
        });
        return;
      }
      hybrideBase = { id: base.id, name: base.name };
      if (viaPoints.length === 0) viaPoints = hybrideViaPunten(baseGeom);
      viaLoop = viaPoints.length > 0;
    }

    // Auto-select the routing profile — the athlete never picks one.
    let profile = selectRoutingProfile({
      sport,
      bikeType,
      trainingType: workoutTrainingType,
      durationMin: workoutDurationMin,
      targetDistanceKm,
      elevationPreference,
    });
    // "Vermijd onverhard": echt toepasbaar door het verharde-wegen-profiel te
    // kiezen (cycling-road) — eerlijk gemeld in het rapport.
    if (avoidOnverhard && profile !== "cycling-road") {
      profile = "cycling-road";
      avoidReport.toegepast.push("onverhard (via het wegprofiel)");
    } else if (avoidOnverhard) {
      avoidReport.toegepast.push("onverhard");
    }
    // Harde grendel: nooit stil een racefiets/MTB-route leveren via een motor
    // die geen wegdek/legaliteit kan sturen terwijl de goede motor bestaat.
    {
      const configErr = bikeSuitabilityConfigError(profile);
      if (configErr) {
        res.status(503).json({ error: configErr });
        return;
      }
    }
    const surface = profileToSurface(profile);

    // Size a loop's target distance: explicit value > workout duration × speed
    // > sensible default. A→B distance is whatever the provider returns.
    if (targetDistanceKm == null && workoutDurationMin != null) {
      targetDistanceKm =
        Math.round(
          (workoutDurationMin / 60) * profileCruisingSpeedKmh(profile),
        ) || null;
    }
    if (targetDistanceKm == null) targetDistanceKm = 40;
    targetDistanceKm = Math.min(Math.max(targetDistanceKm, 3), 300);

    // Resolve an A→B destination from explicit coords or a free-text place.
    let end: { lat: number; lon: number } | null = null;
    let endLabel: string | null = null;
    if (mode === "ptp") {
      const endLat = finiteNum(body.endLat);
      const endLon = finiteNum(body.endLon);
      if (endLat != null && endLon != null) {
        end = { lat: endLat, lon: endLon };
      } else if (
        typeof body.destinationText === "string" &&
        body.destinationText.trim()
      ) {
        const geo = await provider.geocode(body.destinationText.trim());
        if (!geo) {
          res
            .status(422)
            .json({ error: "Kon de bestemming niet vinden" });
          return;
        }
        end = { lat: geo.lat, lon: geo.lon };
        endLabel = geo.label;
      } else {
        res
          .status(400)
          .json({ error: "Bestemming is verplicht voor een A→B route" });
        return;
      }
    }

    // Loop mode: build the candidate via the shared helper so the single-route
    // path and the 3-distance chooser (/generate/options) never drift.
    // The geometry cache lives inside buildLoopCandidate — identical ORS params
    // skip the provider call and return within ~1 ms. putCandidate is always
    // called fresh inside the helper, so ownership is always correct.
    if (mode === "loop" && !viaLoop) {
      const _t_req0 = performance.now();
      let candidate;
      try {
        candidate = await buildLoopCandidate(
          {
            clerkId,
            provider,
            start: { lat: startLat, lon: startLon },
            profile,
            surface,
            sport,
            bikeType,
            workoutTrainingType,
            linkedWorkoutTitle,
            elevationPreference: elevationPreference ?? "any",
            seed,
            points: loopPointsFor(workoutTrainingType),
            startName: null,
            plannedWorkoutId,
            wish,
            targetElevationGainM,
            unpavedTargetShare: coerceUnpavedTargetShare(
              body.unpavedPreferencePct,
              bikeType,
            ),
            avoidBusyRoads,
            // Kaart-planner: bied naast de winnaar ook de écht anders lopende
            // pool-kandidaten aan als kiesbare voorstellen.
            collectAlternates: true,
            onPhase: onPhaseOf(req),
          },
          targetDistanceKm,
        );
      } catch (err) {
        if (err instanceof NoSuitableRouteError) {
          // Harde afkeurpoort (PO-01 §5.2, taak #437): eerlijke weigering,
          // nooit een foute route tonen. De renner krijgt een duidelijke
          // melding; de klant-kant kan de renner vragen een ander startpunt
          // of kortere afstand te proberen.
          console.log(
            `[generate.loop] harde afkeur: ${err.message} ms=${Math.round(performance.now() - _t_req0)}`,
          );
          res.status(422).json({
            error: err.message,
            code: "NO_SUITABLE_ROUTE",
            profile: err.profile,
          });
          return;
        }
        if (err instanceof UnverifiableRouteError) {
          // Fail-closed (taak #505): geen geslaagde blokkademeting = niet
          // verifieerbaar = eerlijk weigeren, nooit ongecontroleerd leveren.
          console.log(
            `[generate.loop] unverifiable: ${err.message} ms=${Math.round(performance.now() - _t_req0)}`,
          );
          res.status(503).json({
            error: err.message,
            code: "ROUTE_UNVERIFIABLE",
            profile: err.profile,
          });
          return;
        }
        throw err;
      }
      console.log(`[PERF] generate.loop TOTAL ms=${Math.round(performance.now()-_t_req0)} distKm=${candidate.distanceKm?.toFixed(1)} mode=loop`);
      // Elk voorstel krijgt zijn EIGEN eerlijke vermijd-rapport — het gemeten
      // N-weg-aandeel verschilt per lus, dus het rapport van de winnaar mag
      // nooit stilzwijgend voor een alternatief doorgaan.
      const alternatesWithReport = (candidate.alternates ?? []).map((a) => {
        const altReport = {
          toegepast: [...avoidReport.toegepast],
          nietMogelijk: [...avoidReport.nietMogelijk],
        };
        applyBusyRoadReport(altReport, avoidBusyRoads, a.busyRoadFraction);
        return { ...a, avoidReport: altReport };
      });
      applyBusyRoadReport(avoidReport, avoidBusyRoads, candidate.busyRoadFraction);
      res.json({
        candidate: {
          ...candidate,
          avoidReport,
          alternates: alternatesWithReport,
        },
      });
      return;
    }

    // PTP / waypoints / via-loop path.
    const _t_ptpreq0 = performance.now();

    // Geometry-only cache: key on the parameters that determine ORS road
    // geometry. candidateId and user context are NOT stored — putCandidate is
    // always called fresh below so the candidate is owned by the current user
    // with the correct plannedWorkoutId. Safe for cross-user sharing.
    evictRouteGeometryCache();
    const ptpGeomKeyParams: Record<string, unknown> =
      mode === "ptp"
        ? {
            mode: "ptp",
            startLat,
            startLon,
            endLat: finiteNum(body.endLat) ?? null,
            endLon: finiteNum(body.endLon) ?? null,
            destinationText:
              typeof body.destinationText === "string"
                ? body.destinationText.trim()
                : null,
            profile,
            avoidBusyRoads,
          }
        : mode === "waypoints"
          ? {
              mode: "waypoints",
              waypoints: JSON.stringify(waypoints),
              profile,
              avoidBusyRoads,
            }
          : {
              mode: "via-loop",
              startLat,
              startLon,
              viaPoints: JSON.stringify(viaPoints),
              profile,
              avoidBusyRoads,
            };
    const ptpGeomKey = routeGeometryCacheKey(ptpGeomKeyParams);
    const ptpGeomCached = ROUTE_GEOMETRY_CACHE.get(ptpGeomKey);

    // Helper: build and return the PTP/waypoints candidate from geometry +
    // geocoded names. Always called with a fresh putCandidate so the candidateId
    // is always owned by the current user / linked to the current plannedWorkoutId.
    const buildPtpResponse = (
      geom: CachedRouteGeometry,
      resolvedStartName: string | null,
      resolvedEndName: string | null,
      cacheHit: boolean,
    ) => {
      const summary = summarizeTrack(geom.points);
      const distanceKm = summary.distanceKm ?? geom.distanceKm;
      const elevationGainM = summary.elevationGainM ?? geom.ascentM;
      const durationSec = geom.durationSec;
      const nav: RouteStep[] = geom.steps;

      const distLabel = distanceKm != null ? `${Math.round(distanceKm)} km` : "";
      const name = hybrideBase
        ? `Variant op ${hybrideBase.name}${distLabel ? ` · ${distLabel}` : ""}`
        : mode === "ptp"
          ? `${resolvedStartName ?? "Start"} → ${resolvedEndName ?? "bestemming"}${distLabel ? ` · ${distLabel}` : ""}`
          : mode === "waypoints"
            ? `Eigen route${resolvedStartName ? ` vanuit ${resolvedStartName}` : ""}${distLabel ? ` · ${distLabel}` : ""}`
            : `${workoutTrainingType}-lus${resolvedStartName ? ` vanuit ${resolvedStartName}` : ""}${distLabel ? ` · ${distLabel}` : ""}`;

      const rationaleInput: RationaleInput = {
        trainingType: linkedWorkoutTitle
          ? `${workoutTrainingType} (${linkedWorkoutTitle})`
          : workoutTrainingType,
        profile,
        mode,
        distanceKm,
        durationSec,
        elevationGainM,
        climbCount: summary.climbs.length,
        startName: resolvedStartName,
        endName: resolvedEndName,
        wish,
      };
      // Hybride herkomst hoort onlosmakelijk bij de motivering — zo reist
      // "Gebaseerd op jouw eerdere route …" bij het opslaan automatisch mee.
      const rationale = hybrideBase
        ? `Gebaseerd op jouw eerdere route "${hybrideBase.name}": de heenweg volgt je bekende route, de terugweg is opnieuw gepland en gecontroleerd. ${buildRationaleFallback(rationaleInput)}`
        : buildRationaleFallback(rationaleInput);

      const candidateId = putCandidate({
        clerkId,
        name,
        surface,
        distanceKm,
        durationSec,
        elevationGainM,
        profile: summary.profile,
        climbs: summary.climbs,
        nav,
        geometry: geom.path,
        waypoints: viaLoop
          ? viaPoints.map((p) => [p.lat, p.lon])
          : mode === "waypoints"
            ? waypoints.map((p) => [p.lat, p.lon])
            : [],
        rationale,
        plannedWorkoutId,
        engineSurface: engineSurfaceOf(geom),
      });

      // Hybride voorstellen behouden hun deterministische motivering-met-
      // herkomst: AI-verrijking zou de "Gebaseerd op jouw eerdere route …"-
      // regel stilletjes overschrijven, dus die slaan we hier bewust over.
      if (!hybrideBase) {
        scheduleEnrichment(
          candidateId,
          clerkId,
          rationaleInput,
          geom.path,
          false, // PTP/waypoints/via-loop routes have no scenery steering
        );
      }

      const totalMs = Math.round(performance.now() - _t_ptpreq0);
      console.log(
        `[PERF] generate.${mode} ${cacheHit ? "CACHE_HIT" : "CACHE_MISS"} ms=${totalMs}`,
      );

      // Eerlijk N-wegen-rapport op basis van de gecachete meting — geldt ook
      // bij een geometrie-cache-hit (de meting reist met de geometrie mee).
      applyBusyRoadReport(avoidReport, avoidBusyRoads, geom.busyRoadFraction);

      return {
        candidateId,
        name,
        surface,
        sport,
        bikeType,
        routingProfile: profile,
        trainingType: workoutTrainingType,
        mode,
        distanceKm,
        durationSec,
        elevationGainM,
        profile: summary.profile,
        climbs: summary.climbs,
        nav,
        geometry: geom.path,
        waypoints: viaLoop
          ? viaPoints.map((p) => [p.lat, p.lon])
          : mode === "waypoints"
            ? waypoints.map((p) => [p.lat, p.lon])
            : [],
        rationale,
        startName: resolvedStartName,
        endName: resolvedEndName,
        plannedWorkoutId,
        targetDistanceKm: null,
        avoidReport,
        // Hybride herkomst (taak #512): welke bekende route de basis vormde.
        hybride: hybrideBase
          ? {
              baseRouteId: hybrideBase.id,
              baseRouteName: hybrideBase.name,
            }
          : undefined,
      };
    };

    // Harde blokkadepoort óók voor handmatige punten/PTP (opdracht
    // 30-07-2026): een route over fietsverbod, trap of afgesloten poort/
    // privéterrein wordt nooit als voorstel aangeboden — ook niet wanneer de
    // renner de punten zelf plaatste. Zelfde meting als de lusgenerator,
    // maar BLOKKEREND (besluit René, stap 2/3 Routes-bewijsronde, taak #502):
    // een koude Overpass-cache duurt in deze omgeving 10–20 s en het oude
    // 2500 ms-budget liet daardoor de allereerste aanvraag in een vers gebied
    // dwars door een op-slot-poort met 200 door (live bewezen 30-07-2026).
    // We wachten dus tot de meting klaar is — de meting zelf is begrensd
    // (per-mirror timeout in route-remarks), dus dit hangt nooit oneindig.
    // Alleen een ÉCHT mislukte meting (alle mirrors kapot) blijft eerlijk
    // fail-open, en dat wordt expliciet gelogd.
    const rejectIfBlocked = async (
      path: RoutePathPoint[],
    ): Promise<boolean> => {
      onPhaseOf(req)?.("veiligheidscontrole");
      const _t_gate0 = performance.now();
      const obs = await routeObstaclesOf()(path);
      console.log(
        `[generate.${mode}] blokkadepoort meting ms=${Math.round(performance.now() - _t_gate0)} beschikbaar=${obs != null}`,
      );
      if (obs == null) {
        // Fail-closed (taak #505): geen geslaagde meting = niet verifieerbaar
        // = nooit als voorstel aanbieden. Voorheen fail-open; dat is precies
        // het gat waardoor ongecontroleerde routes doorlekten.
        req.log.warn(
          { mode },
          "generate: blokkademeting definitief niet beschikbaar — fail-closed geweigerd",
        );
        res.status(422).json({
          error:
            "De route kon niet gecontroleerd worden op blokkades (de kaartbron gaf geen antwoord). We bieden een ongecontroleerde route niet aan — probeer het over een paar minuten opnieuw.",
          code: "ROUTE_UNVERIFIABLE",
        });
        return true;
      }
      if (
        obs != null &&
        (obs.forbidden > 0 || obs.steps > 0 || obs.blockedGates > 0)
      ) {
        console.log(
          `[generate.${mode}] harde afkeur handmatige route: forbidden=${obs.forbidden} steps=${obs.steps} blockedGates=${obs.blockedGates}`,
        );
        res.status(422).json({
          error:
            "Deze route loopt over een harde blokkade (fietsverbod, trap of afgesloten poort/privéterrein) en wordt daarom niet aangeboden. Verplaats een punt om de blokkade heen.",
          code: "NO_SUITABLE_ROUTE",
          blockage: obs,
        });
        return true;
      }
      return false;
    };

    if (ptpGeomCached) {
      // Geometry cache hit: skip ORS + geocoding entirely.
      if (await rejectIfBlocked(ptpGeomCached.geometry.path)) return;
      res.json({
        candidate: buildPtpResponse(
          ptpGeomCached.geometry,
          ptpGeomCached.startName,
          ptpGeomCached.endName,
          true,
        ),
      });
      return;
    }

    // Cache miss: call ORS provider, then geocode place names concurrently.
    const _t_ors0 = performance.now();
    const orsResult =
      mode === "waypoints"
        ? await provider.routeWaypoints({
            points: waypoints,
            profile,
            avoidBusyRoads,
          })
        : viaLoop
          ? await provider.routeWaypoints({
              points: [
                { lat: startLat, lon: startLon },
                ...viaPoints,
                { lat: startLat, lon: startLon },
              ],
              profile,
              avoidBusyRoads,
            })
          : await provider.routePointToPoint({
              start: { lat: startLat, lon: startLon },
              end: end!,
              profile,
              avoidBusyRoads,
            });
    console.log(`[PERF] generate.ors mode=${mode} ms=${Math.round(performance.now()-_t_ors0)}`);

    // Best-effort place names — never blocks generation.
    const endPoint =
      end ??
      (mode === "waypoints" && !viaLoop
        ? waypoints[waypoints.length - 1]!
        : null);
    const [startName, resolvedEndName] = await Promise.all([
      provider.reverseGeocode({ lat: startLat, lon: startLon }),
      endPoint ? provider.reverseGeocode(endPoint) : Promise.resolve(endLabel),
    ]);
    const endName = endLabel ?? resolvedEndName;

    // Store only the raw geometry + names — no user context, no candidateId.
    const ptpGeom: CachedRouteGeometry = {
      path: orsResult.path,
      points: orsResult.points,
      distanceKm: orsResult.distanceKm,
      ascentM: orsResult.ascentM,
      durationSec: orsResult.durationSec,
      steps: orsResult.steps,
      pavedFraction: orsResult.pavedFraction ?? null,
      surfaceKnownFraction: orsResult.surfaceKnownFraction ?? null,
      busyRoadFraction: orsResult.busyRoadFraction ?? null,
    };
    evictRouteGeometryCache();
    ROUTE_GEOMETRY_CACHE.set(ptpGeomKey, {
      geometry: ptpGeom,
      startName,
      endName,
      at: Date.now(),
    });

    if (await rejectIfBlocked(ptpGeom.path)) return;
    res.json({
      candidate: buildPtpResponse(ptpGeom, startName, endName, false),
    });
  } catch (err) {
    req.log.error({ err }, "routes.generate failed");
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Routegeneratie mislukt";
    res.status(502).json({ error: message });
  }
};
router.post("/generate", requireAuth, generateHandler);

// POST /api/routes/generate/options — loop-only. Instead of a single route,
// Sparki proposes THREE real loops at different distances (korter ≈ 0,9× /
// gevraagd 1,0× / langer ≈ 1,2× the target) so the rider can pick. Each option
// is a fully-computed, server-stored candidate (same shape + a `variant` label)
// that can be saved via POST / like any other candidate. Nothing is fabricated:
// distances that collide after rounding/clamping are de-duplicated, so near a
// clamp bound you may honestly get fewer than three.
const generateOptionsHandler: import("express").RequestHandler = async (
  req,
  res,
) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const provider = getRoutingProvider();
  if (!provider.isConfigured()) {
    res.status(503).json({
      error:
        "Routegeneratie is nog niet beschikbaar — de routeservice-sleutel ontbreekt.",
    });
    return;
  }

  if (
    typeof body.sport === "string" &&
    !isSportActive(body.sport.toLowerCase())
  ) {
    res
      .status(400)
      .json({ error: "Deze sport is nog niet beschikbaar in Sparki." });
    return;
  }
  const sport = coerceSport(body.sport);
  const bikeType = coerceBikeType(body.bikeType);
  const elevationPreference = coerceElevation(body.elevationPreference);
  const trainingType =
    typeof body.trainingType === "string" && body.trainingType.trim()
      ? body.trainingType.trim()
      : "duurtraining";

  const startLat = finiteNum(body.startLat);
  const startLon = finiteNum(body.startLon);
  if (
    startLat == null ||
    startLon == null ||
    Math.abs(startLat) > 90 ||
    Math.abs(startLon) > 180
  ) {
    res.status(400).json({ error: "Geldig startpunt is verplicht" });
    return;
  }

  const seed = finiteNum(body.seed) ?? undefined;
  const wish = parseWish(body.wish);

  try {
    let targetDistanceKm = finiteNum(body.targetDistanceKm);
    let linkedWorkoutTitle: string | null = null;
    let workoutDurationMin: number | null = null;
    let workoutTrainingType = trainingType;

    const plannedWorkoutId =
      Number.isInteger(Number(body.plannedWorkoutId)) &&
      Number(body.plannedWorkoutId) > 0
        ? Number(body.plannedWorkoutId)
        : null;
    if (plannedWorkoutId != null) {
      const [workout] = await db
        .select()
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.id, plannedWorkoutId),
            eq(plannedWorkoutsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      if (!workout) {
        res.status(400).json({ error: "Ongeldige training-koppeling" });
        return;
      }
      linkedWorkoutTitle = workout.title;
      workoutDurationMin = workout.targetDurationMin;
      if (workout.type && workout.type.trim())
        workoutTrainingType = workout.type;
    }

    const profile = selectRoutingProfile({
      sport,
      bikeType,
      trainingType: workoutTrainingType,
      durationMin: workoutDurationMin,
      targetDistanceKm,
      elevationPreference,
    });
    {
      const configErr = bikeSuitabilityConfigError(profile);
      if (configErr) {
        res.status(503).json({ error: configErr });
        return;
      }
    }
    const surface = profileToSurface(profile);

    if (targetDistanceKm == null && workoutDurationMin != null) {
      targetDistanceKm =
        Math.round(
          (workoutDurationMin / 60) * profileCruisingSpeedKmh(profile),
        ) || null;
    }
    if (targetDistanceKm == null) targetDistanceKm = 40;
    targetDistanceKm = Math.min(Math.max(targetDistanceKm, 3), 300);
    const base = targetDistanceKm;

    // korter ≈ 0,9× · gevraagd 1,0× · langer ≈ 1,2×. Clamp to the honest bounds
    // and de-duplicate so a request near an edge never fabricates variants.
    const distances = [
      ...new Set(
        [Math.round(base * 0.9), base, Math.round(base * 1.2)].map((d) =>
          Math.min(Math.max(d, 3), 300),
        ),
      ),
    ].sort((a, b) => a - b);

    const startName = await provider.reverseGeocode({
      lat: startLat,
      lon: startLon,
    });

    const ctx: LoopCandidateContext = {
      clerkId,
      provider,
      start: { lat: startLat, lon: startLon },
      profile,
      surface,
      sport,
      bikeType,
      workoutTrainingType,
      linkedWorkoutTitle,
      elevationPreference: elevationPreference ?? "any",
      seed,
      points: loopPointsFor(workoutTrainingType),
      startName,
      plannedWorkoutId,
      wish,
      unpavedTargetShare: coerceUnpavedTargetShare(
        body.unpavedPreferencePct,
        bikeType,
      ),
      avoidBusyRoads: coerceAvoidBusyRoads(body, sport),
      onPhase: onPhaseOf(req),
    };

    // Build sequentially — each loop already fans out several provider probes,
    // so parallelising all three at once risks tripping ORS rate limits.
    // Fail-soft per variant: bouw de GEVRAAGDE afstand eerst; als een variant
    // faalt (bijv. tijdelijke ORS-limiet) leveren we eerlijk de varianten die
    // wél lukten in plaats van na lang wachten met lege handen te eindigen.
    // Alleen als ALLES faalt volgt een echte foutmelding. Een tijdbudget
    // voorkomt dat trage extra varianten de rijder minutenlang laten wachten.
    const ordered = [base, ...distances.filter((d) => d !== base)];
    const options: Array<
      Awaited<ReturnType<typeof buildLoopCandidate>> & {
        variant: string;
        avoidReport: {
          toegepast: string[];
          nietMogelijk: { wens: string; reden: string }[];
        };
      }
    > = [];
    let firstError: unknown = null;
    const budgetStart = Date.now();
    const BUDGET_MS = 25_000;
    for (const d of ordered) {
      if (Date.now() - budgetStart > BUDGET_MS) {
        req.log.warn(
          { built: options.length },
          "routes.generate.options: tijdbudget op — resterende varianten overgeslagen",
        );
        break;
      }
      try {
        const candidate = await buildLoopCandidate(ctx, d);
        const variant = d < base ? "Korter" : d > base ? "Langer" : "Op maat";
        // Eerlijk N-wegen-rapport per variant (taak #462): gelukt, niet
        // gelukt in dit gebied, of geen meting — nooit stil.
        const avoidReport: {
          toegepast: string[];
          nietMogelijk: { wens: string; reden: string }[];
        } = { toegepast: [], nietMogelijk: [] };
        applyBusyRoadReport(
          avoidReport,
          ctx.avoidBusyRoads === true,
          candidate.busyRoadFraction,
        );
        options.push({ ...candidate, variant, avoidReport });
      } catch (err) {
        firstError = firstError ?? err;
        req.log.warn({ err, distanceKm: d }, "routes.generate.options: variant mislukt");
      }
    }
    if (options.length === 0) throw firstError ?? new Error("Routegeneratie mislukt");
    // Vaste volgorde voor de kiezer: kort → gevraagd → lang.
    options.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    res.json({ options });
  } catch (err) {
    req.log.error({ err }, "routes.generate.options failed");
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Routegeneratie mislukt";
    // Fail-closed (taak #505): niet-verifieerbaar krijgt een eigen code zodat
    // de klant de eerlijke uitleg kan tonen (geen KLAAR, geen opslag).
    if (err instanceof UnverifiableRouteError) {
      res.status(503).json({ error: message, code: "ROUTE_UNVERIFIABLE" });
      return;
    }
    if (err instanceof NoSuitableRouteError) {
      res.status(422).json({ error: message, code: "NO_SUITABLE_ROUTE" });
      return;
    }
    res.status(502).json({ error: message });
  }
};
router.post("/generate/options", requireAuth, generateOptionsHandler);

// ── WP-1 (31-07-2026): generatie als korte start + statuspolling ───────────
// Waarom: één lange POST wordt op mobiel afgebroken door proxy-afkap of
// schermvergrendeling — de renner zag een berekening die "stil stopt". De
// job-endpoints hergebruiken EXACT dezelfde handlers (zelfde motor, zelfde
// fail-closed poorten, zelfde foutcodes); alleen het transport verschilt.
function startGenerationJob(
  handler: import("express").RequestHandler,
  req: import("express").Request,
  res: import("express").Response,
): void {
  const clerkId = getClerkUserId(req)!;
  const job = createRouteGenerationJob(clerkId);
  setJobPhase(job, "berekenen");
  (req as unknown as { sparkiOnPhase: GeneratePhaseFn }).sparkiOnPhase = (p) =>
    setJobPhase(job, p);
  // Vang de uitkomst van de bestaande handler op in plaats van hem naar de
  // (allang beantwoorde) verbinding te schrijven.
  let captured = 200;
  const fakeRes = {
    status(code: number) {
      captured = code;
      return this;
    },
    json(body: unknown) {
      finishJob(job, captured, body);
      return this;
    },
  } as unknown as import("express").Response;
  Promise.resolve(handler(req, fakeRes, () => {})).catch((err) => {
    req.log.error({ err }, "routes.generate job crashed");
    if (!job.done)
      finishJob(job, 502, {
        error: "Routegeneratie mislukt door een serverfout. Probeer het opnieuw.",
      });
  });
  res.status(202).json({ jobId: job.id });
}

router.post("/generate/start", requireAuth, (req, res) => {
  startGenerationJob(generateHandler, req, res);
});
router.post("/generate/options/start", requireAuth, (req, res) => {
  startGenerationJob(generateOptionsHandler, req, res);
});

// GET /api/routes/generate-jobs/:id — status/resultaat van een gestarte
// generatie. Ownership-gecheckt; andermans job = 404. Zolang de job loopt
// komt alleen de eerlijke fase terug; daarna het volledige HTTP-contract van
// het synchrone endpoint (status + body), zodat 422/503 fail-closed blijft.
router.get("/generate-jobs/:id", requireAuth, (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const job = getRouteGenerationJob(String(req.params.id), clerkId);
  if (!job) {
    res.status(404).json({ error: "Aanvraag niet gevonden of verlopen" });
    return;
  }
  if (!job.done) {
    res.json({ done: false, phase: job.phase });
    return;
  }
  res.json({ done: true, phase: job.phase, status: job.status, body: job.body });
});

// POST /api/routes — create a route. Two sources:
//   1. GPX upload: body { content (GPX text), name?, surface?, visibility?,
//      linkedActivityImportId? } — distance/profile/climbs derived from track.
//   2. Generated route: body { source: "generated", candidateId, name?,
//      visibility? } — candidateId references a server-trusted candidate from
//      POST /generate. All geometry/distance/duration/elevation/nav are pulled
//      from that stored candidate, NEVER from the client (data-honesty guard:
//      a forged payload cannot persist fabricated metrics). The client may only
//      override cosmetic fields (name, visibility).
// We never fabricate directions; GPX uploads keep nav null.
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  // ── Generated route branch ─────────────────────────────────────────────────
  if (body.source === "generated") {
    const candidateId =
      typeof body.candidateId === "string" ? body.candidateId : "";
    const stored = candidateId ? getCandidate(candidateId, clerkId) : null;
    if (!stored) {
      res.status(410).json({
        error:
          "Routevoorstel is verlopen of niet gevonden — genereer de route opnieuw.",
      });
      return;
    }

    // Only cosmetic overrides are accepted from the client; all route data comes
    // from the trusted stored candidate. Meeting points ("verzamelpunten") are
    // user annotations — not provider geometry — so they're accepted from the
    // client, but sanitised by parseMeetpoints (coords range-checked, capped).
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : stored.name;
    const meetpoints = parseMeetpoints(body.meetpoints);

    try {
      // Re-validate workout ownership defensively (it was checked at /generate).
      let linkedPlannedWorkoutId: number | null = null;
      if (stored.plannedWorkoutId != null) {
        const [owned] = await db
          .select({ id: plannedWorkoutsTable.id })
          .from(plannedWorkoutsTable)
          .where(
            and(
              eq(plannedWorkoutsTable.id, stored.plannedWorkoutId),
              eq(plannedWorkoutsTable.clerkId, clerkId),
            ),
          )
          .limit(1);
        if (owned) linkedPlannedWorkoutId = owned.id;
      }

      const [route] = await db
        .insert(routesTable)
        .values({
          clerkId,
          name,
          surface: coerceSurface(stored.surface),
          visibility: await safeVisibility(clerkId, body.visibility),
          status: "ready",
          distanceKm: stored.distanceKm,
          durationSec: stored.durationSec,
          elevationGainM: stored.elevationGainM,
          profile: stored.profile,
          climbs: stored.climbs,
          nav: stored.nav.length > 0 ? stored.nav : null,
          geometry: stored.geometry as RoutePathPoint[],
          waypoints:
            stored.waypoints.length > 0
              ? (stored.waypoints as RouteWaypoint[])
              : null,
          meetpoints: meetpoints.length > 0 ? meetpoints : null,
          rationale: stored.rationale,
          engineSurface: stored.engineSurface,
          source: "generated",
          linkedActivityImportId: null,
          linkedPlannedWorkoutId,
        })
        .returning();
      res.status(201).json({ route });
    } catch (err) {
      req.log.error({ err }, "routes.create (generated) failed");
      res.status(500).json({ error: "Kon route niet opslaan" });
    }
    return;
  }

  // ── GPX upload branch ──────────────────────────────────────────────────────
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) {
    res.status(400).json({ error: "GPX-inhoud (content) is verplicht" });
    return;
  }

  const parsed = parseGpxRoute(content);
  if (!parsed) {
    res
      .status(422)
      .json({ error: "Geen geldige trackpunten gevonden in GPX-bestand" });
    return;
  }

  const nameOverride =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : null;
  const name = nameOverride ?? parsed.trackName ?? "Naamloze route";

  const requestedLinkId =
    Number.isInteger(Number(body.linkedActivityImportId)) &&
    Number(body.linkedActivityImportId) > 0
      ? Number(body.linkedActivityImportId)
      : null;

  try {
    // Only link an activity import the caller actually owns — never trust a
    // raw id from the client (cross-tenant reference protection).
    let linkedActivityImportId: number | null = null;
    if (requestedLinkId != null) {
      const [owned] = await db
        .select({ id: activityImportsTable.id })
        .from(activityImportsTable)
        .where(
          and(
            eq(activityImportsTable.id, requestedLinkId),
            eq(activityImportsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      if (!owned) {
        res.status(400).json({ error: "Ongeldige activiteit-koppeling" });
        return;
      }
      linkedActivityImportId = owned.id;
    }

    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name,
        surface: coerceSurface(body.surface),
        visibility: await safeVisibility(clerkId, body.visibility),
        status: "ready",
        distanceKm: parsed.distanceKm,
        elevationGainM: parsed.elevationGainM,
        profile: parsed.profile,
        climbs: parsed.climbs,
        // Persist the full track shape (with per-point elevation where present)
        // so the import can be re-exported as a faithful GPX. A bare GPX track
        // still carries no turn semantics, so nav stays null.
        geometry: parsed.geometry,
        nav: null,
        source: "gpx",
        linkedActivityImportId,
      })
      .returning();
    res.status(201).json({ route });
  } catch (err) {
    req.log.error({ err }, "routes.create failed");
    res.status(500).json({ error: "Kon route niet opslaan" });
  }
});

// POST /api/routes/from-activity — save a RIDDEN ride as a re-ridable route.
// body: { importId, name?, surface?, visibility? }. The geometry/profile/climbs
// come from the real track stored on the activity import at ingest — never
// fabricated. If the import has no stored track (older imports, or non-GPX
// sources that don't retain geometry), we honestly refuse (422) instead of
// inventing a path.
router.post("/from-activity", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const importId =
    Number.isInteger(Number(body.importId)) && Number(body.importId) > 0
      ? Number(body.importId)
      : null;
  if (importId == null) {
    res.status(400).json({ error: "importId is verplicht" });
    return;
  }

  try {
    // Only the caller's own import may be read (cross-tenant protection).
    const [imp] = await db
      .select()
      .from(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.id, importId),
          eq(activityImportsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (!imp) {
      res.status(404).json({ error: "Activiteit niet gevonden" });
      return;
    }

    const summary = (imp.parsedSummary ?? null) as {
      route?: {
        geometry?: RoutePathPoint[];
        profile?: number[];
        climbs?: unknown[];
        distanceKm?: number | null;
        elevationGainM?: number | null;
        trackName?: string | null;
      } | null;
    } | null;
    const stored = summary?.route ?? null;
    // Defense-in-depth: only accept a real numeric [lat, lon(, ele)] tuple
    // sequence. Guards against malformed historical JSON rather than trusting
    // the stored shape blindly.
    const geometry: RoutePathPoint[] = Array.isArray(stored?.geometry)
      ? (stored!.geometry.filter(
          (p): p is RoutePathPoint =>
            Array.isArray(p) &&
            p.length >= 2 &&
            Number.isFinite(p[0]) &&
            Number.isFinite(p[1]) &&
            Math.abs(p[0] as number) <= 90 &&
            Math.abs(p[1] as number) <= 180,
        ) as RoutePathPoint[])
      : [];
    if (!stored || geometry.length < 2) {
      res.status(422).json({
        error:
          "Deze rit heeft geen opgeslagen route om terug te rijden. Alleen ritten met een bewaarde GPS-track kunnen als route worden opgeslagen.",
      });
      return;
    }

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : stored.trackName || imp.fileName || "Gereden route";

    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name,
        surface: coerceSurface(body.surface),
        visibility: await safeVisibility(clerkId, body.visibility),
        status: "ready",
        distanceKm: stored.distanceKm ?? null,
        elevationGainM: stored.elevationGainM ?? null,
        profile: Array.isArray(stored.profile) ? stored.profile : null,
        climbs:
          Array.isArray(stored.climbs) && stored.climbs.length > 0
            ? stored.climbs
            : null,
        // A ridden track carries no turn semantics, so nav stays null (the
        // navigator shows the line without invented directions).
        nav: null,
        geometry: stored.geometry as RoutePathPoint[],
        source: "ridden",
        linkedActivityImportId: imp.id,
      })
      .returning();
    res.status(201).json({ route });
  } catch (err) {
    req.log.error({ err }, "routes.fromActivity failed");
    res.status(500).json({ error: "Kon route niet opslaan" });
  }
});

// PUT /api/routes/:id — bewerk een route (alleen eigenaar). Inhoudelijke
// wijzigingen (naam, ondergrond, meetpunten) verhogen het versienummer, zodat
// eerder vastgelegd versiegebruik eerlijk naar de oude versie blijft wijzen.
// Niet-inhoudelijk (favoriet, zichtbaarheid, archiveren) laat de versie staan.
router.put("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(
        and(
          eq(routesTable.id, id),
          eq(routesTable.clerkId, clerkId),
          isNull(routesTable.deletedAt),
        ),
      )
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const updates: Record<string, unknown> = {};
    let inhoudelijk = false;
    if (typeof body.name === "string" && body.name.trim()) {
      const name = body.name.trim().slice(0, 120);
      if (name !== route.name) {
        updates.name = name;
        inhoudelijk = true;
      }
    }
    if (typeof body.surface === "string") {
      if (!(routeSurfaces as readonly string[]).includes(body.surface)) {
        res.status(400).json({ error: "Ongeldige ondergrond" });
        return;
      }
      if (body.surface !== route.surface) {
        updates.surface = body.surface as RouteSurface;
        inhoudelijk = true;
      }
    }
    if (body.meetpoints !== undefined) {
      const meetpoints = parseMeetpoints(body.meetpoints);
      updates.meetpoints = meetpoints;
      inhoudelijk = true;
    }
    if (typeof body.visibility === "string") {
      if (!(routeVisibilities as readonly string[]).includes(body.visibility)) {
        res.status(400).json({ error: "Ongeldige zichtbaarheid" });
        return;
      }
      // Fail-closed: minderjarigen kunnen een route nooit openbaar zetten.
      if (body.visibility === "public" && (await isMinorAthlete(clerkId))) {
        res.status(403).json({
          error:
            "Openbaar delen is niet beschikbaar voor renners onder de 18.",
        });
        return;
      }
      updates.visibility = body.visibility as RouteVisibility;
    }
    if (typeof body.favorite === "boolean") updates.favorite = body.favorite;
    // Eigenaarskeuze: mag Sparki deze route gebruiken voor automatische
    // voorstellen? Presentatie/gedrag, geen inhoudelijke wijziging.
    if (typeof body.suggestExclude === "boolean") {
      updates.suggestExclude = body.suggestExclude;
    }
    // Gebruikstype (training | toertocht | wedstrijd) — wedstrijd activeert
    // Wedstrijdmodus in de live navigatie. Presentatie/gedrag, geen inhoudelijke
    // routewijziging (geen versie-bump).
    if (typeof body.usageType === "string") {
      if (!["training", "toertocht", "wedstrijd"].includes(body.usageType)) {
        res.status(400).json({ error: "Ongeldig gebruikstype" });
        return;
      }
      updates.usageType = body.usageType;
    }
    if (typeof body.status === "string") {
      if (!["ready", "archived"].includes(body.status)) {
        res.status(400).json({ error: "Ongeldige status" });
        return;
      }
      updates.status = body.status;
    }
    if (Object.keys(updates).length === 0) {
      res.json({ route });
      return;
    }
    if (inhoudelijk) updates.version = route.version + 1;
    const [updated] = await db
      .update(routesTable)
      .set(updates)
      .where(eq(routesTable.id, id))
      .returning();
    res.json({ route: updated });
  } catch (err) {
    req.log.error({ err }, "routes.update failed");
    res.status(500).json({ error: "Kon route niet bijwerken" });
  }
});

// POST /api/routes/:id/duplicate — kopieer een eigen route (of een met jou
// gedeelde route naar je eigen bibliotheek; dan wordt de VEILIGE kijkers-
// geometrie gekopieerd, nooit de exacte start van de eigenaar).
router.post("/:id/duplicate", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), isNull(routesTable.deletedAt)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const isOwner = route.clerkId === clerkId;
    let source: Record<string, unknown> = route;
    if (!isOwner) {
      const allowed = await canViewSharedRoute(route, clerkId);
      if (!allowed) {
        res.status(404).json({ error: "Route niet gevonden" });
        return;
      }
      const zones = await ownerPrivacyZones(route.clerkId);
      source = viewerRouteView(route, zones) as Record<string, unknown>;
      if (!source.geometry) {
        res.status(422).json({
          error:
            "Deze gedeelde route heeft na privacy-afscherming geen bruikbare geometrie om te kopiëren.",
        });
        return;
      }
    }
    const [copy] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name: `${route.name} (kopie)`,
        source: route.source,
        surface: route.surface as RouteSurface,
        visibility: "prive",
        status: "ready",
        distanceKm: route.distanceKm,
        durationSec: route.durationSec,
        elevationGainM: route.elevationGainM,
        geometry: source.geometry as RoutePathPoint[] | null,
        profile: (isOwner ? route.profile : null) as never,
        nav: (isOwner ? route.nav : null) as never,
        waypoints: (isOwner ? route.waypoints : null) as never,
        meetpoints: (isOwner ? route.meetpoints : null) as never,
      })
      .returning();
    res.status(201).json({ route: copy });
  } catch (err) {
    req.log.error({ err }, "routes.duplicate failed");
    res.status(500).json({ error: "Kon route niet kopiëren" });
  }
});

// ── Delen ──────────────────────────────────────────────────────────────────

// POST /api/routes/:id/delen — deel een route (alleen eigenaar) met coach,
// club, team of één persoon. Idempotent: nogmaals delen met dezelfde doelgroep
// geeft de bestaande rij terug.
router.post("/:id/delen", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const audience =
    typeof body.audience === "string" &&
    (routeShareAudiences as readonly string[]).includes(body.audience)
      ? (body.audience as RouteShareAudience)
      : null;
  if (!audience) {
    res.status(400).json({ error: "Ongeldige doelgroep" });
    return;
  }
  const targetClerkId =
    typeof body.targetClerkId === "string" && body.targetClerkId.trim()
      ? body.targetClerkId.trim()
      : null;
  if (audience === "persoon" && !targetClerkId) {
    res
      .status(400)
      .json({ error: "Delen met een persoon vereist een gebruiker" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(
        and(
          eq(routesTable.id, id),
          eq(routesTable.clerkId, clerkId),
          isNull(routesTable.deletedAt),
        ),
      )
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    if (audience === "persoon") {
      const [target] = await db
        .select({ clerkId: userProfilesTable.clerkId })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, targetClerkId!))
        .limit(1);
      if (!target) {
        res.status(400).json({ error: "Deze gebruiker bestaat niet" });
        return;
      }
      if (target.clerkId === clerkId) {
        res.status(400).json({ error: "Je kunt niet met jezelf delen" });
        return;
      }
    }
    const [created] = await db
      .insert(routeSharesTable)
      .values({
        routeId: id,
        ownerClerkId: clerkId,
        audience,
        targetClerkId: audience === "persoon" ? targetClerkId : null,
      })
      .onConflictDoNothing()
      .returning();
    if (created) {
      res.status(201).json({ share: created });
      return;
    }
    const [existing] = await db
      .select()
      .from(routeSharesTable)
      .where(
        and(
          eq(routeSharesTable.routeId, id),
          eq(routeSharesTable.audience, audience),
          audience === "persoon"
            ? eq(routeSharesTable.targetClerkId, targetClerkId!)
            : isNull(routeSharesTable.targetClerkId),
        ),
      )
      .limit(1);
    res.json({ share: existing ?? null });
  } catch (err) {
    req.log.error({ err }, "routes.share failed");
    res.status(500).json({ error: "Kon route niet delen" });
  }
});

// GET /api/routes/:id/delen — bestaande deel-instellingen (alleen eigenaar).
router.get("/:id/delen", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select({ id: routesTable.id })
      .from(routesTable)
      .where(
        and(
          eq(routesTable.id, id),
          eq(routesTable.clerkId, clerkId),
          isNull(routesTable.deletedAt),
        ),
      )
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const shares = await db
      .select()
      .from(routeSharesTable)
      .where(eq(routeSharesTable.routeId, id))
      .orderBy(asc(routeSharesTable.createdAt));
    res.json({ shares });
  } catch (err) {
    req.log.error({ err }, "routes.shares.list failed");
    res.status(500).json({ error: "Kon deel-instellingen niet laden" });
  }
});

// DELETE /api/routes/:id/delen/:shareId — stop met delen (alleen eigenaar).
router.delete("/:id/delen/:shareId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const shareId = Number(String(req.params.shareId));
  if (!Number.isInteger(id) || !Number.isInteger(shareId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const deleted = await db
      .delete(routeSharesTable)
      .where(
        and(
          eq(routeSharesTable.id, shareId),
          eq(routeSharesTable.routeId, id),
          eq(routeSharesTable.ownerClerkId, clerkId),
        ),
      )
      .returning({ id: routeSharesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Deel-instelling niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "routes.shares.delete failed");
    res.status(500).json({ error: "Kon delen niet stoppen" });
  }
});

// POST /api/routes/:id/navigatie-start — de mobiele navigatie meldt dat zij
// met deze routeversie start; legt versiegebruik vast (context "navigatie",
// contextId = versienummer, idempotent per versie).
router.post("/:id/navigatie-start", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), isNull(routesTable.deletedAt)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    if (route.clerkId !== clerkId) {
      const allowed = await canViewSharedRoute(route, clerkId);
      if (!allowed) {
        res.status(404).json({ error: "Route niet gevonden" });
        return;
      }
    }
    // Harde blokkadecontrole vóór navigatie (opdracht 30-07-2026): routes die
    // vóór de generatiepoort zijn opgeslagen kunnen fietsverbod, trap of
    // afgesloten poort/privéterrein bevatten — die sturen we nooit de
    // navigatie in. Zelfde meting als de opmerkingen (gedeelde cache);
    // meting mislukt/te traag = eerlijk fail-open (nooit gokken), gelogd.
    const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
    // Fail-closed (taak #505): BLOKKEREND meten (geen 2500 ms-budget meer —
    // dat liet een koude Overpass-cache stil fail-open door). Meting mislukt
    // definitief (alle mirrors kapot) ⇒ eerlijke weigering, nooit
    // ongecontroleerd de navigatie in.
    const obs = await routeObstaclesOf()(geometry);
    if (
      obs != null &&
      (obs.forbidden > 0 || obs.steps > 0 || obs.blockedGates > 0)
    ) {
      res.status(409).json({
        error:
          "Deze route bevat harde blokkades (fietsverbod, trap of afgesloten poort/privéterrein) en kan niet genavigeerd worden. Genereer een nieuwe route — de routemaker keurt zulke routes tegenwoordig af.",
        code: "ROUTE_BLOCKED",
        blockage: obs,
      });
      return;
    }
    if (obs == null) {
      req.log.warn(
        { routeId: route.id },
        "navStart: blokkademeting definitief niet beschikbaar — fail-closed geweigerd",
      );
      res.status(409).json({
        error:
          "Deze route kon nu niet gecontroleerd worden op blokkades (de kaartbron gaf geen antwoord). We starten navigatie niet op een ongecontroleerde route — probeer het over een paar minuten opnieuw.",
        code: "ROUTE_UNVERIFIABLE",
      });
      return;
    }
    await registerRouteUsage(route, "navigatie", route.version, clerkId);
    res.json({ ok: true, version: route.version });
  } catch (err) {
    req.log.error({ err }, "routes.navStart failed");
    res.status(500).json({ error: "Kon navigatiestart niet vastleggen" });
  }
});

// GET /api/routes/:id/vergelijk?importId= — vergelijk de geplande route met
// een ECHT gereden activiteit (GPS-track uit een import van de renner zelf).
// Alles deterministisch uit echte punten: dekking, afwijkingen, afstand- en
// hoogteverschil en gemiste meetpunten. Geen track ⇒ eerlijke 422.
router.get("/:id/vergelijk", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const importId = Number(String(req.query.importId ?? ""));
  if (!Number.isInteger(id) || !Number.isInteger(importId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(
        and(
          eq(routesTable.id, id),
          eq(routesTable.clerkId, clerkId),
          isNull(routesTable.deletedAt),
        ),
      )
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const routePoints = Array.isArray(route.geometry)
      ? (route.geometry as RoutePathPoint[]).map((p) => ({
          lat: Number(p[0]),
          lon: Number(p[1]),
        }))
      : [];
    if (routePoints.length < 2) {
      res.status(422).json({
        error: "Deze route heeft geen opgeslagen geometrie om te vergelijken.",
      });
      return;
    }
    const [imp] = await db
      .select()
      .from(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.id, importId),
          eq(activityImportsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (!imp) {
      res.status(404).json({ error: "Activiteit niet gevonden" });
      return;
    }
    const summary = (imp.parsedSummary ?? {}) as Record<string, unknown>;
    // Het gereden spoor zit in parsedSummary.route — bij GPX-imports is dat
    // een object ({ geometry: [[lat,lon,(ele)]...] }), historisch soms direct
    // een array. Beide vormen zijn echt; alles anders is eerlijk "geen track".
    const routePayload = summary.route as unknown;
    const rawTrack = Array.isArray(routePayload)
      ? (routePayload as unknown[])
      : routePayload != null &&
          typeof routePayload === "object" &&
          Array.isArray((routePayload as { geometry?: unknown }).geometry)
        ? ((routePayload as { geometry: unknown[] }).geometry)
        : [];
    const ridden = rawTrack
      .map((p) => {
        const arr = p as [number, number];
        return Array.isArray(arr) && arr.length >= 2
          ? { lat: Number(arr[0]), lon: Number(arr[1]) }
          : null;
      })
      .filter(
        (p): p is { lat: number; lon: number } =>
          p != null && Number.isFinite(p.lat) && Number.isFinite(p.lon),
      );
    if (ridden.length < 2) {
      res.status(422).json({
        error:
          "Deze activiteit heeft geen GPS-track; vergelijken kan alleen met een echt gereden spoor.",
      });
      return;
    }
    // Subsample beide sporen voor een betaalbare maar eerlijke vergelijking.
    const sample = <T>(arr: T[], max: number): T[] => {
      if (arr.length <= max) return arr;
      const step = arr.length / max;
      const out: T[] = [];
      for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]!);
      return out;
    };
    const plan = sample(routePoints, 400);
    const track = sample(ridden, 1200);
    const NEAR_M = 60;
    const covered: boolean[] = plan.map((rp) => {
      for (const tp of track) {
        if (haversineMeters(rp.lat, rp.lon, tp.lat, tp.lon) <= NEAR_M) return true;
      }
      return false;
    });
    const coveredCount = covered.filter(Boolean).length;
    const coverage = coveredCount / plan.length;
    // Afwijkingssegmenten: aaneengesloten stukken van ≥3 niet-gedekte punten.
    const deviations: { fromIndex: number; toIndex: number; lengthKm: number }[] =
      [];
    let runStart = -1;
    for (let i = 0; i <= covered.length; i++) {
      const off = i < covered.length && !covered[i];
      if (off && runStart === -1) runStart = i;
      if (!off && runStart !== -1) {
        if (i - runStart >= 3) {
          let lengthM = 0;
          for (let j = runStart; j < i - 1; j++) {
            lengthM += haversineMeters(plan[j]!.lat, plan[j]!.lon, plan[j + 1]!.lat, plan[j + 1]!.lon);
          }
          deviations.push({
            fromIndex: runStart,
            toIndex: i - 1,
            lengthKm: Math.round((lengthM / 1000) * 10) / 10,
          });
        }
        runStart = -1;
      }
    }
    // Gemiste meetpunten (binnen 150 m van het gereden spoor = gehaald).
    const meetpoints = Array.isArray(route.meetpoints)
      ? (route.meetpoints as RouteMeetpoint[])
      : [];
    const missedMeetpoints = meetpoints.filter((mp) => {
      const pt = { lat: Number(mp.lat), lon: Number(mp.lon) };
      if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lon)) return false;
      return !track.some((tp) => haversineMeters(pt.lat, pt.lon, tp.lat, tp.lon) <= 150);
    });
    const distanceKmRidden =
      typeof summary.distanceKm === "number" ? summary.distanceKm : null;
    const elevationGainMRidden =
      typeof summary.elevationGainM === "number"
        ? summary.elevationGainM
        : null;
    // Versiegebruik: deze activiteit is (achteraf) aan deze routeversie
    // gekoppeld — idempotent per activiteit.
    await registerRouteUsage(route, "activiteit", importId, clerkId);
    res.json({
      vergelijk: {
        routeId: route.id,
        routeVersion: route.version,
        importId,
        dekkingPct: Math.round(coverage * 100),
        afwijkingen: deviations,
        afstand: {
          planKm: route.distanceKm,
          geredenKm: distanceKmRidden,
          verschilKm:
            distanceKmRidden != null && route.distanceKm != null
              ? Math.round((distanceKmRidden - route.distanceKm) * 10) / 10
              : null,
        },
        hoogte: {
          planM: route.elevationGainM,
          geredenM: elevationGainMRidden,
          verschilM:
            elevationGainMRidden != null && route.elevationGainM != null
              ? Math.round(elevationGainMRidden - route.elevationGainM)
              : null,
        },
        meetpunten: {
          totaal: meetpoints.length,
          gemist: missedMeetpoints.map((mp) => ({
            name: mp.name ?? null,
            lat: mp.lat,
            lon: mp.lon,
          })),
        },
      },
    });
  } catch (err) {
    req.log.error({ err }, "routes.compare failed");
    res.status(500).json({ error: "Kon vergelijking niet maken" });
  }
});

// DELETE /api/routes/:id — verwijderen (alleen eigenaar). Wordt de route nog
// ergens in historie gebruikt (wedstrijd, sprint, versiegebruik), dan wordt
// zij ZACHT verwijderd (deletedAt) zodat dossiers blijven kloppen; anders mag
// de rij echt weg. Deel-instellingen vervallen in beide gevallen.
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(
        and(
          eq(routesTable.id, id),
          eq(routesTable.clerkId, clerkId),
          isNull(routesTable.deletedAt),
        ),
      )
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    await db.delete(routeSharesTable).where(eq(routeSharesTable.routeId, id));
    if (await routeIsReferenced(id)) {
      await db
        .update(routesTable)
        .set({ deletedAt: new Date() })
        .where(eq(routesTable.id, id));
      res.json({ ok: true, soft: true });
      return;
    }
    await db.delete(routesTable).where(eq(routesTable.id, id));
    res.json({ ok: true, soft: false });
  } catch (err) {
    req.log.error({ err }, "routes.delete failed");
    res.status(500).json({ error: "Kon route niet verwijderen" });
  }
});

export default router;
