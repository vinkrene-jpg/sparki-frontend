import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  routesTable,
  activityImportsTable,
  routeSurfaces,
  routeVisibilities,
  type RouteSurface,
  type RouteVisibility,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { parseGpxRoute } from "../lib/gpx-parse";

const router = Router();

function coerceSurface(v: unknown): RouteSurface {
  return typeof v === "string" &&
    (routeSurfaces as readonly string[]).includes(v)
    ? (v as RouteSurface)
    : "unknown";
}

function coerceVisibility(v: unknown): RouteVisibility {
  return typeof v === "string" &&
    (routeVisibilities as readonly string[]).includes(v)
    ? (v as RouteVisibility)
    : "private";
}

// GET /api/routes — caller's saved routes, newest first.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  try {
    const routes = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.clerkId, clerkId))
      .orderBy(desc(routesTable.createdAt))
      .limit(limit);
    res.json({ routes });
  } catch (err) {
    req.log.error({ err }, "routes.list failed");
    res.status(500).json({ error: "Kon routes niet laden" });
  }
});

// GET /api/routes/:id — a single route (owner only).
router.get("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    res.json({ route });
  } catch (err) {
    req.log.error({ err }, "routes.get failed");
    res.status(500).json({ error: "Kon route niet laden" });
  }
});

// POST /api/routes — create a route from a real GPX track.
//   body: { content (GPX text, required), name?, surface?, visibility?,
//           linkedActivityImportId? }
// Distance, elevation gain, the elevation profile, and climbs are all derived
// from the track. Turn-by-turn nav is left null (not derivable from a GPX
// track) — we never fabricate directions.
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) {
    res.status(400).json({ error: "GPX-inhoud (content) is verplicht" });
    return;
  }

  const parsed = parseGpxRoute(content);
  if (!parsed) {
    res
      .status(422)
      .json({ error: "Geen geldige trackpunten gevonden in GPX-bestand" });
    return;
  }

  const nameOverride =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : null;
  const name = nameOverride ?? parsed.trackName ?? "Naamloze route";

  const requestedLinkId =
    Number.isInteger(Number(body.linkedActivityImportId)) &&
    Number(body.linkedActivityImportId) > 0
      ? Number(body.linkedActivityImportId)
      : null;

  try {
    // Only link an activity import the caller actually owns — never trust a
    // raw id from the client (cross-tenant reference protection).
    let linkedActivityImportId: number | null = null;
    if (requestedLinkId != null) {
      const [owned] = await db
        .select({ id: activityImportsTable.id })
        .from(activityImportsTable)
        .where(
          and(
            eq(activityImportsTable.id, requestedLinkId),
            eq(activityImportsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      if (!owned) {
        res.status(400).json({ error: "Ongeldige activiteit-koppeling" });
        return;
      }
      linkedActivityImportId = owned.id;
    }

    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId,
        name,
        surface: coerceSurface(body.surface),
        visibility: coerceVisibility(body.visibility),
        status: "ready",
        distanceKm: parsed.distanceKm,
        elevationGainM: parsed.elevationGainM,
        profile: parsed.profile,
        climbs: parsed.climbs,
        nav: null,
        source: "gpx",
        linkedActivityImportId,
      })
      .returning();
    res.status(201).json({ route });
  } catch (err) {
    req.log.error({ err }, "routes.create failed");
    res.status(500).json({ error: "Kon route niet opslaan" });
  }
});

// DELETE /api/routes/:id — remove a route (owner only).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const deleted = await db
      .delete(routesTable)
      .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
      .returning({ id: routesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "routes.delete failed");
    res.status(500).json({ error: "Kon route niet verwijderen" });
  }
});

export default router;
