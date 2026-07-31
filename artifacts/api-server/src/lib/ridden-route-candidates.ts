// Persoonlijke routekandidaten uit gekoppelde ritgeschiedenis.
//
// Geïmporteerde ritten (Strava / Garmin / bestandsupload) worden — naast
// activiteitenhistorie — grondstof voor herbruikbare routekandidaten. Dit is
// bewust GEEN tweede routesysteem: de analyse leest bestaande Data Hub-data
// (training_sessions + activity_imports + connector_activities), schrijft
// alleen naar de eigen kandidaat-tabellen en verandert de oorspronkelijke
// activiteit NOOIT. Een kandidaat wordt pas een echte route via het bestaande
// opslagpad in routes/route-candidates.ts, mét de actuele fail-closed
// blokkadeverificatie — een oude of vaak gereden route is nooit automatisch
// veilig.
//
// Incrementeel: de scan verwerkt per gebruiker alleen sessies met
// id > cursor (route_candidate_scans.lastSessionId). Nooit een zware volledige
// analyse bij paginalaad; de scan wordt aangestoten ná een sync of import.

import crypto from "node:crypto";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import {
  db,
  trainingSessionsTable,
  activityImportsTable,
  connectorActivitiesTable,
  routeCandidatesTable,
  routeCandidateRidesTable,
  routeCandidateScansTable,
  type RouteCandidate,
  type RouteCandidateQuality,
  type RouteCandidateQualityFactor,
  type RoutePathPoint,
  type TrainingSession,
} from "@workspace/db";

// ── Afstemming ───────────────────────────────────────────────────────────────

// Rastercel ~150 m: grof genoeg om GPS-ruis tussen twee ritten over dezelfde
// weg op te vangen, fijn genoeg om parallelle routes te onderscheiden.
const CELL_DEG = 0.0015;
// Zelfde cluster: celoverlap (Jaccard) minstens dit.
const MATCH_OVERLAP = 0.62;
// Zelfde cluster: startpunt binnen deze afstand.
const MATCH_START_M = 1500;
// Zelfde cluster: afstand binnen deze fractie.
const MATCH_DISTANCE_FRAC = 0.25;
// Lus: start en einde binnen deze afstand van elkaar.
const LOOP_CLOSE_M = 1000;
// Slechte GPS: een sprong groter dan dit midden in het spoor = onbruikbaar.
const BAD_GPS_JUMP_M = 2500;
// Vervoer vóór/na: aaneengesloten randstuk waarvan de puntafstand ver boven
// de mediaan ligt wordt weggeknipt uit de KANDIDAAT-geometrie (de activiteit
// zelf blijft onaangetast) en eerlijk gemeld.
const TRIM_SPACING_FACTOR = 6;
const TRIM_MIN_M = 2000;
// Minimaal bruikbaar spoor.
const MIN_TRACK_POINTS = 20;
const MIN_TRACK_KM = 3;
// Maximaal aantal sessies per scan-run (incrementeel; rest volgt vanzelf).
const SCAN_BATCH = 400;

// ── Geometrie-hulpjes ────────────────────────────────────────────────────────

export function haversineM(
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
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function trackDistanceKm(points: RoutePathPoint[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) {
    m += haversineM(
      points[i - 1]![0],
      points[i - 1]![1],
      points[i]![0],
      points[i]![1],
    );
  }
  return m / 1000;
}

/** Google encoded polyline → [lat, lon]-paren. Puur, geen fabricatie. */
export function decodePolyline(encoded: string): RoutePathPoint[] {
  const points: RoutePathPoint[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    for (const which of [0, 1] as const) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        if (index >= encoded.length) return points;
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lon += delta;
    }
    points.push([lat / 1e5, lon / 1e5]);
  }
  return points;
}

function cellKey(lat: number, lon: number): string {
  return `${Math.round(lat / CELL_DEG)}:${Math.round(lon / CELL_DEG)}`;
}

/** Gesorteerde unieke rastercellen van een spoor. */
export function trackCells(points: RoutePathPoint[]): string[] {
  const set = new Set<string>();
  for (const [lat, lon] of points) set.add(cellKey(lat, lon));
  return [...set].sort();
}

export function cellJaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let inter = 0;
  for (const c of a) if (setB.has(c)) inter++;
  return inter / (a.length + b.length - inter);
}

/**
 * Route-fingerprint voor duplicaatdetectie: hash over de genormaliseerde
 * celreeks (opeenvolgende duplicaten samengevouwen — richting telt dus mee)
 * + lus-vlag. Dubbele imports van dezelfde rit geven dezelfde fingerprint.
 */
export function routeFingerprint(points: RoutePathPoint[]): string {
  const seq: string[] = [];
  for (const [lat, lon] of points) {
    const key = cellKey(lat, lon);
    if (seq[seq.length - 1] !== key) seq.push(key);
  }
  const loop = isLoopTrack(points) ? "L" : "AB";
  return crypto
    .createHash("sha1")
    .update(`${loop}|${seq.join(",")}`)
    .digest("hex");
}

export function isLoopTrack(points: RoutePathPoint[]): boolean {
  if (points.length < 2) return false;
  const a = points[0]!;
  const b = points[points.length - 1]!;
  return haversineM(a[0], a[1], b[0], b[1]) <= LOOP_CLOSE_M;
}

// ── Spooranalyse ─────────────────────────────────────────────────────────────

export type TrackAnalysis = {
  ok: boolean;
  reason: string | null; // eerlijke afkeurreden bij ok=false
  points: RoutePathPoint[]; // (getrimd) bruikbaar spoor
  trimmedStartM: number;
  trimmedEndM: number;
  distanceKm: number;
  cells: string[];
  fingerprint: string;
  isLoop: boolean;
  // 0–1: aandeel cellen dat vaker dan tweemaal bezocht wordt (keren/heen-weer).
  revisitFraction: number;
  // 0–1: puntdichtheid t.o.v. een gezond spoor (≥8 punten/km = 1).
  gpsDensity: number;
};

function medianSpacingM(points: RoutePathPoint[]): number {
  const d: number[] = [];
  for (let i = 1; i < points.length; i++) {
    d.push(
      haversineM(
        points[i - 1]![0],
        points[i - 1]![1],
        points[i]![0],
        points[i]![1],
      ),
    );
  }
  d.sort((a, b) => a - b);
  return d.length ? d[Math.floor(d.length / 2)]! : 0;
}

/**
 * Knip een aaneengesloten randstuk (begin of eind) weg waarvan de
 * puntafstanden ver boven de mediaan liggen — het patroon van een autorit
 * vóór of na de fietsrit in een spoor met vaste sample-frequentie. Eerlijk:
 * we WETEN niet zeker dat het een auto was; de meting (weggeknipte meters)
 * wordt bewaard en getoond, en de activiteit zelf blijft onaangetast.
 */
export function trimTransportEdges(points: RoutePathPoint[]): {
  points: RoutePathPoint[];
  trimmedStartM: number;
  trimmedEndM: number;
} {
  if (points.length < MIN_TRACK_POINTS)
    return { points, trimmedStartM: 0, trimmedEndM: 0 };
  const median = medianSpacingM(points);
  if (median <= 0) return { points, trimmedStartM: 0, trimmedEndM: 0 };
  const limit = median * TRIM_SPACING_FACTOR;

  const spacing = (i: number) =>
    haversineM(points[i]![0], points[i]![1], points[i + 1]![0], points[i + 1]![1]);

  let start = 0;
  let trimmedStartM = 0;
  while (start < points.length - 2 && spacing(start) > limit) {
    trimmedStartM += spacing(start);
    start++;
  }
  let end = points.length - 1;
  let trimmedEndM = 0;
  while (end > start + 1 && spacing(end - 1) > limit) {
    trimmedEndM += spacing(end - 1);
    end--;
  }
  if (trimmedStartM < TRIM_MIN_M) {
    start = 0;
    trimmedStartM = 0;
  }
  if (trimmedEndM < TRIM_MIN_M) {
    end = points.length - 1;
    trimmedEndM = 0;
  }
  return {
    points: points.slice(start, end + 1),
    trimmedStartM: Math.round(trimmedStartM),
    trimmedEndM: Math.round(trimmedEndM),
  };
}

export function analyzeTrack(raw: RoutePathPoint[]): TrackAnalysis {
  const clean = (Array.isArray(raw) ? raw : []).filter(
    (p): p is RoutePathPoint =>
      Array.isArray(p) &&
      p.length >= 2 &&
      Number.isFinite(p[0]) &&
      Number.isFinite(p[1]) &&
      Math.abs(p[0] as number) <= 90 &&
      Math.abs(p[1] as number) <= 180,
  ) as RoutePathPoint[];

  const fail = (reason: string): TrackAnalysis => ({
    ok: false,
    reason,
    points: [],
    trimmedStartM: 0,
    trimmedEndM: 0,
    distanceKm: 0,
    cells: [],
    fingerprint: "",
    isLoop: false,
    revisitFraction: 0,
    gpsDensity: 0,
  });

  if (clean.length < MIN_TRACK_POINTS) return fail("te weinig GPS-punten");

  const { points, trimmedStartM, trimmedEndM } = trimTransportEdges(clean);
  if (points.length < MIN_TRACK_POINTS)
    return fail("na wegknippen van vervoer blijft te weinig spoor over");

  // Slechte GPS: grote sprongen midden in het (getrimde) spoor.
  for (let i = 1; i < points.length; i++) {
    if (
      haversineM(
        points[i - 1]![0],
        points[i - 1]![1],
        points[i]![0],
        points[i]![1],
      ) > BAD_GPS_JUMP_M
    ) {
      return fail("GPS-sprong midden in het spoor (onvolledige opname)");
    }
  }

  const distanceKm = trackDistanceKm(points);
  if (distanceKm < MIN_TRACK_KM) return fail("spoor korter dan 3 km");

  // Keren/heen-en-weer: hoe vaak worden cellen méér dan tweemaal aangedaan
  // (tweemaal is normaal voor een heen-terug-passage of lus-sluiting).
  const counts = new Map<string, number>();
  let prev: string | null = null;
  for (const [lat, lon] of points) {
    const key = cellKey(lat, lon);
    if (key !== prev) counts.set(key, (counts.get(key) ?? 0) + 1);
    prev = key;
  }
  let revisited = 0;
  for (const n of counts.values()) if (n > 2) revisited++;
  const revisitFraction = counts.size ? revisited / counts.size : 0;

  const density = points.length / Math.max(distanceKm, 0.001);
  return {
    ok: true,
    reason: null,
    points,
    trimmedStartM,
    trimmedEndM,
    distanceKm,
    cells: trackCells(points),
    fingerprint: routeFingerprint(points),
    isLoop: isLoopTrack(points),
    revisitFraction,
    gpsDensity: Math.min(1, density / 8),
  };
}

// ── Labels (deterministisch; de gebruiker kan corrigeren) ────────────────────

export function autoLabelsFor(c: {
  rideCount: number;
  distanceKm: number;
  elevationM: number | null;
  sport: string;
  isLoop: boolean;
}): string[] {
  const labels: string[] = [];
  if (c.rideCount >= 3) labels.push("vaak gereden");
  const hmPerKm =
    c.elevationM != null && c.distanceKm > 0 ? c.elevationM / c.distanceKm : null;
  if (hmPerKm != null && hmPerKm >= 8) labels.push("klimroute");
  if (c.sport === "gravel") labels.push("gravelroute");
  if (c.sport === "mtb") labels.push("mtb-route");
  if (c.distanceKm > 0 && c.distanceKm < 25) labels.push("korte rit");
  if (c.distanceKm >= 80) labels.push("lange rit");
  labels.push(c.isLoop ? "rondrit" : "van A naar B");
  return labels;
}

// ── Kwaliteitsscore (transparant, nooit een veiligheidsoordeel) ──────────────

export function computeQuality(c: {
  rideCount: number;
  lastRiddenAt: Date | null;
  gpsDensity: number;
  overlapAvg: number | null;
  sport: string;
  sessionSport: string | null;
  revisitFraction: number;
  trimmedM: number;
}): RouteCandidateQuality {
  const now = Date.now();
  const daysAgo =
    c.lastRiddenAt != null
      ? Math.max(0, (now - c.lastRiddenAt.getTime()) / 86_400_000)
      : null;

  const factors: RouteCandidateQualityFactor[] = [
    {
      factor: "frequentie",
      score: Math.min(100, c.rideCount * 25),
      weight: 0.2,
      toelichting: `${c.rideCount}× gereden`,
    },
    {
      factor: "recentheid",
      score:
        daysAgo == null
          ? 0
          : daysAgo <= 30
            ? 100
            : daysAgo <= 180
              ? 70
              : daysAgo <= 365
                ? 40
                : 15,
      weight: 0.2,
      toelichting:
        daysAgo == null
          ? "laatste ritdatum onbekend"
          : `laatst gereden ${Math.round(daysAgo)} dagen geleden`,
    },
    {
      factor: "gps_volledigheid",
      score: Math.round(c.gpsDensity * 100),
      weight: 0.2,
      toelichting:
        c.gpsDensity >= 1
          ? "volledige GPS-dekking"
          : `beperkte puntdichtheid (${Math.round(c.gpsDensity * 100)}%)`,
    },
    {
      factor: "consistentie",
      score:
        c.overlapAvg == null ? 50 : Math.round(Math.min(1, c.overlapAvg) * 100),
      weight: 0.15,
      toelichting:
        c.overlapAvg == null
          ? "één rit — consistentie nog niet meetbaar"
          : `ritten overlappen gemiddeld ${Math.round(c.overlapAvg * 100)}%`,
    },
    {
      factor: "profiel_match",
      score: c.sessionSport == null ? 50 : c.sessionSport === c.sport ? 100 : 30,
      weight: 0.1,
      toelichting:
        c.sessionSport == null
          ? "discipline onbekend"
          : c.sessionSport === c.sport
            ? `past bij ${c.sport}`
            : `discipline wisselt (${c.sessionSport} vs ${c.sport})`,
    },
    {
      factor: "keren_stilstand",
      score: Math.round(
        Math.max(0, 1 - c.revisitFraction * 3) * (c.trimmedM > 0 ? 80 : 100),
      ),
      weight: 0.15,
      toelichting:
        (c.revisitFraction > 0.1
          ? `veel dubbel bereden stukken (${Math.round(c.revisitFraction * 100)}% van de cellen)`
          : "weinig keren of dubbel spoor") +
        (c.trimmedM > 0
          ? `; mogelijk vervoer vóór/na weggeknipt (${Math.round(c.trimmedM)} m)`
          : ""),
    },
  ];

  const score = Math.round(
    factors.reduce((s, f) => s + f.score * f.weight, 0),
  );
  return { score, factors };
}

// ── Spoorbron per sessie ─────────────────────────────────────────────────────

/**
 * Echt spoor van een geïmporteerde sessie, of null (eerlijk gat).
 * Bronnen, in volgorde: (1) gekoppelde bestandsimport
 * (activity_imports.parsed_summary.route.geometry), (2) Strava-samenvatting
 * (connector_activities.raw.map.summary_polyline). Nooit gefabriceerd.
 */
export async function trackForSession(
  clerkId: string,
  sessionId: number,
): Promise<RoutePathPoint[] | null> {
  const [imp] = await db
    .select({ parsedSummary: activityImportsTable.parsedSummary })
    .from(activityImportsTable)
    .where(
      and(
        eq(activityImportsTable.clerkId, clerkId),
        eq(activityImportsTable.linkedTrainingSessionId, sessionId),
      ),
    )
    .limit(1);
  const geom = (imp?.parsedSummary as { route?: { geometry?: unknown } } | null)
    ?.route?.geometry;
  if (Array.isArray(geom) && geom.length >= 2) {
    return geom.map((p) =>
      Array.isArray(p) ? ([p[0], p[1]] as RoutePathPoint) : ([NaN, NaN] as RoutePathPoint),
    );
  }

  const rows = await db
    .select({ raw: connectorActivitiesTable.raw })
    .from(connectorActivitiesTable)
    .where(
      and(
        eq(connectorActivitiesTable.clerkId, clerkId),
        eq(connectorActivitiesTable.normalizedSessionId, sessionId),
      ),
    );
  for (const row of rows) {
    const poly = (
      row.raw as { map?: { summary_polyline?: unknown; polyline?: unknown } } | null
    )?.map;
    const enc =
      typeof poly?.polyline === "string" && poly.polyline
        ? poly.polyline
        : typeof poly?.summary_polyline === "string"
          ? poly.summary_polyline
          : null;
    if (enc) {
      const pts = decodePolyline(enc);
      if (pts.length >= 2) return pts;
    }
  }
  return null;
}

// ── Incrementele scan ────────────────────────────────────────────────────────

export type ScanResult = {
  processed: number;
  withTrack: number;
  created: number;
  merged: number;
  skipped: number;
};

// In-process wacht: per gebruiker maximaal één scan tegelijk.
const scanning = new Set<string>();

/**
 * Analyseer nieuwe geïmporteerde sessies (id > cursor) incrementeel naar
 * routekandidaten. Idempotent: unique(clerkId, sessionId) op de herkomstrij
 * en unique(clerkId, fingerprint) op de kandidaat maken herhaald draaien en
 * dubbele imports onschadelijk. Best-effort aanroepen (nooit een sync breken).
 */
export async function scanRouteCandidatesForUser(
  clerkId: string,
  opts: { batch?: number } = {},
): Promise<ScanResult> {
  const result: ScanResult = {
    processed: 0,
    withTrack: 0,
    created: 0,
    merged: 0,
    skipped: 0,
  };
  if (scanning.has(clerkId)) return result;
  scanning.add(clerkId);
  try {
    const [scan] = await db
      .insert(routeCandidateScansTable)
      .values({ clerkId })
      .onConflictDoNothing({ target: routeCandidateScansTable.clerkId })
      .returning();
    const cursorRow =
      scan ??
      (
        await db
          .select()
          .from(routeCandidateScansTable)
          .where(eq(routeCandidateScansTable.clerkId, clerkId))
          .limit(1)
      )[0]!;

    const sessions = await db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gt(trainingSessionsTable.id, cursorRow.lastSessionId),
        ),
      )
      .orderBy(asc(trainingSessionsTable.id))
      .limit(opts.batch ?? SCAN_BATCH);

    if (sessions.length === 0) return result;

    // Bestaande (niet-uitgesloten én uitgesloten) kandidaten: uitgesloten
    // blijven meedoen aan matching zodat een her-import niet een "nieuwe"
    // duplicaatkandidaat aanmaakt.
    const candidates = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.clerkId, clerkId));

    // Sessies die al verwerkt zijn (herkomstrij bestaat) overslaan — dekt
    // her-scans na een cursor-reset of dubbele hooks.
    const ids = sessions.map((s) => s.id);
    const done = new Set(
      (
        await db
          .select({ sessionId: routeCandidateRidesTable.sessionId })
          .from(routeCandidateRidesTable)
          .where(
            and(
              eq(routeCandidateRidesTable.clerkId, clerkId),
              inArray(routeCandidateRidesTable.sessionId, ids),
            ),
          )
      ).map((r) => r.sessionId),
    );

    let maxId = cursorRow.lastSessionId;
    for (const session of sessions) {
      maxId = Math.max(maxId, session.id);
      result.processed++;
      if (done.has(session.id)) {
        result.skipped++;
        continue;
      }
      // Alleen fietsdisciplines; hardlopen enz. is geen fietsroute.
      const sport = session.sport || "cycling";
      if (!["cycling", "gravel", "mtb", "ebike"].includes(sport)) {
        result.skipped++;
        continue;
      }
      const raw = await trackForSession(clerkId, session.id);
      if (!raw) {
        result.skipped++;
        continue;
      }
      result.withTrack++;
      const analysis = analyzeTrack(raw);
      if (!analysis.ok) {
        result.skipped++;
        continue;
      }
      const outcome = await upsertCandidateForTrack(
        clerkId,
        session,
        analysis,
        candidates,
      );
      if (outcome === "created") result.created++;
      else result.merged++;
    }

    await db
      .update(routeCandidateScansTable)
      .set({
        lastSessionId: maxId,
        lastScanAt: new Date(),
        activitiesSeen: cursorRow.activitiesSeen + result.processed,
        activitiesWithTrack: cursorRow.activitiesWithTrack + result.withTrack,
        updatedAt: new Date(),
      })
      .where(eq(routeCandidateScansTable.clerkId, clerkId));

    return result;
  } finally {
    scanning.delete(clerkId);
  }
}

function riddenAtOf(session: TrainingSession): Date | null {
  const d = session.sessionDate ? new Date(`${session.sessionDate}T12:00:00Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

async function upsertCandidateForTrack(
  clerkId: string,
  session: TrainingSession,
  analysis: TrackAnalysis,
  candidates: RouteCandidate[],
): Promise<"created" | "merged"> {
  const start = analysis.points[0]!;
  const riddenAt = riddenAtOf(session);

  // 1) Exacte duplicaat (fingerprint) of 2) cluster-match op overlap +
  // startgebied + afstand + discipline. Richting zit in de fingerprint; voor
  // clustering is celoverlap + gelijke start voldoende onderscheidend.
  let best: { cand: RouteCandidate; overlap: number } | null = null;
  for (const cand of candidates) {
    if (cand.sport !== (session.sport || "cycling")) continue;
    if (cand.fingerprint === analysis.fingerprint) {
      best = { cand, overlap: 1 };
      break;
    }
    const startM = haversineM(start[0], start[1], cand.startLat, cand.startLon);
    if (startM > MATCH_START_M) continue;
    const distFrac =
      Math.abs(cand.distanceKm - analysis.distanceKm) /
      Math.max(cand.distanceKm, analysis.distanceKm);
    if (distFrac > MATCH_DISTANCE_FRAC) continue;
    const overlap = cellJaccard(analysis.cells, cand.cells);
    if (overlap < MATCH_OVERLAP) continue;
    if (!best || overlap > best.overlap) best = { cand, overlap };
  }

  if (best) {
    const cand = best.cand;
    const rideCount = cand.rideCount + 1;
    const overlapAvg =
      cand.overlapAvg == null
        ? best.overlap
        : (cand.overlapAvg * (rideCount - 2) + best.overlap) /
          Math.max(1, rideCount - 1);
    const lastRiddenAt =
      riddenAt && (!cand.lastRiddenAt || riddenAt > cand.lastRiddenAt)
        ? riddenAt
        : cand.lastRiddenAt;
    const firstRiddenAt =
      riddenAt && (!cand.firstRiddenAt || riddenAt < cand.firstRiddenAt)
        ? riddenAt
        : cand.firstRiddenAt;
    const quality = computeQuality({
      rideCount,
      lastRiddenAt,
      gpsDensity: analysis.gpsDensity,
      overlapAvg,
      sport: cand.sport,
      sessionSport: session.sport || null,
      revisitFraction: analysis.revisitFraction,
      trimmedM: (cand.trimmedStartM ?? 0) + (cand.trimmedEndM ?? 0),
    });
    const autoLabels = autoLabelsFor({
      rideCount,
      distanceKm: cand.distanceKm,
      elevationM: cand.elevationM,
      sport: cand.sport,
      isLoop: cand.isLoop,
    });
    await db
      .update(routeCandidatesTable)
      .set({
        rideCount,
        overlapAvg,
        lastRiddenAt,
        firstRiddenAt,
        quality,
        autoLabels,
        updatedAt: new Date(),
      })
      .where(eq(routeCandidatesTable.id, cand.id));
    cand.rideCount = rideCount;
    cand.overlapAvg = overlapAvg;
    cand.lastRiddenAt = lastRiddenAt;
    cand.firstRiddenAt = firstRiddenAt;
    await db
      .insert(routeCandidateRidesTable)
      .values({
        clerkId,
        candidateId: cand.id,
        sessionId: session.id,
        riddenAt,
        overlap: best.overlap,
      })
      .onConflictDoNothing();
    return "merged";
  }

  const end = analysis.points[analysis.points.length - 1]!;
  const sport = session.sport || "cycling";
  const elevationM = session.elevationM ?? null;
  const quality = computeQuality({
    rideCount: 1,
    lastRiddenAt: riddenAt,
    gpsDensity: analysis.gpsDensity,
    overlapAvg: null,
    sport,
    sessionSport: session.sport || null,
    revisitFraction: analysis.revisitFraction,
    trimmedM: analysis.trimmedStartM + analysis.trimmedEndM,
  });
  const autoLabels = autoLabelsFor({
    rideCount: 1,
    distanceKm: analysis.distanceKm,
    elevationM,
    sport,
    isLoop: analysis.isLoop,
  });
  const [created] = await db
    .insert(routeCandidatesTable)
    .values({
      clerkId,
      fingerprint: analysis.fingerprint,
      geometry: analysis.points,
      cells: analysis.cells,
      startLat: start[0],
      startLon: start[1],
      endLat: end[0],
      endLon: end[1],
      isLoop: analysis.isLoop,
      distanceKm: Math.round(analysis.distanceKm * 10) / 10,
      elevationM,
      sport,
      rideCount: 1,
      firstRiddenAt: riddenAt,
      lastRiddenAt: riddenAt,
      autoLabels,
      quality,
      trimmedStartM: analysis.trimmedStartM || null,
      trimmedEndM: analysis.trimmedEndM || null,
    })
    .onConflictDoUpdate({
      target: [routeCandidatesTable.clerkId, routeCandidatesTable.fingerprint],
      set: { updatedAt: new Date() },
    })
    .returning();
  await db
    .insert(routeCandidateRidesTable)
    .values({
      clerkId,
      candidateId: created!.id,
      sessionId: session.id,
      riddenAt,
      overlap: 1,
    })
    .onConflictDoNothing();
  candidates.push(created!);
  return "created";
}
