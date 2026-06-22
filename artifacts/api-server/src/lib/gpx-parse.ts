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

export function parseGpx(content: string): GpxSummary | null {
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
