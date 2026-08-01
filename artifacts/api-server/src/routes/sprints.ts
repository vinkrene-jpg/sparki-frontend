import { Router } from "express";
import { and, desc, eq, gte, or, inArray, isNull } from "drizzle-orm";
import {
  db,
  sprintResultsTable,
  friendLinksTable,
  userProfilesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { deriveSprintBadges } from "../engines/sprint/badges";

const router = Router();

// BESLUIT 31-07-2026 — Bordjes sprinten is GESTOPT wegens veiligheidsrisico op
// de openbare weg: de functie stimuleert sprintgedrag en kan ondanks
// kaartcontroles niet betrouwbaar rekening houden met actuele verkeers-
// situaties, voetgangers, tegenliggers, werkzaamheden, slecht wegdek of
// ontbrekende kaartdata. Alle START-paden (borddetectie, live plaatsdetectie,
// nieuwe resultaten) zijn geblokkeerd — ook via directe URL of API (410).
// Historische resultaten blijven bewaard en leesbaar (/season, Samen-feed);
// er wordt geen gebruikersdata verwijderd zonder migratieplan. Alleen een
// toekomstige variant op afgesloten terrein of vooraf handmatig goedgekeurde
// trainingssegmenten mag later opnieuw worden onderzocht.
// Herbruikbaar bewaard: engines/sprint (detect/score/badges — puur en getest),
// lib/db schema sprints.ts, hooks/use-sprints.ts (leesdeel).
const SPRINT_GESTOPT_MELDING =
  "Bordjes sprinten is gestopt — veiligheidsrisico op de openbare weg. Je eerdere resultaten blijven bewaard.";

function gestopt(res: import("express").Response) {
  return res.status(410).json({ error: SPRINT_GESTOPT_MELDING, stopped: true });
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

// De blokkade zit bewust VÓÓR requireAuth: het startverbod geldt voor iedereen
// en is zo ook zonder inlog aantoonbaar (410, nooit een halve start).

// GESTOPT — borddetectie langs een route start het sprintspel en is daarom
// geblokkeerd (ook via directe URL/API).
router.get("/route/:id", (_req, res) => gestopt(res));

// GESTOPT — herscannen van bordjes is een startpad en is geblokkeerd.
router.post("/route/:id/rescan", (_req, res) => gestopt(res));

// GESTOPT — nieuwe sprintresultaten worden niet meer geaccepteerd. Bestaande
// rijen blijven onaangetast (geen dataverwijdering zonder migratieplan).
router.post("/result", (_req, res) => gestopt(res));

// GESTOPT — live plaatsdetectie (free-ride sprint) is een startpad en is
// geblokkeerd.
router.post("/place", (_req, res) => gestopt(res));

// GESTOPT — het delen van (historische) sprints promoot het gestopte spel niet
// verder; nieuwe share-toggles zijn dicht. Al gedeelde historie blijft staan.
router.post("/result/:id/share", (_req, res) => gestopt(res));

// GET /api/sprints/season — ALLEEN-LEZEN historie: het eigen seizoensoverzicht
// blijft beschikbaar zodat eerder verdiende resultaten niet verdwijnen.
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
        eq(friendLinksTable.status, "accepted"), isNull(friendLinksTable.endedAt),
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

export default router;
