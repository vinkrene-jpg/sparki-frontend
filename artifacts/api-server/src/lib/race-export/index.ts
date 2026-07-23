// Wedstrijdexport-engine — deterministische kern van het exportcentrum.
// Bouwt GPX- en Garmin FIT Course/Workout-bestanden uit het bestaande centrale
// wedstrijdmodel: routegeometrie (routes.geometry / parsedSummary.route) en
// UITSLUITEND door de gebruiker bevestigde of aangepaste wedstrijdpunten
// (race_points, status bevestigd|aangepast). Routevormingswaypoints
// (routes.waypoints) worden hier bewust NOOIT gelezen — die zijn vormgeving,
// geen meldingspunten. Niets wordt verzonnen: geen hoogte zonder echt
// hoogteprofiel, geen locatie zonder bevestigde km of coördinaten.

import type { Race, RacePoint, RacePointKind } from "@workspace/db";
import {
  encodeFitCourse,
  encodeFitWorkout,
  type CoursePointTypeName,
  type FitCoursePoint,
  type FitCourseRecord,
  type FitWorkoutStep,
} from "../fit-encode";
import { parseFitCourse } from "./fit-course-parse";
import { activeRacePoints, cumulativeKm, snapToRouteKm } from "../race-points";

export type RaceExportType = "gpx" | "fit-course" | "fit-workout";

export const EXPORT_TYPE_LABELS: Record<RaceExportType, string> = {
  gpx: "GPX (universeel)",
  "fit-course": "Garmin FIT Course",
  "fit-workout": "FIT Workout",
};

// ── Track (parcours) ────────────────────────────────────────────────────────
export type TrackPoint = { lat: number; lon: number; eleM: number | null };

// Route-geometrie [lat,lon][] (+ eventueel [lat,lon,ele]) → TrackPoint[].
export function coerceTrack(raw: unknown): TrackPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: TrackPoint[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const lat = Number(p[0]);
    const lon = Number(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const ele = p.length >= 3 ? Number(p[2]) : NaN;
    out.push({ lat, lon, eleM: Number.isFinite(ele) ? ele : null });
  }
  return out;
}

// Hoogte per trackpunt uit het opgeslagen (gedownsamplede maar echte)
// hoogteprofiel, afstands-proportioneel gekoppeld. Alleen toegepast wanneer de
// track zelf geen per-punt hoogte draagt én er een echt profiel bestaat.
export function applyProfileElevation(
  track: TrackPoint[],
  profile: number[] | null,
): boolean {
  if (!profile || profile.length < 2) return false;
  if (track.some((p) => p.eleM != null)) return true; // track draagt al echte hoogte
  const clean = profile.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return false;
  const cum = cumulativeKm(track.map((p) => [p.lat, p.lon] as [number, number]));
  const total = cum[cum.length - 1]!;
  if (!(total > 0)) return false;
  for (let i = 0; i < track.length; i++) {
    const frac = cum[i]! / total;
    const fIdx = frac * (clean.length - 1);
    const lo = Math.floor(fIdx);
    const hi = Math.min(clean.length - 1, lo + 1);
    const t = fIdx - lo;
    track[i]!.eleM = Math.round((clean[lo]! * (1 - t) + clean[hi]! * t) * 10) / 10;
  }
  return true;
}

// ── Punten op het parcours plaatsen ────────────────────────────────────────
export type PlacedPoint = {
  point: RacePoint;
  lat: number;
  lon: number;
  km: number;
};

export type PlacementResult = {
  placed: PlacedPoint[];
  // Actieve punten zonder bruikbare locatie (geen km, geen coördinaten) —
  // eerlijk vermeld, nooit op een verzonnen plek gezet.
  unplaced: RacePoint[];
  // Actieve punten met coördinaten die NIET op/nabij de route liggen.
  offRoute: RacePoint[];
};

// Interpoleer positie op de track bij een gegeven km.
function positionAtKm(
  track: TrackPoint[],
  cum: number[],
  km: number,
): { lat: number; lon: number } | null {
  const total = cum[cum.length - 1]!;
  if (km < -0.05 || km > total + 0.05) return null;
  const target = Math.min(Math.max(km, 0), total);
  for (let i = 1; i < cum.length; i++) {
    if (cum[i]! >= target) {
      const seg = cum[i]! - cum[i - 1]!;
      const t = seg > 0 ? (target - cum[i - 1]!) / seg : 0;
      const a = track[i - 1]!;
      const b = track[i]!;
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lon: a.lon + (b.lon - a.lon) * t,
      };
    }
  }
  const last = track[track.length - 1]!;
  return { lat: last.lat, lon: last.lon };
}

// Plaats alle ACTIEVE punten (bevestigd|aangepast) op de track. Voorgestelde
// en afgewezen punten komen hier nooit doorheen.
export function placeActivePoints(
  points: RacePoint[],
  track: TrackPoint[],
): PlacementResult {
  const active = activeRacePoints(points);
  const geometry = track.map((p) => [p.lat, p.lon] as [number, number]);
  const cum = cumulativeKm(geometry);
  const placed: PlacedPoint[] = [];
  const unplaced: RacePoint[] = [];
  const offRoute: RacePoint[] = [];

  for (const p of active) {
    if (p.lat != null && p.lng != null) {
      const km = snapToRouteKm(geometry, p.lat, p.lng);
      if (km == null) {
        offRoute.push(p);
        continue;
      }
      placed.push({ point: p, lat: p.lat, lon: p.lng, km });
      continue;
    }
    if (p.raceKm != null) {
      const pos = positionAtKm(track, cum, p.raceKm);
      if (!pos) {
        offRoute.push(p);
        continue;
      }
      placed.push({ point: p, lat: pos.lat, lon: pos.lon, km: p.raceKm });
      continue;
    }
    unplaced.push(p);
  }
  placed.sort((a, b) => a.km - b.km || a.point.id - b.point.id);
  return { placed, unplaced, offRoute };
}

// ── Validatie (§8) ─────────────────────────────────────────────────────────
export type ExportValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function validateRaceExport(input: {
  race: Pick<Race, "localLaps">;
  allPoints: RacePoint[];
  track: TrackPoint[];
  placement: PlacementResult;
}): ExportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { track, placement, allPoints } = input;
  const active = activeRacePoints(allPoints);

  // Route bevat voldoende punten.
  if (track.length < 2) {
    errors.push("De gekoppelde route heeft geen opgeslagen geometrie.");
  } else if (track.length < 10) {
    errors.push(
      `De route heeft maar ${track.length} geometriepunten — te weinig voor een bruikbaar bestand op een fietscomputer.`,
    );
  }

  // Start en finish bestaan; finish is uniek.
  const finishes = active.filter((p) => p.kind === "finish");
  const starts = active.filter((p) => p.kind === "start");
  if (starts.length === 0) {
    errors.push("Er is geen bevestigd startpunt. Bevestig de officiële start op de kaart.");
  }
  if (finishes.length === 0) {
    errors.push("Er is geen bevestigde finish. Bevestig de officiële finish op de kaart.");
  } else if (finishes.length > 1) {
    errors.push(
      `Er zijn ${finishes.length} bevestigde finishpunten — een parcours heeft er precies één. Wijs de extra finish af of verwijder hem.`,
    );
  }

  // Punten liggen op of nabij de route.
  for (const p of placement.offRoute) {
    errors.push(
      `"${p.label}" ligt niet op of nabij de route (meer dan 250 m ervandaan of buiten de routelengte). Verplaats of controleer dit punt.`,
    );
  }
  // Punten zonder locatie: eerlijk melden. Start/finish zonder locatie is een
  // fout (die MOETEN in het bestand); overige punten worden weggelaten.
  for (const p of placement.unplaced) {
    if (p.kind === "start" || p.kind === "finish") {
      errors.push(
        `"${p.label}" heeft geen kilometer of locatie en kan niet in het bestand worden gezet. Zet het punt eerst op de kaart.`,
      );
    } else {
      warnings.push(
        `"${p.label}" heeft geen kilometer of locatie en wordt niet meegeëxporteerd.`,
      );
    }
  }

  // Afstanden lopen correct op (geen negatieve of buiten-bereik kilometers).
  if (track.length >= 2) {
    const cum = cumulativeKm(track.map((p) => [p.lat, p.lon] as [number, number]));
    const total = cum[cum.length - 1]!;
    if (!(total > 0)) {
      errors.push("De route heeft geen oplopende afstand (alle punten liggen op dezelfde plek).");
    }
    for (const pl of placement.placed) {
      if (pl.km < -0.05 || pl.km > total + 0.5) {
        errors.push(
          `"${pl.point.label}" ligt op km ${pl.km.toFixed(1)}, buiten de routelengte van ${total.toFixed(1)} km.`,
        );
      }
    }
  }

  // Geen dubbele Course Points: zelfde soort binnen 100 m is een dubbel.
  const bySorted = [...placement.placed].sort(
    (a, b) => (a.point.kind < b.point.kind ? -1 : a.point.kind > b.point.kind ? 1 : 0) || a.km - b.km,
  );
  for (let i = 1; i < bySorted.length; i++) {
    const a = bySorted[i - 1]!;
    const b = bySorted[i]!;
    if (a.point.kind === b.point.kind && Math.abs(a.km - b.km) < 0.1) {
      errors.push(
        `Dubbel punt: "${a.point.label}" en "${b.point.label}" (${a.point.kind}) liggen allebei rond km ${a.km.toFixed(1)}. Verwijder of verplaats er één.`,
      );
    }
  }

  // Geen onbevestigde AI-punten: structurele garantie (we exporteren alleen
  // bevestigd|aangepast), hier defensief gecontroleerd.
  for (const pl of placement.placed) {
    if (pl.point.status !== "bevestigd" && pl.point.status !== "aangepast") {
      errors.push(`"${pl.point.label}" is niet bevestigd en mag niet worden geëxporteerd.`);
    }
  }

  // Lokale ronden logisch.
  const laps = input.race.localLaps;
  if (laps != null && laps >= 2) {
    const lapPoints = active.filter((p) => p.kind === "lokale_ronde");
    if (lapPoints.length === 0) {
      warnings.push(
        `Deze wedstrijd heeft ${laps} lokale ronden maar geen bevestigd "lokale ronde"-punt; de fietscomputer toont de ronden dan niet.`,
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── GPX ─────────────────────────────────────────────────────────────────────
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// GPX-waypointsymbolen (De-facto Garmin-namen die routeapps herkennen).
const GPX_SYMBOLS: Partial<Record<RacePointKind, string>> = {
  start: "Flag, Green",
  finish: "Flag, Checkered",
  sprint: "Flag, Blue",
  bergprijs: "Summit",
  bevoorrading: "Restaurant",
  gevaar: "Danger Area",
  wegdek: "Danger Area",
  spoorwegovergang: "Crossing",
  laatste_km: "Flag, Red",
};

export function buildRaceGpx(input: {
  race: Pick<Race, "name" | "raceDate">;
  track: TrackPoint[];
  placement: PlacementResult;
}): string {
  const { race, track, placement } = input;
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1">`,
  );
  lines.push(`  <metadata>`);
  lines.push(`    <name>${xmlEscape(race.name)}</name>`);
  lines.push(`    <time>${new Date().toISOString()}</time>`);
  lines.push(`  </metadata>`);

  // Waypoints: alleen geplaatste, bevestigde punten. Routevormingswaypoints
  // bestaan hier niet (worden nooit gelezen).
  for (const pl of placement.placed) {
    const sym = GPX_SYMBOLS[pl.point.kind as RacePointKind];
    lines.push(`  <wpt lat="${pl.lat.toFixed(6)}" lon="${pl.lon.toFixed(6)}">`);
    lines.push(`    <name>${xmlEscape(pl.point.label)}</name>`);
    if (pl.point.description) {
      lines.push(`    <desc>${xmlEscape(pl.point.description)}</desc>`);
    }
    if (sym) lines.push(`    <sym>${xmlEscape(sym)}</sym>`);
    lines.push(`  </wpt>`);
  }

  lines.push(`  <trk>`);
  lines.push(`    <name>${xmlEscape(race.name)}</name>`);
  lines.push(`    <trkseg>`);
  for (const p of track) {
    if (p.eleM != null) {
      lines.push(
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.eleM.toFixed(1)}</ele></trkpt>`,
      );
    } else {
      lines.push(`      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"/>`);
    }
  }
  lines.push(`    </trkseg>`);
  lines.push(`  </trk>`);
  lines.push(`</gpx>`);
  return lines.join("\n");
}

// ── FIT Course ──────────────────────────────────────────────────────────────
// Kind → Garmin course_point type. Alleen soorten met een echt passend
// FIT-type krijgen dat type; de rest wordt "generic" met het eigen label.
const COURSE_POINT_TYPE: Record<string, CoursePointTypeName> = {
  start: "generic",
  neutralisatie_einde: "generic",
  sprint: "sprint",
  bergprijs: "summit",
  bevoorrading: "food",
  afvalzone: "generic",
  gevaar: "danger",
  wegdek: "danger",
  spoorwegovergang: "danger",
  laatste_km: "generic",
  lokale_ronde: "generic",
  finish: "generic",
  info: "generic",
};

// Nominale virtual-partner-snelheid voor de tijdlijn in het course-bestand.
const NOMINAL_KMH = 30;

export function buildFitCourse(input: {
  race: Pick<Race, "name" | "raceDate">;
  track: TrackPoint[];
  placement: PlacementResult;
  elevationGainM: number | null;
}): Buffer {
  const { race, track, placement } = input;
  const cum = cumulativeKm(track.map((p) => [p.lat, p.lon] as [number, number]));
  // Tijdlijn: wedstrijddag 09:00 UTC + nominale 30 km/u. Puur een afspeel-
  // tijdlijn voor de fietscomputer, geen voorspelling.
  const base = Date.parse(`${race.raceDate}T09:00:00Z`);
  const startMs = Number.isFinite(base) ? base : Date.now();
  const msAtKm = (km: number) => startMs + (km / NOMINAL_KMH) * 3_600_000;

  const records: FitCourseRecord[] = track.map((p, i) => ({
    lat: p.lat,
    lon: p.lon,
    distanceM: cum[i]! * 1000,
    altitudeM: p.eleM,
    timeMs: msAtKm(cum[i]!),
  }));

  const coursePoints: FitCoursePoint[] = placement.placed.map((pl) => ({
    lat: pl.lat,
    lon: pl.lon,
    distanceM: pl.km * 1000,
    type: COURSE_POINT_TYPE[pl.point.kind] ?? "generic",
    name: pl.point.label,
    timeMs: msAtKm(pl.km),
  }));

  return encodeFitCourse({
    name: race.name,
    records,
    coursePoints,
    totalAscentM: input.elevationGainM,
  });
}

// ── FIT Workout ─────────────────────────────────────────────────────────────
// Alleen wanneer er een echte warming-up (logistics.warmupMin) of gekoppelde
// geplande training bestaat. We verzinnen geen stappen, vermogens of zones.
export type WorkoutSource = {
  warmupMin: number | null;
  plannedWorkout: { title: string; targetDurationMin: number | null } | null;
  assignment: string | null;
};

export function buildWorkoutSteps(src: WorkoutSource): FitWorkoutStep[] | null {
  const steps: FitWorkoutStep[] = [];
  if (src.warmupMin != null && src.warmupMin >= 5 && src.warmupMin <= 180) {
    steps.push({
      name: `Warming-up ${src.warmupMin} min`,
      durationSec: src.warmupMin * 60,
      intensity: 2,
    });
  }
  if (src.plannedWorkout) {
    steps.push({
      name: src.plannedWorkout.title.slice(0, 47),
      durationSec:
        src.plannedWorkout.targetDurationMin != null &&
        src.plannedWorkout.targetDurationMin > 0
          ? src.plannedWorkout.targetDurationMin * 60
          : null,
      intensity: 0,
    });
  }
  if (steps.length === 0) return null;
  // Afsluitende open stap zodat de computer niet abrupt stopt vóór de start.
  steps.push({
    name: src.assignment ? src.assignment.slice(0, 47) : "Naar de start",
    durationSec: null,
    intensity: 0,
  });
  return steps;
}

export function buildFitWorkout(input: {
  race: Pick<Race, "name">;
  steps: FitWorkoutStep[];
}): Buffer {
  return encodeFitWorkout({
    name: `${input.race.name} voorbereiding`.slice(0, 47),
    steps: input.steps,
  });
}

// ── Bestandsnaam ────────────────────────────────────────────────────────────
export function exportFileName(input: {
  raceName: string;
  raceDate: string;
  type: RaceExportType;
  version: number;
}): string {
  const slug = input.raceName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "wedstrijd";
  const typePart =
    input.type === "gpx" ? "gpx" : input.type === "fit-course" ? "course" : "workout";
  const ext = input.type === "gpx" ? "gpx" : "fit";
  return `${slug}_${input.raceDate}_${typePart}_v${input.version}.${ext}`;
}

// ── Round-trip-controle ─────────────────────────────────────────────────────
export type RoundTripResult = {
  ok: boolean;
  detail: string;
};

// GPX: opnieuw inlezen met dezelfde regex-benadering als de importparser en
// route/hoogte/punten vergelijken.
export function roundTripGpx(
  content: string,
  expected: { trackPoints: number; waypoints: number; hasElevation: boolean },
): RoundTripResult {
  const trkptCount = (content.match(/<trkpt\b/g) ?? []).length;
  const wptCount = (content.match(/<wpt\b/g) ?? []).length;
  const eleCount = (content.match(/<ele>/g) ?? []).length;
  if (trkptCount !== expected.trackPoints) {
    return {
      ok: false,
      detail: `GPX bevat ${trkptCount} routepunten, verwacht ${expected.trackPoints}.`,
    };
  }
  if (wptCount !== expected.waypoints) {
    return {
      ok: false,
      detail: `GPX bevat ${wptCount} wedstrijdpunten, verwacht ${expected.waypoints}.`,
    };
  }
  if (expected.hasElevation && eleCount === 0) {
    return { ok: false, detail: "GPX mist hoogtegegevens die de route wel heeft." };
  }
  return {
    ok: true,
    detail: `Round-trip geslaagd: ${trkptCount} routepunten, ${wptCount} wedstrijdpunten${expected.hasElevation ? ", hoogte aanwezig" : ""}.`,
  };
}

export function roundTripFitCourse(
  buf: Buffer,
  expected: {
    trackPoints: number;
    coursePoints: number;
    distanceKm: number;
    hasElevation: boolean;
  },
): RoundTripResult {
  const parsed = parseFitCourse(buf);
  if (!parsed) return { ok: false, detail: "FIT-bestand kon niet worden teruggelezen." };
  if (!parsed.crcValid) return { ok: false, detail: "FIT-bestand heeft een ongeldige checksum." };
  if (parsed.fileType !== 6) {
    return { ok: false, detail: `FIT-bestandstype is ${parsed.fileType}, verwacht 6 (course).` };
  }
  if (parsed.records.length !== expected.trackPoints) {
    return {
      ok: false,
      detail: `FIT bevat ${parsed.records.length} routepunten, verwacht ${expected.trackPoints}.`,
    };
  }
  if (parsed.coursePoints.length !== expected.coursePoints) {
    return {
      ok: false,
      detail: `FIT bevat ${parsed.coursePoints.length} course points, verwacht ${expected.coursePoints}.`,
    };
  }
  const dist = parsed.lapTotalDistanceM != null ? parsed.lapTotalDistanceM / 1000 : null;
  if (dist == null || Math.abs(dist - expected.distanceKm) > Math.max(0.2, expected.distanceKm * 0.02)) {
    return {
      ok: false,
      detail: `FIT-afstand (${dist?.toFixed(1) ?? "onbekend"} km) wijkt af van de route (${expected.distanceKm.toFixed(1)} km).`,
    };
  }
  if (expected.hasElevation && !parsed.records.some((r) => r.altitudeM != null)) {
    return { ok: false, detail: "FIT mist hoogtegegevens die de route wel heeft." };
  }
  return {
    ok: true,
    detail: `Round-trip geslaagd: ${parsed.records.length} routepunten, ${parsed.coursePoints.length} course points, ${dist!.toFixed(1)} km.`,
  };
}

export function roundTripFitWorkout(
  buf: Buffer,
  expected: { steps: number },
): RoundTripResult {
  const parsed = parseFitCourse(buf);
  if (!parsed) return { ok: false, detail: "FIT-bestand kon niet worden teruggelezen." };
  if (!parsed.crcValid) return { ok: false, detail: "FIT-bestand heeft een ongeldige checksum." };
  if (parsed.fileType !== 5) {
    return { ok: false, detail: `FIT-bestandstype is ${parsed.fileType}, verwacht 5 (workout).` };
  }
  if (parsed.workoutSteps.length !== expected.steps) {
    return {
      ok: false,
      detail: `FIT bevat ${parsed.workoutSteps.length} stappen, verwacht ${expected.steps}.`,
    };
  }
  return { ok: true, detail: `Round-trip geslaagd: ${parsed.workoutSteps.length} stappen.` };
}
