import { Router } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  routesTable,
  volgautoPlansTable,
  volgautoPositionsTable,
  volgautoReportsTable,
  volgautoReportKinds,
  type RoutePathPoint,
  type VolgautoRole,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getRoutingProvider } from "../lib/routing";
import {
  computeVolgautoPlan,
  VOLGAUTO_DISCLAIMER,
} from "../lib/volgauto/compute";
import { cumulativeKm, nearestOnPath } from "../lib/volgauto/plan";

const router = Router();

// Volgauto (Opdracht 3) — sub-router onder /api/routes, gemount VÓÓR de
// hoofd-routesrouter. De fietsroute blijft altijd volledig intact; het
// volgautoplan (aparte voertuiggeschikte route + vergelijking) staat in een
// eigen tabel en is een optionele laag er bovenop.

function parseId(raw: unknown): number | null {
  const id = Number(String(raw));
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function ownedRoute(id: number, clerkId: string) {
  const [route] = await db
    .select()
    .from(routesTable)
    .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
    .limit(1);
  return route ?? null;
}

function planPayload(plan: typeof volgautoPlansTable.$inferSelect) {
  return {
    enabled: plan.enabled,
    carGeometry: (plan.carGeometry as RoutePathPoint[] | null) ?? null,
    carNav: plan.carNav ?? null,
    carDistanceKm: plan.carDistanceKm,
    carDurationSec: plan.carDurationSec,
    segments: plan.segments ?? [],
    meetpoints: plan.meetpoints ?? [],
    dataNotes: (plan.dataNotes as string[] | null) ?? [VOLGAUTO_DISCLAIMER],
    routeVersion: plan.routeVersion,
    computedAt: plan.computedAt,
    disclaimer: VOLGAUTO_DISCLAIMER,
  };
}

// GET /api/routes/:id/volgauto — plan lezen (null wanneer uit).
router.get("/:id/volgauto", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const route = await ownedRoute(id, clerkId);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const [plan] = await db
      .select()
      .from(volgautoPlansTable)
      .where(eq(volgautoPlansTable.routeId, id))
      .limit(1);
    if (!plan || !plan.enabled) {
      res.json({ plan: null });
      return;
    }
    const outdated = plan.routeVersion != null && plan.routeVersion !== route.version;
    res.json({ plan: { ...planPayload(plan), outdated } });
  } catch (err) {
    req.log.error({ err }, "volgauto.get failed");
    res.status(500).json({ error: "Kon het volgautoplan niet lezen." });
  }
});

// POST /api/routes/:id/volgauto — instelling aanzetten + plan (her)berekenen.
router.post("/:id/volgauto", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const route = await ownedRoute(id, clerkId);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
    if (geometry.length < 2) {
      res.status(422).json({
        error:
          "Deze route heeft geen opgeslagen lijn op de kaart, dus er kan geen volgautoroute berekend worden.",
      });
      return;
    }
    const provider = getRoutingProvider();
    if (!provider.isConfigured()) {
      res.status(503).json({
        error:
          "De volgautoroute kan nu niet berekend worden — de routedienst is niet gekoppeld.",
      });
      return;
    }
    let computation;
    try {
      computation = await computeVolgautoPlan(geometry);
    } catch (err) {
      req.log.error({ err }, "volgauto.compute failed");
      res.status(502).json({
        error:
          "Er is geen voertuiggeschikte route gevonden voor dit gebied. De fietsroute blijft gewoon beschikbaar.",
      });
      return;
    }
    const now = new Date();
    const [plan] = await db
      .insert(volgautoPlansTable)
      .values({
        routeId: id,
        clerkId,
        enabled: true,
        carGeometry: computation.carGeometry,
        carNav: computation.carNav,
        carDistanceKm: computation.carDistanceKm,
        carDurationSec: computation.carDurationSec,
        segments: computation.segments,
        meetpoints: computation.meetpoints,
        dataNotes: computation.dataNotes,
        routeVersion: route.version,
        computedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: volgautoPlansTable.routeId,
        set: {
          enabled: true,
          carGeometry: computation.carGeometry,
          carNav: computation.carNav,
          carDistanceKm: computation.carDistanceKm,
          carDurationSec: computation.carDurationSec,
          segments: computation.segments,
          meetpoints: computation.meetpoints,
          dataNotes: computation.dataNotes,
          routeVersion: route.version,
          computedAt: now,
          updatedAt: now,
        },
      })
      .returning();
    res.json({
      plan: {
        ...planPayload(plan!),
        outdated: false,
        sharedKm: computation.sharedKm,
        separatedKm: computation.separatedKm,
      },
    });
  } catch (err) {
    req.log.error({ err }, "volgauto.enable failed");
    res.status(500).json({ error: "Kon het volgautoplan niet opslaan." });
  }
});

// DELETE /api/routes/:id/volgauto — instelling uitzetten (plan blijft bewaard
// maar telt als uit; fietsrouteflow verandert nergens).
router.delete("/:id/volgauto", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const route = await ownedRoute(id, clerkId);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    await db
      .update(volgautoPlansTable)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(volgautoPlansTable.routeId, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "volgauto.disable failed");
    res.status(500).json({ error: "Kon de volgauto-instelling niet uitzetten." });
  }
});

// POST /api/routes/:id/volgauto/rejoin — de VOLGAUTO is van de autoroute of
// moet naar een aansluitpunt verderop. Routeert ALTIJD met het autoprofiel
// (driving-car) — nooit via fietspaden. De fiets-rejoin blijft ongewijzigd in
// de hoofd-routesrouter.
router.post("/:id/volgauto/rejoin", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lon = typeof body.lon === "number" && Number.isFinite(body.lon) ? body.lon : null;
  const targetLat =
    typeof body.targetLat === "number" && Number.isFinite(body.targetLat)
      ? body.targetLat
      : null;
  const targetLon =
    typeof body.targetLon === "number" && Number.isFinite(body.targetLon)
      ? body.targetLon
      : null;
  if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    res.status(400).json({ error: "Ongeldige positie" });
    return;
  }
  try {
    const route = await ownedRoute(id, clerkId);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const [plan] = await db
      .select()
      .from(volgautoPlansTable)
      .where(eq(volgautoPlansTable.routeId, id))
      .limit(1);
    if (!plan || !plan.enabled) {
      res.status(409).json({ error: "Deze route heeft geen volgautoplan." });
      return;
    }
    const provider = getRoutingProvider();
    if (!provider.isConfigured()) {
      res.status(503).json({
        error: "Herberekenen is nu niet beschikbaar — de routedienst is niet gekoppeld.",
      });
      return;
    }
    // Doel: expliciet meegegeven aansluitpunt, anders het dichtstbijzijnde
    // punt op de opgeslagen autoroute.
    let end: { lat: number; lon: number } | null = null;
    if (targetLat != null && targetLon != null) {
      end = { lat: targetLat, lon: targetLon };
    } else {
      const carGeom = (plan.carGeometry as RoutePathPoint[] | null) ?? [];
      if (carGeom.length >= 2) {
        const cum = cumulativeKm(carGeom);
        const near = nearestOnPath(lat, lon, carGeom, cum);
        end = { lat: carGeom[near.idx]![0], lon: carGeom[near.idx]![1] };
      }
    }
    if (!end) {
      res.status(422).json({ error: "Geen doelpunt beschikbaar om naartoe te rekenen." });
      return;
    }
    const result = await provider.routePointToPoint({
      start: { lat, lon },
      end,
      profile: "driving-car",
    });
    res.json({
      path: result.path,
      distanceKm: result.distanceKm,
      durationSec: result.durationSec,
      nav: result.steps,
      profile: "driving-car",
      disclaimer: VOLGAUTO_DISCLAIMER,
    });
  } catch (err) {
    req.log.error({ err }, "volgauto.rejoin failed");
    res.status(502).json({
      error: "Kon geen autoroute berekenen — de routedienst gaf geen bruikbaar antwoord.",
    });
  }
});

// POST /api/routes/:id/volgauto/position — live positie delen (renner of
// volgauto). Eén rij per route+gebruiker; verouderde rijen tellen niet mee.
router.post("/:id/volgauto/position", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const role: VolgautoRole = body.role === "volgauto" ? "volgauto" : "renner";
  const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lon = typeof body.lon === "number" && Number.isFinite(body.lon) ? body.lon : null;
  const speedMps =
    typeof body.speedMps === "number" && Number.isFinite(body.speedMps) && body.speedMps >= 0
      ? body.speedMps
      : null;
  if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    res.status(400).json({ error: "Ongeldige positie" });
    return;
  }
  try {
    const route = await ownedRoute(id, clerkId);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    await db
      .insert(volgautoPositionsTable)
      .values({ routeId: id, clerkId, role, lat, lon, speedMps, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [volgautoPositionsTable.routeId, volgautoPositionsTable.clerkId],
        set: { role, lat, lon, speedMps, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "volgauto.position failed");
    res.status(500).json({ error: "Kon de positie niet opslaan." });
  }
});

// GET /api/routes/:id/volgauto/positions?role=renner — recente posities van de
// andere rol. Ouder dan 3 minuten telt eerlijk als "geen positie bekend".
router.get("/:id/volgauto/positions", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const role = String(req.query.role ?? "renner") === "volgauto" ? "volgauto" : "renner";
  try {
    const route = await ownedRoute(id, clerkId);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const cutoff = new Date(Date.now() - 3 * 60_000);
    const rows = await db
      .select()
      .from(volgautoPositionsTable)
      .where(
        and(
          eq(volgautoPositionsTable.routeId, id),
          eq(volgautoPositionsTable.role, role),
          gte(volgautoPositionsTable.updatedAt, cutoff),
        ),
      )
      .orderBy(desc(volgautoPositionsTable.updatedAt))
      .limit(10);
    res.json({
      positions: rows.map((r) => ({
        role: r.role,
        lat: r.lat,
        lon: r.lon,
        speedMps: r.speedMps,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "volgauto.positions failed");
    res.status(500).json({ error: "Kon posities niet lezen." });
  }
});

// POST /api/routes/:id/volgauto/reports — melding na de rit. Uitdrukkelijk
// GEEN universele waarheid: de melding krijgt status "nieuw" en past nooit
// automatisch kaartdata of plannen aan.
router.post("/:id/volgauto/reports", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const kind = String(body.kind ?? "");
  if (!(volgautoReportKinds as readonly string[]).includes(kind)) {
    res.status(400).json({ error: "Ongeldig meldingstype." });
    return;
  }
  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 500)
      : null;
  const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lon = typeof body.lon === "number" && Number.isFinite(body.lon) ? body.lon : null;
  try {
    const route = await ownedRoute(id, clerkId);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const [row] = await db
      .insert(volgautoReportsTable)
      .values({ routeId: id, clerkId, kind, note, lat, lon })
      .returning();
    res.status(201).json({
      report: { id: row!.id, kind: row!.kind, status: row!.status },
      uitleg:
        "Bedankt voor je melding. We behandelen dit als gebruikersmelding die gecontroleerd moet worden — niet als vaststaand feit.",
    });
  } catch (err) {
    req.log.error({ err }, "volgauto.report failed");
    res.status(500).json({ error: "Kon de melding niet opslaan." });
  }
});

// GET /api/routes/:id/volgauto/reports — eigen meldingen teruglezen.
router.get("/:id/volgauto/reports", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const route = await ownedRoute(id, clerkId);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const rows = await db
      .select()
      .from(volgautoReportsTable)
      .where(eq(volgautoReportsTable.routeId, id))
      .orderBy(desc(volgautoReportsTable.createdAt))
      .limit(50);
    res.json({
      reports: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "volgauto.reports failed");
    res.status(500).json({ error: "Kon meldingen niet lezen." });
  }
});

export default router;
