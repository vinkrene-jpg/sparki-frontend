import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  racePointsTable,
  racesTable,
  routesTable,
  type RoutePathPoint,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { requireCommercialFeature } from "../lib/entitlements";
import {
  KIND_LABELS,
  activeRacePoints,
  isAllowedStatusChange,
  isRacePointKind,
  isRacePointStatus,
  kindToClass,
  snapToRouteKm,
} from "../lib/race-points";

// Wedstrijdpunten — kaartcontrole-API (opdracht §3). AI levert alleen
// voorstellen (via document-analysis link); alles hier is menselijke controle:
// bevestigen, aanpassen, verplaatsen, verwijderen en handmatig toevoegen.
// Ownership: altijd via de wedstrijd (races.clerkId).

const router = Router();

async function ownRace(clerkId: string, raceId: number) {
  const [race] = await db
    .select()
    .from(racesTable)
    .where(and(eq(racesTable.id, raceId), eq(racesTable.clerkId, clerkId)))
    .limit(1);
  return race ?? null;
}

function parseNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/races/:raceId/points — alle punten van deze wedstrijd (alle
// statussen; de kaartcontrole toont voorgesteld/afgewezen apart) + welke
// actief zijn.
router.get("/:raceId/points", requireAuth, requireCommercialFeature("route_course_points"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raceId = Number(String(req.params.raceId));
  if (!Number.isInteger(raceId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const race = await ownRace(clerkId, raceId);
    if (!race) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }
    const points = await db
      .select()
      .from(racePointsTable)
      .where(eq(racePointsTable.raceId, raceId))
      .orderBy(asc(racePointsTable.raceKm), asc(racePointsTable.id));
    res.json({
      points,
      activeCount: activeRacePoints(points).length,
      localLaps: race.localLaps,
    });
  } catch (err) {
    req.log.error({ err }, "racePoints.list failed");
    res.status(500).json({ error: "Kon wedstrijdpunten niet laden" });
  }
});

// POST /api/races/:raceId/points — handmatig punt toevoegen (kaartklik of km).
// Handmatig = direct "bevestigd" (de renner stelt het zelf vast), geen bron,
// geen betrouwbaarheid.
router.post("/:raceId/points", requireAuth, requireCommercialFeature("route_course_points"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raceId = Number(String(req.params.raceId));
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(raceId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  if (!isRacePointKind(body.kind)) {
    res.status(400).json({ error: "Ongeldig punttype" });
    return;
  }
  try {
    const race = await ownRace(clerkId, raceId);
    if (!race) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }
    const lat = parseNum(body.lat);
    const lng = parseNum(body.lng);
    let raceKm = parseNum(body.raceKm);
    // Kaartklik zonder km: deterministisch snappen op de gekoppelde route.
    if (raceKm == null && lat != null && lng != null && race.routeId != null) {
      const [route] = await db
        .select({ geometry: routesTable.geometry })
        .from(routesTable)
        .where(eq(routesTable.id, race.routeId))
        .limit(1);
      const geom = (route?.geometry as RoutePathPoint[] | null) ?? null;
      if (geom && geom.length >= 2) raceKm = snapToRouteKm(geom, lat, lng);
    }
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 120)
        : KIND_LABELS[body.kind];
    const [point] = await db
      .insert(racePointsTable)
      .values({
        raceId,
        clerkId,
        kind: body.kind,
        pointClass: kindToClass(body.kind),
        label,
        description:
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim().slice(0, 500)
            : null,
        raceKm,
        lat,
        lng,
        status: "bevestigd",
      })
      .returning();
    res.status(201).json({ point });
  } catch (err) {
    req.log.error({ err }, "racePoints.create failed");
    res.status(500).json({ error: "Kon punt niet toevoegen" });
  }
});

// PATCH /api/races/:raceId/points/:pointId — bevestigen / aanpassen /
// verplaatsen / afwijzen. Een locatie- of tekstwijziging zet de status op
// "aangepast" tenzij expliciet "bevestigd" wordt meegestuurd.
router.patch("/:raceId/points/:pointId", requireAuth, requireCommercialFeature("route_course_points"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raceId = Number(String(req.params.raceId));
  const pointId = Number(String(req.params.pointId));
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(raceId) || !Number.isInteger(pointId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const race = await ownRace(clerkId, raceId);
    if (!race) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }
    const [existing] = await db
      .select()
      .from(racePointsTable)
      .where(
        and(eq(racePointsTable.id, pointId), eq(racePointsTable.raceId, raceId)),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Punt niet gevonden" });
      return;
    }

    const updates: Record<string, unknown> = {};
    let moved = false;
    if (body.label !== undefined) {
      if (typeof body.label === "string" && body.label.trim()) {
        updates.label = body.label.trim().slice(0, 120);
        moved = true;
      }
    }
    if (body.description !== undefined) {
      updates.description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim().slice(0, 500)
          : null;
      moved = true;
    }
    if (body.kind !== undefined) {
      if (!isRacePointKind(body.kind)) {
        res.status(400).json({ error: "Ongeldig punttype" });
        return;
      }
      updates.kind = body.kind;
      updates.pointClass = kindToClass(body.kind);
      moved = true;
    }
    if (body.raceKm !== undefined) {
      updates.raceKm = parseNum(body.raceKm);
      moved = true;
    }
    if (body.lat !== undefined || body.lng !== undefined) {
      const lat = parseNum(body.lat);
      const lng = parseNum(body.lng);
      updates.lat = lat;
      updates.lng = lng;
      // Verplaatsen op de kaart: km deterministisch mee-snappen als er een
      // route is en er geen expliciete km meekwam.
      if (
        body.raceKm === undefined &&
        lat != null &&
        lng != null &&
        race.routeId != null
      ) {
        const [route] = await db
          .select({ geometry: routesTable.geometry })
          .from(routesTable)
          .where(eq(routesTable.id, race.routeId))
          .limit(1);
        const geom = (route?.geometry as RoutePathPoint[] | null) ?? null;
        if (geom && geom.length >= 2) updates.raceKm = snapToRouteKm(geom, lat, lng);
      }
      moved = true;
    }
    if (body.status !== undefined) {
      if (!isRacePointStatus(body.status) || !isAllowedStatusChange(body.status)) {
        res.status(400).json({ error: "Ongeldige status" });
        return;
      }
      updates.status = body.status;
    } else if (moved) {
      updates.status = "aangepast";
    }
    // Herbevestiging (nieuwe-gids-diff): iedere expliciete bevestiging,
    // aanpassing of verplaatsing door de renner heft de vraag op.
    if (updates.status === "bevestigd" || updates.status === "aangepast") {
      updates.needsReconfirm = false;
      updates.reviewNote = null;
    }

    if (Object.keys(updates).length === 0) {
      res.json({ point: existing });
      return;
    }
    updates.updatedAt = new Date();
    const [point] = await db
      .update(racePointsTable)
      .set(updates)
      .where(
        and(eq(racePointsTable.id, pointId), eq(racePointsTable.raceId, raceId)),
      )
      .returning();
    res.json({ point });
  } catch (err) {
    req.log.error({ err }, "racePoints.update failed");
    res.status(500).json({ error: "Kon punt niet bijwerken" });
  }
});

// DELETE /api/races/:raceId/points/:pointId — punt verwijderen.
router.delete("/:raceId/points/:pointId", requireAuth, requireCommercialFeature("route_course_points"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raceId = Number(String(req.params.raceId));
  const pointId = Number(String(req.params.pointId));
  if (!Number.isInteger(raceId) || !Number.isInteger(pointId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const race = await ownRace(clerkId, raceId);
    if (!race) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }
    await db
      .delete(racePointsTable)
      .where(
        and(eq(racePointsTable.id, pointId), eq(racePointsTable.raceId, raceId)),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "racePoints.delete failed");
    res.status(500).json({ error: "Kon punt niet verwijderen" });
  }
});

export default router;
