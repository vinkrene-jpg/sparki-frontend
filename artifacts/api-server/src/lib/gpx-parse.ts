// Minimal, dependency-free GPX parser. Extracts ONLY metadata we can compute
// honestly from the track points — distance (haversine), elevation gain, moving
// time window, point count, bounds. No estimated/faked power, HR, or calories.
//
// Returns null when the content has no parseable track points (caller marks the
// import "failed" rather than inventing values).

import {
  computeRouteStats,
  haversineKm,
  type GeoPoint,
  type RouteClimb,
} from "./route-geometry";

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
// elevation profile + detected climbs + the full geometry. Everything derived
// from real <ele>/<trkpt> data — no fabricated values. Turn-by-turn nav is NOT
// produced here (a bare GPX track has no turn semantics); callers leave nav null.

export type GpxRouteClimb = RouteClimb;

export type GpxRoute = {
  distanceKm: number | null;
  elevationGainM: number | null;
  profile: number[];
  climbs: GpxRouteClimb[];
  trackName: string | null;
  // Full path as [lon, lat, ele?] tuples so GPX routes can also be mapped.
  geometry: Array<[number, number] | [number, number, number]>;
};

export function parseGpxRoute(content: string): GpxRoute | null {
  const points = extractTrackPoints(content);
  if (points.length === 0) return null;

  const geoPoints: GeoPoint[] = points.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    ele: p.ele,
  }));
  const stats = computeRouteStats(geoPoints);

  const geometry: Array<[number, number] | [number, number, number]> =
    points.map((p) =>
      p.ele != null
        ? ([p.lon, p.lat, p.ele] as [number, number, number])
        : ([p.lon, p.lat] as [number, number]),
    );

  return {
    distanceKm: stats.distanceKm,
    elevationGainM: stats.elevationGainM,
    profile: stats.profile,
    climbs: stats.climbs,
    trackName: /<name>\s*([^<]+)<\/name>/i.exec(content)?.[1]?.trim() || null,
    geometry,
  };
}
