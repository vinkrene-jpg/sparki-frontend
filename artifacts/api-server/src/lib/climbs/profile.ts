// Derived climb profile for the Klimmenverkenner. For a chosen summit we trace a
// real road route TO the top with the existing routing provider (ORS, elevation
// on) and derive length / average + steepest gradient / elevation gain / height
// profile from the returned points. Nothing is fabricated: if no sensible climb
// road can be traced (or no routing provider is configured), we return null and
// the caller honestly reports "profiel niet beschikbaar".

import { getRoutingProvider } from "../routing";
import { summarizeTrack } from "../gpx-parse";
import type { GeoPoint } from "../routing/types";

export type DerivedClimbProfile = {
  lengthKm: number;
  avgGradePct: number;
  maxGradePct: number;
  elevationGainM: number;
  // Downsampled elevation series (metres) for the profile chart.
  profile: number[];
  // De ECHTE getraceerde routelijn naar de top ([lat, lon]), licht
  // gedownsampled — zodat de kaart de klim kan tekenen. Nooit verzonnen.
  points: [number, number][];
  // Honest note that these numbers are derived, not surveyed.
  derived: true;
};

const EARTH_KM = 6371;
const D2R = Math.PI / 180;

// Destination point given a start, bearing (deg) and distance (km).
function destination(
  lat: number,
  lon: number,
  bearingDeg: number,
  distKm: number,
): { lat: number; lon: number } {
  const br = bearingDeg * D2R;
  const dr = distKm / EARTH_KM;
  const lat1 = lat * D2R;
  const lon1 = lon * D2R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dr) +
      Math.cos(lat1) * Math.sin(dr) * Math.cos(br),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(dr) * Math.cos(lat1),
      Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: lat2 / D2R, lon: lon2 / D2R };
}

function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = (bLat - aLat) * D2R;
  const dLon = (bLon - aLon) * D2R;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * D2R) *
      Math.cos(bLat * D2R) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Steepest gradient over a rolling ~300 m window along the real points.
function maxGradient(points: GeoPoint[]): number {
  const WINDOW_M = 300;
  let cum = 0;
  const cumKm: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum += haversineKm(
      points[i - 1]!.lat,
      points[i - 1]!.lon,
      points[i]!.lat,
      points[i]!.lon,
    );
    cumKm.push(cum);
  }
  let max = 0;
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    const ei = points[i]!.ele;
    if (ei == null) continue;
    while (j < i && (cumKm[i]! - cumKm[j]!) * 1000 > WINDOW_M) j++;
    const ej = points[j]!.ele;
    if (ej == null) continue;
    const runM = (cumKm[i]! - cumKm[j]!) * 1000;
    if (runM < 50) continue;
    const grade = ((ei - ej) / runM) * 100;
    if (grade > max) max = grade;
  }
  return Math.round(max * 10) / 10;
}

// Try tracing a climb from several bearings/distances and keep the candidate
// whose traced route ends highest near the summit with a real sustained ascent.
export async function deriveClimbProfile(summit: {
  lat: number;
  lon: number;
  elevationM: number | null;
}): Promise<DerivedClimbProfile | null> {
  const provider = getRoutingProvider();
  if (!provider.isConfigured()) return null;

  const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
  const distances = [3, 6];

  let best: DerivedClimbProfile | null = null;
  let bestGain = 0;

  for (const distKm of distances) {
    for (const bearing of bearings) {
      const start = destination(summit.lat, summit.lon, bearing, distKm);
      let points: GeoPoint[];
      try {
        const result = await provider.routePointToPoint({
          start,
          end: { lat: summit.lat, lon: summit.lon },
          profile: "cycling-road",
        });
        points = result.points;
      } catch {
        continue;
      }
      if (points.length < 4) continue;

      const summary = summarizeTrack(points);
      const gain = summary.elevationGainM;
      const len = summary.distanceKm;
      if (gain == null || len == null || gain < 80 || len < 1) continue;

      // The route must actually finish near the summit — the end point should be
      // among the highest points, otherwise we traced a road that misses the top.
      const eles = points
        .map((p) => p.ele)
        .filter((e): e is number => e != null);
      if (eles.length < 2) continue;
      const endEle = points[points.length - 1]!.ele;
      const maxEle = Math.max(...eles);
      if (endEle == null || endEle < maxEle - 40) continue;

      if (gain > bestGain) {
        bestGain = gain;
        // Downsample de echte lijn tot max ~200 punten voor de kaart.
        const step = Math.max(1, Math.ceil(points.length / 200));
        const line: [number, number][] = [];
        for (let i = 0; i < points.length; i += step) {
          line.push([points[i]!.lat, points[i]!.lon]);
        }
        const last = points[points.length - 1]!;
        const tail = line[line.length - 1];
        if (!tail || tail[0] !== last.lat || tail[1] !== last.lon) {
          line.push([last.lat, last.lon]);
        }
        best = {
          lengthKm: Math.round(len * 100) / 100,
          avgGradePct: Math.round((gain / (len * 1000)) * 100 * 10) / 10,
          maxGradePct: maxGradient(points),
          elevationGainM: Math.round(gain),
          profile: summary.profile,
          points: line,
          derived: true,
        };
      }
    }
  }

  return best;
}
