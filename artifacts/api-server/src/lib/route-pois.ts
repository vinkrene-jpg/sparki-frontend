// Bezienswaardigheden en horeca langs een opgeslagen route.
//
// Bron: OpenStreetMap via de Overpass API (vast host, bbox-query + lokale
// afstandsfilter — zie route-insight.ts voor waarom geen around-linestring).
// Honesty contract: bij een upstream-fout is het antwoord null (eerlijk gat),
// er wordt nooit een lijst verzonnen. Alleen benoemde punten (met een naam)
// worden getoond — een naamloos punt heeft de renner niets te vertellen.

import type { RoutePathPoint } from "@workspace/db";
import { samplePath } from "./route-insight";

export type RoutePoiCategory = "bezienswaardigheid" | "horeca" | "service";

export type RoutePoi = {
  id: string;
  name: string;
  kind: string; // Dutch label, e.g. "Uitzichtpunt", "Café"
  category: RoutePoiCategory;
  lat: number;
  lon: number;
  routeKm: number; // where along the route this POI sits
  offRouteM: number; // distance from the route line
  // Only for service POIs (bike shops): evaluated from real OSM opening_hours
  // at request time (Europe/Amsterdam). "unknown" = hours not on OSM or in a
  // pattern we can't evaluate — stated honestly, never guessed.
  openState?: "open" | "closed" | "unknown";
  openingHours?: string;
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = 15_000;
const NEAR_ROUTE_M = 250;

const POI_CACHE = new Map<string, { at: number; data: RoutePoi[] }>();
const POI_CACHE_TTL_MS = 6 * 60 * 60_000;

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

// ── Opening hours (honest evaluation) ──────────────────────────────────────
// Evaluates the common OSM opening_hours patterns ("Mo-Fr 09:00-18:00; Sa
// 10:00-17:00", "24/7", "Mo off") against Amsterdam local time. Anything we
// cannot parse with certainty returns null → shown as "unknown", never a
// fabricated "open".
const OH_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function amsterdamNow(now: Date): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").slice(0, 2); // "Mo".."Su" style: en-US gives "Mon" → "Mo"
  const hour = Number(get("hour")) % 24;
  return { day, minutes: hour * 60 + Number(get("minute")) };
}

function expandDays(spec: string): string[] | null {
  const out: string[] = [];
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^([A-Z][a-z])(?:-([A-Z][a-z]))?$/);
    if (!m) return null;
    const a = OH_DAYS.indexOf(m[1] as (typeof OH_DAYS)[number]);
    if (a < 0) return null;
    if (!m[2]) {
      out.push(OH_DAYS[a]!);
      continue;
    }
    const b = OH_DAYS.indexOf(m[2] as (typeof OH_DAYS)[number]);
    if (b < 0) return null;
    for (let i = a; ; i = (i + 1) % 7) {
      out.push(OH_DAYS[i]!);
      if (i === b) break;
    }
  }
  return out;
}

type OhRule = { days: string[]; off: boolean; spans: [number, number][] };

// Parses the whole value; null on anything we can't evaluate with certainty.
// skipped = rules referencing public/school holidays (we cannot know whether
// today is one) — their existence downgrades a "closed" verdict to unknown.
function parseOpeningHours(
  value: string,
): { rules: OhRule[]; skipped: boolean } | null {
  const rules: OhRule[] = [];
  let skipped = false;
  for (const ruleRaw of value.split(";")) {
    const rule = ruleRaw.trim();
    if (!rule) continue;
    if (/PH|SH/.test(rule)) {
      skipped = true;
      continue;
    }
    const m = rule.match(
      /^((?:[A-Z][a-z](?:-[A-Z][a-z])?)(?:,[A-Z][a-z](?:-[A-Z][a-z])?)*)?\s*(off|closed|(?:\d{2}:\d{2}-\d{2}:\d{2})(?:,\d{2}:\d{2}-\d{2}:\d{2})*)$/,
    );
    if (!m) return null;
    const days = m[1] ? expandDays(m[1]) : [...OH_DAYS];
    if (!days) return null;
    if (m[2] === "off" || m[2] === "closed") {
      rules.push({ days, off: true, spans: [] });
      continue;
    }
    const spans: [number, number][] = [];
    for (const span of m[2]!.split(",")) {
      const [from, to] = span.split("-");
      const [fh, fm] = from!.split(":").map(Number);
      const [th, tm] = to!.split(":").map(Number);
      const a = fh! * 60 + fm!;
      let b = th! * 60 + tm!;
      if (b <= a) b += 24 * 60; // crosses midnight into the next day
      spans.push([a, b]);
    }
    rules.push({ days, off: false, spans });
  }
  return { rules, skipped };
}

// Last matching rule wins for a day (OSM semantics: later rules override).
function ruleFor(rules: OhRule[], day: string): OhRule | null {
  let hit: OhRule | null = null;
  for (const r of rules) if (r.days.includes(day)) hit = r;
  return hit;
}

export function evaluateOpeningHours(
  raw: string | undefined,
  now: Date = new Date(),
): "open" | "closed" | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value === "24/7") return "open";

  const parsed = parseOpeningHours(value);
  if (!parsed) return null;
  const { rules, skipped } = parsed;

  const { day, minutes } = amsterdamNow(now);
  const today = ruleFor(rules, day);
  const dayIdx = OH_DAYS.indexOf(day as (typeof OH_DAYS)[number]);
  const yesterday = ruleFor(rules, OH_DAYS[(dayIdx + 6) % 7]!);

  // Open now if today's rule covers this minute…
  const openToday =
    !!today &&
    !today.off &&
    today.spans.some(([a, b]) => minutes >= a && minutes < b);
  // …or yesterday's rule ran past midnight into the early hours of today.
  const openOvernight =
    !!yesterday &&
    !yesterday.off &&
    yesterday.spans.some(([a, b]) => b > 24 * 60 && minutes + 24 * 60 < b && minutes + 24 * 60 >= a);
  if (openToday || openOvernight) return "open";

  // Closed only when provable: a holiday rule we had to skip means today
  // could still be an exception — say "unknown", never a false "closed".
  return skipped ? null : "closed";
}

type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
};

// Tag → Dutch label + category. Only kinds a rider actually cares about.
function classify(
  tags: Record<string, string>,
): { kind: string; category: RoutePoiCategory } | null {
  if (tags.amenity === "cafe") return { kind: "Café", category: "horeca" };
  if (tags.amenity === "restaurant") {
    // Italian restaurants get their own kind (own pasta icon on the map).
    // OSM cuisine can hold multiple values ("italian;pizza") — match honestly
    // on the real tag only, never guess from the name.
    const cuisine = (tags.cuisine ?? "").toLowerCase();
    if (/(^|;|\s)(italian|pasta|pizza)(;|\s|$)/.test(cuisine))
      return { kind: "Italiaans restaurant", category: "horeca" };
    return { kind: "Restaurant", category: "horeca" };
  }
  if (tags.tourism === "viewpoint")
    return { kind: "Uitzichtpunt", category: "bezienswaardigheid" };
  if (tags.tourism === "museum")
    return { kind: "Museum", category: "bezienswaardigheid" };
  if (tags.tourism === "attraction")
    return { kind: "Bezienswaardigheid", category: "bezienswaardigheid" };
  if (tags.tourism === "artwork")
    return { kind: "Kunstwerk", category: "bezienswaardigheid" };
  if (tags.historic === "castle")
    return { kind: "Kasteel", category: "bezienswaardigheid" };
  if (tags.historic === "monument" || tags.historic === "memorial")
    return { kind: "Monument", category: "bezienswaardigheid" };
  if (tags.historic === "ruins")
    return { kind: "Ruïne", category: "bezienswaardigheid" };
  if (tags.man_made === "windmill" || tags.man_made === "watermill")
    return { kind: "Molen", category: "bezienswaardigheid" };
  if (tags.shop === "bicycle")
    return { kind: "Fietsenwinkel", category: "service" };
  return null;
}

/**
 * Named sights + cafés/restaurants within ~250 m of the route line, with their
 * position along the route. Returns null on any upstream failure (honest gap).
 */
export async function getRoutePois(
  geometry: RoutePathPoint[] | null | undefined,
): Promise<RoutePoi[] | null> {
  if (!geometry || geometry.length < 2) return null;

  const key = samplePath(geometry, 30)
    .map(([la, lo]) => `${la.toFixed(3)},${lo.toFixed(3)}`)
    .join(";");
  const hit = POI_CACHE.get(key);
  if (hit && Date.now() - hit.at < POI_CACHE_TTL_MS)
    return withFreshOpenState(hit.data);

  const sampled = samplePath(geometry, 200);
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
  // Very large areas: skip honestly instead of fetching half a province.
  if (maxLat - minLat > 1 || maxLon - minLon > 1.5) return null;
  const pad = 0.003; // ~300m
  const bbox = `${(minLat - pad).toFixed(4)},${(minLon - pad).toFixed(4)},${(maxLat + pad).toFixed(4)},${(maxLon + pad).toFixed(4)}`;

  // Compact `nwr` clauses: the expanded node+way form times out (504) on
  // city-sized bboxes; nwr with a 25s budget returns within a few seconds.
  const query = `[out:json][timeout:25];(
nwr["tourism"~"^(viewpoint|museum|attraction|artwork)$"]["name"](${bbox});
nwr["historic"~"^(castle|monument|memorial|ruins)$"]["name"](${bbox});
nwr["man_made"~"^(windmill|watermill)$"]["name"](${bbox});
nwr["amenity"~"^(cafe|restaurant)$"]["name"](${bbox});
nwr["shop"="bicycle"]["name"](${bbox});
);out center 600;`;

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

  // Cumulative km along the full geometry for routeKm lookup.
  const cumKm: number[] = [0];
  for (let i = 1; i < geometry.length; i++) {
    cumKm.push(cumKm[i - 1]! + haversineM(geometry[i - 1]!, geometry[i]!) / 1000);
  }

  const out: RoutePoi[] = [];
  const seen = new Set<string>();
  for (const e of elements) {
    const tags = e.tags ?? {};
    const cls = classify(tags);
    const name = (tags.name ?? "").trim();
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!cls || !name || lat == null || lon == null) continue;
    // Strip any markup from OSM names before they ever reach a client.
    const cleanName = name.replace(/<[^>]*>/g, "").slice(0, 80);
    if (!cleanName) continue;

    let nearestIdx = 0;
    let nearestM = Number.POSITIVE_INFINITY;
    for (let i = 0; i < geometry.length; i++) {
      const d = haversineM([lat, lon], geometry[i]!);
      if (d < nearestM) {
        nearestM = d;
        nearestIdx = i;
      }
    }
    if (nearestM > NEAR_ROUTE_M) continue;

    const dedupe = `${cleanName.toLowerCase()}|${cls.kind}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    out.push({
      id: `${e.type}/${e.id}`,
      name: cleanName,
      kind: cls.kind,
      category: cls.category,
      lat,
      lon,
      routeKm: Math.round(cumKm[nearestIdx]! * 10) / 10,
      offRouteM: Math.round(nearestM),
      ...(cls.category === "service"
        ? {
            openingHours: (tags.opening_hours ?? "")
              .replace(/<[^>]*>/g, "")
              .slice(0, 120),
          }
        : {}),
    });
  }

  out.sort((a, b) => a.routeKm - b.routeKm);
  const capped = out.slice(0, 140);
  // Cache the raw list (incl. opening hours); openState is recomputed on
  // every read so a 6h-old cache entry never claims a shop is still open.
  POI_CACHE.set(key, { at: Date.now(), data: capped });
  return withFreshOpenState(capped);
}

// ── Onderweg-velden voor het nearby-corpus (taak: koffie/eten echt filteren) ──
//
// Eén gebiedsvraag (Overpass) voor benoemde cafés/restaurants rond het
// zoekcentrum; daarna wordt per route lokaal gematcht (≤250 m van de lijn).
// Bewust GÉÉN per-route Overpass-vraag: dat zou bursts geven (rate-limits) en
// koude caches. Eerlijkheidscontract:
//   true  = aantoonbaar een punt ≤250 m van de route binnen het dekkingsgebied
//   false = route ligt volledig binnen het dekkingsgebied en er is niets
//   null  = onbekend (Overpass-fout, gebied te groot, resultaat afgekapt of
//           route loopt deels buiten het dekkingsgebied) — nooit een stil "nee".

export type OnderwegVelden = { koffie: boolean | null; eten: boolean | null };

export type AreaEatery = { lat: number; lon: number; soort: "koffie" | "eten" };

export type EateryBbox = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

// Dekkingsgebied: de zoekcirkel zelf (zonder segmentmarge — die dient alleen
// de databankvoorselectie). Routes die deels buiten dit vak lopen krijgen bij
// "geen match" eerlijk null in plaats van false.
//
// Canoniek op 4 decimalen, NAAR BUITEN afgerond (min ⌊⌋, max ⌈⌉): query,
// cachesleutel én dekkingstoets gebruiken zo exact dezelfde grenzen. Zou de
// dekkingstoets ruimer zijn dan wat werkelijk bevraagd is, dan kon een route
// in de randstrook een vals "false" krijgen.
export function eateryBboxRond(
  center: { lat: number; lon: number },
  radiusKm: number,
): EateryBbox {
  const dLat = radiusKm / 111.19;
  const dLon = radiusKm / (111.19 * Math.cos((center.lat * Math.PI) / 180));
  const omlaag = (v: number) => Math.floor(v * 1e4) / 1e4;
  const omhoog = (v: number) => Math.ceil(v * 1e4) / 1e4;
  return {
    minLat: omlaag(center.lat - dLat),
    maxLat: omhoog(center.lat + dLat),
    minLon: omlaag(center.lon - dLon),
    maxLon: omhoog(center.lon + dLon),
  };
}

// Cachesleutel = exact dezelfde afronding als de Overpass-vraag zelf (4
// decimalen). Een verschoven bbox mag NOOIT de corpus van een ander gebied
// hergebruiken: dat zou een route "false" kunnen geven op basis van dekking
// die nooit bevraagd is. Exporteerbaar zodat de regressietest dit bewaakt.
export function eateryCacheKey(bbox: EateryBbox): string {
  return [bbox.minLat, bbox.minLon, bbox.maxLat, bbox.maxLon]
    .map((v) => v.toFixed(4))
    .join(",");
}

const EATERY_CACHE = new Map<string, { at: number; data: AreaEatery[] | null }>();
const EATERY_CACHE_TTL_MS = 6 * 60 * 60_000;
const EATERY_NULL_TTL_MS = 10 * 60_000;
// Boven dit aantal elementen is het antwoord mogelijk afgekapt door Overpass
// zelf → dekking niet bewijsbaar volledig → eerlijk null.
const EATERY_MAX_ELEMENTS = 4000;

/**
 * Benoemde cafés/restaurants in een gebied, via één Overpass-vraag (6h cache).
 * Retourneert null bij een upstream-fout, een te groot gebied of een mogelijk
 * afgekapt antwoord — eerlijk gat, nooit een halve lijst als "compleet".
 */
export async function getAreaEateries(
  bbox: EateryBbox,
): Promise<AreaEatery[] | null> {
  // Te groot gebied: eerlijk overslaan (zelfde principe als getRoutePois).
  if (bbox.maxLat - bbox.minLat > 1.2 || bbox.maxLon - bbox.minLon > 1.8) {
    return null;
  }
  const key = eateryCacheKey(bbox);
  const hit = EATERY_CACHE.get(key);
  if (hit) {
    // Echte data 6h vasthouden; een eerlijke null (upstream-hapering) maar
    // kort — anders verbergt één transiënte 504 de filters urenlang.
    const ttl = hit.data == null ? EATERY_NULL_TTL_MS : EATERY_CACHE_TTL_MS;
    if (Date.now() - hit.at < ttl) return hit.data;
  }

  const bboxStr = `${bbox.minLat.toFixed(4)},${bbox.minLon.toFixed(4)},${bbox.maxLat.toFixed(4)},${bbox.maxLon.toFixed(4)}`;
  const query = `[out:json][timeout:25];(
nwr["amenity"~"^(cafe|restaurant)$"]["name"](${bboxStr});
);out center ${EATERY_MAX_ELEMENTS};`;

  // Hoofdhost + mirror (zelfde patroon als het route-paspoort): een gebied van
  // deze omvang krijgt onder last soms een 504 van de hoofdhost, terwijl de
  // mirror gewoon antwoordt. Eén poging per host, nooit hameren.
  const hosts = [
    OVERPASS_URL,
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  let data: AreaEatery[] | null = null;
  for (const host of hosts) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), OVERPASS_TIMEOUT_MS + 5_000);
      let res: Response;
      try {
        res = await fetch(host, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Sparki/1.0 (cycling training app)",
            Accept: "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) continue;
      const json = (await res.json()) as {
        elements?: OverpassElement[];
        remark?: string;
      };
      // Overpass meldt onvolledige uitvoering (runtime-timeout, geheugen-
      // plafond) als `remark` in een verder gewone 200-JSON. Zo'n antwoord is
      // GEEN volledige dekking — false zou dan gelogen zijn ⇒ mirror proberen,
      // anders eerlijk null.
      if (typeof json.remark === "string" && json.remark.trim() !== "") continue;
      const elements = Array.isArray(json.elements) ? json.elements : [];
      if (elements.length >= EATERY_MAX_ELEMENTS) break; // mogelijk afgekapt ⇒ eerlijk null
      const pts: AreaEatery[] = [];
      for (const e of elements) {
        const tags = e.tags ?? {};
        const lat = e.lat ?? e.center?.lat;
        const lon = e.lon ?? e.center?.lon;
        if (lat == null || lon == null) continue;
        if (tags.amenity === "cafe") pts.push({ lat, lon, soort: "koffie" });
        else if (tags.amenity === "restaurant")
          pts.push({ lat, lon, soort: "eten" });
      }
      data = pts;
      break;
    } catch {
      // volgende host proberen; blijft het mis, dan eerlijk null
    }
  }
  // Ook een eerlijke null cachen: anders hamert elke kaartbeweging op een
  // haperende Overpass. 6h is dezelfde horizon als de POI-cache.
  EATERY_CACHE.set(key, { at: Date.now(), data });
  return data;
}

// Celgrootte voor de lokale ruimtelijke index (~550 m in latitude): één cel
// plus zijn 8 buren dekt ruim de 250 m-matchafstand.
const EATERY_CELL_DEG = 0.005;

function cellKey(lat: number, lon: number): string {
  return `${Math.floor(lat / EATERY_CELL_DEG)}|${Math.floor(lon / EATERY_CELL_DEG)}`;
}

// Exacte afstand van een punt tot een LIJNSEGMENT (niet alleen de hoekpunten):
// lokale equirectangulaire projectie rond het segment (ruim voldoende op deze
// schaal), projectie op het segment met geklemde t, dan euclidische afstand.
function distPuntTotSegmentM(
  p: RoutePathPoint,
  a: RoutePathPoint,
  b: RoutePathPoint,
): number {
  const kLat = 111_190; // m per graad latitude
  const kLon = 111_190 * Math.cos((a[0] * Math.PI) / 180);
  const ax = 0;
  const ay = 0;
  const bx = (b[1] - a[1]) * kLon;
  const by = (b[0] - a[0]) * kLat;
  const px = (p[1] - a[1]) * kLon;
  const py = (p[0] - a[0]) * kLat;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  const dx = px - (ax + t * bx);
  const dy = py - (ay + t * by);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Bepaal per route of er koffie/eten onderweg is (≤250 m van de LIJN, dus
 * segment-bewust: ook een punt naast het midden van een lang GPX-segment
 * telt). Puur en deterministisch; zie het eerlijkheidscontract bij
 * OnderwegVelden.
 */
export function onderwegVoorRoute(
  geometry: RoutePathPoint[],
  bbox: EateryBbox,
  eateries: AreaEatery[],
): OnderwegVelden {
  // Ruimtelijke index over de punten (eenmalig per aanroep is goedkoop genoeg
  // bij ≤250 routes; de index zelf domineert de kosten niet).
  const grid = new Map<string, AreaEatery[]>();
  for (const p of eateries) {
    const k = cellKey(p.lat, p.lon);
    const cel = grid.get(k);
    if (cel) cel.push(p);
    else grid.set(k, [p]);
  }

  // Dekking: elk hoekpunt binnen het bevraagde gebied?
  let volledigBinnen = true;
  for (const [la, lo] of geometry) {
    if (
      la < bbox.minLat ||
      la > bbox.maxLat ||
      lo < bbox.minLon ||
      lo > bbox.maxLon
    ) {
      volledigBinnen = false;
      break;
    }
  }

  // Match per SEGMENT: kandidaten komen uit rastercellen rond de segment-bbox
  // (+1 celrand ≈ 550 m > 250 m); de beslissing valt op de exacte punt-tot-
  // segment-afstand. Twee begrenzingen houden pathologische geometrieën (heel
  // lange, dun bemonsterde import-routes) goedkoop:
  //  1. de celrechthoek wordt geklemd op het bevraagde gebied — daarbuiten
  //     bestaan er per definitie geen kandidaten;
  //  2. is de (geklemde) rechthoek nog steeds groter dan het aantal BEZETTE
  //     cellen, dan itereren we de bezette cellen zelf.
  const bboxIMin = Math.floor(bbox.minLat / EATERY_CELL_DEG) - 1;
  const bboxIMax = Math.floor(bbox.maxLat / EATERY_CELL_DEG) + 1;
  const bboxJMin = Math.floor(bbox.minLon / EATERY_CELL_DEG) - 1;
  const bboxJMax = Math.floor(bbox.maxLon / EATERY_CELL_DEG) + 1;
  let koffie = false;
  let eten = false;
  for (let s = 1; s < geometry.length && !(koffie && eten); s++) {
    const a = geometry[s - 1]!;
    const b = geometry[s]!;
    const iMin = Math.max(bboxIMin, Math.floor(Math.min(a[0], b[0]) / EATERY_CELL_DEG) - 1);
    const iMax = Math.min(bboxIMax, Math.floor(Math.max(a[0], b[0]) / EATERY_CELL_DEG) + 1);
    const jMin = Math.max(bboxJMin, Math.floor(Math.min(a[1], b[1]) / EATERY_CELL_DEG) - 1);
    const jMax = Math.min(bboxJMax, Math.floor(Math.max(a[1], b[1]) / EATERY_CELL_DEG) + 1);
    if (iMin > iMax || jMin > jMax) continue; // segment raakt het gebied niet

    const proefCel = (cel: AreaEatery[]) => {
      for (const p of cel) {
        if (koffie && eten) return;
        if (p.soort === "koffie" ? koffie : eten) continue;
        if (distPuntTotSegmentM([p.lat, p.lon], a, b) <= NEAR_ROUTE_M) {
          if (p.soort === "koffie") koffie = true;
          else eten = true;
        }
      }
    };
    const rechthoek = (iMax - iMin + 1) * (jMax - jMin + 1);
    if (rechthoek > grid.size) {
      // Dun bezet raster: loop de bezette cellen langs in plaats van de
      // (mogelijk enorme) lege rechthoek.
      for (const [key, cel] of grid) {
        if (koffie && eten) break;
        const [ciStr, cjStr] = key.split("|");
        const ci = Number(ciStr);
        const cj = Number(cjStr);
        if (ci < iMin || ci > iMax || cj < jMin || cj > jMax) continue;
        proefCel(cel);
      }
    } else {
      for (let ci = iMin; ci <= iMax && !(koffie && eten); ci++) {
        for (let cj = jMin; cj <= jMax && !(koffie && eten); cj++) {
          const cel = grid.get(`${ci}|${cj}`);
          if (cel) proefCel(cel);
        }
      }
    }
  }

  return {
    koffie: koffie ? true : volledigBinnen ? false : null,
    eten: eten ? true : volledigBinnen ? false : null,
  };
}

// Service POIs (bike shops) are only useful when reachable: a shop we can
// PROVE is closed right now is dropped; hours we cannot evaluate are shown
// with an honest "unknown" so the rider can decide.
function withFreshOpenState(pois: RoutePoi[]): RoutePoi[] {
  const now = new Date();
  const out: RoutePoi[] = [];
  for (const p of pois) {
    if (p.category !== "service") {
      out.push(p);
      continue;
    }
    const state = evaluateOpeningHours(p.openingHours, now);
    if (state === "closed") continue;
    out.push({ ...p, openState: state ?? "unknown" });
  }
  return out;
}
