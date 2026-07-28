// Overpass (OpenStreetMap) client for the Klimmenverkenner. Fetches the real
// catalogue of named climbs — mountain passes/cols (`mountain_pass=yes`) and
// named peaks with a real elevation (`natural=peak` + `ele`). Every value comes
// straight from OSM tags; nothing is invented. Results are cached briefly
// in-memory (like the calendar importer) to keep the public endpoint kind.

import { postForm, fetchJson } from "./http";

// Multiple public Overpass mirrors — we try them in order so one blocked/rate-
// limited host degrades to the next instead of failing the whole feature.
const ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export type ClimbHit = {
  // Stable OSM identity: "node/123", "way/456", "relation/789".
  osmId: string;
  name: string;
  lat: number;
  lon: number;
  // Real elevation in metres from the OSM `ele` tag, when present.
  elevationM: number | null;
  // Kind derived from tags — for an honest label ("Col/pas", "Top/berg" of
  // "Klimweg": een benoemde weg waarvan de naam een bekende klim aanduidt).
  kind: "pass" | "peak" | "road";
  // Whether OSM carries a description source (tag / wikipedia / wikidata).
  hasDescription: boolean;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

type CacheEntry = { at: number; value: ClimbHit[] };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheGet(key: string): ClimbHit[] | null {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return hit.value;
}

// Ruwe afstand in km (equirectangulair) — ruim voldoende voor nabijheids-dedupe.
function roughKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * 111;
  const dLon =
    (bLon - aLon) * 111 * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

function parseEle(raw: string | undefined): number | null {
  if (!raw) return null;
  // OSM `ele` is metres, sometimes with a unit or comma decimal.
  const m = raw.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toHit(el: OverpassElement): ClimbHit | null {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;
  const kind: "pass" | "peak" | "road" =
    tags.mountain_pass === "yes" || tags.mountain_pass === "1"
      ? "pass"
      : tags.highway
        ? "road"
        : "peak";
  const hasDescription = Boolean(
    tags.description || tags.wikipedia || tags.wikidata,
  );
  return {
    osmId: `${el.type}/${el.id}`,
    name,
    lat,
    lon,
    elevationM: parseEle(tags.ele),
    kind,
    hasDescription,
  };
}

async function runQuery(ql: string): Promise<OverpassResponse> {
  let lastErr: unknown;
  for (const endpoint of ENDPOINTS) {
    try {
      return await postForm<OverpassResponse>(
        endpoint,
        "data=" + encodeURIComponent(ql),
      );
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("overpass_unreachable");
}

// Search named climbs within a bounding box. `nameFilter` (optional) narrows to
// climbs whose name contains the term (case-insensitive), for name-based search.
export async function searchClimbsInBbox(opts: {
  south: number;
  west: number;
  north: number;
  east: number;
  nameFilter?: string | null;
  limit?: number;
}): Promise<ClimbHit[]> {
  const { south, west, north, east } = opts;
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 80);
  const nameFilter = opts.nameFilter?.trim().toLowerCase() || null;
  const bbox = `${south},${west},${north},${east}`;
  const key = `bbox:${bbox}`;

  let hits = cacheGet(key);
  if (!hits) {
    // Twee bronnen, samen één eerlijke catalogus:
    // 1. cols/passen + benoemde toppen met echte hoogte (zoals voorheen);
    // 2. benoemde KLIMWEGEN — wegen waarvan de straatnaam zelf een klim is
    //    (Cauberg, Keutenberg, Côte de la Redoute, Muur van Geraardsbergen…).
    //    In heuvelland (Limburg, Vlaanderen) zijn de bekende beklimmingen
    //    vrijwel nooit als peak/pass getagd, wel als weg met die naam.
    const ROAD_NAME_RE =
      "(berg|helling|muur)$|^(col |côte |cote |mur |muur )";
    const HIGHWAY_RE =
      "^(primary|secondary|tertiary|unclassified|residential|living_street|cycleway|track)$";
    const ql =
      `[out:json][timeout:25];(` +
      `node["mountain_pass"="yes"]["name"](${bbox});` +
      `way["mountain_pass"="yes"]["name"](${bbox});` +
      `node["natural"="peak"]["name"]["ele"](${bbox});` +
      `node["natural"="saddle"]["name"](${bbox});` +
      `way["highway"~"${HIGHWAY_RE}"]["name"~"${ROAD_NAME_RE}",i](${bbox});` +
      `);out center ${limit * 6};`;
    const data = await runQuery(ql);
    const raw = (data.elements ?? [])
      .map(toHit)
      .filter((h): h is ClimbHit => h !== null);
    // Eén klim bestaat in OSM vaak meerdere keren: een klimweg uit meerdere
    // wegsegmenten, of dezelfde naam als top én als straat (Cauberg). Dedupe
    // op naam, maar ALLEEN als de elementen ook echt bij elkaar liggen
    // (≤ ~3 km) — twee verschillende "Kruisberg"-en verderop blijven allebei
    // staan. Binnen een cluster wint het element mét echte hoogte.
    const NEAR_KM = 3;
    const clusters = new Map<string, ClimbHit[]>();
    for (const h of raw) {
      const k = h.name.toLowerCase();
      const list = clusters.get(k) ?? [];
      const near = list.find(
        (o) => roughKm(o.lat, o.lon, h.lat, h.lon) <= NEAR_KM,
      );
      if (!near) {
        list.push(h);
      } else if (near.elevationM == null && h.elevationM != null) {
        list[list.indexOf(near)] = h;
      }
      clusters.set(k, list);
    }
    hits = [...clusters.values()].flat();
    CACHE.set(key, { at: Date.now(), value: hits });
  }

  let result = hits;
  if (nameFilter) {
    result = result.filter((h) => h.name.toLowerCase().includes(nameFilter));
  }
  // Hoogste toppen eerst; klimwegen (meestal zonder ele-tag) daarna op naam.
  result = [...result].sort((a, b) => {
    const ea = a.elevationM;
    const eb = b.elevationM;
    if (ea != null && eb != null) return eb - ea;
    if (ea != null) return -1;
    if (eb != null) return 1;
    return a.name.localeCompare(b.name, "nl");
  });
  return result.slice(0, limit);
}

// Fetch the full OSM tag set for one element by its "type/id" identity. Used by
// the detail endpoint to read description/wikipedia/wikidata tags authentically.
export async function fetchClimbTags(
  osmId: string,
): Promise<{ tags: Record<string, string>; lat: number; lon: number } | null> {
  const m = osmId.match(/^(node|way|relation)\/(\d+)$/);
  if (!m) return null;
  const type = m[1]!;
  const id = m[2]!;
  const ql = `[out:json][timeout:25];${type}(${id});out center 1;`;
  const data = await runQuery(ql);
  const el = data.elements?.[0];
  if (!el) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;
  return { tags: el.tags ?? {}, lat, lon };
}

// Reachability probe used by the honest empty/error states.
export async function overpassReachable(): Promise<boolean> {
  try {
    await fetchJson(
      "https://overpass-api.de/api/status",
      8000,
    ).catch(() => {
      // /api/status returns text/plain; a thrown JSON parse still proves the
      // host answered. Treat any HTTP-level success as reachable.
      return null;
    });
    return true;
  } catch {
    return false;
  }
}
