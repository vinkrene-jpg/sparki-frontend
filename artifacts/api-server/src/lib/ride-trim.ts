// ── Rit inkorten (trim) engine ───────────────────────────────────────────────
// Pure herberekening van sessiestatistieken wanneer een renner het begin of
// einde van een bewaarde rit verplaatst. Werkt uitsluitend op de ECHT bewaarde
// track-geometrie (parsedSummary.route.geometry, [lat, lon, ele?]-tuples).
//
// Eerlijkheidsregels:
// - De geometrie draagt geen tijdstempels: de ingekorte duur wordt PROPORTIONEEL
//   aan de afstand geschat en altijd als schatting gemarkeerd (durationEstimated).
// - Hoogtemeters worden alleen herberekend als de geometrie echte ele-waarden
//   draagt; anders eerlijk null (nooit proportioneel verzonnen).
// - De oorspronkelijke statistieken blijven bewaard zodat inkorten altijd
//   volledig terug te draaien is.

export type TrimGeometryPoint = [number, number, number?];

export type TrimOriginalStats = {
  durationMin: number | null;
  distanceKm: string | null;
  elevationM: number | null;
  avgSpeedKph: string | null;
};

export type SessionTrimEdit = {
  startIndex: number;
  endIndex: number;
  trimmedAt: string;
  durationEstimated: boolean;
  original: TrimOriginalStats;
};

export type TrimPreview = {
  startIndex: number;
  endIndex: number;
  pointCount: number;
  distanceKm: number;
  fullDistanceKm: number;
  distanceFraction: number;
  elevationM: number | null;
  durationMin: number | null;
  durationEstimated: boolean;
  avgSpeedKph: number | null;
};

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: TrimGeometryPoint, b: TrimGeometryPoint): number {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Valideer een gevraagd bereik tegen de tracklengte. Retourneert een
// Nederlandstalige foutmelding of null wanneer het bereik geldig is.
export function validateTrimRange(
  pointCount: number,
  startIndex: unknown,
  endIndex: unknown,
): string | null {
  if (pointCount < 2) return "Deze rit heeft geen bruikbare track om in te korten";
  if (
    typeof startIndex !== "number" ||
    typeof endIndex !== "number" ||
    !Number.isInteger(startIndex) ||
    !Number.isInteger(endIndex)
  ) {
    return "Ongeldig bereik";
  }
  if (startIndex < 0 || endIndex > pointCount - 1 || startIndex >= endIndex) {
    return "Ongeldig bereik";
  }
  if (endIndex - startIndex < 1) return "Ongeldig bereik";
  return null;
}

// Totale afstand (km) langs een reeks geometriepunten.
export function trackDistanceKm(geometry: TrimGeometryPoint[]): number {
  let km = 0;
  for (let i = 1; i < geometry.length; i++) {
    km += haversineKm(geometry[i - 1]!, geometry[i]!);
  }
  return km;
}

// Hoogtemeters (stijging) uit echte ele-waarden met een 3 m-drempel tegen
// GPS-ruis. Retourneert null wanneer de punten geen (of te weinig) echte
// hoogtes dragen — nooit een verzonnen getal.
export function elevationGainM(geometry: TrimGeometryPoint[]): number | null {
  const eles = geometry
    .map((p) => p[2])
    .filter((e): e is number => typeof e === "number" && Number.isFinite(e));
  if (eles.length < 2 || eles.length < geometry.length * 0.8) return null;
  let gain = 0;
  let base = eles[0]!;
  for (let i = 1; i < eles.length; i++) {
    const e = eles[i]!;
    if (e > base + 3) {
      gain += e - base;
      base = e;
    } else if (e < base) {
      base = e;
    }
  }
  return Math.round(gain);
}

// Herbereken de statistieken voor een ingekort bereik. Duur is proportioneel
// aan de afstand (de geometrie draagt geen tijd) en dus altijd een schatting.
export function computeTrimPreview(
  geometry: TrimGeometryPoint[],
  startIndex: number,
  endIndex: number,
  original: TrimOriginalStats,
): TrimPreview {
  const slice = geometry.slice(startIndex, endIndex + 1);
  const fullKm = trackDistanceKm(geometry);
  const sliceKm = trackDistanceKm(slice);
  const fraction = fullKm > 0 ? Math.min(1, sliceKm / fullKm) : 0;

  const origDuration =
    typeof original.durationMin === "number" &&
    Number.isFinite(original.durationMin) &&
    original.durationMin > 0
      ? original.durationMin
      : null;
  // Bij degenerate geometrie (geen meetbare afstand) is een proportionele
  // duurschatting niet eerlijk te maken — dan blijft de duur gewoon null.
  const durationMin =
    origDuration != null && fullKm > 0
      ? Math.max(1, Math.round(origDuration * fraction))
      : null;

  const elevationM = elevationGainM(slice);

  const avgSpeedKph =
    durationMin != null && durationMin > 0 && sliceKm > 0
      ? Math.round((sliceKm / (durationMin / 60)) * 100) / 100
      : null;

  return {
    startIndex,
    endIndex,
    pointCount: slice.length,
    distanceKm: Math.round(sliceKm * 100) / 100,
    fullDistanceKm: Math.round(fullKm * 100) / 100,
    distanceFraction: Math.round(fraction * 1000) / 1000,
    elevationM,
    durationMin,
    durationEstimated: durationMin != null,
    avgSpeedKph,
  };
}

// Snijd het (over de hele rit gedownsamplede) hoogteprofiel proportioneel bij
// op het ingekorte bereik — beide zijn echte, gemeten waarden.
export function sliceProfile(
  profile: number[] | null,
  pointCount: number,
  startIndex: number,
  endIndex: number,
): number[] | null {
  if (!profile || profile.length < 2 || pointCount < 2) return profile;
  const from = Math.floor((startIndex / (pointCount - 1)) * (profile.length - 1));
  const to = Math.ceil((endIndex / (pointCount - 1)) * (profile.length - 1));
  const out = profile.slice(from, to + 1);
  return out.length >= 2 ? out : null;
}
