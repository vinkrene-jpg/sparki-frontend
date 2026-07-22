// Deterministische stop-detectie en -classificatie voor de Sparki Traffic
// Database. Pure functies — geen I/O — zodat het gedrag volledig testbaar is.
//
// Invoer: echte, van tijd voorziene GPS-punten uit een geüpload ritbestand
// (GPX/TCX <time> of FIT record-timestamps). Uitvoer: gedetecteerde stops met
// een deterministische, uitgelegde kansverdeling over mogelijke oorzaken
// (verkeerslicht / spoorwegovergang / kruispunt / pauze).
//
// Eerlijkheidscontract: elke score komt uit gedocumenteerde regels op echte
// meetwaarden (stilstandsduur, context van bekende objecten, herhaling door
// meerdere renners). Er wordt nooit 100% zekerheid geclaimd en zonder
// tijdstempels is er geen detectie (geen gok op afstand alleen).

export type TimedTrackPoint = { lat: number; lon: number; timeMs: number };

export type DetectedStop = {
  lat: number;
  lon: number;
  /** Rastercel-sleutel (~11 m) — de leersleutel voor het zelflerende systeem. */
  cellKey: string;
  /** Werkelijke stilstandsduur in seconden. */
  stopSec: number;
  /** Seconden vanaf de start van de rit tot deze stop. */
  atSec: number;
  /** Gerangschikte kansverdeling (hoogste eerst), waarden 0..1. */
  candidates: StopCandidate[];
};

export type StopCandidateKind =
  | "traffic_signal"
  | "railway_crossing"
  | "junction"
  | "pause";

export type StopCandidate = { kind: StopCandidateKind; confidence: number };

export const STOP_KIND_LABELS: Record<StopCandidateKind, string> = {
  traffic_signal: "verkeerslicht",
  railway_crossing: "spoorwegovergang",
  junction: "kruispunt",
  pause: "pauze",
};

// Detectie-drempels (gedocumenteerde aannames, geen magie):
// - stilstand = < 1,0 m/s (3,6 km/u): onder fietstempo, boven GPS-ruis;
// - een stop telt vanaf 5 s stilstand (korter is vaak gewoon een voetganger
//   of bocht) en we groeperen puntreeksen die binnen 25 m blijven.
const STILL_SPEED_MPS = 1.0;
const MIN_STOP_SEC = 5;
const MAX_DRIFT_M = 25;

export function haversineM(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rastercel van ~11 m (4 decimalen) — "exact dezelfde locatie" in de praktijk. */
export function cellKeyFor(lat: number, lon: number): string {
  return `cell:${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/**
 * Vind echte stops in een van tijd voorziene track. Een stop is een
 * aaneengesloten reeks punten met snelheid < 1 m/s die samen ≥ 5 s duurt en
 * binnen ~25 m blijft (GPS-drift bij stilstand).
 */
export function findStops(track: TimedTrackPoint[]): Omit<DetectedStop, "candidates">[] {
  if (track.length < 3) return [];
  const pts = [...track].sort((a, b) => a.timeMs - b.timeMs);
  const startMs = pts[0]!.timeMs;

  const stops: Omit<DetectedStop, "candidates">[] = [];
  let anchor: TimedTrackPoint | null = null;
  let stopStartMs = 0;
  let sumLat = 0;
  let sumLon = 0;
  let n = 0;

  const flush = (endMs: number) => {
    if (!anchor || n === 0) return;
    const stopSec = Math.round((endMs - stopStartMs) / 1000);
    if (stopSec >= MIN_STOP_SEC) {
      const lat = sumLat / n;
      const lon = sumLon / n;
      stops.push({
        lat,
        lon,
        cellKey: cellKeyFor(lat, lon),
        stopSec,
        atSec: Math.round((stopStartMs - startMs) / 1000),
      });
    }
    anchor = null;
    n = 0;
    sumLat = 0;
    sumLon = 0;
  };

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    const dtSec = (cur.timeMs - prev.timeMs) / 1000;
    if (dtSec <= 0 || dtSec > 120) {
      // Gat in de opname: sluit een lopende stop eerlijk af op het laatste
      // bekende moment — de gat-duur wordt nooit als stilstand geteld.
      flush(prev.timeMs);
      continue;
    }
    const dM = haversineM(prev.lat, prev.lon, cur.lat, cur.lon);
    const speed = dM / dtSec;

    if (speed < STILL_SPEED_MPS) {
      if (anchor && haversineM(anchor.lat, anchor.lon, cur.lat, cur.lon) > MAX_DRIFT_M) {
        flush(cur.timeMs);
      }
      if (!anchor) {
        anchor = prev;
        stopStartMs = prev.timeMs;
      }
      sumLat += cur.lat;
      sumLon += cur.lon;
      n += 1;
    } else if (anchor) {
      flush(prev.timeMs);
    }
  }
  flush(pts[pts.length - 1]!.timeMs);
  return stops;
}

export type StopContext = {
  /** Bekend verkeerslicht binnen ~40 m (uit de Sparki Traffic Database/OSM). */
  nearKnownSignal: boolean;
  /** Bekende spoorwegovergang binnen ~60 m. */
  nearKnownRailway: boolean;
  /** Eerdere waarnemingen in dezelfde rastercel (alle renners samen). */
  priorReports: number;
  /** Aantal verschillende renners dat hier eerder stopte. */
  distinctUsers: number;
};

/**
 * Deterministische kansverdeling voor één stop. De basis komt uit de
 * stilstandsduur (verkeerslichten wachten typisch 10–120 s, overwegen langer,
 * kruispunt-stops zijn kort, lange stilstand is vrijwel altijd pauze);
 * context van bekende objecten en herhaald stopgedrag van meerdere renners
 * verschuift de verdeling. Uitkomsten worden genormaliseerd en afgetopt op
 * 0,97 — nooit een geclaimde 100%.
 */
export function classifyStop(
  stopSec: number,
  ctx: StopContext,
): StopCandidate[] {
  // Basisscores per oorzaak uit de duur (stuksgewijs lineair, gedocumenteerd).
  let signal: number;
  if (stopSec < 8) signal = 0.15;
  else if (stopSec <= 120) signal = 0.55;
  else if (stopSec <= 180) signal = 0.3;
  else signal = 0.05;

  let railway: number;
  if (stopSec < 20) railway = 0.05;
  else if (stopSec <= 300) railway = 0.2;
  else railway = 0.08;

  let junction: number;
  if (stopSec < 8) junction = 0.5;
  else if (stopSec <= 30) junction = 0.2;
  else junction = 0.05;

  let pause: number;
  if (stopSec < 60) pause = 0.05;
  else if (stopSec <= 180) pause = 0.15;
  else if (stopSec <= 300) pause = 0.45;
  else pause = 0.85;

  // Context: een bekend object vlakbij is sterk bewijs voor die oorzaak.
  if (ctx.nearKnownSignal) signal *= 2.2;
  if (ctx.nearKnownRailway) railway *= 2.5;

  // Zelflerend: herhaalde stops op exact deze plek — zeker door verschillende
  // renners — wijzen op vaste infrastructuur, niet op een individuele pauze.
  const repetition = Math.min(ctx.priorReports, 6) * 0.06 +
    Math.min(ctx.distinctUsers, 4) * 0.1;
  if (repetition > 0 && stopSec <= 300) {
    signal *= 1 + repetition;
    railway *= 1 + repetition * 0.5;
    pause *= Math.max(0.3, 1 - repetition);
  }

  const total = signal + railway + junction + pause;
  const out: StopCandidate[] = [
    { kind: "traffic_signal" as const, confidence: signal / total },
    { kind: "railway_crossing" as const, confidence: railway / total },
    { kind: "junction" as const, confidence: junction / total },
    { kind: "pause" as const, confidence: pause / total },
  ]
    .map((c) => ({ ...c, confidence: Math.min(0.97, Math.round(c.confidence * 100) / 100) }))
    .sort((a, b) => b.confidence - a.confidence);
  return out;
}

// ── Tijd-voorziene tracks uit geüploade bestanden ───────────────────────────
// Dezelfde afhankelijkheidsvrije regex-stijl als de bestaande parsers.

/** GPX: <trkpt lat=".." lon=".."><time>ISO</time></trkpt>. */
export function extractTimedTrackFromGpx(content: string): TimedTrackPoint[] {
  const out: TimedTrackPoint[] = [];
  const re = /<trkpt\b[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    const timeStr = /<time>\s*([^<]+)<\/time>/i.exec(m[3]!)?.[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !timeStr) continue;
    const t = Date.parse(timeStr.trim());
    if (!Number.isFinite(t)) continue;
    out.push({ lat, lon, timeMs: t });
  }
  return out;
}

/** TCX: <Trackpoint><Time>ISO</Time><Position><LatitudeDegrees>…</…>. */
export function extractTimedTrackFromTcx(content: string): TimedTrackPoint[] {
  const out: TimedTrackPoint[] = [];
  const re = /<Trackpoint\b[\s\S]*?<\/Trackpoint>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const block = m[0]!;
    const timeStr = /<(?:\w+:)?Time>\s*([^<]+)<\/(?:\w+:)?Time>/i.exec(block)?.[1];
    const latStr = /<(?:\w+:)?LatitudeDegrees>\s*([^<]+)</i.exec(block)?.[1];
    const lonStr = /<(?:\w+:)?LongitudeDegrees>\s*([^<]+)</i.exec(block)?.[1];
    if (!timeStr || !latStr || !lonStr) continue;
    const t = Date.parse(timeStr.trim());
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(t) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ lat, lon, timeMs: t });
  }
  return out;
}
