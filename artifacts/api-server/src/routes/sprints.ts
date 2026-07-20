import { Router } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  db,
  routesTable,
  routeSprintBoardsTable,
  sprintResultsTable,
  athleteProfilesTable,
  sprintRideTypes,
  type SprintBoard,
  type RoutePathPoint,
  type SprintRideType,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { detectSprintBoards, scoreSprint } from "../engines/sprint";

const router = Router();

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

// GET /api/sprints/route/:id — sprint boards ("bordjes") along a saved route the
// caller owns. Detection is cached per route (route-intrinsic). Honest: returns
// available:false when reverse geocoding can't run, never fabricated places.
router.get("/route/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
  const routeId = num(req.params.id);
  if (routeId === null) return res.status(400).json({ error: "Ongeldige route" });

  const [route] = await db
    .select()
    .from(routesTable)
    .where(and(eq(routesTable.id, routeId), eq(routesTable.clerkId, clerkId)))
    .limit(1);
  if (!route) return res.status(404).json({ error: "Route niet gevonden" });

  const cached = await db
    .select()
    .from(routeSprintBoardsTable)
    .where(eq(routeSprintBoardsTable.routeId, routeId))
    .limit(1);
  if (cached[0]) {
    return res.json({
      boards: cached[0].boards as SprintBoard[],
      available: cached[0].available === "true",
      count: (cached[0].boards as SprintBoard[]).length,
    });
  }

  const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
  const { boards, available } = await detectSprintBoards(geometry);

  await db
    .insert(routeSprintBoardsTable)
    .values({
      routeId,
      boards,
      available: available ? "true" : "false",
    })
    .onConflictDoUpdate({
      target: routeSprintBoardsTable.routeId,
      set: { boards, available: available ? "true" : "false" },
    });

  return res.json({ boards, available, count: boards.length });
});

// POST /api/sprints/route/:id/rescan — force a fresh detection (e.g. after a
// route edit). Same honesty contract.
router.post("/route/:id/rescan", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
  const routeId = num(req.params.id);
  if (routeId === null) return res.status(400).json({ error: "Ongeldige route" });

  const [route] = await db
    .select()
    .from(routesTable)
    .where(and(eq(routesTable.id, routeId), eq(routesTable.clerkId, clerkId)))
    .limit(1);
  if (!route) return res.status(404).json({ error: "Route niet gevonden" });

  const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
  const { boards, available } = await detectSprintBoards(geometry);
  await db
    .insert(routeSprintBoardsTable)
    .values({ routeId, boards, available: available ? "true" : "false" })
    .onConflictDoUpdate({
      target: routeSprintBoardsTable.routeId,
      set: {
        boards,
        available: available ? "true" : "false",
        detectedAt: new Date(),
      },
    });
  return res.json({ boards, available, count: boards.length });
});

// POST /api/sprints/result — persist one bordje-sprint. Points are computed
// server-side from real inputs (GPS speed; watts only when a meter was
// connected). A cancelled sprint is stored with 0 points and status cancelled.
router.post("/result", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const b = (req.body ?? {}) as Record<string, unknown>;
  const placeName =
    typeof b.placeName === "string" && b.placeName.trim()
      ? b.placeName.trim()
      : null;
  if (!placeName) return res.status(400).json({ error: "Plaatsnaam ontbreekt" });

  const rideType: SprintRideType =
    typeof b.rideType === "string" &&
    (sprintRideTypes as readonly string[]).includes(b.rideType)
      ? (b.rideType as SprintRideType)
      : "free";
  const cancelled = b.status === "cancelled";
  const routeId = num(b.routeId);
  const km = num(b.km);
  const speedKmhPeak = num(b.speedKmhPeak);
  const speedGainKmh = num(b.speedGainKmh);
  const avgWatts = num(b.avgWatts);
  const peakWatts5s = num(b.peakWatts5s);

  // A planned sprint must reference a route the caller owns — never trust a
  // client-supplied routeId for another athlete's route.
  if (rideType === "planned") {
    if (routeId === null) {
      return res.status(400).json({ error: "Route ontbreekt" });
    }
    const [owned] = await db
      .select({ id: routesTable.id })
      .from(routesTable)
      .where(and(eq(routesTable.id, routeId), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!owned) return res.status(404).json({ error: "Route niet gevonden" });
  }

  let ftp: number | null = null;
  const [profile] = await db
    .select({ ftp: athleteProfilesTable.ftp })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (profile) ftp = profile.ftp ?? null;

  const score = cancelled
    ? { basePoints: 0, bonusPoints: 0, totalPoints: 0 }
    : scoreSprint({ speedGainKmh, peakWatts5s, ftpWatts: ftp });

  const [row] = await db
    .insert(sprintResultsTable)
    .values({
      clerkId,
      routeId: rideType === "planned" ? routeId : null,
      rideType,
      placeName,
      km,
      speedKmhPeak,
      speedGainKmh,
      avgWatts,
      peakWatts5s,
      basePoints: score.basePoints,
      bonusPoints: score.bonusPoints,
      totalPoints: score.totalPoints,
      status: cancelled ? "cancelled" : "scored",
    })
    .returning();

  return res.status(201).json({ result: row });
});

// GET /api/sprints/season — the caller's own season tally + recent sprints.
// Season starts Jan 1 of the current year (Europe/Amsterdam calendar year).
router.get("/season", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const seasonStart = new Date(new Date().getFullYear(), 0, 1);
  const rows = await db
    .select()
    .from(sprintResultsTable)
    .where(
      and(
        eq(sprintResultsTable.clerkId, clerkId),
        gte(sprintResultsTable.occurredAt, seasonStart),
      ),
    )
    .orderBy(desc(sprintResultsTable.occurredAt));

  const scored = rows.filter((r) => r.status === "scored");
  const totalPoints = scored.reduce((s, r) => s + r.totalPoints, 0);
  const bestSingle = scored.reduce((m, r) => Math.max(m, r.totalPoints), 0);

  return res.json({
    seasonYear: new Date().getFullYear(),
    totalPoints,
    sprintCount: scored.length,
    bestSingle,
    recent: rows.slice(0, 25),
  });
});

export default router;
