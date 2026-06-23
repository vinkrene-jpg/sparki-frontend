import { Router, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  routesTable,
  activityImportsTable,
  plannedWorkoutsTable,
  routeSurfaces,
  routeVisibilities,
  bikeTypes,
  trainingTypes,
  type RouteSurface,
  type RouteVisibility,
  type BikeType,
  type TrainingType,
  type RoutePoint,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { parseGpxRoute } from "../lib/gpx-parse";
import {
  computeRouteStats,
  downsampleGeometry,
  type GeoPoint,
} from "../lib/route-geometry";
import {
  bikeProfile,
  routeAtoB,
  routeLoop,
  reverseGeocode,
  searchGeocode,
  OrsError,
  type LatLon,
} from "../lib/ors";
import {
  estimateDistanceKm,
  preferredSurface,
  loopPoints,
  generateRationale,
} from "../lib/route-generator";

const router = Router();

// Safety cap on stored/returned geometry so a pathological payload can't blow up
// JSON size. Set high enough that realistic cycling routes keep their full ORS
// resolution — distance/elevation are derived from these points, so aggressive
// downsampling would understate the real route (corner-cutting). Authoritative
// stats are always computed from the FULL ORS geometry before any downsampling.
const MAX_GEOMETRY_POINTS = 4000;

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

function coerceBike(v: unknown): BikeType | null {
  return typeof v === "string" && (bikeTypes as readonly string[]).includes(v)
    ? (v as BikeType)
    : null;
}

function coerceTraining(v: unknown): TrainingType | null {
  return typeof v === "string" &&
    (trainingTypes as readonly string[]).includes(v)
    ? (v as TrainingType)
    : null;
}

function coercePoint(v: unknown): LatLon | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = Number(o.lat);
  const lon = Number(o.lon);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }
  return { lat, lon };
}

// Turn ORS geometry ([lon,lat,ele?]) into the GeoPoint shape our stats math
// expects, then compute distance/elevation/profile/climbs from it.
function statsFromGeometry(geometry: RoutePoint[]) {
  const geoPoints: GeoPoint[] = geometry.map((c) => ({
    lon: c[0]!,
    lat: c[1]!,
    ele: c.length >= 3 ? (c[2] as number) : null,
  }));
  return computeRouteStats(geoPoints);
}

// GET /api/routes — caller's saved routes, newest first.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  try {
    const routes = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.clerkId, clerkId))
      .orderBy(desc(routesTable.createdAt))
      .limit(limit);
    res.json({ routes });
  } catch (err) {
    req.log.error({ err }, "routes.list failed");
    res.status(500).json({ error: "Kon routes niet laden" });
  }
});

// GET /api/routes/geocode?q=...&lat=&lon= — forward geocode an address for the
// A→B destination picker. lat/lon (optional) bias results near the start.
router.get("/geocode", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.status(400).json({ error: "Zoekterm te kort" });
    return;
  }
  const near = coercePoint({ lat: req.query.lat, lon: req.query.lon });
  try {
    const results = await searchGeocode(q, near ?? undefined);
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "routes.geocode failed");
    const status = err instanceof OrsError ? 502 : 500;
    res.status(status).json({ error: "Geocoderen mislukt" });
  }
});

// POST /api/routes/generate — generate a real route candidate via ORS WITHOUT
// persisting it. Geometry/distance/elevation/climbs all come from ORS; the
// rationale is AI/rule-based prose. The client saves it later via POST /routes.
//   body: { mode: "loop"|"ab", start:{lat,lon}, end?:{lat,lon},
//           bikeType, trainingType, targetDistanceKm?, linkedWorkoutId?, seed? }
router.post("/generate", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const mode = body.mode === "ab" ? "ab" : "loop";
  const start = coercePoint(body.start);
  if (!start) {
    res.status(400).json({ error: "Geldig startpunt is verplicht" });
    return;
  }
  const bike = coerceBike(body.bikeType);
  if (!bike) {
    res.status(400).json({ error: "Ongeldig fietstype" });
    return;
  }
  const training = coerceTraining(body.trainingType);
  if (!training) {
    res.status(400).json({ error: "Ongeldig trainingstype" });
    return;
  }

  const seed =
    Number.isFinite(Number(body.seed)) && Number(body.seed) >= 0
      ? Math.floor(Number(body.seed))
      : undefined;

  try {
    // Derive target distance: explicit value wins; otherwise from a linked
    // (owned) planned workout's target duration; otherwise a sensible default.
    let targetKm =
      Number.isFinite(Number(body.targetDistanceKm)) &&
      Number(body.targetDistanceKm) > 0
        ? Math.min(Number(body.targetDistanceKm), 300)
        : 0;
    let fromWorkout = false;

    const requestedWorkoutId =
      Number.isInteger(Number(body.linkedWorkoutId)) &&
      Number(body.linkedWorkoutId) > 0
        ? Number(body.linkedWorkoutId)
        : null;

    if (requestedWorkoutId != null) {
      // Ownership check — never trust a raw workout id from the client.
      const [workout] = await db
        .select({
          id: plannedWorkoutsTable.id,
          targetDurationMin: plannedWorkoutsTable.targetDurationMin,
        })
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.id, requestedWorkoutId),
            eq(plannedWorkoutsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      if (!workout) {
        res.status(400).json({ error: "Ongeldige trainingskoppeling" });
        return;
      }
      if (targetKm <= 0 && workout.targetDurationMin) {
        targetKm = estimateDistanceKm(bike, workout.targetDurationMin);
        fromWorkout = true;
      }
    }

    let end: LatLon | null = null;
    if (mode === "ab") {
      end = coercePoint(body.end);
      if (!end) {
        res
          .status(400)
          .json({ error: "Bestemming is verplicht voor een A→B route" });
        return;
      }
    } else if (targetKm <= 0) {
      targetKm = 40; // honest default loop length when nothing else is known
    }

    const profile = bikeProfile(bike);
    const orsRoute =
      mode === "ab"
        ? await routeAtoB(profile, start, end!)
        : await routeLoop(profile, start, targetKm, {
            seed,
            points: loopPoints(training),
          });

    // Compute authoritative stats from the FULL ORS geometry, then downsample
    // only for transport/storage. Never derive distance from a reduced polyline.
    const stats = statsFromGeometry(orsRoute.geometry);
    const geometry = downsampleGeometry(orsRoute.geometry, MAX_GEOMETRY_POINTS);

    const [startName, endName] = await Promise.all([
      reverseGeocode(start),
      end ? reverseGeocode(end) : Promise.resolve(null),
    ]);

    const rationale = await generateRationale({
      bike,
      training,
      mode,
      distanceKm: stats.distanceKm,
      elevationGainM: stats.elevationGainM,
      climbCount: stats.climbs.length,
      startName,
      endName,
      fromWorkout,
    });

    const name =
      mode === "ab"
        ? `${startName ?? "Start"} → ${endName ?? "Bestemming"}`
        : `Rondje ${startName ?? "vanaf start"}`;

    res.json({
      candidate: {
        name,
        surface: preferredSurface(bike),
        bikeType: bike,
        trainingType: training,
        mode,
        distanceKm: stats.distanceKm,
        elevationGainM: stats.elevationGainM,
        profile: stats.profile,
        climbs: stats.climbs,
        geometry,
        startName,
        endName,
        rationale,
        fromWorkout,
      },
    });
  } catch (err) {
    req.log.error({ err }, "routes.generate failed");
    if (err instanceof OrsError) {
      res.status(502).json({
        error:
          "De routemachine kon geen route vinden. Probeer een andere afstand of bestemming.",
      });
      return;
    }
    res.status(500).json({ error: "Kon route niet genereren" });
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

// POST /api/routes — create a route. Two shapes:
//   1. GPX upload: { content (GPX text), name?, surface?, visibility?,
//                    linkedActivityImportId? }
//   2. Generated:  { source:"generated", geometry:[[lon,lat,ele?]...], name?,
//                    surface?, visibility?, bikeType?, trainingType?,
//                    rationale?, startName?, endName? }
// In BOTH cases distance/elevation/profile/climbs are recomputed server-side
// from the real geometry — we never trust client-supplied stats.
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const isGenerated = body.source === "generated";

  if (isGenerated) {
    await createGeneratedRoute(req, res, clerkId, body);
    return;
  }

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

    const geometry = downsampleGeometry(parsed.geometry, MAX_GEOMETRY_POINTS);

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
        nav: null,
        geometry: geometry.length > 0 ? geometry : null,
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

// Persist a generated route. Stats are recomputed from the supplied geometry so
// a client cannot save fabricated distance/elevation numbers.
async function createGeneratedRoute(
  req: Request,
  res: Response,
  clerkId: string,
  body: Record<string, unknown>,
) {
  const rawGeometry = Array.isArray(body.geometry) ? body.geometry : [];
  const geometry: RoutePoint[] = [];
  for (const pt of rawGeometry) {
    if (!Array.isArray(pt)) continue;
    const lon = Number(pt[0]);
    const lat = Number(pt[1]);
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      continue;
    }
    const ele = pt.length >= 3 ? Number(pt[2]) : NaN;
    geometry.push(
      Number.isFinite(ele) ? [lon, lat, ele] : [lon, lat],
    );
  }
  if (geometry.length < 2) {
    res.status(422).json({ error: "Ongeldige routegeometrie" });
    return;
  }

  // Authoritative stats come from the FULL supplied geometry; we only downsample
  // for storage. A client therefore cannot save fabricated distance/elevation.
  const stats = statsFromGeometry(geometry);
  const trimmed = downsampleGeometry(geometry, MAX_GEOMETRY_POINTS);

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "Gegenereerde route";
  const rationale =
    typeof body.rationale === "string" && body.rationale.trim()
      ? body.rationale.trim()
      : null;
  const bike = coerceBike(body.bikeType);
  const training = coerceTraining(body.trainingType);
  const startName =
    typeof body.startName === "string" && body.startName.trim()
      ? body.startName.trim()
      : null;
  const endName =
    typeof body.endName === "string" && body.endName.trim()
      ? body.endName.trim()
      : null;

  try {
    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name,
        surface: coerceSurface(body.surface ?? (bike ? preferredSurface(bike) : undefined)),
        visibility: coerceVisibility(body.visibility),
        status: "ready",
        distanceKm: stats.distanceKm,
        elevationGainM: stats.elevationGainM,
        profile: stats.profile,
        climbs: stats.climbs,
        nav: null,
        geometry: trimmed,
        rationale,
        bikeType: bike,
        trainingType: training,
        startName,
        endName,
        source: "generated",
      })
      .returning();
    res.status(201).json({ route });
  } catch (err) {
    req.log.error({ err }, "routes.create generated failed");
    res.status(500).json({ error: "Kon route niet opslaan" });
  }
}

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
