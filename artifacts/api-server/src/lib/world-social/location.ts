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

/**
 * Pas locatieprivacy toe op een track. `home` is het huisadres van de
 * EIGENAAR (null = onbekend; de privacyzone kan dan niet worden toegepast en
 * we vallen fail-closed terug op start/eind verbergen).
 */
export function applyLocationPrivacy(
  raw: TrackPoint[],
  opts: LocationPrivacyOptions,
  home: TrackPoint | null,
): TrackPoint[] | null {
  let points = raw.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lon) &&
      Math.abs(p.lat) <= 90 &&
      Math.abs(p.lon) <= 180,
  );
  if (points.length < 2) return null;

  const wantZone = opts.privacyZone;
  const zoneUsable = wantZone && home !== null;
  // Fail-closed: privacyzone gevraagd maar huisadres onbekend ⇒ dan in elk
  // geval start/einde verbergen zodat er nooit een exact vertrekpunt lekt.
  const hideEnds = opts.hideStartEnd || (wantZone && !zoneUsable);

  if (hideEnds) points = trimEnds(points, TRIM_METERS);
  if (zoneUsable) {
    points = points.filter(
      (p) => haversineMeters(p, home!) > PRIVACY_ZONE_METERS,
    );
  }
  if (opts.simplify && points.length > 200) {
    const step = Math.ceil(points.length / 200);
    const kept: TrackPoint[] = [];
    for (let i = 0; i < points.length; i += step) kept.push(points[i]!);
    const last = points[points.length - 1]!;
    if (kept[kept.length - 1] !== last) kept.push(last);
    points = kept;
  }
  return points.length >= MIN_POINTS ? points : null;
}
