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
  // Kind derived from tags — for an honest label ("Col/pas" vs "Top/berg").
  kind: "pass" | "peak";
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
  const kind: "pass" | "peak" =
    tags.mountain_pass === "yes" || tags.mountain_pass === "1"
      ? "pass"
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
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 80);
  const nameFilter = opts.nameFilter?.trim().toLowerCase() || null;
  const bbox = `${south},${west},${north},${east}`;
  const key = `bbox:${bbox}`;

  let hits = cacheGet(key);
  if (!hits) {
    const ql =
      `[out:json][timeout:25];(` +
      `node["mountain_pass"="yes"]["name"](${bbox});` +
      `way["mountain_pass"="yes"]["name"](${bbox});` +
      `node["natural"="peak"]["name"]["ele"](${bbox});` +
      `);out center ${limit * 3};`;
    const data = await runQuery(ql);
    hits = (data.elements ?? [])
      .map(toHit)
      .filter((h): h is ClimbHit => h !== null);
    CACHE.set(key, { at: Date.now(), value: hits });
  }

  let result = hits;
  if (nameFilter) {
    result = result.filter((h) => h.name.toLowerCase().includes(nameFilter));
  }
  // Highest climbs first — the most notable named summits/passes lead.
  result = [...result].sort(
    (a, b) => (b.elevationM ?? 0) - (a.elevationM ?? 0),
  );
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
