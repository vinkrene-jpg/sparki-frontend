// Opslag- en leerlaag van de Sparki Traffic Database.
//
// - upsertOsmObjects: schrijft echte OSM-objecten (bron "osm") idempotent weg.
// - recordStops: slaat ruwe stop-waarnemingen op (dedupe per renner+cel+rit)
//   en laat het systeem leren: herhaalde stops van meerdere renners op exact
//   dezelfde plek verhogen de confidence of promoveren tot een nieuw object.
// - effectiveConfidence: confidence daalt deterministisch met de tijd sinds
//   de laatste validatie — lazy op het leespad, dus nooit afhankelijk van een
//   cronjob die stilletjes kan wegvallen.

import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import {
  db,
  roadObjectsTable,
  roadObjectReportsTable,
  type RoadObject,
  type RoadObjectKind,
} from "@workspace/db";
import { logger } from "../logger";
import {
  cellKeyFor,
  classifyStop,
  findStops,
  haversineM,
  type DetectedStop,
  type TimedTrackPoint,
} from "./detect";

// Verval: 120 dagen respijt na de laatste validatie, daarna −0,004/dag.
// Ondergrens per bron: kaartbronnen en handmatige verificatie behouden een
// redelijke bodem, pure detectie zakt verder terug.
const DECAY_GRACE_DAYS = 120;
const DECAY_PER_DAY = 0.004;
const FLOOR_BY_SOURCE: Record<string, number> = {
  osm: 0.35,
  here: 0.35,
  tomtom: 0.35,
  manual: 0.3,
  detection: 0.05,
};

export function effectiveConfidence(obj: RoadObject, now = new Date()): number {
  const ageDays =
    (now.getTime() - new Date(obj.lastValidatedAt).getTime()) / 86_400_000;
  const over = Math.max(0, ageDays - DECAY_GRACE_DAYS);
  const floor = FLOOR_BY_SOURCE[obj.source] ?? 0.05;
  return Math.max(floor, Math.round((obj.confidence - over * DECAY_PER_DAY) * 100) / 100);
}

export type OsmRoadObject = {
  kind: RoadObjectKind;
  externalId: string; // "node/123"
  lat: number;
  lon: number;
  roadName: string | null;
  country: string | null;
};

/** Idempotente OSM-upsert: nieuw = insert, bestaand = her-validatie (+1). */
export async function upsertOsmObjects(objects: OsmRoadObject[]): Promise<number> {
  let written = 0;
  for (const o of objects) {
    const res = await db
      .insert(roadObjectsTable)
      .values({
        kind: o.kind,
        source: "osm",
        externalId: o.externalId,
        lat: o.lat,
        lon: o.lon,
        roadName: o.roadName,
        country: o.country,
        confidence: 0.9, // aanwezig op de actuele kaart — sterk maar geen 100%
        confirmations: 1,
      })
      .onConflictDoUpdate({
        target: [
          roadObjectsTable.kind,
          roadObjectsTable.source,
          roadObjectsTable.externalId,
        ],
        set: {
          lat: o.lat,
          lon: o.lon,
          roadName: o.roadName,
          country: o.country,
          confidence: 0.9,
          confirmations: sql`${roadObjectsTable.confirmations} + 1`,
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    written += res.rowCount ?? 0;
  }
  return written;
}

/** Objecten in een bbox (ruwe voorselectie; afstandsfilter doet de aanroeper). */
export async function objectsInBbox(opts: {
  kinds: RoadObjectKind[];
  south: number;
  west: number;
  north: number;
  east: number;
}): Promise<RoadObject[]> {
  return db
    .select()
    .from(roadObjectsTable)
    .where(
      and(
        inArray(roadObjectsTable.kind, opts.kinds),
        gte(roadObjectsTable.lat, opts.south),
        lte(roadObjectsTable.lat, opts.north),
        gte(roadObjectsTable.lon, opts.west),
        lte(roadObjectsTable.lon, opts.east),
      ),
    )
    .limit(2000);
}

// Leerdrempels: een detectie-object ontstaat pas bij herhaald echt stopgedrag
// — minstens 3 stops waarvan ≥ 2 verschillende renners, of ≥ 5 stops totaal.
const PROMOTE_MIN_REPORTS_MULTI_USER = 3;
const PROMOTE_MIN_DISTINCT_USERS = 2;
const PROMOTE_MIN_REPORTS_SINGLE_USER = 5;

export type StopIngestResult = {
  stops: DetectedStop[];
  reportsWritten: number;
  objectsConfirmed: number;
  objectsCreated: number;
};

/**
 * Verwerk de stops van één geüploade rit: waarnemingen opslaan (idempotent per
 * renner+cel+rit) en het zelflerende model bijwerken. Alleen stops ≤ 5 min
 * voeden het leren — langere stilstand is vrijwel zeker pauze.
 */
export async function recordStops(
  clerkId: string,
  activityExternalId: string,
  track: TimedTrackPoint[],
): Promise<StopIngestResult> {
  const rawStops = findStops(track);
  const result: StopIngestResult = {
    stops: [],
    reportsWritten: 0,
    objectsConfirmed: 0,
    objectsCreated: 0,
  };
  if (rawStops.length === 0) return result;

  for (const stop of rawStops) {
    // Context: bekende objecten vlakbij + eerdere waarnemingen in deze cel.
    const pad = 0.001; // ~110 m zoekruimte
    const nearby = await objectsInBbox({
      kinds: ["traffic_signal", "railway_crossing"],
      south: stop.lat - pad,
      west: stop.lon - pad,
      north: stop.lat + pad,
      east: stop.lon + pad,
    });
    const nearKnownSignal = nearby.some(
      (o) =>
        o.kind === "traffic_signal" &&
        haversineM(stop.lat, stop.lon, o.lat, o.lon) <= 40,
    );
    const nearKnownRailway = nearby.some(
      (o) =>
        o.kind === "railway_crossing" &&
        haversineM(stop.lat, stop.lon, o.lat, o.lon) <= 60,
    );

    const prior = await db
      .select({
        clerkId: roadObjectReportsTable.clerkId,
      })
      .from(roadObjectReportsTable)
      .where(eq(roadObjectReportsTable.cellKey, stop.cellKey));
    const distinctUsers = new Set(prior.map((r) => r.clerkId)).size;

    const candidates = classifyStop(stop.stopSec, {
      nearKnownSignal,
      nearKnownRailway,
      priorReports: prior.length,
      distinctUsers,
    });
    const top = candidates[0]!;
    result.stops.push({ ...stop, candidates });

    // Alleen infrastructuur-achtige stops voeden het leren.
    if (top.kind === "pause" || stop.stopSec > 300) continue;

    const inserted = await db
      .insert(roadObjectReportsTable)
      .values({
        clerkId,
        cellKey: stop.cellKey,
        lat: stop.lat,
        lon: stop.lon,
        stopSec: stop.stopSec,
        guessedKind: top.kind,
        confidence: top.confidence,
        activityExternalId,
      })
      .onConflictDoNothing({
        target: [
          roadObjectReportsTable.clerkId,
          roadObjectReportsTable.cellKey,
          roadObjectReportsTable.activityExternalId,
        ],
      });
    if ((inserted.rowCount ?? 0) === 0) continue; // her-upload: telt niet dubbel
    result.reportsWritten += 1;

    // Bekend object vlakbij → echte bevestiging: confidence omhoog (max 0,97).
    const confirmTarget = nearby.find(
      (o) =>
        (o.kind === "traffic_signal" || o.kind === "railway_crossing") &&
        haversineM(stop.lat, stop.lon, o.lat, o.lon) <=
          (o.kind === "traffic_signal" ? 40 : 60),
    );
    if (confirmTarget) {
      await db
        .update(roadObjectsTable)
        .set({
          confidence: Math.min(0.97, effectiveConfidence(confirmTarget) + 0.03),
          confirmations: sql`${roadObjectsTable.confirmations} + 1`,
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(roadObjectsTable.id, confirmTarget.id));
      result.objectsConfirmed += 1;
      continue;
    }

    // Geen bekend object: promoveer pas bij herhaald gedrag (zie drempels).
    const all = prior.length + 1;
    const users = new Set([...prior.map((r) => r.clerkId), clerkId]).size;
    const promote =
      (all >= PROMOTE_MIN_REPORTS_MULTI_USER && users >= PROMOTE_MIN_DISTINCT_USERS) ||
      all >= PROMOTE_MIN_REPORTS_SINGLE_USER;
    if (!promote || (top.kind !== "traffic_signal" && top.kind !== "railway_crossing"))
      continue;

    const created = await db
      .insert(roadObjectsTable)
      .values({
        kind: top.kind,
        source: "detection",
        externalId: stop.cellKey,
        lat: stop.lat,
        lon: stop.lon,
        roadName: null, // detectie kent geen wegnaam — eerlijk leeg
        country: null,
        confidence: Math.min(0.7, top.confidence),
        confirmations: all,
      })
      .onConflictDoUpdate({
        target: [
          roadObjectsTable.kind,
          roadObjectsTable.source,
          roadObjectsTable.externalId,
        ],
        set: {
          confidence: sql`LEAST(0.85, ${roadObjectsTable.confidence} + 0.05)`,
          confirmations: sql`${roadObjectsTable.confirmations} + 1`,
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    if ((created.rowCount ?? 0) > 0) result.objectsCreated += 1;
  }

  if (result.reportsWritten > 0) {
    logger.info(
      {
        clerkId,
        activityExternalId,
        stops: result.stops.length,
        reports: result.reportsWritten,
        confirmed: result.objectsConfirmed,
        created: result.objectsCreated,
      },
      "road-objects: stops verwerkt",
    );
  }
  return result;
}

export type ConfirmResult =
  | { status: "confirmed"; object: RoadObject }
  | { status: "already_confirmed"; object: RoadObject }
  | { status: "no_evidence" }
  | { status: "not_found" };

/**
 * Handmatige verificatie door een gebruiker: sterkste bevestiging — maar
 * alleen met echt bewijs. De database is gedeelde kennis, dus een bevestiging
 * telt uitsluitend als deze renner er zelf aantoonbaar gestopt is (een eigen
 * stop-waarneming binnen ~60 m van het object). Eén bevestiging per renner
 * per object, idempotent afgedwongen via de dedupe-index van de rapporten —
 * herhaald klikken kan de confidence dus nooit opjagen.
 */
export async function confirmObject(
  id: number,
  clerkId: string,
): Promise<ConfirmResult> {
  const [obj] = await db
    .select()
    .from(roadObjectsTable)
    .where(eq(roadObjectsTable.id, id))
    .limit(1);
  if (!obj) return { status: "not_found" };

  // Bewijs: een eigen, uit een echte rit gedetecteerde stop vlakbij dit
  // object (bevestigings-rijen zelf tellen niet als bewijs).
  const radiusM = obj.kind === "railway_crossing" ? 60 : 40;
  const pad = 0.001; // ~110 m zoekruimte
  const own = await db
    .select({
      lat: roadObjectReportsTable.lat,
      lon: roadObjectReportsTable.lon,
      activityExternalId: roadObjectReportsTable.activityExternalId,
    })
    .from(roadObjectReportsTable)
    .where(
      and(
        eq(roadObjectReportsTable.clerkId, clerkId),
        gte(roadObjectReportsTable.lat, obj.lat - pad),
        lte(roadObjectReportsTable.lat, obj.lat + pad),
        gte(roadObjectReportsTable.lon, obj.lon - pad),
        lte(roadObjectReportsTable.lon, obj.lon + pad),
      ),
    );
  const hasEvidence = own.some(
    (r) =>
      !r.activityExternalId.startsWith("confirm:") &&
      haversineM(obj.lat, obj.lon, r.lat, r.lon) <= radiusM,
  );
  if (!hasEvidence) return { status: "no_evidence" };

  // Idempotentie: één bevestigings-rij per (renner, objectcel, object).
  const inserted = await db
    .insert(roadObjectReportsTable)
    .values({
      clerkId,
      cellKey: cellKeyFor(obj.lat, obj.lon),
      lat: obj.lat,
      lon: obj.lon,
      stopSec: 0,
      guessedKind: obj.kind,
      confidence: 1,
      activityExternalId: `confirm:${obj.id}`,
    })
    .onConflictDoNothing({
      target: [
        roadObjectReportsTable.clerkId,
        roadObjectReportsTable.cellKey,
        roadObjectReportsTable.activityExternalId,
      ],
    });
  if ((inserted.rowCount ?? 0) === 0) {
    return { status: "already_confirmed", object: obj };
  }

  const [updated] = await db
    .update(roadObjectsTable)
    .set({
      confidence: Math.min(0.97, effectiveConfidence(obj) + 0.1),
      confirmations: sql`${roadObjectsTable.confirmations} + 1`,
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(roadObjectsTable.id, id))
    .returning();
  return { status: "confirmed", object: updated ?? obj };
}
