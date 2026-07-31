// Sparki World — locatieprivacy voor gedeelde routes. De transformatie werkt
// UITSLUITEND op de kopie die aan een kijker wordt geserveerd; de
// oorspronkelijke activiteit blijft intern volledig intact.
//
//   - hideStartEnd: knip ~500 m van het begin en einde van de lijn.
//   - privacyZone:  verwijder alle punten binnen ~750 m van het huisadres.
//   - simplify:     dun de lijn uit (elke n-de punt) zodat exacte posities
//                   minder herleidbaar zijn en de payload klein blijft.
//
// Eerlijkheid: als na de transformatie te weinig punten overblijven om nog een
// zinvolle lijn te tonen, geven we null terug (geen kaart) — nooit een
// gefabriceerde lijn.

export type TrackPoint = { lat: number; lon: number };

const TRIM_METERS = 500;
const PRIVACY_ZONE_METERS = 750;
const MIN_POINTS = 8;

export function haversineMeters(a: TrackPoint, b: TrackPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function trimEnds(points: TrackPoint[], meters: number): TrackPoint[] {
  if (points.length < 2) return [];
  // vanaf het begin
  let startIdx = 0;
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    acc += haversineMeters(points[i - 1]!, points[i]!);
    if (acc >= meters) {
      startIdx = i;
      break;
    }
    startIdx = i;
  }
  // vanaf het einde
  let endIdx = points.length - 1;
  acc = 0;
  for (let i = points.length - 2; i >= 0; i--) {
    acc += haversineMeters(points[i]!, points[i + 1]!);
    if (acc >= meters) {
      endIdx = i;
      break;
    }
    endIdx = i;
  }
  if (endIdx <= startIdx) return [];
  return points.slice(startIdx, endIdx + 1);
}

export interface LocationPrivacyOptions {
  hideStartEnd: boolean;
  privacyZone: boolean;
  simplify: boolean;
}

// Eén privacyzone: middelpunt + straal. Het huisadres van de eigenaar is
// altijd impliciet zo'n zone (750 m); gebruikers kunnen daarnaast eigen zones
// (werk, andere gevoelige plekken) met eigen straal beheren.
export type PrivacyZoneCircle = TrackPoint & { radiusM: number };

/**
 * Pas locatieprivacy toe op een track. `zones` zijn de privacyzones van de
 * EIGENAAR — huisadres plus zelf beheerde zones. Een enkel TrackPoint (legacy:
 * alleen huisadres) wordt behandeld als één zone met de standaardstraal.
 * Lege lijst/null = onbekend; de privacyzone kan dan niet worden toegepast en
 * we vallen fail-closed terug op start/eind verbergen.
 */
export function applyLocationPrivacy(
  raw: TrackPoint[],
  opts: LocationPrivacyOptions,
  zonesInput: PrivacyZoneCircle[] | TrackPoint | null,
): TrackPoint[] | null {
  const zones: PrivacyZoneCircle[] = Array.isArray(zonesInput)
    ? zonesInput.filter(
        (z) =>
          Number.isFinite(z.lat) &&
          Number.isFinite(z.lon) &&
          Number.isFinite(z.radiusM) &&
          z.radiusM > 0,
      )
    : zonesInput !== null
      ? [{ ...zonesInput, radiusM: PRIVACY_ZONE_METERS }]
      : [];
  let points = raw.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lon) &&
      Math.abs(p.lat) <= 90 &&
      Math.abs(p.lon) <= 180,
  );
  if (points.length < 2) return null;

  const wantZone = opts.privacyZone;
  const zoneUsable = wantZone && zones.length > 0;
  // Fail-closed: privacyzone gevraagd maar geen enkele zone bekend ⇒ dan in
  // elk geval start/einde verbergen zodat er nooit een exact vertrekpunt lekt.
  const hideEnds = opts.hideStartEnd || (wantZone && !zoneUsable);

  if (hideEnds) points = trimEnds(points, TRIM_METERS);
  if (opts.simplify && points.length > 200) {
    const step = Math.ceil(points.length / 200);
    const kept: TrackPoint[] = [];
    for (let i = 0; i < points.length; i += step) kept.push(points[i]!);
    const last = points[points.length - 1]!;
    if (kept[kept.length - 1] !== last) kept.push(last);
    points = kept;
  }
  if (zoneUsable) {
    // Punten binnen een zone weglaten is niet genoeg: de kaart trekt dan een
    // rechte lijn van het punt vóór de zone naar het punt erna — dwars door de
    // beschermde cirkel. Daarom houden we alleen het langste aaneengesloten
    // stuk over waarvan geen enkel punt in een zone ligt ÉN geen enkel
    // tussensegment een zonecirkel snijdt. Eerlijk: de rest van de route wordt
    // dan niet getoond in plaats van een verraderlijke verbindingslijn.
    points = longestRunOutsideZones(points, zones);
  }
  return points.length >= MIN_POINTS ? points : null;
}

// Kleinste afstand (meters) van zonemiddelpunt z tot het segment a–b, via een
// lokale equirectangulaire projectie rond z (ruim voldoende op zone-schaal).
export function segmentMinDistanceMeters(
  a: TrackPoint,
  b: TrackPoint,
  z: TrackPoint,
): number {
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((z.lat * Math.PI) / 180);
  const ax = (a.lon - z.lon) * mPerDegLon;
  const ay = (a.lat - z.lat) * mPerDegLat;
  const bx = (b.lon - z.lon) * mPerDegLon;
  const by = (b.lat - z.lat) * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.sqrt(px * px + py * py);
}

function longestRunOutsideZones(
  points: TrackPoint[],
  zones: PrivacyZoneCircle[],
): TrackPoint[] {
  const inside = (p: TrackPoint) =>
    zones.some((z) => haversineMeters(p, z) <= z.radiusM);
  const segmentCrosses = (a: TrackPoint, b: TrackPoint) =>
    zones.some((z) => segmentMinDistanceMeters(a, b, z) <= z.radiusM);
  let best: TrackPoint[] = [];
  let run: TrackPoint[] = [];
  const flush = () => {
    if (run.length > best.length) best = run;
    run = [];
  };
  for (const p of points) {
    if (inside(p)) {
      flush();
      continue;
    }
    if (run.length > 0 && segmentCrosses(run[run.length - 1]!, p)) flush();
    run.push(p);
  }
  flush();
  return best;
}
