// Bezienswaardigheden en horeca langs een opgeslagen route.
//
// Bron: OpenStreetMap via de Overpass API (vast host, bbox-query + lokale
// afstandsfilter — zie route-insight.ts voor waarom geen around-linestring).
// Honesty contract: bij een upstream-fout is het antwoord null (eerlijk gat),
// er wordt nooit een lijst verzonnen. Alleen benoemde punten (met een naam)
// worden getoond — een naamloos punt heeft de renner niets te vertellen.

import type { RoutePathPoint } from "@workspace/db";
import { samplePath } from "./route-insight";

export type RoutePoiCategory = "bezienswaardigheid" | "horeca";

export type RoutePoi = {
  id: string;
  name: string;
  kind: string; // Dutch label, e.g. "Uitzichtpunt", "Café"
  category: RoutePoiCategory;
  lat: number;
  lon: number;
  routeKm: number; // where along the route this POI sits
  offRouteM: number; // distance from the route line
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
  if (tags.amenity === "restaurant")
    return { kind: "Restaurant", category: "horeca" };
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
  if (hit && Date.now() - hit.at < POI_CACHE_TTL_MS) return hit.data;

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

  const query = `[out:json][timeout:20];(
node["tourism"~"^(viewpoint|museum|attraction|artwork)$"]["name"](${bbox});
way["tourism"~"^(viewpoint|museum|attraction|artwork)$"]["name"](${bbox});
node["historic"~"^(castle|monument|memorial|ruins)$"]["name"](${bbox});
way["historic"~"^(castle|monument|memorial|ruins)$"]["name"](${bbox});
node["man_made"~"^(windmill|watermill)$"]["name"](${bbox});
way["man_made"~"^(windmill|watermill)$"]["name"](${bbox});
node["amenity"~"^(cafe|restaurant)$"]["name"](${bbox});
way["amenity"~"^(cafe|restaurant)$"]["name"](${bbox});
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
    });
  }

  out.sort((a, b) => a.routeKm - b.routeKm);
  const capped = out.slice(0, 120);
  POI_CACHE.set(key, { at: Date.now(), data: capped });
  return capped;
}
