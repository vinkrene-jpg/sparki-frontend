import { Router } from "express";
import { and, desc, eq, gte, or, inArray, sql } from "drizzle-orm";
import {
  db,
  routesTable,
  routeSprintBoardsTable,
  sprintResultsTable,
  athleteProfilesTable,
  friendLinksTable,
  userProfilesTable,
  sprintRideTypes,
  type SprintBoard,
  type RoutePathPoint,
  type SprintRideType,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { detectSprintBoards, scoreSprint } from "../engines/sprint";
import { deriveSprintBadges } from "../engines/sprint/badges";
import { getRoutingProvider } from "../lib/routing";

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
  // Idempotentiesleutel van de client (per sprint-moment). Een herhaalde
  // upload van dezelfde sprint maakt nooit een dubbele rij.
  const clientKey =
    typeof b.clientKey === "string" && b.clientKey.trim()
      ? b.clientKey.trim().slice(0, 120)
      : null;
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

  const values = {
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
    clientKey,
  };

  // Met een clientKey is de insert idempotent: een herhaalde upload van
  // dezelfde sprint (offline-retry, dubbele tik) raakt de partiële unieke
  // index en geeft de bestaande rij terug in plaats van een duplicaat.
  const [row] = clientKey
    ? await db
        .insert(sprintResultsTable)
        .values(values)
        .onConflictDoNothing({
          target: [sprintResultsTable.clerkId, sprintResultsTable.clientKey],
          where: sql`client_key IS NOT NULL`,
        })
        .returning()
    : await db.insert(sprintResultsTable).values(values).returning();

  if (!row && clientKey) {
    const [existing] = await db
      .select()
      .from(sprintResultsTable)
      .where(
        and(
          eq(sprintResultsTable.clerkId, clerkId),
          eq(sprintResultsTable.clientKey, clientKey),
        ),
      )
      .limit(1);
    if (existing) return res.status(200).json({ result: existing, deduped: true });
    return res.status(500).json({ error: "Sprint kon niet worden opgeslagen" });
  }

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

  const badges = deriveSprintBadges(
    rows.map((r) => ({
      totalPoints: r.totalPoints,
      bonusPoints: r.bonusPoints,
      speedGainKmh: r.speedGainKmh,
      placeName: r.placeName,
      status: r.status as "scored" | "cancelled",
    })),
  );

  // Friends-ranking. Honest + privacy-respecting: a friend only appears when
  // they explicitly SHARED a scored sprint this season (shared="true"). No
  // shared sprints ⇒ they don't show, and we never expose private tallies.
  const links = await db
    .select()
    .from(friendLinksTable)
    .where(
      and(
        eq(friendLinksTable.status, "accepted"),
        or(
          eq(friendLinksTable.requesterClerkId, clerkId),
          eq(friendLinksTable.addresseeClerkId, clerkId),
        ),
      ),
    );
  const friendIds = links.map((l) =>
    l.requesterClerkId === clerkId ? l.addresseeClerkId : l.requesterClerkId,
  );

  const ranking: { clerkId: string; name: string; points: number; isMe: boolean }[] =
    [{ clerkId, name: "Jij", points: totalPoints, isMe: true }];

  if (friendIds.length > 0) {
    const friendRows = await db
      .select()
      .from(sprintResultsTable)
      .where(
        and(
          inArray(sprintResultsTable.clerkId, friendIds),
          eq(sprintResultsTable.status, "scored"),
          eq(sprintResultsTable.shared, "true"),
          gte(sprintResultsTable.occurredAt, seasonStart),
        ),
      );
    const byFriend = new Map<string, number>();
    for (const r of friendRows) {
      byFriend.set(r.clerkId, (byFriend.get(r.clerkId) ?? 0) + r.totalPoints);
    }
    const sharingIds = [...byFriend.keys()];
    if (sharingIds.length > 0) {
      const names = await db
        .select({
          clerkId: userProfilesTable.clerkId,
          displayName: userProfilesTable.displayName,
        })
        .from(userProfilesTable)
        .where(inArray(userProfilesTable.clerkId, sharingIds));
      const nameMap = new Map(
        names.map((n) => [n.clerkId, n.displayName ?? "Sporter"]),
      );
      for (const [fid, pts] of byFriend) {
        ranking.push({
          clerkId: fid,
          name: nameMap.get(fid) ?? "Sporter",
          points: pts,
          isMe: false,
        });
      }
    }
  }

  ranking.sort((a, b) => b.points - a.points);
  const myRank = ranking.findIndex((r) => r.isMe) + 1;

  return res.json({
    seasonYear: new Date().getFullYear(),
    totalPoints,
    sprintCount: scored.length,
    bestSingle,
    badges,
    // Only meaningful when at least one friend shared — otherwise it's just you.
    ranking: ranking.length > 1 ? ranking : [],
    myRank: ranking.length > 1 ? myRank : null,
    recent: rows.slice(0, 25),
  });
});

// POST /api/sprints/place — reverse geocode a live GPS point to a place name so
// a FREE ride can detect town-sign transitions in real time. Honest: returns
// placeName:null when the routing provider can't resolve it (never fabricated).
router.post("/place", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const b = (req.body ?? {}) as Record<string, unknown>;
  const lat = num(b.lat);
  const lon = num(b.lon);
  if (
    lat === null ||
    lon === null ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return res.status(400).json({ error: "Ongeldige coördinaten" });
  }

  const placeName = await getRoutingProvider().reverseGeocode({ lat, lon });
  return res.json({ placeName: placeName ?? null });
});

// POST /api/sprints/result/:id/share — share (or unshare) one of the caller's
// own sprints to their Samen-overzicht. Only the owner can toggle it.
router.post("/result/:id/share", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
  const id = num(req.params.id);
  if (id === null) return res.status(400).json({ error: "Ongeldig id" });

  const b = (req.body ?? {}) as Record<string, unknown>;
  const shared = b.shared === false ? "false" : "true";

  const [row] = await db
    .update(sprintResultsTable)
    .set({ shared })
    .where(
      and(
        eq(sprintResultsTable.id, id),
        eq(sprintResultsTable.clerkId, clerkId),
      ),
    )
    .returning();
  if (!row) return res.status(404).json({ error: "Sprint niet gevonden" });
  return res.json({ result: row });
});

export default router;
