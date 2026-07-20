// Pure geo helpers for turn-by-turn navigation. No external deps, no fabricated
// data — everything is derived from the route's real geometry.

export type LatLon = { latitude: number; longitude: number };

const R = 6371000; // earth radius in metres

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Great-circle distance between two points, in metres. */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, in degrees (0 = north, clockwise). */
export function bearingDegrees(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Cumulative along-path distance (km) for each geometry point. Element 0 is 0.
 * `path` is [lat, lon][] as stored by the backend (RoutePathPoint).
 */
export function cumulativeKm(path: LatLon[]): number[] {
  const out: number[] = new Array(path.length);
  let acc = 0;
  for (let i = 0; i < path.length; i++) {
    if (i > 0) acc += haversineMeters(path[i - 1], path[i]) / 1000;
    out[i] = acc;
  }
  return out;
}

/** Index of the geometry point nearest to `p`, with its distance in metres. */
export function nearestPointIndex(
  path: LatLon[],
  p: LatLon,
): { index: number; distanceMeters: number } {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = haversineMeters(path[i], p);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { index: bestIdx, distanceMeters: bestDist };
}

/** Convert the backend [lat, lon] tuples into {latitude, longitude}. */
export function toLatLon(pair: [number, number]): LatLon {
  return { latitude: pair[0], longitude: pair[1] };
}
