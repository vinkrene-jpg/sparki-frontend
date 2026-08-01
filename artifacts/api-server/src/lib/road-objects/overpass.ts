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

// ROUTE_OVERPASS_STABILITEIT_01: alle Overpass-verkeer loopt via de gedeelde
// client (serieel, mirror-gezondheid, persistente cache, budget, meting).
import { runOverpassQuery } from "../overpass/client";

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
// niet vaker dan eens per 6 uur opnieuw bij OSM opgehaald. Naast de exacte
// sleutel telt ook OMVATTING: is een corridor volledig gedekt door een eerder
// (vers) gesynct groter gebied — bv. de achtergrond-warm-up rond de
// woonlocatie — dan is de database daar al actueel en slaan we de netwerkstap
// over. Zo blijft het interactieve pad binnen zijn tijdbudget.
const SYNCED = new Map<string, { at: number; bbox: BBox }>();
const SYNC_TTL_MS = 6 * 60 * 60_000;

export type BBox = { south: number; west: number; north: number; east: number };

/**
 * Is deze bbox al gedekt door een verse sync — exact dezelfde sleutel of
 * volledig omvat door een eerder gesynct (groter) gebied? Ruimt verlopen
 * entries meteen op.
 */
function isBboxSynced(bbox: BBox, exactKey: string): boolean {
  const now = Date.now();
  const exact = SYNCED.get(exactKey);
  if (exact && now - exact.at < SYNC_TTL_MS) return true;
  for (const [k, entry] of SYNCED) {
    if (now - entry.at >= SYNC_TTL_MS) {
      SYNCED.delete(k);
      continue;
    }
    const b = entry.bbox;
    if (
      bbox.south >= b.south &&
      bbox.north <= b.north &&
      bbox.west >= b.west &&
      bbox.east <= b.east
    )
      return true;
  }
  return false;
}

/** Alleen-lezen variant voor logging/metrics: dekt een verse sync deze bbox? */
export function isRoadObjectsCorridorSynced(bbox: BBox): boolean {
  const key = [bbox.south, bbox.west, bbox.north, bbox.east]
    .map((v) => v.toFixed(3))
    .join(",");
  return isBboxSynced(bbox, key);
}

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

// Beleefde herkansing bij intermitterende burst-rate-limits (zie
// lib/route-remarks.ts): één extra ronde na een ruime pauze, kleine pauze
// tussen mirrors. Na twee mislukte rondes blijft het antwoord eerlijk null.
async function runQuery(ql: string): Promise<OverpassElement[] | null> {
  const answer = await runOverpassQuery(ql, { timeoutMs: OVERPASS_TIMEOUT_MS });
  return answer ? (answer.elements as OverpassElement[]) : null;
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
  if (isBboxSynced(bbox, key)) return 0;

  const bboxStr = `${bbox.south.toFixed(4)},${bbox.west.toFixed(4)},${bbox.north.toFixed(4)},${bbox.east.toFixed(4)}`;
  // Compacte unie (uitgebreide vormen geven 504 op stadsgrote bboxes):
  // verkeerslichten, spoorwegovergangen, rotondes (mini-rotonde-nodes én
  // rotonde-wegen via "out center") en snelheidsdrempels.
  const query = `[out:json][timeout:25];(
node["highway"="traffic_signals"](${bboxStr});
node["railway"="level_crossing"](${bboxStr});
node["highway"="mini_roundabout"](${bboxStr});
way["junction"="roundabout"](${bboxStr});
node["traffic_calming"~"^(bump|hump|table|cushion)$"](${bboxStr});
);out center 4000;`;

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
      tags.railway === "level_crossing"
        ? ("railway_crossing" as const)
        : tags.highway === "mini_roundabout" || tags.junction === "roundabout"
          ? ("roundabout" as const)
          : tags.traffic_calming != null
            ? ("speed_bump" as const)
            : ("traffic_signal" as const);
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
  SYNCED.set(key, { at: Date.now(), bbox });
  logger.info({ bbox: bboxStr, objects: objects.length }, "road-objects: OSM-sync klaar");
  return written;
}
