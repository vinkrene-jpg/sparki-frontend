// GRB-verhardingslaag (alleen Vlaanderen): controlelaag bovenop OSM/GraphHopper.
//
// Bron: het Grootschalig Referentie Bestand Vlaanderen (GRB, "Basiskaart
// Vlaanderen") via de OGC API Features van Digitaal Vlaanderen, collectie
// Wegsegment. Per wegsegment (LIJN-geometrie, geen vlak zoals de BGT) is een
// verhardingsattribuut vastgelegd (`VERH`/`LBLVERH`: vaste verharding, losse
// verharding, zowel vaste en losse verharding) plus een morfologische
// wegklasse (`MORF`/`LBLMORF`, o.a. "aardeweg").
//
// Licentie (PO-04, getoetst 30-07-2026): Gratis open data licentie Vlaanderen
// v1.02 — commercieel gebruik toegestaan, naamvermelding VERPLICHT:
// "Bron: Grootschalig Referentie Bestand Vlaanderen, Digitaal Vlaanderen".
// Die bronvermelding zit in grbSource() en MOET zichtbaar blijven overal waar
// GRB-data gebruikt wordt.
//
// Rol: CONTROLELAAG, geen vervanging van de routemotor — het Vlaamse
// equivalent van de NL BGT-laag (lib/bgt-verharding.ts). Zelfde honesty
// contract:
// - Vlaanderen-specifiek: daarbuiten (ook Wallonië en Brussel — nog niet
//   getoetst) is het antwoord null (eerlijk "geen bron").
// - Upstream-fout of geen dekking: null per punt / null als geheel — er wordt
//   NOOIT een verharding verzonnen.
// - Alleen wegsegmenten met status "in gebruik" tellen mee.
//
// Verschil met de BGT: lijngeometrie ⇒ punt-op-lijn-matching (dichtstbijzijnd
// wegsegment binnen ~20 m) i.p.v. punt-in-polygoon.

import type { RoutePathPoint } from "@workspace/db";
import { pointInPolygon, type BgtVerdict } from "./bgt-verharding";

export type GrbVerdict = BgtVerdict; // zelfde oordeel-vocabulaire als de BGT

export type GrbPointVerdict = {
  verdict: GrbVerdict;
  // Letterlijke GRB-labels waarop het oordeel is gebaseerd.
  lblVerh: string;
  lblMorf: string | null;
};

// ── Deterministische mapping (puur, testbaar) ───────────────────────────────

/**
 * GRB `LBLVERH` (+ `LBLMORF` als verfijning) → verhardingsoordeel.
 * - "weg met vaste verharding" → verhard
 * - "weg met losse verharding" → onverhard bij een aardeweg, anders
 *   half_verhard (losse verharding = grind/steenslag e.d.)
 * - "weg met zowel vaste en losse verharding" → half_verhard (deels los)
 * - al het overige ("niet van toepassing", onbekend, leeg) → eerlijk null.
 */
export function mapGrbVerharding(
  lblVerh: string | null | undefined,
  lblMorf?: string | null,
): GrbVerdict | null {
  if (!lblVerh) return null;
  const v = lblVerh.trim().toLowerCase();
  if (v === "weg met vaste verharding") return "verhard";
  if (v === "weg met losse verharding") {
    const m = (lblMorf ?? "").trim().toLowerCase();
    return m === "aardeweg" ? "onverhard" : "half_verhard";
  }
  if (v === "weg met zowel vaste en losse verharding") return "half_verhard";
  return null; // "niet van toepassing" / onbekende labels: nooit raden
}

// ── Vlaanderen-check (het GRB bestaat alleen voor Vlaanderen) ───────────────

// Ruwe omtrek van Vlaanderen als [lon,lat]-ring, met het Brussels
// Hoofdstedelijk Gewest als gat (niet getoetst, geen GRB-dekking). Bewust
// grof: een grensgeval dat er nét binnen valt (randje Wallonië) krijgt hooguit
// lege GRB-tegels terug (eerlijk "geen dekking"), maar duidelijk
// niet-Vlaamse routes (Wallonië, Nederland, Frankrijk) worden hier geweerd.
const VLAANDEREN_OUTLINE: [number, number][] = [
  [2.54, 51.1], // kust bij De Panne (Franse grens)
  [3.2, 51.34], // kust bij Knokke
  [3.45, 51.25], // grens Zeeuws-Vlaanderen west
  [3.9, 51.22], // grens Zeeuws-Vlaanderen zuid
  [4.24, 51.38], // grens boven Antwerpen
  [4.78, 51.5], // Baarle / Noord-Brabant
  [5.1, 51.44], // Kempen
  [5.24, 51.28], // grens bij Lommel
  [5.57, 51.22], // grens bij Hamont
  [5.87, 51.15], // Maas noord (Kessenich)
  [5.8, 50.95], // Maas (Maasmechelen)
  [5.7, 50.75], // Riemst/Voeren-west (taalgrens oost)
  [5.4, 50.71], // taalgrens bij Tongeren
  [5.0, 50.72], // taalgrens bij Landen
  [4.64, 50.68], // taalgrens onder Leuven
  [4.2, 50.68], // taalgrens bij Halle
  [3.85, 50.7], // taalgrens bij Ronse
  [3.35, 50.66], // taalgrens bij Kortrijk/Moeskroen
  [2.98, 50.68], // taalgrens bij Mesen
  [2.8, 50.7], // Heuvelland (Franse grens)
  [2.55, 50.85], // Franse grens west
  [2.54, 51.1],
];

// Brussels Hoofdstedelijk Gewest: enclave binnen Vlaanderen, GEEN GRB-dekking
// en nog niet licentie-getoetst (UrbIS) — expliciet uitgesloten.
const BRUSSEL_HOLE: [number, number][] = [
  [4.24, 50.76],
  [4.48, 50.76],
  [4.48, 50.92],
  [4.24, 50.92],
  [4.24, 50.76],
];

export function pointInFlanders(p: RoutePathPoint): boolean {
  return pointInPolygon(p[0], p[1], [VLAANDEREN_OUTLINE, BRUSSEL_HOLE]);
}

/** Route "in Vlaanderen" = (vrijwel) alle punten binnen de omtrek. */
export function routeInFlanders(points: RoutePathPoint[]): boolean {
  if (points.length === 0) return false;
  let inside = 0;
  for (const p of points) if (pointInFlanders(p)) inside += 1;
  return inside / points.length >= 0.95;
}

// ── GRB-features → bruikbare wegsegmenten (puur, testbaar) ──────────────────

export type GrbWegsegment = {
  verdict: GrbVerdict;
  lblVerh: string;
  lblMorf: string | null;
  lines: RoutePathPoint[][]; // één of meer polylijnen ([lat,lon])
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
};

type GrbFeature = {
  properties?: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: unknown };
};

function toLatLonLine(coords: unknown): RoutePathPoint[] {
  if (!Array.isArray(coords)) return [];
  const out: RoutePathPoint[] = [];
  for (const c of coords) {
    if (
      Array.isArray(c) &&
      typeof c[0] === "number" &&
      typeof c[1] === "number"
    ) {
      out.push([c[1], c[0]]); // GeoJSON [lon,lat] → [lat,lon]
    }
  }
  return out;
}

/**
 * Filter + normaliseer GRB Wegsegment-features. Alleen segmenten met status
 * "in gebruik", een herkenbare verharding en een lijn-geometrie doen mee.
 */
export function parseWegsegmentFeatures(features: GrbFeature[]): GrbWegsegment[] {
  const out: GrbWegsegment[] = [];
  for (const f of features) {
    const props = f.properties ?? {};
    const status =
      typeof props["LBLSTATUS"] === "string" ? props["LBLSTATUS"] : null;
    if (status != null && status.trim().toLowerCase() !== "in gebruik") continue;
    const lblVerh =
      typeof props["LBLVERH"] === "string" ? props["LBLVERH"] : null;
    const lblMorf =
      typeof props["LBLMORF"] === "string" ? props["LBLMORF"] : null;
    const verdict = mapGrbVerharding(lblVerh, lblMorf);
    if (!verdict || !lblVerh) continue;
    const geom = f.geometry;
    let lines: RoutePathPoint[][] = [];
    if (geom?.type === "LineString") {
      const l = toLatLonLine(geom.coordinates);
      if (l.length >= 2) lines = [l];
    } else if (geom?.type === "MultiLineString" && Array.isArray(geom.coordinates)) {
      lines = (geom.coordinates as unknown[])
        .map(toLatLonLine)
        .filter((l) => l.length >= 2);
    }
    if (lines.length === 0) continue;
    const bbox = { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity };
    for (const line of lines) {
      for (const [la, lo] of line) {
        if (la < bbox.minLat) bbox.minLat = la;
        if (la > bbox.maxLat) bbox.maxLat = la;
        if (lo < bbox.minLon) bbox.minLon = lo;
        if (lo > bbox.maxLon) bbox.maxLon = lo;
      }
    }
    out.push({ verdict, lblVerh, lblMorf, lines, bbox });
  }
  return out;
}

// ── Punt-op-lijn-matching (puur, testbaar) ──────────────────────────────────

// Maximale afstand routepunt → wegsegment-as. Wegsegmenten zijn de as van de
// wegcorridor; 20 m dekt de halve wegbreedte + GPS-/geometrieruis, zonder een
// parallelweg verderop te grijpen.
const NEAR_SEGMENT_M = 20;

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

/** Afstand punt → polylijn in meters (punt-naar-segment, vlakke benadering). */
export function pointToLineM(p: RoutePathPoint, pts: RoutePathPoint[]): number {
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return haversineM(p, pts[0]!);
  const cos = Math.cos((p[0] * Math.PI) / 180);
  const px = p[1] * cos;
  const py = p[0];
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1]![1] * cos;
    const ay = pts[i - 1]![0];
    const bx = pts[i]![1] * cos;
    const by = pts[i]![0];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = haversineM(p, [cy, cx / cos]);
    if (d < best) best = d;
  }
  return best;
}

const PAD_DEG = 0.0004; // ≈ 25–45 m marge rond de segment-bbox

/**
 * Puur: zoek voor één punt het DICHTSTBIJZIJNDE wegsegment binnen 20 m.
 * Bij meerdere kandidaten wint de kleinste afstand (het segment waar je
 * daadwerkelijk op rijdt), nooit "eerste rij wint".
 */
export function verdictForPoint(
  p: RoutePathPoint,
  segments: GrbWegsegment[],
): GrbPointVerdict | null {
  let best: GrbWegsegment | null = null;
  let bestM = NEAR_SEGMENT_M;
  for (const s of segments) {
    if (
      p[0] < s.bbox.minLat - PAD_DEG || p[0] > s.bbox.maxLat + PAD_DEG ||
      p[1] < s.bbox.minLon - PAD_DEG || p[1] > s.bbox.maxLon + PAD_DEG
    )
      continue;
    for (const line of s.lines) {
      const d = pointToLineM(p, line);
      if (d < bestM) {
        bestM = d;
        best = s;
      }
    }
  }
  if (!best) return null;
  return { verdict: best.verdict, lblVerh: best.lblVerh, lblMorf: best.lblMorf };
}

// ── Ophaal per tegel + cache (zelfde patroon als de BGT-laag) ───────────────

const GRB_ITEMS_URL =
  "https://geo.api.vlaanderen.be/GRB/ogc/features/v1/collections/Wegsegment/items";
const GRB_TIMEOUT_MS = 15_000;
const PAGE_LIMIT = 1000;
const MAX_PAGES_PER_TILE = 4;

// Tegel ~450 m (zelfde maat als de BGT-laag): klein genoeg om per pagina
// compleet te zijn, groot genoeg om clusters punten in één call te dekken.
const TILE_DEG = 0.004;

const TILE_CACHE = new Map<string, { at: number; segments: GrbWegsegment[] | null }>();
const TILE_TTL_MS = 24 * 60 * 60_000; // GRB muteert traag; 24 h is ruim vers
const TILE_FAIL_TTL_MS = 10 * 60_000; // mislukte tegel kort onthouden
const TILE_CACHE_MAX = 600;

export function tileKeyFor(p: RoutePathPoint): string {
  return `${Math.floor(p[0] / TILE_DEG)}:${Math.floor(p[1] / TILE_DEG)}`;
}

async function fetchTile(key: string): Promise<GrbWegsegment[] | null> {
  const [ty, tx] = key.split(":").map(Number);
  if (!Number.isFinite(ty) || !Number.isFinite(tx)) return null;
  const minLat = ty! * TILE_DEG;
  const minLon = tx! * TILE_DEG;
  const bbox = `${minLon.toFixed(5)},${minLat.toFixed(5)},${(minLon + TILE_DEG).toFixed(5)},${(minLat + TILE_DEG).toFixed(5)}`;
  let url: string | null = `${GRB_ITEMS_URL}?bbox=${bbox}&limit=${PAGE_LIMIT}&f=application%2Fgeo%2Bjson`;
  const features: GrbFeature[] = [];
  try {
    for (let page = 0; page < MAX_PAGES_PER_TILE && url; page++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), GRB_TIMEOUT_MS);
      const resp = await fetch(url, {
        headers: { Accept: "application/geo+json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        features?: GrbFeature[];
        links?: { rel?: string; href?: string }[];
      };
      if (Array.isArray(json.features)) features.push(...json.features);
      const next = (json.links ?? []).find((l) => l.rel === "next")?.href;
      url = typeof next === "string" ? next : null;
    }
  } catch {
    return null; // eerlijk gat — nooit een lege set als "alles verhard" laten lezen
  }
  return parseWegsegmentFeatures(features);
}

function cacheTile(key: string, segments: GrbWegsegment[] | null) {
  TILE_CACHE.set(key, { at: Date.now(), segments });
  if (TILE_CACHE.size > TILE_CACHE_MAX) {
    const oldest = [...TILE_CACHE.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) TILE_CACHE.delete(oldest[0]);
  }
}

async function loadTilesFor(
  points: RoutePathPoint[],
  maxTiles: number,
): Promise<Map<string, GrbWegsegment[] | null>> {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const p of points) {
    const k = tileKeyFor(p);
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  const out = new Map<string, GrbWegsegment[] | null>();
  const toFetch: string[] = [];
  const now = Date.now();
  for (const k of keys) {
    const hit = TILE_CACHE.get(k);
    if (
      hit &&
      now - hit.at < (hit.segments === null ? TILE_FAIL_TTL_MS : TILE_TTL_MS)
    ) {
      out.set(k, hit.segments);
    } else if (toFetch.length < maxTiles) {
      toFetch.push(k);
    }
    // Tegels boven het plafond: bewust niet in `out` — eerlijk onbeoordeeld.
  }
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
 * GRB-verhardingsoordeel per punt. Alleen voor routes in Vlaanderen;
 * daarbuiten null (eerlijk: geen bron). Per punt null wanneer het GRB er geen
 * wegsegment binnen 20 m kent, de tegel niet is opgehaald (plafond) of de
 * opvraag faalde.
 */
export async function grbVerdictsForPoints(
  points: RoutePathPoint[],
  opts?: { maxTiles?: number },
): Promise<(GrbPointVerdict | null)[] | null> {
  if (points.length === 0) return null;
  if (!routeInFlanders(points)) return null;
  const maxTiles = Math.max(1, Math.min(opts?.maxTiles ?? 40, 80));
  const tiles = await loadTilesFor(points, maxTiles);
  let anyTile = false;
  for (const v of tiles.values()) if (v !== null) anyTile = true;
  if (!anyTile) return null; // volledige upstream-fout: eerlijk gat
  return points.map((p) => {
    const segments = tiles.get(tileKeyFor(p));
    if (!segments) return null;
    return verdictForPoint(p, segments);
  });
}

// ── Selectiehulp voor loop-quality (racefiets-controlelaag) ─────────────────

const SELECTION_SAMPLES = 80;
const SELECTION_MAX_TILES = 24;

/**
 * Aandeel (0..1) van de bemonsterde routepunten dat volgens het GRB losse of
 * gemengde verharding heeft. null wanneer de route buiten Vlaanderen ligt, de
 * bron faalde of te weinig punten een oordeel kregen (<40% dekking) — dan mag
 * de selectie er niets mee doen (nooit gokken).
 */
export async function grbUnpavedShare(
  path: [number, number][],
): Promise<number | null> {
  if (!Array.isArray(path) || path.length < 2) return null;
  const step = Math.max(1, Math.floor(path.length / SELECTION_SAMPLES));
  const samples: RoutePathPoint[] = [];
  for (let i = 0; i < path.length; i += step) samples.push(path[i]!);
  const verdicts = await grbVerdictsForPoints(samples, {
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

// ── Bronvermelding (VERPLICHT bij elk gebruik van GRB-data) ─────────────────

export function grbSource() {
  return {
    name: "Bron: Grootschalig Referentie Bestand Vlaanderen, Digitaal Vlaanderen",
    license:
      "Gratis open data licentie Vlaanderen v1.02 — commercieel gebruik toegestaan, naamvermelding verplicht",
    url: "https://geo.api.vlaanderen.be/GRB/ogc/features/v1/collections/Wegsegment",
    note: "Alleen Vlaanderen; verharding per wegsegment (vaste/losse verharding), door Digitaal Vlaanderen onderhouden. Wallonië en Brussel vallen hier niet onder.",
  } as const;
}
