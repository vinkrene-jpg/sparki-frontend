import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  routesTable,
  activityImportsTable,
  plannedWorkoutsTable,
  routeSurfaces,
  routeVisibilities,
  type RouteSurface,
  type RouteVisibility,
  type RoutePathPoint,
  type RouteWaypoint,
  type RouteMeetpoint,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  parseGpxRoute,
  summarizeTrack,
  buildGpx,
  buildTcx,
  putCandidate,
  getCandidate,
  getRoutingProvider,
  generateVariedLoop,
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
} from "../engines/route";
import { isSportActive } from "@workspace/feature-flags";
import { getHourlyForecast } from "../lib/weather/open-meteo";
import {
  computeGradeSplit,
  getRouteEnvironment,
  windDirectionLabel,
  beaufort,
} from "../lib/route-insight";

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

// Honesty caveat — always appended to a generated route's rationale, regardless
// of what the AI writes. The routing engine can only *prefer* a quiet, scenic
// route; it cannot guarantee no traffic lights or that city centres are avoided.
const HONESTY_CAVEAT =
  "Let op: de route is geoptimaliseerd voor je trainingstype en sport, maar verkeerslichten, drukke wegen of het mijden van stadscentra kunnen niet worden gegarandeerd. Afstand, hoogtemeters, duur en navigatie komen rechtstreeks van de routemachine (OpenRouteService).";

// Fewer waypoints → longer uninterrupted stretches (better for interval blocks);
// more waypoints → a more varied, scenic loop (better for endurance).
function loopPointsFor(trainingType: string): number {
  const t = trainingType.toLowerCase();
  if (t.includes("interval")) return 2;
  if (t.includes("herstel") || t.includes("recovery")) return 4;
  return 5;
}

// Build a short Dutch rationale for why the route fits the workout. Uses the AI
// integration to phrase it, but NEVER to invent geometry — only the real,
// ORS-derived numbers are passed in. Falls back to a deterministic template if
// the AI call fails. The honesty caveat is always appended server-side.
async function buildRationale(input: {
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
}): Promise<string> {
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

  const fallback = `Deze ${shape} van ${facts || "de gevraagde afstand"} past bij een ${input.trainingType} (${label}).`;

  // What the routegenerator can actually steer on. Free-text wishes about
  // afstand/hoogte/ondergrond can be honoured; specific roads, plaatsen or
  // "vermijd X" cannot be guaranteed by the round-trip engine. The prompt must
  // say so plainly and never claim the route passes a place it can't verify.
  const wishBlock = input.wish
    ? `\n\nDe renner gaf deze wens op: "${input.wish}".\nDe routegenerator kan alleen sturen op afstand, hoeveel klimwerk (vlak/heuvelachtig) en de ondergrond/het profiel — NIET op specifieke wegen, plaatsen, bezienswaardigheden of "vermijd"-verzoeken. Beoordeel de wens eerlijk:\n- Kon de wens (deels) worden ingevuld via afstand/hoogte/ondergrond? Zeg kort dat het gelukt is.\n- Gaat de wens over een specifieke weg/plaats of een vermijd-verzoek dat de generator niet kan garanderen? Zeg dat eerlijk in gewone taal ("Ik kan de route niet op … sturen") en bied deze route aan als passend alternatief voor de training. Beweer NOOIT dat de route langs een plek gaat die niet in de gegevens staat.`
    : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system:
        "Je bent Sparki, een Nederlandstalige duursportcoach. Schrijf bondig en feitelijk. Verzin NOOIT cijfers, plaatsnamen of garanties die niet in de gegevens staan. Maximaal 4 zinnen.",
      messages: [
        {
          role: "user",
          content: `Leg in 1-2 Nederlandse zinnen uit waarom deze gegenereerde route past bij de geplande training. Gebruik alleen deze gegevens:\n- Trainingstype: ${input.trainingType}\n- Sport/profiel: ${label}\n- Vorm: ${shape}\n- Afstand: ${input.distanceKm ?? "onbekend"} km\n- Geschatte duur: ${durationLabel ?? "onbekend"}\n- Hoogtemeters: ${input.elevationGainM ?? "onbekend"}\n- Klimmen: ${input.climbCount}\nSchrijf geen garanties over verkeer of stadscentra.${wishBlock}`,
        },
      ],
    });
    const block = message.content[0];
    const body =
      block && block.type === "text" && block.text.trim()
        ? block.text.trim()
        : fallback;
    return `${body}\n\n${HONESTY_CAVEAT}`;
  } catch {
    return `${fallback}\n\n${HONESTY_CAVEAT}`;
  }
}

// GET /api/routes — caller's saved routes, newest first.
//   ?limit=N                 — cap the number of rows (1–100, default 30)
//   ?plannedWorkoutId=N      — only routes linked to that planned workout
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const plannedWorkoutId =
    Number.isInteger(Number(req.query.plannedWorkoutId)) &&
    Number(req.query.plannedWorkoutId) > 0
      ? Number(req.query.plannedWorkoutId)
      : null;
  try {
    const where =
      plannedWorkoutId != null
        ? and(
            eq(routesTable.clerkId, clerkId),
            eq(routesTable.linkedPlannedWorkoutId, plannedWorkoutId),
          )
        : eq(routesTable.clerkId, clerkId);
    const routes = await db
      .select()
      .from(routesTable)
      .where(where)
      .orderBy(desc(routesTable.createdAt))
      .limit(limit);
    res.json({ routes });
  } catch (err) {
    req.log.error({ err }, "routes.list failed");
    res.status(500).json({ error: "Kon routes niet laden" });
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
      error: "Adres zoeken is nog niet beschikbaar — de ORS_API_KEY ontbreekt.",
    });
    return;
  }
  try {
    const results = await provider.geocodeSearch(q, 6);
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "routes.geocode failed");
    res.status(500).json({ error: "Kon adres niet zoeken" });
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
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    res.json({ route });
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

    const [hours, environment] = await Promise.all([
      start
        ? getHourlyForecast(start[0], start[1], 16)
        : Promise.resolve([]),
      getRouteEnvironment(geometry),
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
  const mode = body.mode === "verder" ? "verder" : "terug";
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
    let targetIdx = nearestIdx;
    if (mode === "verder") {
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
//           endLat?, endLon?, destinationText?, seed? }
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
};

// Build one real loop candidate at a specific target distance, store it server-
// side and return the response shape. Never fabricates geometry or metrics.
async function buildLoopCandidate(
  ctx: LoopCandidateContext,
  targetDistanceKm: number,
) {
  const routeResult = await generateVariedLoop(ctx.provider, {
    start: ctx.start,
    distanceKm: targetDistanceKm,
    profile: ctx.profile,
    seed: ctx.seed,
    points: ctx.points,
    elevationPreference: ctx.elevationPreference,
  });

  const summary = summarizeTrack(routeResult.points);
  const distanceKm = summary.distanceKm ?? routeResult.distanceKm;
  const elevationGainM = summary.elevationGainM ?? routeResult.ascentM;
  const durationSec = routeResult.durationSec;
  const nav: RouteStep[] = routeResult.steps;

  const distLabel = distanceKm != null ? `${Math.round(distanceKm)} km` : "";
  const name = `${ctx.workoutTrainingType}-lus${ctx.startName ? ` vanuit ${ctx.startName}` : ""}${distLabel ? ` · ${distLabel}` : ""}`;

  const rationale = await buildRationale({
    trainingType: ctx.linkedWorkoutTitle
      ? `${ctx.workoutTrainingType} (${ctx.linkedWorkoutTitle})`
      : ctx.workoutTrainingType,
    profile: ctx.profile,
    mode: "loop",
    distanceKm,
    durationSec,
    elevationGainM,
    climbCount: summary.climbs.length,
    startName: ctx.startName,
    endName: null,
    wish: ctx.wish,
  });

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
    startName: ctx.startName,
    endName: null,
    plannedWorkoutId: ctx.plannedWorkoutId,
    targetDistanceKm,
  };
}

router.post("/generate", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const provider = getRoutingProvider();
  if (!provider.isConfigured()) {
    res.status(503).json({
      error:
        "Routegeneratie is nog niet beschikbaar — de ORS_API_KEY ontbreekt.",
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

  const seed = finiteNum(body.seed) ?? undefined;
  const wish = parseWish(body.wish);

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

    // Auto-select the routing profile — the athlete never picks one.
    const profile = selectRoutingProfile({
      sport,
      bikeType,
      trainingType: workoutTrainingType,
      durationMin: workoutDurationMin,
      targetDistanceKm,
      elevationPreference,
    });
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
    targetDistanceKm = Math.min(Math.max(targetDistanceKm, 3), 200);

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
    if (mode === "loop") {
      const startName = await provider.reverseGeocode({
        lat: startLat,
        lon: startLon,
      });
      const candidate = await buildLoopCandidate(
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
          startName,
          plannedWorkoutId,
          wish,
        },
        targetDistanceKm,
      );
      res.json({ candidate });
      return;
    }

    const routeResult =
      mode === "waypoints"
        ? await provider.routeWaypoints({ points: waypoints, profile })
        : await provider.routePointToPoint({
            start: { lat: startLat, lon: startLon },
            end: end!,
            profile,
          });

    const summary = summarizeTrack(routeResult.points);
    const distanceKm = summary.distanceKm ?? routeResult.distanceKm;
    const elevationGainM = summary.elevationGainM ?? routeResult.ascentM;
    const durationSec = routeResult.durationSec;
    const nav: RouteStep[] = routeResult.steps;

    // Best-effort place names for the route title (never blocks generation). For
    // a waypoints route the last placed point is the "end".
    const endPoint =
      end ??
      (mode === "waypoints" ? waypoints[waypoints.length - 1]! : null);
    const [startName, resolvedEndName] = await Promise.all([
      provider.reverseGeocode({ lat: startLat, lon: startLon }),
      endPoint ? provider.reverseGeocode(endPoint) : Promise.resolve(endLabel),
    ]);
    const endName = endLabel ?? resolvedEndName;

    const distLabel = distanceKm != null ? `${Math.round(distanceKm)} km` : "";
    const name =
      mode === "ptp"
        ? `${startName ?? "Start"} → ${endName ?? "bestemming"}${distLabel ? ` · ${distLabel}` : ""}`
        : mode === "waypoints"
          ? `Eigen route${startName ? ` vanuit ${startName}` : ""}${distLabel ? ` · ${distLabel}` : ""}`
          : `${workoutTrainingType}-lus${startName ? ` vanuit ${startName}` : ""}${distLabel ? ` · ${distLabel}` : ""}`;

    const rationale = await buildRationale({
      trainingType: linkedWorkoutTitle
        ? `${workoutTrainingType} (${linkedWorkoutTitle})`
        : workoutTrainingType,
      profile,
      mode,
      distanceKm,
      durationSec,
      elevationGainM,
      climbCount: summary.climbs.length,
      startName,
      endName,
      wish,
    });

    // Store the trusted candidate server-side and hand back an opaque id. Saving
    // (POST /) persists ONLY from this store — never from client-supplied data —
    // so generated route geometry/metrics/nav always come from the provider.
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
      geometry: routeResult.path,
      waypoints:
        mode === "waypoints" ? waypoints.map((p) => [p.lat, p.lon]) : [],
      rationale,
      plannedWorkoutId,
    });

    res.json({
      candidate: {
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
        geometry: routeResult.path,
        waypoints:
          mode === "waypoints" ? waypoints.map((p) => [p.lat, p.lon]) : [],
        rationale,
        startName,
        endName,
        plannedWorkoutId,
        targetDistanceKm: null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "routes.generate failed");
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Routegeneratie mislukt";
    res.status(502).json({ error: message });
  }
});

// POST /api/routes/generate/options — loop-only. Instead of a single route,
// Sparki proposes THREE real loops at different distances (korter ≈ 0,9× /
// gevraagd 1,0× / langer ≈ 1,2× the target) so the rider can pick. Each option
// is a fully-computed, server-stored candidate (same shape + a `variant` label)
// that can be saved via POST / like any other candidate. Nothing is fabricated:
// distances that collide after rounding/clamping are de-duplicated, so near a
// clamp bound you may honestly get fewer than three.
router.post("/generate/options", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const provider = getRoutingProvider();
  if (!provider.isConfigured()) {
    res.status(503).json({
      error:
        "Routegeneratie is nog niet beschikbaar — de ORS_API_KEY ontbreekt.",
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
    const surface = profileToSurface(profile);

    if (targetDistanceKm == null && workoutDurationMin != null) {
      targetDistanceKm =
        Math.round(
          (workoutDurationMin / 60) * profileCruisingSpeedKmh(profile),
        ) || null;
    }
    if (targetDistanceKm == null) targetDistanceKm = 40;
    targetDistanceKm = Math.min(Math.max(targetDistanceKm, 3), 200);
    const base = targetDistanceKm;

    // korter ≈ 0,9× · gevraagd 1,0× · langer ≈ 1,2×. Clamp to the honest bounds
    // and de-duplicate so a request near an edge never fabricates variants.
    const distances = [
      ...new Set(
        [Math.round(base * 0.9), base, Math.round(base * 1.2)].map((d) =>
          Math.min(Math.max(d, 3), 200),
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
    };

    // Build sequentially — each loop already fans out several provider probes,
    // so parallelising all three at once risks tripping ORS rate limits.
    const options: Array<
      Awaited<ReturnType<typeof buildLoopCandidate>> & { variant: string }
    > = [];
    for (const d of distances) {
      const candidate = await buildLoopCandidate(ctx, d);
      const variant = d < base ? "Korter" : d > base ? "Langer" : "Op maat";
      options.push({ ...candidate, variant });
    }

    res.json({ options });
  } catch (err) {
    req.log.error({ err }, "routes.generate.options failed");
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Routegeneratie mislukt";
    res.status(502).json({ error: message });
  }
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
          visibility: coerceVisibility(body.visibility),
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
        visibility: coerceVisibility(body.visibility),
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
        visibility: coerceVisibility(body.visibility),
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

// DELETE /api/routes/:id — remove a route (owner only).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const deleted = await db
      .delete(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .returning({ id: routesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "routes.delete failed");
    res.status(500).json({ error: "Kon route niet verwijderen" });
  }
});

export default router;
