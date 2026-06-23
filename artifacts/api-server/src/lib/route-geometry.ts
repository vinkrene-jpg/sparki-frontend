// Shared route-geometry math. Given an ordered list of real track points
// (lat/lon + optional elevation) it derives distance (haversine), elevation
// gain, a downsampled elevation profile, and detected climbs. Used by BOTH the
// GPX parser and the ORS route generator so generated routes get the exact same
// honest `profile`/`climbs` shape as uploaded GPX routes. Nothing here is
// fabricated — every value comes from the supplied points.

export type GeoPoint = {
  lat: number;
  lon: number;
  ele: number | null;
};

export type RouteClimb = {
  name: string;
  lengthKm: number;
  avgGradePct: number;
};

export type RouteStats = {
  distanceKm: number | null;
  elevationGainM: number | null;
  profile: number[];
  climbs: RouteClimb[];
};

const PROFILE_SAMPLES = 48;

export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Cumulative distance (km) at each point, starting at 0.
function cumulativeKm(points: GeoPoint[]): number[] {
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += haversineKm(a.lat, a.lon, b.lat, b.lon);
    cum.push(total);
  }
  return cum;
}

export function computeRouteStats(points: GeoPoint[]): RouteStats {
  if (points.length === 0) {
    return { distanceKm: null, elevationGainM: null, profile: [], climbs: [] };
  }

  const cumKm = cumulativeKm(points);
  const distanceKm = cumKm[cumKm.length - 1] ?? 0;

  const eleSeries = points.map((p) => p.ele);
  const hasElevation = eleSeries.some((e) => e != null);

  // Elevation gain (sum of positive deltas).
  let elevationGainM = 0;
  let prevEle: number | null = null;
  for (const e of eleSeries) {
    if (e == null) continue;
    if (prevEle != null && e > prevEle) elevationGainM += e - prevEle;
    prevEle = e;
  }

  // Downsample elevation to a fixed number of points for the profile chart.
  const eleOnly = eleSeries.filter((e): e is number => e != null);
  let profile: number[] = [];
  if (eleOnly.length > 0) {
    if (eleOnly.length <= PROFILE_SAMPLES) {
      profile = eleOnly.map((e) => Math.round(e));
    } else {
      const step = (eleOnly.length - 1) / (PROFILE_SAMPLES - 1);
      for (let i = 0; i < PROFILE_SAMPLES; i++) {
        const idx = Math.round(i * step);
        profile.push(Math.round(eleOnly[Math.min(idx, eleOnly.length - 1)]!));
      }
    }
  }

  const climbs = hasElevation ? detectClimbs(points, cumKm) : [];

  return {
    distanceKm: distanceKm > 0 ? Math.round(distanceKm * 100) / 100 : null,
    elevationGainM: hasElevation ? Math.round(elevationGainM) : null,
    profile,
    climbs,
  };
}

// Detect sustained climbs: contiguous stretches of net ascent. Small dips are
// tolerated; a stretch qualifies as a climb when it gains >= MIN_GAIN_M over
// >= MIN_LENGTH_KM at an average grade >= MIN_GRADE_PCT. Names are generic
// ("Klim 1", ...) because the track carries no climb names.
function detectClimbs(points: GeoPoint[], cumKm: number[]): RouteClimb[] {
  const MIN_GAIN_M = 40;
  const MIN_LENGTH_KM = 0.6;
  const MIN_GRADE_PCT = 3;
  const DESCENT_TOLERANCE_M = 12;

  const climbs: RouteClimb[] = [];
  let startIdx: number | null = null;
  let topEle = -Infinity;
  let topIdx = 0;

  const tryClose = () => {
    if (startIdx == null) return;
    const startEle = points[startIdx]!.ele;
    const endEle = points[topIdx]!.ele;
    if (startEle != null && endEle != null) {
      const gain = endEle - startEle;
      const lengthKm = cumKm[topIdx]! - cumKm[startIdx]!;
      if (
        gain >= MIN_GAIN_M &&
        lengthKm >= MIN_LENGTH_KM &&
        (gain / (lengthKm * 1000)) * 100 >= MIN_GRADE_PCT
      ) {
        climbs.push({
          name: `Klim ${climbs.length + 1}`,
          lengthKm: Math.round(lengthKm * 10) / 10,
          avgGradePct: Math.round((gain / (lengthKm * 1000)) * 1000) / 10,
        });
      }
    }
    startIdx = null;
    topEle = -Infinity;
  };

  for (let i = 0; i < points.length; i++) {
    const ele = points[i]!.ele;
    if (ele == null) continue;
    if (startIdx == null) {
      startIdx = i;
      topEle = ele;
      topIdx = i;
      continue;
    }
    if (ele >= topEle) {
      topEle = ele;
      topIdx = i;
    } else if (topEle - ele >= DESCENT_TOLERANCE_M) {
      // Sustained descent ends the current climb candidate.
      tryClose();
      startIdx = i;
      topEle = ele;
      topIdx = i;
    }
  }
  tryClose();
  return climbs;
}

// Downsample a [lon,lat,ele?] geometry to at most `max` vertices, always keeping
// first and last. Keeps stored geometry small while preserving route shape.
export function downsampleGeometry<T>(geometry: T[], max: number): T[] {
  if (geometry.length <= max) return geometry;
  const step = (geometry.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    out.push(geometry[Math.round(i * step)]!);
  }
  return out;
}
