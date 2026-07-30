// BGT-verhardingslaag (alleen Nederland): controlelaag bovenop OSM/GraphHopper.
//
// Bron: de Basisregistratie Grootschalige Topografie (BGT) via de PDOK OGC API
// (open data, CC0, door gemeentes onderhouden). Per "wegdeel" is de
// verhardingssoort (`fysiek_voorkomen`) landsdekkend vastgelegd:
// gesloten verharding (asfalt/beton), open verharding (klinkers/tegels),
// half verhard en onverhard.
//
// Rol: CONTROLELAAG, geen vervanging van de routemotor. Waar OSM de ondergrond
// niet kent, kan de BGT vaak wél een aantoonbaar oordeel geven; en waar de BGT
// zegt "onverhard" verliest een racefietskandidaat bij de selectie of komt er
// een eerlijke melding op de route.
//
// Honesty contract:
// - NL-specifiek: buiten Nederland is het antwoord null (eerlijk "geen bron").
// - Upstream-fout of geen dekking: null per punt / null als geheel — er wordt
//   NOOIT een verharding verzonnen.
// - Alleen actuele BGT-objecten tellen mee (historische versies met een
//   eind_registratie worden genegeerd).
//
// PDOK is gratis maar rate-limited: alle opvragingen lopen per tegel (~450 m)
// met een in-memory cache en een hard plafond per aanvraag.

import type { RoutePathPoint } from "@workspace/db";

export type BgtVerdict = "verhard" | "half_verhard" | "onverhard";

export type BgtPointVerdict = {
  verdict: BgtVerdict;
  // Letterlijke BGT-waarde waarop het oordeel is gebaseerd.
  fysiekVoorkomen: string;
};

// ── Deterministische mapping (puur, testbaar) ───────────────────────────────

/**
 * BGT `fysiek_voorkomen` → verhardingsoordeel. Onbekende of lege waarden zijn
 * eerlijk null (nooit raden). Waarden komen uit de IMGeo-codelijst
 * FysiekVoorkomenWeg; plus-detailleringen ("open verharding: betonstraatstenen")
 * beginnen met dezelfde hoofdcategorie.
 */
export function mapFysiekVoorkomen(value: string | null | undefined): BgtVerdict | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.startsWith("gesloten verharding")) return "verhard";
  if (v.startsWith("open verharding")) return "verhard";
  if (v.startsWith("half verhard") || v.startsWith("halfverhard")) return "half_verhard";
  if (v.startsWith("onverhard")) return "onverhard";
  // "transitie" (werk in uitvoering) en al het overige: eerlijk onbekend.
  return null;
}

// ── Nederland-check (de BGT bestaat alleen voor NL) ─────────────────────────

// Ruwe omtrek van Nederland (incl. Waddeneilanden en Zuid-Limburg) als
// [lon,lat]-ring. Bewust grof: een grensgeval dat er nét binnen valt krijgt
// hooguit lege BGT-tegels terug (eerlijk "geen dekking"), maar duidelijk
// buitenlandse routes (Vlaanderen, Ruhrgebied) worden hier al geweerd.
const NL_OUTLINE: [number, number][] = [
  [3.35, 51.25], // Zeeuws-Vlaanderen west
  [3.3, 51.6], // kust Zeeland
  [4.5, 53.0], // Noordzee
  [4.6, 53.6], // boven de Wadden west
  [6.9, 53.55], // boven Groningen
  [7.25, 53.3], // Duitse grens NO
  [7.1, 52.3], // Twente-oost
  [6.9, 51.9], // Achterhoek
  [6.05, 51.85], // grens bij Kleef
  [6.25, 51.5], // Noord-Limburg
  [6.2, 51.0], // Midden-Limburg
  [6.1, 50.73], // Zuid-Limburg (Aken)
  [5.6, 50.72], // Zuid-Limburg (Maastricht)
  [5.2, 51.28], // Belgische grens Kempen
  [4.9, 51.45], // Baarle
  [4.2, 51.4], // grens boven Antwerpen
  [3.9, 51.2], // Zeeuws-Vlaanderen zuid
  [3.35, 51.25],
];

export function pointInNetherlands(p: RoutePathPoint): boolean {
  return pointInRing(p[0], p[1], NL_OUTLINE);
}

/** Route "in Nederland" = (vrijwel) alle punten binnen de NL-bbox. */
export function routeInNetherlands(points: RoutePathPoint[]): boolean {
  if (points.length === 0) return false;
  let inside = 0;
  for (const p of points) if (pointInNetherlands(p)) inside += 1;
  return inside / points.length >= 0.95;
}

// ── Punt-in-polygoon (puur, testbaar) ───────────────────────────────────────

type Ring = [number, number][]; // GeoJSON [lon, lat]

/** Ray casting; ring is een GeoJSON-ring ([lon,lat]). */
export function pointInRing(lat: number, lon: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0], yi = ring[i]![1];
    const xj = ring[j]![0], yj = ring[j]![1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** GeoJSON Polygon (ring 0 = buitenrand, rest = gaten). */
export function pointInPolygon(lat: number, lon: number, rings: Ring[]): boolean {
  if (rings.length === 0 || !pointInRing(lat, lon, rings[0]!)) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lat, lon, rings[i]!)) return false;
  }
  return true;
}

// ── PDOK-features → bruikbare wegdelen (puur, testbaar) ─────────────────────

export type BgtWegdeel = {
  verdict: BgtVerdict;
  fysiekVoorkomen: string;
  functie: string | null;
  polygons: Ring[][]; // één of meer polygonen (MultiPolygon → meerdere)
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
};

type PdokFeature = {
  properties?: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: unknown };
};

function ringBbox(rings: Ring[][], into: BgtWegdeel["bbox"]) {
  for (const poly of rings) {
    for (const ring of poly) {
      for (const [lon, lat] of ring) {
        if (lat < into.minLat) into.minLat = lat;
        if (lat > into.maxLat) into.maxLat = lat;
        if (lon < into.minLon) into.minLon = lon;
        if (lon > into.maxLon) into.maxLon = lon;
      }
    }
  }
}

/**
 * Filter + normaliseer PDOK wegdeel-features. Alleen ACTUELE (geen
 * eind_registratie/termination_date, status "bestaand") wegdelen met een
 * herkenbare verharding en een polygon-geometrie doen mee.
 */
export function parseWegdeelFeatures(features: PdokFeature[]): BgtWegdeel[] {
  const out: BgtWegdeel[] = [];
  for (const f of features) {
    const props = f.properties ?? {};
    if (props["eind_registratie"] != null) continue; // historische versie
    if (props["termination_date"] != null) continue;
    const status = typeof props["status"] === "string" ? props["status"] : null;
    if (status != null && status !== "bestaand") continue;
    const fysiek =
      typeof props["fysiek_voorkomen"] === "string" ? props["fysiek_voorkomen"] : null;
    const verdict = mapFysiekVoorkomen(fysiek);
    if (!verdict || !fysiek) continue;
    const geom = f.geometry;
    let polygons: Ring[][] = [];
    if (geom?.type === "Polygon" && Array.isArray(geom.coordinates)) {
      polygons = [geom.coordinates as Ring[]];
    } else if (geom?.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
      polygons = geom.coordinates as Ring[][];
    }
    if (polygons.length === 0) continue;
    const bbox = { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity };
    ringBbox(polygons, bbox);
    out.push({
      verdict,
      fysiekVoorkomen: fysiek,
      functie: typeof props["functie"] === "string" ? props["functie"] : null,
      polygons,
      bbox,
    });
  }
  return out;
}

// Wegdeel-functies waar je daadwerkelijk overheen fietst. Een routepunt kan
// randgevallen hebben (naast de rijbaan op een voetpad-vlak); bij meerdere
// treffers wint een rijbaan/fietspad-vlak.
const RIDE_FUNCTIES = new Set([
  "rijbaan lokale weg",
  "rijbaan regionale weg",
  "rijbaan autoweg",
  "rijbaan autosnelweg",
  "fietspad",
  "woonerf",
  "ov-baan",
]);

/** Puur: zoek voor één punt het beste wegdeel-oordeel in een tegelset. */
export function verdictForPoint(
  p: RoutePathPoint,
  wegdelen: BgtWegdeel[],
): BgtPointVerdict | null {
  let fallback: BgtPointVerdict | null = null;
  for (const w of wegdelen) {
    if (
      p[0] < w.bbox.minLat || p[0] > w.bbox.maxLat ||
      p[1] < w.bbox.minLon || p[1] > w.bbox.maxLon
    )
      continue;
    let hit = false;
    for (const poly of w.polygons) {
      if (pointInPolygon(p[0], p[1], poly)) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    const v: BgtPointVerdict = { verdict: w.verdict, fysiekVoorkomen: w.fysiekVoorkomen };
    if (w.functie != null && RIDE_FUNCTIES.has(w.functie.toLowerCase())) return v;
    if (!fallback) fallback = v;
  }
  return fallback;
}

// ── PDOK-ophaal per tegel + cache (rate-limited bron) ───────────────────────

const PDOK_ITEMS_URL =
  "https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel/items";
const PDOK_TIMEOUT_MS = 15_000;
const PAGE_LIMIT = 1000;
const MAX_PAGES_PER_TILE = 4;

// Tegel ~450 m: klein genoeg om per pagina compleet te zijn, groot genoeg om
// clusters onbekende punten in één call te dekken.
const TILE_DEG = 0.004;

const TILE_CACHE = new Map<string, { at: number; wegdelen: BgtWegdeel[] | null }>();
const TILE_TTL_MS = 24 * 60 * 60_000; // BGT muteert traag; 24 h is ruim vers
const TILE_FAIL_TTL_MS = 10 * 60_000; // mislukte tegel kort onthouden (rate limit)
const TILE_CACHE_MAX = 600;

export function tileKeyFor(p: RoutePathPoint): string {
  return `${Math.floor(p[0] / TILE_DEG)}:${Math.floor(p[1] / TILE_DEG)}`;
}

async function fetchTile(key: string): Promise<BgtWegdeel[] | null> {
  const [ty, tx] = key.split(":").map(Number);
  if (!Number.isFinite(ty) || !Number.isFinite(tx)) return null;
  const minLat = ty! * TILE_DEG;
  const minLon = tx! * TILE_DEG;
  const bbox = `${minLon.toFixed(5)},${minLat.toFixed(5)},${(minLon + TILE_DEG).toFixed(5)},${(minLat + TILE_DEG).toFixed(5)}`;
  let url: string | null = `${PDOK_ITEMS_URL}?bbox=${bbox}&limit=${PAGE_LIMIT}&f=json`;
  const features: PdokFeature[] = [];
  try {
    for (let page = 0; page < MAX_PAGES_PER_TILE && url; page++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), PDOK_TIMEOUT_MS);
      const resp = await fetch(url, {
        headers: { Accept: "application/geo+json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        features?: PdokFeature[];
        links?: { rel?: string; href?: string }[];
      };
      if (Array.isArray(json.features)) features.push(...json.features);
      const next = (json.links ?? []).find((l) => l.rel === "next")?.href;
      url = typeof next === "string" ? next : null;
    }
  } catch {
    return null; // eerlijk gat — nooit een lege set als "alles verhard" laten lezen
  }
  return parseWegdeelFeatures(features);
}

function cacheTile(key: string, wegdelen: BgtWegdeel[] | null) {
  TILE_CACHE.set(key, { at: Date.now(), wegdelen });
  if (TILE_CACHE.size > TILE_CACHE_MAX) {
    const oldest = [...TILE_CACHE.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) TILE_CACHE.delete(oldest[0]);
  }
}

/**
 * Haal (met cache) de BGT-wegdelen op voor de tegels van de opgegeven punten.
 * `maxTiles` is het harde plafond aan verse PDOK-calls per aanvraag; tegels
 * daarbuiten blijven eerlijk onbeoordeeld (null per punt). Retourneert een map
 * tegel → wegdelen (null = ophalen mislukt).
 */
async function loadTilesFor(
  points: RoutePathPoint[],
  maxTiles: number,
): Promise<Map<string, BgtWegdeel[] | null>> {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const p of points) {
    const k = tileKeyFor(p);
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  const out = new Map<string, BgtWegdeel[] | null>();
  const toFetch: string[] = [];
  const now = Date.now();
  for (const k of keys) {
    const hit = TILE_CACHE.get(k);
    if (
      hit &&
      now - hit.at < (hit.wegdelen === null ? TILE_FAIL_TTL_MS : TILE_TTL_MS)
    ) {
      out.set(k, hit.wegdelen);
    } else if (toFetch.length < maxTiles) {
      toFetch.push(k);
    }
    // Tegels boven het plafond: bewust niet in `out` — eerlijk onbeoordeeld.
  }
  // Beperkte parallelliteit: PDOK is gratis maar rate-limited.
  const CONCURRENCY = 4;
  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((k) => fetchTile(k)));
    for (let j = 0; j < batch.length; j++) {
      cacheTile(batch[j]!, results[j]!);
      out.set(batch[j]!, results[j]!);
    }
  }
  return out;
}

/**
 * BGT-verhardingsoordeel per punt. Alleen voor routes in Nederland; daarbuiten
 * null (eerlijk: geen bron). Per punt null wanneer de BGT er geen actueel
 * wegdeel kent, de tegel niet is opgehaald (plafond) of de opvraag faalde.
 */
export async function bgtVerdictsForPoints(
  points: RoutePathPoint[],
  opts?: { maxTiles?: number },
): Promise<(BgtPointVerdict | null)[] | null> {
  if (points.length === 0) return null;
  if (!routeInNetherlands(points)) return null;
  const maxTiles = Math.max(1, Math.min(opts?.maxTiles ?? 40, 80));
  const tiles = await loadTilesFor(points, maxTiles);
  let anyTile = false;
  for (const v of tiles.values()) if (v !== null) anyTile = true;
  if (!anyTile) return null; // volledige upstream-fout: eerlijk gat
  return points.map((p) => {
    const wegdelen = tiles.get(tileKeyFor(p));
    if (!wegdelen) return null;
    return verdictForPoint(p, wegdelen);
  });
}

// ── Selectiehulp voor loop-quality (racefiets-controlelaag) ─────────────────

const SELECTION_SAMPLES = 80;
const SELECTION_MAX_TILES = 24;

/**
 * Aandeel (0..1) van de bemonsterde routepunten dat volgens de BGT half
 * verhard of onverhard is. null wanneer de route buiten NL ligt, de bron
 * faalde of te weinig punten een oordeel kregen (<40% dekking) — dan mag de
 * selectie er niets mee doen (nooit gokken).
 */
export async function bgtUnpavedShare(
  path: [number, number][],
): Promise<number | null> {
  if (!Array.isArray(path) || path.length < 2) return null;
  const step = Math.max(1, Math.floor(path.length / SELECTION_SAMPLES));
  const samples: RoutePathPoint[] = [];
  for (let i = 0; i < path.length; i += step) samples.push(path[i]!);
  const verdicts = await bgtVerdictsForPoints(samples, {
    maxTiles: SELECTION_MAX_TILES,
  });
  if (!verdicts) return null;
  let judged = 0;
  let unpaved = 0;
  for (const v of verdicts) {
    if (!v) continue;
    judged += 1;
    if (v.verdict !== "verhard") unpaved += 1;
  }
  if (judged / samples.length < 0.4) return null; // te dunne dekking
  return unpaved / judged;
}

// ── Bronvermelding ──────────────────────────────────────────────────────────

export function bgtSource() {
  return {
    name: "BGT — Basisregistratie Grootschalige Topografie (via PDOK)",
    license: "CC0 1.0 — open data van de Nederlandse overheid",
    url: "https://www.pdok.nl/introductie/-/article/basisregistratie-grootschalige-topografie-bgt-",
    note: "Alleen Nederland; verhardingssoort per wegvak, door gemeentes onderhouden.",
  } as const;
}
