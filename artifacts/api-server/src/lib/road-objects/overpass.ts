// OpenStreetMap-import voor de Sparki Traffic Database.
//
// Ontwikkelnotitie kaartprovider: de app gebruikt Mapbox uitsluitend als
// TEGEL-provider (achtergrondkaart) en openrouteservice voor routering. Geen
// van beide stelt verkeerslicht-objectdata beschikbaar via de gebruikte
// API's. Daarom komt de objectlaag uit OpenStreetMap (Overpass API):
// highway=traffic_signals en railway=level_crossing zijn daar landelijk en
// vrij (ODbL) beschikbaar.
//
// Dezelfde mirror-fallback en compacte querystijl als de Klimmenverkenner en
// route-POI's (uitgebreide queries geven 504 op stadsgrote bboxes). Bij een
// upstream-fout is het antwoord een eerlijke mislukking (null) — er wordt
// nooit een lijst verzonnen.

import type { RoutePathPoint } from "@workspace/db";
import { logger } from "../logger";
import { upsertOsmObjects, type OsmRoadObject } from "./store";

const ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 20_000;

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// Bbox-sync-cache: dezelfde corridor wordt tijdens een navigatie/route-sessie
// niet vaker dan eens per 6 uur opnieuw bij OSM opgehaald.
const SYNCED = new Map<string, number>();
const SYNC_TTL_MS = 6 * 60 * 60_000;

export type BBox = { south: number; west: number; north: number; east: number };

export function bboxAroundPath(
  geometry: RoutePathPoint[],
  padDeg = 0.003,
): BBox | null {
  if (!geometry || geometry.length < 2) return null;
  let s = Infinity,
    w = Infinity,
    n = -Infinity,
    e = -Infinity;
  for (const [la, lo] of geometry) {
    if (la < s) s = la;
    if (la > n) n = la;
    if (lo < w) w = lo;
    if (lo > e) e = lo;
  }
  // Te groot gebied: eerlijk overslaan i.p.v. een halve provincie downloaden.
  if (n - s > 1 || e - w > 1.5) return null;
  return { south: s - padDeg, west: w - padDeg, north: n + padDeg, east: e + padDeg };
}

async function runQuery(ql: string): Promise<OverpassElement[] | null> {
  for (const endpoint of ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), OVERPASS_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Sparki/1.0 (cycling training app)",
            Accept: "application/json",
          },
          body: `data=${encodeURIComponent(ql)}`,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return Array.isArray(json.elements) ? json.elements : [];
    } catch {
      // volgende mirror
    }
  }
  return null;
}

/**
 * Haal verkeerslichten (en spoorwegovergangen) binnen een bbox op bij OSM en
 * schrijf ze idempotent in de Sparki Traffic Database. Retourneert het aantal
 * verwerkte objecten of null bij een onbereikbare bron (eerlijk gat — de
 * database behoudt dan simpelweg de bestaande kennis).
 */
export async function syncOsmSignalsForBbox(bbox: BBox): Promise<number | null> {
  const key = [bbox.south, bbox.west, bbox.north, bbox.east]
    .map((v) => v.toFixed(3))
    .join(",");
  const at = SYNCED.get(key);
  if (at && Date.now() - at < SYNC_TTL_MS) return 0;

  const bboxStr = `${bbox.south.toFixed(4)},${bbox.west.toFixed(4)},${bbox.north.toFixed(4)},${bbox.east.toFixed(4)}`;
  const query = `[out:json][timeout:25];(
node["highway"="traffic_signals"](${bboxStr});
node["railway"="level_crossing"](${bboxStr});
);out 4000;`;

  const elements = await runQuery(query);
  if (elements === null) {
    logger.warn({ bbox: bboxStr }, "road-objects: Overpass onbereikbaar");
    return null;
  }

  const objects: OsmRoadObject[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const tags = el.tags ?? {};
    const kind =
      tags.railway === "level_crossing" ? ("railway_crossing" as const) : ("traffic_signal" as const);
    objects.push({
      kind,
      externalId: `${el.type}/${el.id}`,
      lat,
      lon,
      // Wegnaam/land alleen wanneer OSM ze echt op het object draagt.
      roadName: (tags.name ?? tags["addr:street"] ?? "").replace(/<[^>]*>/g, "").slice(0, 120) || null,
      country: (tags["addr:country"] ?? "").slice(0, 2).toUpperCase() || null,
    });
  }
  const written = await upsertOsmObjects(objects);
  SYNCED.set(key, Date.now());
  logger.info({ bbox: bboxStr, objects: objects.length }, "road-objects: OSM-sync klaar");
  return written;
}
