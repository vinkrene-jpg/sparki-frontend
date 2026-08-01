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
import { runOverpassQuery } from "./overpass/client";

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
  // Aandeel van de route door bebouwd gebied (woonwijk/winkel/bedrijven) —
  // zelfde bemonsterde-punten-indicatie als het bos-aandeel.
  builtUpSharePct: number | null;
};

// ROUTE_OVERPASS_STABILITEIT_01: via de gedeelde client (vaste mirrorlijst —
// geen user-controlled URLs; serieel, mirror-gezondheid, persistente cache).
const OVERPASS_TIMEOUT_MS = 12_000;

// Environment facts are near-static → cache per route geometry for 6 hours.
const ENV_CACHE = new Map<string, { at: number; data: RouteEnvironment }>();
const ENV_CACHE_TTL_MS = 6 * 60 * 60_000;

type AreaBBox = { minLat: number; minLon: number; maxLat: number; maxLon: number };
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

  // Vers voorgewarmd gebied dat de hele route dekt? Dan lokaal uitrekenen —
  // zelfde classificatie, geen netwerk. Resultaat gaat ook in de route-cache.
  const padded: AreaBBox = {
    minLat: minLat - pad,
    minLon: minLon - pad,
    maxLat: maxLat + pad,
    maxLon: maxLon + pad,
  };
  const warm = findWarmAreaCovering(padded);
  if (warm) {
    const data = classifyEnvironment(sampled, elementsInBbox(warm.elements, padded));
    ENV_CACHE.set(key, { at: Date.now(), data });
    return data;
  }

  const bbox = `${padded.minLat.toFixed(4)},${padded.minLon.toFixed(4)},${padded.maxLat.toFixed(4)},${padded.maxLon.toFixed(4)}`;

  const query = `[out:json][timeout:20];(
node["highway"="traffic_signals"](${bbox});
way["landuse"="forest"](${bbox});
way["natural"="wood"](${bbox});
way["landuse"~"^(residential|retail|commercial)$"](${bbox});
);out geom 800;`;

  const answer = await runOverpassQuery(query, {
    timeoutMs: OVERPASS_TIMEOUT_MS,
  });
  if (!answer) return null;
  const elements = answer.elements as OverpassElement[];

  const data = classifyEnvironment(sampled, elements);
  ENV_CACHE.set(key, { at: Date.now(), data });
  return data;
}

/**
 * Deterministische classificatie van Overpass-elementen rond een route:
 * verkeerslichten op de route, bos- en bebouwingsaandeel. Gedeeld tussen het
 * directe pad (eigen bbox-query) en het warm-gebied-pad (voorgewarmde
 * elementen), zodat beide paden exact dezelfde meting geven.
 */
function classifyEnvironment(
  sampled: RoutePathPoint[],
  elements: OverpassElement[],
): RouteEnvironment {
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
  const builtUpPoints: RoutePathPoint[] = [];
  for (const e of elements) {
    if (e.type !== "way" || !Array.isArray(e.geometry)) continue;
    const landuse = e.tags?.landuse;
    const isBuiltUp =
      landuse === "residential" ||
      landuse === "retail" ||
      landuse === "commercial";
    const target = isBuiltUp ? builtUpPoints : forestPoints;
    for (const g of e.geometry) target.push([g.lat, g.lon]);
  }
  const shareOf = (pts: RoutePathPoint[]): number => {
    if (pts.length === 0) return 0; // query slaagde, niets gevonden → eerlijk 0%
    let near = 0;
    for (const p of sampled) {
      if (pts.some((f) => haversineM(p, f) < 120)) near++;
    }
    return Math.round((near / sampled.length) * 100);
  };
  const forestSharePct = shareOf(forestPoints);
  const builtUpSharePct = shareOf(builtUpPoints);

  return {
    trafficLights,
    forestSharePct,
    builtUpSharePct,
  };
}

type WarmArea = { at: number; bbox: AreaBBox; elements: OverpassElement[] };

const AREA_CACHE = new Map<string, WarmArea>();

const AREA_ELEMENT_CAP = 6000;

const AREA_CACHE_MAX = 60;

/**
 * Achtergrond-warm-up: haal de omgevings-elementen (verkeerslichten, bos,
 * bebouwing) voor een gebied rond `center` vooraf op en cache ze 6 uur.
 * `halfDeg` 0.09 ≈ 10 km — ruim genoeg voor lussen tot ~50–60 km vanaf het
 * startpunt. Retourneert true wanneer het gebied nu warm is (vers of zojuist
 * opgehaald). Eerlijk false bij een onbereikbare bron of een (mogelijk)
 * afgekapte elementenlijst — dan blijft het directe meetpad gewoon gelden.
 * Nooit aanroepen op het interactieve pad: dit mag seconden duren.
 */
export function warmRouteEnvironmentArea(
  center: { lat: number; lon: number },
  halfDeg = 0.09,
): Promise<boolean> {
  const areaKey = `${center.lat.toFixed(2)},${center.lon.toFixed(2)}|${halfDeg}`;
  const hit = AREA_CACHE.get(areaKey);
  if (hit && Date.now() - hit.at < AREA_CACHE_TTL_MS) return Promise.resolve(true);
  const inflight = AREA_INFLIGHT.get(areaKey);
  if (inflight) return inflight;

  const bbox: AreaBBox = {
    minLat: center.lat - halfDeg,
    minLon: center.lon - halfDeg * 1.6, // lon-graden zijn smaller op NL-breedte
    maxLat: center.lat + halfDeg,
    maxLon: center.lon + halfDeg * 1.6,
  };
  const bboxStr = `${bbox.minLat.toFixed(4)},${bbox.minLon.toFixed(4)},${bbox.maxLat.toFixed(4)},${bbox.maxLon.toFixed(4)}`;
  const query = `[out:json][timeout:45];(
node["highway"="traffic_signals"](${bboxStr});
way["landuse"="forest"](${bboxStr});
way["natural"="wood"](${bboxStr});
way["landuse"~"^(residential|retail|commercial)$"](${bboxStr});
);out geom ${AREA_ELEMENT_CAP};`;

  const run = (async (): Promise<boolean> => {
    try {
      const answer = await runOverpassQuery(query, { timeoutMs: 50_000 });
      if (!answer) return false;
      const elements = answer.elements as OverpassElement[];
      // Limiet geraakt = mogelijk afgekapt = onvolledige data. Eerlijk niet
      // opslaan; route-metingen in dit gebied meten dan gewoon zelf.
      if (elements.length >= AREA_ELEMENT_CAP) return false;
      if (AREA_CACHE.size >= AREA_CACHE_MAX) {
        // Oudste gebied ruimt op (insertion order ≈ oudste eerst na TTL-sweep).
        const oldest = AREA_CACHE.keys().next().value;
        if (oldest !== undefined) AREA_CACHE.delete(oldest);
      }
      AREA_CACHE.set(areaKey, { at: Date.now(), bbox, elements });
      return true;
    } catch {
      return false;
    } finally {
      AREA_INFLIGHT.delete(areaKey);
    }
  })();
  AREA_INFLIGHT.set(areaKey, run);
  return run;
}

const AREA_INFLIGHT = new Map<string, Promise<boolean>>();

const AREA_CACHE_TTL_MS = ENV_CACHE_TTL_MS;

function findWarmAreaCovering(bbox: AreaBBox): WarmArea | null {
  const now = Date.now();
  for (const [key, area] of AREA_CACHE) {
    if (now - area.at >= AREA_CACHE_TTL_MS) {
      AREA_CACHE.delete(key);
      continue;
    }
    const a = area.bbox;
    if (
      bbox.minLat >= a.minLat &&
      bbox.maxLat <= a.maxLat &&
      bbox.minLon >= a.minLon &&
      bbox.maxLon <= a.maxLon
    )
      return area;
  }
  return null;
}

/** Is er een vers warm gebied dat dit punt (met marge) dekt? Alleen meting. */
export function isEnvironmentAreaWarm(lat: number, lon: number): boolean {
  return (
    findWarmAreaCovering({
      minLat: lat - 0.001,
      minLon: lon - 0.001,
      maxLat: lat + 0.001,
      maxLon: lon + 0.001,
    }) !== null
  );
}

function elementsInBbox(
  elements: OverpassElement[],
  bbox: AreaBBox,
): OverpassElement[] {
  const inBox = (la: number, lo: number) =>
    la >= bbox.minLat && la <= bbox.maxLat && lo >= bbox.minLon && lo <= bbox.maxLon;
  return elements.filter((e) => {
    if (e.type === "node") return e.lat != null && e.lon != null && inBox(e.lat, e.lon);
    if (Array.isArray(e.geometry))
      return e.geometry.some((g) => inBox(g.lat, g.lon));
    return false;
  });
}
