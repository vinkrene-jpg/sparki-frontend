// Wegobjecten langs een route: positie langs de route, telling, dichtheid en
// verwacht tijdverlies. Puur op echte data uit de Sparki Traffic Database;
// het enige aannamedeel (verwacht tijdverlies) is expliciet gedocumenteerd en
// wordt ook zo aan de gebruiker gepresenteerd ("geschat").

import type { RoadObject, RoadObjectKind, RoutePathPoint } from "@workspace/db";
import { haversineM } from "./detect";
import { bboxAroundPath, syncOsmSignalsForBbox } from "./overpass";
import { effectiveConfidence, objectsInBbox } from "./store";

// Hoe dicht een object bij de routelijn moet liggen om "op de route" te zijn.
const NEAR_ROUTE_M: Record<string, number> = {
  traffic_signal: 40,
  railway_crossing: 60,
};

// Alleen objecten waar we redelijk zeker van zijn tellen mee in de navigatie.
const MIN_CONFIDENCE = 0.35;

// Geschat tijdverlies per verkeerslicht: gemiddeld stopt een fietser bij iets
// meer dan de helft van de lichten en wacht dan ~25 s. Dit is een expliciete
// aanname (P_STOP × AVG_WAIT), geen meetwaarde — de UI zegt daarom "geschat".
const P_STOP = 0.55;
const AVG_WAIT_SEC = 25;

export type RouteRoadObject = {
  id: number;
  kind: RoadObjectKind;
  lat: number;
  lon: number;
  roadName: string | null;
  source: string;
  confidence: number; // effectieve confidence op leesmoment
  confirmations: number;
  routeKm: number;
  offRouteM: number;
};

export type RouteRoadObjectsResult = {
  objects: RouteRoadObject[];
  totalKm: number | null;
  counts: Record<string, number>;
  signalsPerKm: number | null;
  // Geschat totaal tijdverlies door verkeerslichten (zie aanname hierboven).
  estimatedTimeLossSec: number | null;
  // Eerlijke bronstatus: is de OSM-laag voor deze corridor recent gesynct?
  osmSynced: boolean;
};

const RESULT_CACHE = new Map<string, { at: number; data: RouteRoadObjectsResult }>();
const RESULT_TTL_MS = 30 * 60_000;

function cacheKey(geometry: RoutePathPoint[]): string {
  const step = Math.max(1, Math.floor(geometry.length / 24));
  const parts: string[] = [];
  for (let i = 0; i < geometry.length; i += step) {
    const [la, lo] = geometry[i]!;
    parts.push(`${la.toFixed(3)},${lo.toFixed(3)}`);
  }
  return parts.join(";");
}

/**
 * Alle bekende wegobjecten langs een routegeometrie, gesorteerd op positie
 * langs de route. Synct eerst (gecachet, max 1×/6u per corridor) de OSM-laag
 * zodat de database de route dekt; een onbereikbare bron is een eerlijke
 * `osmSynced: false` terwijl bestaande databasekennis gewoon meetelt.
 */
export async function getRoadObjectsAlongRoute(
  geometry: RoutePathPoint[] | null | undefined,
  opts?: { kinds?: RoadObjectKind[]; skipOsmSync?: boolean },
): Promise<RouteRoadObjectsResult | null> {
  if (!geometry || geometry.length < 2) return null;
  const kinds = opts?.kinds ?? (["traffic_signal", "railway_crossing"] as RoadObjectKind[]);

  const key = `${kinds.join("+")}|${cacheKey(geometry)}`;
  const hit = RESULT_CACHE.get(key);
  if (hit && Date.now() - hit.at < RESULT_TTL_MS) return hit.data;

  const bbox = bboxAroundPath(geometry);
  if (!bbox) return null;

  let osmSynced = true;
  if (!opts?.skipOsmSync) {
    const synced = await syncOsmSignalsForBbox(bbox);
    osmSynced = synced !== null;
  }

  const raw = await objectsInBbox({ kinds, ...bbox });

  // Cumulatieve km langs de geometrie voor routeKm.
  const cumKm: number[] = [0];
  for (let i = 1; i < geometry.length; i++) {
    const [aLat, aLon] = geometry[i - 1]!;
    const [bLat, bLon] = geometry[i]!;
    cumKm.push(cumKm[i - 1]! + haversineM(aLat, aLon, bLat, bLon) / 1000);
  }
  const totalKm = cumKm[cumKm.length - 1]!;

  const now = new Date();
  // Dedupe per ~22 m-cel: een OSM-licht en een detectie-object op dezelfde
  // plek zijn hetzelfde fysieke object. Per cel wint expliciet de BESTE
  // kandidaat: hoogste effectieve confidence, bij gelijke stand kaart-/
  // handmatige bron boven pure detectie.
  const bestPerCell = new Map<string, RouteRoadObject>();
  const sourceRank = (s: string) => (s === "detection" ? 0 : 1);
  for (const o of raw) {
    const conf = effectiveConfidence(o, now);
    if (conf < MIN_CONFIDENCE) continue;
    let nearestIdx = 0;
    let nearestM = Number.POSITIVE_INFINITY;
    for (let i = 0; i < geometry.length; i++) {
      const [la, lo] = geometry[i]!;
      const d = haversineM(o.lat, o.lon, la, lo);
      if (d < nearestM) {
        nearestM = d;
        nearestIdx = i;
      }
    }
    if (nearestM > (NEAR_ROUTE_M[o.kind] ?? 40)) continue;

    const cell = `${o.kind}:${o.lat.toFixed(4).slice(0, -1)},${o.lon.toFixed(4).slice(0, -1)}`;
    const candidate: RouteRoadObject = {
      id: o.id,
      kind: o.kind as RoadObjectKind,
      lat: o.lat,
      lon: o.lon,
      roadName: o.roadName,
      source: o.source,
      confidence: conf,
      confirmations: o.confirmations,
      routeKm: Math.round(cumKm[nearestIdx]! * 100) / 100,
      offRouteM: Math.round(nearestM),
    };
    const cur = bestPerCell.get(cell);
    if (
      !cur ||
      candidate.confidence > cur.confidence ||
      (candidate.confidence === cur.confidence &&
        sourceRank(candidate.source) > sourceRank(cur.source))
    ) {
      bestPerCell.set(cell, candidate);
    }
  }
  const objects = [...bestPerCell.values()];
  objects.sort((a, b) => a.routeKm - b.routeKm || b.confidence - a.confidence);

  const counts: Record<string, number> = {};
  for (const o of objects) counts[o.kind] = (counts[o.kind] ?? 0) + 1;
  const signals = counts["traffic_signal"] ?? 0;

  const data: RouteRoadObjectsResult = {
    objects,
    totalKm: totalKm > 0 ? Math.round(totalKm * 10) / 10 : null,
    counts,
    signalsPerKm:
      totalKm > 0.5 ? Math.round((signals / totalKm) * 100) / 100 : null,
    estimatedTimeLossSec:
      signals > 0 ? Math.round(signals * P_STOP * AVG_WAIT_SEC) : signals === 0 ? 0 : null,
    osmSynced,
  };
  RESULT_CACHE.set(key, { at: Date.now(), data });
  return data;
}

/**
 * Navigatiehulp: afstand tot het eerstvolgende object en het resterende
 * aantal, gegeven de huidige positie langs de route (in km).
 */
export function nextObjectAhead(
  objects: RouteRoadObject[],
  progressKm: number,
  kind: RoadObjectKind = "traffic_signal",
): { distanceM: number; remaining: number } | null {
  const ahead = objects.filter((o) => o.kind === kind && o.routeKm >= progressKm - 0.02);
  if (ahead.length === 0) return null;
  const next = ahead[0]!;
  return {
    distanceM: Math.max(0, Math.round((next.routeKm - progressKm) * 1000)),
    remaining: ahead.length,
  };
}
