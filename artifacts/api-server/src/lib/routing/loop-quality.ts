// Loop quality — reduce the "small lusjes / same road twice" problem in
// generated round-trips.
//
// ORS `round_trip` returns ONE loop per (seed, points). On a sparse road network
// a single random loop often doubles back on itself or stitches together little
// repeated lusjes. We cannot change what a single ORS call returns, but we CAN
// ask ORS for several real candidates and keep the one that backtracks least.
// Every candidate is still 100% real ORS geometry — nothing here fabricates a
// path; it only *selects* among honest results (and honestly falls back to the
// only usable one when candidates are scarce).

import type { LoopRequest, RouteResult, RoutingProvider } from "./types";

// Grid cell for snapping coordinates so we can tell when a route re-uses the
// same stretch of road. ~0.0006° ≈ 55–65 m in the Netherlands — coarse enough
// to treat "there and back on the same road" as one shared edge, fine enough
// not to merge genuinely different parallel roads.
const CELL_DEG = 0.0006;

function cellKey(lat: number, lon: number): string {
  return `${Math.round(lat / CELL_DEG)}:${Math.round(lon / CELL_DEG)}`;
}

// Metres between two [lat, lon] points (haversine). Used to weight overlap by
// real distance rather than raw point count (ORS densifies geometry unevenly).
function segMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Fraction (0..1) of a route's length ridden over road segments the route uses
// more than once. 0 = every stretch is unique (a clean loop); higher = more
// out-and-back / repeated lusjes. Direction-agnostic: A→B and later B→A both
// map to the same undirected edge, so a there-and-back counts as overlap.
export function pathOverlapFraction(path: [number, number][]): number {
  if (path.length < 3) return 0;
  const edgeCount = new Map<string, number>();
  let total = 0;
  let repeated = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = segMeters(a, b);
    if (len <= 0) continue;
    total += len;
    const ka = cellKey(a[0], a[1]);
    const kb = cellKey(b[0], b[1]);
    if (ka === kb) continue; // movement within one cell — too small to judge
    const edge = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const seen = edgeCount.get(edge) ?? 0;
    if (seen >= 1) repeated += len;
    edgeCount.set(edge, seen + 1);
  }
  return total > 0 ? repeated / total : 0;
}

// Generate a varied loop: ask the provider for a handful of real candidates with
// distinct seeds and keep the one that backtracks least while staying closest to
// the requested distance. Falls back honestly to the only usable candidate when
// others fail; throws only when NONE succeed (same contract as generateLoop).
export async function generateVariedLoop(
  provider: RoutingProvider,
  req: LoopRequest,
  opts?: { candidates?: number },
): Promise<RouteResult> {
  const n = Math.min(Math.max(opts?.candidates ?? 3, 1), 5);
  const target = req.distanceKm;
  let best: RouteResult | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let lastErr: unknown = null;

  for (let i = 0; i < n; i++) {
    // Distinct, deterministic-when-seeded variants: a large prime step keeps the
    // ORS round-trip seeds well separated so candidates differ meaningfully.
    const seed =
      req.seed != null
        ? (req.seed + i * 7919) % 1_000_000
        : Math.floor(Math.random() * 1e6);
    let result: RouteResult;
    try {
      result = await provider.generateLoop({ ...req, seed });
    } catch (err) {
      lastErr = err;
      continue;
    }
    const overlap = pathOverlapFraction(result.path);
    // Penalise distance drift so we never pick a clean-looking loop that badly
    // misses the requested length. Overlap dominates; drift is a tie-breaker.
    const drift =
      target > 0 && result.distanceKm != null
        ? Math.abs(result.distanceKm - target) / target
        : 0;
    const score = overlap + drift * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = result;
    }
    // Good enough — a near-clean loop; no need to spend more ORS calls.
    if (overlap < 0.08) break;
  }

  if (!best) {
    throw lastErr instanceof Error
      ? lastErr
      : new Error("ORS leverde geen bruikbare route op");
  }
  return best;
}
