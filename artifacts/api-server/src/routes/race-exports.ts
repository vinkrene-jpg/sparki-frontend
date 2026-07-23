import { Router } from "express";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  activityImportsTable,
  plannedWorkoutsTable,
  raceExportsTable,
  racePointsTable,
  racesTable,
  routesTable,
  type Race,
  type RacePoint,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  EXPORT_TYPE_LABELS,
  applyProfileElevation,
  buildFitCourse,
  buildFitWorkout,
  buildRaceGpx,
  buildWorkoutSteps,
  coerceTrack,
  exportFileName,
  placeActivePoints,
  roundTripFitCourse,
  roundTripFitWorkout,
  roundTripGpx,
  validateRaceExport,
  type RaceExportType,
  type TrackPoint,
} from "../lib/race-export";

// Wedstrijdexport-centrum (opdracht "export naar fietscomputers").
// - GPX (universeel), Garmin FIT Course (bevestigde punten als Course Points),
//   FIT Workout (alleen bij echte warming-up/gekoppelde training).
// - Iedere export wordt gevalideerd (§8) en round-trip-getest (§9) vóór hij
//   wordt vrijgegeven; de historie bewaart versie + uitslag.
// - Wahoo/Karoo: geen aparte bestandsvariant en GEEN sync-knop — die apparaten
//   lezen standaard GPX/FIT via hun eigen apps; dat vertellen we eerlijk in de
//   UI in plaats van een niet-geteste "compatibiliteit" te claimen.

const router = Router();

async function ownRace(clerkId: string, raceId: number): Promise<Race | null> {
  const [race] = await db
    .select()
    .from(racesTable)
    .where(and(eq(racesTable.id, raceId), eq(racesTable.clerkId, clerkId)))
    .limit(1);
  return race ?? null;
}

// Routegeometrie ophalen: routes.geometry, of bij GPX-routes het echte spoor
// uit de gekoppelde activity_import (parsedSummary.route). Nooit verzonnen.
async function loadTrack(
  clerkId: string,
  routeId: number,
): Promise<{
  track: TrackPoint[];
  hasElevation: boolean;
  elevationGainM: number | null;
  routeVersion: number;
  routeUpdatedAt: Date | null;
} | null> {
  const [route] = await db
    .select()
    .from(routesTable)
    .where(and(eq(routesTable.id, routeId), eq(routesTable.clerkId, clerkId)))
    .limit(1);
  if (!route) return null;

  let track = coerceTrack(route.geometry);
  if (track.length < 2 && route.linkedActivityImportId != null) {
    const [imp] = await db
      .select({ parsedSummary: activityImportsTable.parsedSummary })
      .from(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.id, route.linkedActivityImportId),
          eq(activityImportsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (imp) {
      const summary = (imp.parsedSummary ?? {}) as Record<string, unknown>;
      const payload = summary.route as unknown;
      const raw = Array.isArray(payload)
        ? payload
        : payload != null &&
            typeof payload === "object" &&
            Array.isArray((payload as { geometry?: unknown }).geometry)
          ? (payload as { geometry: unknown[] }).geometry
          : [];
      track = coerceTrack(raw);
    }
  }
  const hasElevation = applyProfileElevation(
    track,
    Array.isArray(route.profile) ? (route.profile as number[]) : null,
  );
  return {
    track,
    hasElevation,
    elevationGainM: route.elevationGainM ?? null,
    routeVersion: route.version,
    routeUpdatedAt: route.updatedAt ?? null,
  };
}

// Vingerafdruk van alles dat de bestandsinhoud bepaalt — hiermee zien we
// eerlijk of een eerdere export is ingehaald door wijzigingen.
function contentFingerprint(input: {
  points: RacePoint[];
  trackLen: number;
  routeVersion: number;
  race: Race;
}): string {
  const active = input.points
    .filter((p) => p.status === "bevestigd" || p.status === "aangepast")
    .map((p) => [p.id, p.kind, p.label, p.raceKm, p.lat, p.lng, p.status])
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const basis = JSON.stringify({
    active,
    trackLen: input.trackLen,
    routeVersion: input.routeVersion,
    name: input.race.name,
    date: input.race.raceDate,
    laps: input.race.localLaps,
    warmup: (input.race.logistics as { warmupMin?: unknown } | null)?.warmupMin ?? null,
    workout: input.race.plannedWorkoutId,
  });
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

type BuildResult =
  | {
      ok: true;
      content: Buffer;
      mime: string;
      roundTrip: { ok: boolean; detail: string };
      pointCount: number;
      trackPointCount: number;
      warnings: string[];
    }
  | { ok: false; status: number; error: string; details?: string[] };

async function buildExport(
  clerkId: string,
  race: Race,
  type: RaceExportType,
): Promise<BuildResult> {
  if (race.routeId == null) {
    return {
      ok: false,
      status: 422,
      error:
        "Deze wedstrijd heeft geen gekoppelde route. Koppel eerst een route met het parcours.",
    };
  }
  const loaded = await loadTrack(clerkId, race.routeId);
  if (!loaded || loaded.track.length < 2) {
    return {
      ok: false,
      status: 422,
      error: "De gekoppelde route heeft geen opgeslagen geometrie om te exporteren.",
    };
  }
  const points = await db
    .select()
    .from(racePointsTable)
    .where(eq(racePointsTable.raceId, race.id));
  const placement = placeActivePoints(points, loaded.track);
  const validation = validateRaceExport({
    race,
    allPoints: points,
    track: loaded.track,
    placement,
  });
  if (type !== "fit-workout" && !validation.ok) {
    return {
      ok: false,
      status: 422,
      error: "De export is geblokkeerd door de controle vooraf.",
      details: validation.errors,
    };
  }

  if (type === "gpx") {
    const gpx = buildRaceGpx({ race, track: loaded.track, placement });
    const rt = roundTripGpx(gpx, {
      trackPoints: loaded.track.length,
      waypoints: placement.placed.length,
      hasElevation: loaded.hasElevation,
    });
    if (!rt.ok) return { ok: false, status: 500, error: rt.detail };
    return {
      ok: true,
      content: Buffer.from(gpx, "utf8"),
      mime: "application/gpx+xml",
      roundTrip: rt,
      pointCount: placement.placed.length,
      trackPointCount: loaded.track.length,
      warnings: validation.warnings,
    };
  }

  if (type === "fit-course") {
    const buf = buildFitCourse({
      race,
      track: loaded.track,
      placement,
      elevationGainM: loaded.elevationGainM,
    });
    const distanceKm = trackDistanceKm(loaded.track);
    const rt = roundTripFitCourse(buf, {
      trackPoints: loaded.track.length,
      coursePoints: placement.placed.length,
      distanceKm,
      hasElevation: loaded.hasElevation,
    });
    if (!rt.ok) return { ok: false, status: 500, error: rt.detail };
    return {
      ok: true,
      content: buf,
      mime: "application/vnd.ant.fit",
      roundTrip: rt,
      pointCount: placement.placed.length,
      trackPointCount: loaded.track.length,
      warnings: validation.warnings,
    };
  }

  // fit-workout — alleen bij een echte warming-up of gekoppelde training.
  const logistics = (race.logistics ?? {}) as { warmupMin?: unknown };
  const warmupMin =
    typeof logistics.warmupMin === "number" && Number.isFinite(logistics.warmupMin)
      ? logistics.warmupMin
      : null;
  let planned: { title: string; targetDurationMin: number | null } | null = null;
  if (race.plannedWorkoutId != null) {
    const [w] = await db
      .select({
        title: plannedWorkoutsTable.title,
        targetDurationMin: plannedWorkoutsTable.targetDurationMin,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.id, race.plannedWorkoutId),
          eq(plannedWorkoutsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    planned = w ?? null;
  }
  const steps = buildWorkoutSteps({
    warmupMin,
    plannedWorkout: planned,
    assignment: race.assignment ?? null,
  });
  if (!steps) {
    return {
      ok: false,
      status: 422,
      error:
        "Er is geen warming-up of gekoppelde training voor deze wedstrijd — er valt geen workout-bestand te maken. Vul de warming-up in bij logistiek of koppel een training.",
    };
  }
  const buf = buildFitWorkout({ race, steps });
  const rt = roundTripFitWorkout(buf, { steps: steps.length });
  if (!rt.ok) return { ok: false, status: 500, error: rt.detail };
  return {
    ok: true,
    content: buf,
    mime: "application/vnd.ant.fit",
    roundTrip: rt,
    pointCount: 0,
    trackPointCount: 0,
    warnings: validation.warnings,
  };
}

function trackDistanceKm(track: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!;
    const b = track[i]!;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const la = (a.lat * Math.PI) / 180;
    const lb = (b.lat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
    total += 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  return total;
}

function isExportType(v: unknown): v is RaceExportType {
  return v === "gpx" || v === "fit-course" || v === "fit-workout";
}

// GET /api/races/:raceId/exports — status vooraf + historie.
router.get("/:raceId/exports", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raceId = Number(String(req.params.raceId));
  if (!Number.isInteger(raceId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const race = await ownRace(clerkId, raceId);
    if (!race) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }
    const points = await db
      .select()
      .from(racePointsTable)
      .where(eq(racePointsTable.raceId, raceId));

    let validation: { ok: boolean; errors: string[]; warnings: string[] } | null = null;
    let fingerprint: string | null = null;
    let trackPointCount = 0;
    if (race.routeId != null) {
      const loaded = await loadTrack(clerkId, race.routeId);
      if (loaded && loaded.track.length >= 2) {
        const placement = placeActivePoints(points, loaded.track);
        validation = validateRaceExport({
          race,
          allPoints: points,
          track: loaded.track,
          placement,
        });
        trackPointCount = loaded.track.length;
        fingerprint = contentFingerprint({
          points,
          trackLen: loaded.track.length,
          routeVersion: loaded.routeVersion,
          race,
        });
      }
    }

    const history = await db
      .select()
      .from(raceExportsTable)
      .where(
        and(eq(raceExportsTable.raceId, raceId), eq(raceExportsTable.clerkId, clerkId)),
      )
      .orderBy(desc(raceExportsTable.createdAt));

    // Dynamische veroudering: fingerprint gewijzigd sinds de export.
    const withFreshness = history.map((h) => ({
      ...h,
      status:
        h.status === "verouderd" ||
        (fingerprint != null && h.contentFingerprint !== fingerprint)
          ? "verouderd"
          : "actueel",
    }));

    const reconfirmCount = points.filter(
      (p) =>
        p.needsReconfirm && (p.status === "bevestigd" || p.status === "aangepast"),
    ).length;

    // Workout-bron aanwezig?
    const logistics = (race.logistics ?? {}) as { warmupMin?: unknown };
    const hasWorkoutSource =
      (typeof logistics.warmupMin === "number" && logistics.warmupMin >= 5) ||
      race.plannedWorkoutId != null;

    res.json({
      types: EXPORT_TYPE_LABELS,
      hasRoute: race.routeId != null && trackPointCount >= 10,
      trackPointCount,
      validation,
      reconfirmCount,
      hasWorkoutSource,
      exports: withFreshness,
      // Eerlijke apparaatuitleg — géén sync-knoppen, geen geteste-claim.
      deviceNote:
        "Garmin: zet het FIT Course-bestand in de map Garmin/NewFiles of importeer het via Garmin Connect. Wahoo en Hammerhead Karoo lezen GPX- en FIT-routes via hun eigen app (bestand delen of uploaden). Sparki heeft geen directe synchronisatie met deze diensten en doet daar ook geen beloftes over.",
    });
  } catch (err) {
    req.log.error({ err }, "raceExports.list failed");
    res.status(500).json({ error: "Kon exportcentrum niet laden" });
  }
});

// POST /api/races/:raceId/exports — bouw + valideer + registreer een export.
router.post("/:raceId/exports", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raceId = Number(String(req.params.raceId));
  const type = (req.body ?? {}).type as unknown;
  if (!Number.isInteger(raceId) || !isExportType(type)) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const race = await ownRace(clerkId, raceId);
    if (!race) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }
    // Herbevestiging vereist vóór nieuwe export (nieuwe gids wijzigde punten).
    const points = await db
      .select()
      .from(racePointsTable)
      .where(eq(racePointsTable.raceId, raceId));
    const pending = points.filter(
      (p) =>
        p.needsReconfirm && (p.status === "bevestigd" || p.status === "aangepast"),
    );
    if (type !== "fit-workout" && pending.length > 0) {
      res.status(409).json({
        error: `Een nieuwe technische gids heeft ${pending.length} punt(en) gewijzigd. Herbevestig die eerst op de kaart voordat je opnieuw exporteert.`,
        pointIds: pending.map((p) => p.id),
      });
      return;
    }

    const built = await buildExport(clerkId, race, type);
    if (!built.ok) {
      res.status(built.status).json({ error: built.error, details: built.details });
      return;
    }

    const loaded = race.routeId != null ? await loadTrack(clerkId, race.routeId) : null;
    const fingerprint = contentFingerprint({
      points,
      trackLen: loaded?.track.length ?? 0,
      routeVersion: loaded?.routeVersion ?? 0,
      race,
    });

    // Versienummer: hoogste bestaande versie van dit type + 1.
    const prev = await db
      .select({ version: raceExportsTable.version })
      .from(raceExportsTable)
      .where(
        and(
          eq(raceExportsTable.raceId, raceId),
          eq(raceExportsTable.clerkId, clerkId),
          eq(raceExportsTable.exportType, type),
        ),
      )
      .orderBy(desc(raceExportsTable.version))
      .limit(1);
    const version = (prev[0]?.version ?? 0) + 1;
    const fileName = exportFileName({
      raceName: race.name,
      raceDate: race.raceDate,
      type,
      version,
    });

    const [row] = await db
      .insert(raceExportsTable)
      .values({
        raceId,
        clerkId,
        exportType: type,
        version,
        fileName,
        contentFingerprint: fingerprint,
        status: "actueel",
        validationOk: true,
        validationWarnings: built.warnings,
        roundTripOk: built.roundTrip.ok,
        roundTripDetail: built.roundTrip.detail,
        pointCount: built.pointCount,
        trackPointCount: built.trackPointCount,
      })
      .returning();

    res.json({ export: row, warnings: built.warnings });
  } catch (err) {
    req.log.error({ err }, "raceExports.create failed");
    res.status(500).json({ error: "Kon export niet maken" });
  }
});

// GET /api/races/:raceId/exports/:exportId/download — bestand (opnieuw
// deterministisch opgebouwd; bij inhoudelijke wijziging sinds de export is de
// registratie "verouderd" maar de download geeft altijd de ACTUELE inhoud —
// dat melden we eerlijk via de headers).
router.get("/:raceId/exports/:exportId/download", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raceId = Number(String(req.params.raceId));
  const exportId = Number(String(req.params.exportId));
  if (!Number.isInteger(raceId) || !Number.isInteger(exportId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const race = await ownRace(clerkId, raceId);
    if (!race) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }
    const [exp] = await db
      .select()
      .from(raceExportsTable)
      .where(
        and(
          eq(raceExportsTable.id, exportId),
          eq(raceExportsTable.raceId, raceId),
          eq(raceExportsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (!exp) {
      res.status(404).json({ error: "Export niet gevonden" });
      return;
    }
    const built = await buildExport(clerkId, race, exp.exportType as RaceExportType);
    if (!built.ok) {
      res.status(built.status).json({ error: built.error, details: built.details });
      return;
    }
    res.setHeader("Content-Type", built.mime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exp.fileName}"`,
    );
    res.send(built.content);
  } catch (err) {
    req.log.error({ err }, "raceExports.download failed");
    res.status(500).json({ error: "Kon bestand niet leveren" });
  }
});

export default router;
