// Route-paspoort: eerlijke, echte feiten over een opgeslagen route.
//
// - Hellingsverdeling (vlak/stijgend/dalend km) komt deterministisch uit de
//   opgeslagen hoogtepunten + afstand.
// - Weer (wind, temperatuur, uv) komt live van Open-Meteo voor het startpunt
//   op de gekozen vertrektijd.
// - Omgeving (verkeerslichten, bos-aandeel) komt van OpenStreetMap via de
//   Overpass API. Het bos-aandeel is een indicatie (bemonsterde punten langs
//   de route), en wordt ook zo gelabeld.
//
// Honesty contract: elk blok is null wanneer de bron niet antwoordt — er wordt
// nooit iets verzonnen.

import type { RoutePathPoint } from "@workspace/db";

// ── Hellingsverdeling ────────────────────────────────────────────────────────

export type GradeSplit = {
  flatKm: number;
  upKm: number;
  downKm: number;
};

/** Deterministic split of the route into flat (±2%), climbing and descending kilometers. */
export function computeGradeSplit(
  profile: number[] | null | undefined,
  distanceKm: number | null | undefined,
): GradeSplit | null {
  if (!profile || profile.length < 2) return null;
  if (typeof distanceKm !== "number" || !(distanceKm > 0)) return null;
  const segKm = distanceKm / (profile.length - 1);
  const segM = segKm * 1000;
  let flat = 0;
  let up = 0;
  let down = 0;
  for (let i = 1; i < profile.length; i++) {
    const slopePct = ((profile[i] - profile[i - 1]) / segM) * 100;
    if (slopePct >= 2) up += segKm;
    else if (slopePct <= -2) down += segKm;
    else flat += segKm;
  }
  const round = (v: number) => Math.round(v * 10) / 10;
  return { flatKm: round(flat), upKm: round(up), downKm: round(down) };
}

// ── Wind helpers ─────────────────────────────────────────────────────────────

const WIND_DIRECTIONS = [
  "noord",
  "noordoost",
  "oost",
  "zuidoost",
  "zuid",
  "zuidwest",
  "west",
  "noordwest",
] as const;

/** Meteorologische graden (waar de wind vandaan komt) → Nederlandse windrichting. */
export function windDirectionLabel(deg: number | null): string | null {
  if (deg == null || !Number.isFinite(deg)) return null;
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return WIND_DIRECTIONS[idx];
}

/** Windsnelheid (km/u) → Beaufort. */
export function beaufort(kmh: number | null): number | null {
  if (kmh == null || !Number.isFinite(kmh) || kmh < 0) return null;
  const bounds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
  for (let b = 0; b < bounds.length; b++) {
    if (kmh < bounds[b]) return b;
  }
  return 12;
}

// ── Omgeving via Overpass (OpenStreetMap) ────────────────────────────────────

export type RouteEnvironment = {
  trafficLights: number | null;
  forestSharePct: number | null; // indicatie op basis van bemonsterde punten
};

// Only this fixed host is ever contacted (no user-controlled URLs).
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = 12_000;

// Environment facts are near-static → cache per route geometry for 6 hours.
const ENV_CACHE = new Map<string, { at: number; data: RouteEnvironment }>();
const ENV_CACHE_TTL_MS = 6 * 60 * 60_000;

function haversineM(a: RoutePathPoint, b: RoutePathPoint): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Evenly sample the geometry down to at most `max` points. */
export function samplePath(
  geometry: RoutePathPoint[],
  max: number,
): RoutePathPoint[] {
  if (geometry.length <= max) return geometry;
  const out: RoutePathPoint[] = [];
  const step = (geometry.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    out.push(geometry[Math.round(i * step)]);
  }
  return out;
}

type OverpassElement = {
  type: string;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  geometry?: { lat: number; lon: number }[];
};

/**
 * Fetch traffic lights along the route and an indicative forest share from
 * OpenStreetMap. Returns null on any upstream failure (honest gap).
 */
export async function getRouteEnvironment(
  geometry: RoutePathPoint[] | null | undefined,
): Promise<RouteEnvironment | null> {
  if (!geometry || geometry.length < 2) return null;

  // Dense local samples along the route for the proximity checks.
  const sampled = samplePath(geometry, 120);
  const key = samplePath(geometry, 30)
    .map(([la, lo]) => `${la.toFixed(3)},${lo.toFixed(3)}`)
    .join(";");
  const hit = ENV_CACHE.get(key);
  if (hit && Date.now() - hit.at < ENV_CACHE_TTL_MS) return hit.data;

  // Around-linestring queries time out on Overpass; a bounding-box query is
  // cheap and reliable. We fetch everything in the route's bbox (padded) and
  // filter locally by real distance to the route.
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [la, lo] of sampled) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (lo < minLon) minLon = lo;
    if (lo > maxLon) maxLon = lo;
  }
  const pad = 0.003; // ~300m
  // Very large areas would make the bbox query heavy AND meaningless — be
  // honest and skip instead of fetching half a province.
  if (maxLat - minLat > 1 || maxLon - minLon > 1.5) return null;
  const bbox = `${(minLat - pad).toFixed(4)},${(minLon - pad).toFixed(4)},${(maxLat + pad).toFixed(4)},${(maxLon + pad).toFixed(4)}`;

  const query = `[out:json][timeout:20];(
node["highway"="traffic_signals"](${bbox});
way["landuse"="forest"](${bbox});
way["natural"="wood"](${bbox});
);out geom 800;`;

  let elements: OverpassElement[];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), OVERPASS_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass rejects requests without an identifying User-Agent (406).
          "User-Agent": "Sparki/1.0 (cycling training app)",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as { elements?: OverpassElement[] };
    elements = Array.isArray(json.elements) ? json.elements : [];
  } catch {
    return null;
  }

  // Traffic lights actually ON the route: bbox nodes within ~35m of a sampled
  // route point (samples are dense enough for typical routes).
  const trafficLights = elements.filter(
    (e) =>
      e.type === "node" &&
      e.tags?.highway === "traffic_signals" &&
      e.lat != null &&
      e.lon != null &&
      sampled.some((p) => haversineM(p, [e.lat!, e.lon!]) < 35),
  ).length;

  // Forest share: fraction of sampled route points that lie within ~120m of a
  // forest/wood way vertex. An indication, honestly labelled as such.
  const forestPoints: RoutePathPoint[] = [];
  for (const e of elements) {
    if (e.type !== "way" || !Array.isArray(e.geometry)) continue;
    for (const g of e.geometry) forestPoints.push([g.lat, g.lon]);
  }
  let forestSharePct: number | null = null;
  if (forestPoints.length > 0) {
    let near = 0;
    for (const p of sampled) {
      if (forestPoints.some((f) => haversineM(p, f) < 120)) near++;
    }
    forestSharePct = Math.round((near / sampled.length) * 100);
  } else {
    // Query succeeded and found no forest at all → honestly 0%.
    forestSharePct = 0;
  }

  const data: RouteEnvironment = { trafficLights, forestSharePct };
  ENV_CACHE.set(key, { at: Date.now(), data });
  return data;
}
