// Minimal, dependency-free GPX parser. Extracts ONLY metadata we can compute
// honestly from the track points — distance (haversine), elevation gain, moving
// time window, point count, bounds. No estimated/faked power, HR, or calories.
//
// Returns null when the content has no parseable track points (caller marks the
// import "failed" rather than inventing values).

export type GpxSummary = {
  pointCount: number;
  distanceKm: number | null;
  elevationGainM: number | null;
  startTime: string | null;
  endTime: string | null;
  durationSec: number | null;
  trackName: string | null;
};

type TrackPoint = {
  lat: number;
  lon: number;
  ele: number | null;
  time: number | null;
};

function haversineKm(
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

// Extract raw track points from GPX content. Shared by parseGpx and
// parseGpxRoute so both read the same source of truth.
function extractTrackPoints(content: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  // Match each <trkpt ...> ... </trkpt> (or self-closing). Tolerant of attribute
  // ordering and whitespace; deliberately simple regex parsing (no XML dep).
  const trkptRe = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/gi;
  let m: RegExpExecArray | null;
  while ((m = trkptRe.exec(content)) !== null) {
    const attrs = m[1] ?? "";
    const inner = m[2] ?? "";
    const lat = Number(/\blat\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]);
    const lon = Number(/\blon\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleStr = /<ele>\s*([^<]+)<\/ele>/i.exec(inner)?.[1];
    const timeStr = /<time>\s*([^<]+)<\/time>/i.exec(inner)?.[1];
    const ele = eleStr != null ? Number(eleStr) : NaN;
    const t = timeStr != null ? Date.parse(timeStr.trim()) : NaN;
    points.push({
      lat,
      lon,
      ele: Number.isFinite(ele) ? ele : null,
      time: Number.isFinite(t) ? t : null,
    });
  }
  return points;
}

export function parseGpx(content: string): GpxSummary | null {
  const points = extractTrackPoints(content);

  if (points.length === 0) return null;

  let distanceKm = 0;
  let elevationGainM = 0;
  let prevEle: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    distanceKm += haversineKm(a.lat, a.lon, b.lat, b.lon);
  }
  for (const p of points) {
    if (p.ele == null) continue;
    if (prevEle != null && p.ele > prevEle) elevationGainM += p.ele - prevEle;
    prevEle = p.ele;
  }

  const times = points
    .map((p) => p.time)
    .filter((t): t is number => t != null);
  const startTime = times.length > 0 ? Math.min(...times) : null;
  const endTime = times.length > 0 ? Math.max(...times) : null;
  const hasElevation = points.some((p) => p.ele != null);

  const nameStr = /<name>\s*([^<]+)<\/name>/i.exec(content)?.[1]?.trim();

  return {
    pointCount: points.length,
    distanceKm: distanceKm > 0 ? Math.round(distanceKm * 100) / 100 : null,
    elevationGainM: hasElevation ? Math.round(elevationGainM) : null,
    startTime: startTime != null ? new Date(startTime).toISOString() : null,
    endTime: endTime != null ? new Date(endTime).toISOString() : null,
    durationSec:
      startTime != null && endTime != null
        ? Math.round((endTime - startTime) / 1000)
        : null,
    trackName: nameStr || null,
  };
}

// Route-specific parse: distance + elevation gain + a downsampled real
// elevation profile + detected climbs. Everything derived from real <ele>/
// <trkpt> data — no fabricated values. Turn-by-turn nav is NOT produced here
// (a bare GPX track has no turn semantics); callers leave nav null in v1.

export type GpxRouteClimb = {
  name: string;
  lengthKm: number;
  avgGradePct: number;
};

export type GpxRoute = {
  distanceKm: number | null;
  elevationGainM: number | null;
  profile: number[];
  climbs: GpxRouteClimb[];
  trackName: string | null;
};

const PROFILE_SAMPLES = 48;

export function parseGpxRoute(content: string): GpxRoute | null {
  const points = extractTrackPoints(content);
  if (points.length === 0) return null;

  // Cumulative distance per point.
  const cumKm: number[] = [0];
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    distanceKm += haversineKm(a.lat, a.lon, b.lat, b.lon);
    cumKm.push(distanceKm);
  }

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
  // Uses real metres; the UI normalizes against the max.
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
    trackName: /<name>\s*([^<]+)<\/name>/i.exec(content)?.[1]?.trim() || null,
  };
}

// Detect sustained climbs: contiguous stretches of net ascent. Small dips are
// tolerated; a stretch qualifies as a climb when it gains >= MIN_GAIN_M over
// >= MIN_LENGTH_KM at an average grade >= MIN_GRADE_PCT. Names are generic
// ("Klim 1", ...) because a GPX track carries no climb names.
function detectClimbs(
  points: TrackPoint[],
  cumKm: number[],
): GpxRouteClimb[] {
  const MIN_GAIN_M = 40;
  const MIN_LENGTH_KM = 0.6;
  const MIN_GRADE_PCT = 3;
  const DESCENT_TOLERANCE_M = 12;

  const climbs: GpxRouteClimb[] = [];
  let startIdx: number | null = null;
  let topEle = -Infinity;
  let topIdx = 0;

  const tryClose = (endIdx: number) => {
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
      tryClose(i);
      startIdx = i;
      topEle = ele;
      topIdx = i;
    }
  }
  tryClose(points.length - 1);
  return climbs;
}
