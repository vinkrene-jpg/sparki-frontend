import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

const router = Router();

// GET /api/links — the current athlete's linked coaches and parents, with the
// linked person's display name and link status. Used by the athlete You screen.
router.get("/", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    const coaches = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        email: userProfilesTable.email,
        status: coachAthleteLinksTable.status,
        createdAt: coachAthleteLinksTable.createdAt,
      })
      .from(coachAthleteLinksTable)
      .innerJoin(
        userProfilesTable,
        eq(userProfilesTable.clerkId, coachAthleteLinksTable.coachClerkId),
      )
      .where(eq(coachAthleteLinksTable.athleteClerkId, me));

    const parents = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        email: userProfilesTable.email,
        status: parentAthleteLinksTable.status,
        createdAt: parentAthleteLinksTable.createdAt,
      })
      .from(parentAthleteLinksTable)
      .innerJoin(
        userProfilesTable,
        eq(userProfilesTable.clerkId, parentAthleteLinksTable.parentClerkId),
      )
      .where(eq(parentAthleteLinksTable.athleteClerkId, me));

    res.json({ coaches, parents });
  } catch (err) {
    req.log.error({ err }, "links.list failed");
    res.status(500).json({ error: "Kon koppelingen niet laden" });
  }
});

// DELETE /api/links/coach/:coachClerkId — athlete revokes a coach link.
router.delete("/coach/:coachClerkId", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    const result = await db
      .delete(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, String(req.params.coachClerkId)),
          eq(coachAthleteLinksTable.athleteClerkId, me),
        ),
      );
    const removed = result.rowCount ?? 0;
    res.json({ ok: true, removed });
  } catch (err) {
    req.log.error({ err }, "links.revoke-coach failed");
    res.status(500).json({ error: "Kon koppeling niet verwijderen" });
  }
});

// DELETE /api/links/parent/:parentClerkId — athlete revokes a parent link.
router.delete("/parent/:parentClerkId", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    const result = await db
      .delete(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, String(req.params.parentClerkId)),
          eq(parentAthleteLinksTable.athleteClerkId, me),
        ),
      );
    const removed = result.rowCount ?? 0;
    res.json({ ok: true, removed });
  } catch (err) {
    req.log.error({ err }, "links.revoke-parent failed");
    res.status(500).json({ error: "Kon koppeling niet verwijderen" });
  }
});

// DELETE /api/links/as-coach/:athleteClerkId — a coach ends a link to an athlete
// from their own side. Scoped to coachClerkId = me, so a coach can only end a
// link where they are the coach (never someone else's link).
router.delete("/as-coach/:athleteClerkId", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    await db
      .delete(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, me),
          eq(
            coachAthleteLinksTable.athleteClerkId,
            String(req.params.athleteClerkId),
          ),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "links.end-as-coach failed");
    res.status(500).json({ error: "Kon koppeling niet verwijderen" });
  }
});

// DELETE /api/links/as-parent/:athleteClerkId — a parent ends a link to an
// athlete from their own side. Scoped to parentClerkId = me, so a parent can
// only end a link where they are the parent (never someone else's link).
router.delete("/as-parent/:athleteClerkId", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    await db
      .delete(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, me),
          eq(
            parentAthleteLinksTable.athleteClerkId,
            String(req.params.athleteClerkId),
          ),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "links.end-as-parent failed");
    res.status(500).json({ error: "Kon koppeling niet verwijderen" });
  }
});

export default router;
