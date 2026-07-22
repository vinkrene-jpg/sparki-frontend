// Sparki Traffic Database — API.
//
// - GET  /api/road-objects/along-route/:routeId — wegobjecten (verkeerslichten,
//   spoorwegovergangen, rotondes, drempels) langs een eigen route (met
//   OSM-sync + cache).
// - GET  /api/road-objects/session/:importId/stops — de gedetecteerde stops
//   ("waarschijnlijk gestopt voor rood licht") van een eigen ge-uploade rit.
// - POST /api/road-objects/:id/confirm — handmatige bevestiging van een
//   object (sterkste vorm van validatie in het zelflerende model).

import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  routesTable,
  activityImportsTable,
  type RoutePathPoint,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getRoadObjectsAlongRoute,
  confirmObject,
  effectiveConfidence,
  STOP_KIND_LABELS,
  type DetectedStop,
} from "../engines/road-objects";

const router = Router();

router.get("/along-route/:routeId", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const routeId = Number(String(req.params.routeId));
  if (!Number.isInteger(routeId)) {
    res.status(400).json({ error: "Ongeldige route-id" });
    return;
  }
  try {
    const [route] = await db
      .select({ geometry: routesTable.geometry })
      .from(routesTable)
      .where(and(eq(routesTable.id, routeId), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const geometry = (route.geometry ?? null) as RoutePathPoint[] | null;
    if (!geometry || geometry.length < 2) {
      // Eerlijk: zonder routegeometrie valt er niets langs de route te vinden.
      res.json({ available: false, reason: "Deze route heeft geen routelijn." });
      return;
    }
    const result = await getRoadObjectsAlongRoute(geometry);
    if (!result) {
      res.json({
        available: false,
        reason: "Deze route beslaat een te groot gebied voor de wegobjectenlaag.",
      });
      return;
    }
    res.json({ available: true, ...result });
  } catch (err) {
    req.log.error({ err }, "roadObjects.alongRoute failed");
    res.status(500).json({ error: "Kon wegobjecten niet laden" });
  }
});

router.get("/session/:importId/stops", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const importId = Number(String(req.params.importId));
  if (!Number.isInteger(importId)) {
    res.status(400).json({ error: "Ongeldige import-id" });
    return;
  }
  try {
    const [row] = await db
      .select({ parsedSummary: activityImportsTable.parsedSummary })
      .from(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.id, importId),
          eq(activityImportsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Import niet gevonden" });
      return;
    }
    const summary = (row.parsedSummary ?? {}) as Record<string, unknown>;
    const stops = Array.isArray(summary.roadStops)
      ? (summary.roadStops as DetectedStop[])
      : [];
    res.json({
      stops: stops.map((s) => ({
        ...s,
        // Nederlands label van de meest waarschijnlijke oorzaak.
        topLabel:
          s.candidates?.[0] != null
            ? STOP_KIND_LABELS[s.candidates[0].kind]
            : null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "roadObjects.sessionStops failed");
    res.status(500).json({ error: "Kon stops niet laden" });
  }
});

router.post("/:id/confirm", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const result = await confirmObject(id, clerkId);
    if (result.status === "not_found") {
      res.status(404).json({ error: "Object niet gevonden" });
      return;
    }
    if (result.status === "no_evidence") {
      // Eerlijk: bevestigen kan alleen als je hier zelf echt gestopt bent
      // (een eigen waarneming uit een geüploade rit) — anders zou iedereen
      // de gedeelde kennis kunnen opjagen.
      res.status(403).json({
        error:
          "Bevestigen kan alleen op plekken waar je zelf gestopt bent tijdens een rit.",
      });
      return;
    }
    res.json({
      alreadyConfirmed: result.status === "already_confirmed",
      object: {
        ...result.object,
        confidence: effectiveConfidence(result.object),
      },
    });
  } catch (err) {
    req.log.error({ err }, "roadObjects.confirm failed");
    res.status(500).json({ error: "Kon bevestiging niet opslaan" });
  }
});

export default router;
