// Derived climb profile for the Klimmenverkenner. For a chosen summit we trace a
// real road route TO the top with the existing routing provider (ORS, elevation
// on) and derive length / average + steepest gradient / elevation gain / height
// profile from the returned points. Nothing is fabricated: if no sensible climb
// road can be traced (or no routing provider is configured), we return null and
// the caller honestly reports "profiel niet beschikbaar".

import { getRoutingProvider } from "../routing";
import type { RoadSegment } from "./overpass";
import { summarizeTrack } from "../gpx-parse";
import type { GeoPoint } from "../routing/types";

export type DerivedClimbProfile = {
  lengthKm: number;
  avgGradePct: number;
  maxGradePct: number;
  elevationGainM: number;
  // Downsampled elevation series (metres) for the profile chart.
  profile: number[];
  // De ECHTE lijn ([lat, lon]), licht gedownsampled — zodat de kaart de klim
  // kan tekenen. Nooit verzonnen. Bij `source: "trace"` is dit de getraceerde
  // route naar de top; bij `source: "way"` de echte weggeometrie zelf.
  points: [number, number][];
  // Honest note that these numbers are derived, not surveyed.
  derived: true;
  // Waar de lijn vandaan komt: een routetrace naar een top (pass/peak) of de
  // OSM-weggeometrie van de klimweg zelf (road).
  source: "trace" | "way";
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

const JOIN_TOLERANCE_KM = 0.03; // ~30 m: node-snap tolerance between segments.
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
          source: "trace",
        };
      }
    }
  }

  return best;
}

const ORS_ELEVATION_URL = "https://api.openrouteservice.org/elevation/line";

function samePoint(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): boolean {
  return haversineKm(a.lat, a.lon, b.lat, b.lon) <= JOIN_TOLERANCE_KM;
}

const MAX_ELEVATION_POINTS = 280;

async function elevationForLine(
  line: { lat: number; lon: number }[],
): Promise<GeoPoint[] | null> {
  const key = process.env.ORS_API_KEY;
  if (!key) return null;
  // Downsample to stay well within the API's point limit; endpoints kept.
  let sampled = line;
  if (line.length > MAX_ELEVATION_POINTS) {
    const step = (line.length - 1) / (MAX_ELEVATION_POINTS - 1);
    sampled = [];
    for (let i = 0; i < MAX_ELEVATION_POINTS; i++) {
      sampled.push(line[Math.min(Math.round(i * step), line.length - 1)]!);
    }
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);
  try {
    const res = await fetch(ORS_ELEVATION_URL, {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        format_in: "polyline",
        format_out: "polyline",
        geometry: sampled.map((p) => [p.lon, p.lat]),
      }),
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      geometry?: [number, number, number][];
    };
    const geom = data.geometry;
    if (!Array.isArray(geom) || geom.length < 2) return null;
    const points: GeoPoint[] = [];
    for (const entry of geom) {
      if (!Array.isArray(entry) || entry.length < 3) return null;
      const [lon, lat, ele] = entry;
      if (
        typeof lat !== "number" ||
        typeof lon !== "number" ||
        typeof ele !== "number"
      ) {
        return null;
      }
      points.push({ lat, lon, ele });
    }
    return points;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function deriveRoadClimbProfile(
  segments: RoadSegment[],
): Promise<DerivedClimbProfile | null> {
  const line = stitchSegments(segments);
  if (line.length < 4) return null;
  const lengthKm = segmentLengthKm(line);
  // A real climb road is at least a couple hundred metres; guard degenerates.
  if (lengthKm < 0.2 || lengthKm > 30) return null;

  let points = await elevationForLine(line);
  if (!points || points.length < 4) return null;

  // Orient the line UPHILL: a climb is ridden bottom → top. The geometry order
  // in OSM is arbitrary, so flip when the end is lower than the start.
  const first = points[0]!.ele;
  const last = points[points.length - 1]!.ele;
  if (first == null || last == null) return null;
  if (last < first) points = [...points].reverse();

  // The street name often extends past the actual climb (flat run-in through
  // the town, a stretch past the top). Trim to the sustained climbing stretch:
  // the sub-interval with the LARGEST net rise (max-subarray over elevation
  // deltas). Still 100% real geometry + elevation — just the climb itself.
  points = trimToClimb(points);
  if (points.length < 4) return null;

  const summary = summarizeTrack(points);
  const len = summary.distanceKm;
  const gain = summary.elevationGainM;
  if (len == null || gain == null || len <= 0) return null;
  // Net climb over the whole way — the honest "gemiddeld %" for a klimweg.
  const startEle = points[0]!.ele!;
  const endEle = points[points.length - 1]!.ele!;
  const netUpM = endEle - startEle;
  // Honesty guard: if the road barely climbs, there is no climb profile.
  if (netUpM < 10 && gain < 20) return null;

  const step = Math.max(1, Math.ceil(points.length / 200));
  const mapLine: [number, number][] = [];
  for (let i = 0; i < points.length; i += step) {
    mapLine.push([points[i]!.lat, points[i]!.lon]);
  }
  const tail = points[points.length - 1]!;
  const lastKept = mapLine[mapLine.length - 1];
  if (!lastKept || lastKept[0] !== tail.lat || lastKept[1] !== tail.lon) {
    mapLine.push([tail.lat, tail.lon]);
  }

  return {
    lengthKm: Math.round(len * 100) / 100,
    avgGradePct: Math.round((netUpM / (len * 1000)) * 100 * 10) / 10,
    maxGradePct: maxGradient(points),
    elevationGainM: Math.round(gain),
    profile: summary.profile,
    points: mapLine,
    derived: true,
    source: "way",
  };
}

function trimToClimb(points: GeoPoint[]): GeoPoint[] {
  let bestStart = 0;
  let bestEnd = points.length - 1;
  let bestRise = -Infinity;
  let curStart = 0;
  let curRise = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!.ele;
    const b = points[i]!.ele;
    if (a == null || b == null) continue;
    curRise += b - a;
    if (curRise > bestRise) {
      bestRise = curRise;
      bestStart = curStart;
      bestEnd = i;
    }
    if (curRise < 0) {
      curRise = 0;
      curStart = i;
    }
  }
  if (bestRise <= 0 || bestEnd - bestStart < 3) return points;
  return points.slice(bestStart, bestEnd + 1);
}

function segmentLengthKm(seg: { lat: number; lon: number }[]): number {
  let len = 0;
  for (let i = 1; i < seg.length; i++) {
    len += haversineKm(
      seg[i - 1]!.lat,
      seg[i - 1]!.lon,
      seg[i]!.lat,
      seg[i]!.lon,
    );
  }
  return len;
}

export function stitchSegments(
  segments: RoadSegment[],
): { lat: number; lon: number }[] {
  if (segments.length === 0) return [];
  let best: { lat: number; lon: number }[] = [];
  let bestLen = 0;
  // Try each segment as a seed; cheap because climb roads have few segments.
  for (let seed = 0; seed < segments.length; seed++) {
    const used = new Set<number>([seed]);
    let chain = [...segments[seed]!];
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        const seg = segments[i]!;
        const head = chain[0]!;
        const tail = chain[chain.length - 1]!;
        const segStart = seg[0]!;
        const segEnd = seg[seg.length - 1]!;
        if (samePoint(tail, segStart)) {
          chain = chain.concat(seg.slice(1));
        } else if (samePoint(tail, segEnd)) {
          chain = chain.concat([...seg].reverse().slice(1));
        } else if (samePoint(head, segEnd)) {
          chain = seg.slice(0, -1).concat(chain);
        } else if (samePoint(head, segStart)) {
          chain = [...seg].reverse().slice(0, -1).concat(chain);
        } else {
          continue;
        }
        used.add(i);
        extended = true;
      }
    }
    const len = segmentLengthKm(chain);
    if (len > bestLen) {
      bestLen = len;
      best = chain;
    }
  }
  return best;
}
