import { getRoutingProvider } from "../route";
import type { SprintBoard, RoutePathPoint } from "@workspace/db";

// Bound the number of reverse-geocode calls per route so detection stays cheap
// and within provider rate limits. The route is sampled at roughly-even spacing.
const MAX_SAMPLES = 45;
const MIN_SAMPLE_SPACING_KM = 0.5;

type LatLon = { lat: number; lon: number };

function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Normalise a place label so "Nistelrode, Bernheze" and "Nistelrode" compare
// equal — we sprint for the town name, not the full address.
function placeKey(name: string): string {
  return name.split(",")[0]!.trim().toLowerCase();
}

// Pure transition detector: given ordered samples with a (possibly null) place
// name, return one board per NEW place name relative to the previous known one.
// The first known place is the start (not a sprint). Nulls are skipped.
// Deterministic and provider-free so it can be unit-tested directly.
export function boardsFromSamples(
  samples: { name: string | null; lat: number; lon: number; km: number }[],
): SprintBoard[] {
  const boards: SprintBoard[] = [];
  let prevKey: string | null = null;
  for (const s of samples) {
    if (!s.name) continue;
    const key = placeKey(s.name);
    if (prevKey === null) {
      prevKey = key;
      continue;
    }
    if (key !== prevKey) {
      boards.push({
        placeName: s.name.split(",")[0]!.trim(),
        lat: s.lat,
        lon: s.lon,
        km: Math.round(s.km * 10) / 10,
      });
      prevKey = key;
    }
  }
  return boards;
}

// Detect "bordjes" (town/village name signs) along a route by sampling the
// geometry and reverse-geocoding each sample. A new place name relative to the
// previous known one is a sprint board, located at that sample point.
//
// Honesty: numbers/places come straight from the routing provider. If reverse
// geocoding cannot run at all (no provider / all failures) we return
// available:false with no boards — the UI says it can't determine them now,
// rather than inventing towns.
export async function detectSprintBoards(
  geometry: RoutePathPoint[],
): Promise<{ boards: SprintBoard[]; available: boolean }> {
  if (!Array.isArray(geometry) || geometry.length < 2) {
    return { boards: [], available: true };
  }

  const path: LatLon[] = geometry.map(([lat, lon]) => ({ lat, lon }));
  const cum: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1]! + haversineKm(path[i - 1]!, path[i]!));
  }
  const totalKm = cum[cum.length - 1] ?? 0;
  if (totalKm <= 0) return { boards: [], available: true };

  // Choose sample indices at even km spacing, capped at MAX_SAMPLES.
  const spacingKm = Math.max(MIN_SAMPLE_SPACING_KM, totalKm / MAX_SAMPLES);
  const sampleIdx: number[] = [];
  let nextKm = 0;
  for (let i = 0; i < path.length; i++) {
    if (cum[i]! >= nextKm) {
      sampleIdx.push(i);
      nextKm += spacingKm;
      if (sampleIdx.length >= MAX_SAMPLES) break;
    }
  }
  if (sampleIdx[sampleIdx.length - 1] !== path.length - 1) {
    sampleIdx.push(path.length - 1);
  }

  const provider = getRoutingProvider();
  if (!provider || typeof provider.reverseGeocode !== "function") {
    return { boards: [], available: false };
  }

  const samples: { name: string | null; lat: number; lon: number; km: number }[] =
    [];
  let anySuccess = false;

  for (const idx of sampleIdx) {
    const pt = path[idx]!;
    let name: string | null = null;
    try {
      name = await provider.reverseGeocode(pt);
    } catch {
      name = null;
    }
    if (name) anySuccess = true;
    samples.push({ name, lat: pt.lat, lon: pt.lon, km: cum[idx] ?? 0 });
  }

  // Never fabricate: if not a single geocode succeeded, say it's unavailable.
  if (!anySuccess) return { boards: [], available: false };
  return { boards: boardsFromSamples(samples), available: true };
}
