// SPARKI_BUILD_04 F3 — sportergroepen van de zelfstandige trainer.
//
// Groepen zijn organisatie, géén rechtenbron. Toevoegen aan een groep kan
// alleen bij een geaccepteerde, niet-beëindigde directe koppeling
// (coach_athlete_links) — en groepslezen geeft nooit sporterdata, alleen
// lidmaatschap. Ontkoppelen (endedAt) laat de sporter uit alle groepen van
// deze trainer verdwijnen bij de eerstvolgende read (read-time hercheck).

import { Router } from "express";
import { and, eq, isNull, inArray } from "drizzle-orm";
import {
  db,
  trainerGroupsTable,
  trainerGroupMembersTable,
  coachAthleteLinksTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

const router = Router();

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function acceptedAthleteIds(trainerClerkId: string): Promise<string[]> {
  const rows = await db
    .select({ athleteClerkId: coachAthleteLinksTable.athleteClerkId })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.coachClerkId, trainerClerkId),
        eq(coachAthleteLinksTable.status, "accepted"),
        isNull(coachAthleteLinksTable.endedAt),
      ),
    );
  return rows.map((r) => r.athleteClerkId);
}

async function loadOwnedGroup(groupId: number, trainerClerkId: string) {
  const [group] = await db
    .select()
    .from(trainerGroupsTable)
    .where(and(eq(trainerGroupsTable.id, groupId), eq(trainerGroupsTable.trainerClerkId, trainerClerkId)));
  return group ?? null;
}

router.get("/", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const groups = await db
    .select()
    .from(trainerGroupsTable)
    .where(eq(trainerGroupsTable.trainerClerkId, trainerClerkId));
  res.json(groups);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Groepsnaam is verplicht." });
      return;
    }
    const [row] = await db
      .insert(trainerGroupsTable)
      .values({ trainerClerkId, name, description: str(req.body?.description) })
      .onConflictDoNothing()
      .returning();
    if (!row) {
      res.status(409).json({ error: "Er bestaat al een groep met deze naam." });
      return;
    }
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "trainer group create failed");
    res.status(500).json({ error: "Groep aanmaken is niet gelukt." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const group = await loadOwnedGroup(Number(req.params.id), trainerClerkId);
  if (!group) {
    res.status(404).json({ error: "Groep niet gevonden." });
    return;
  }
  await db.delete(trainerGroupsTable).where(eq(trainerGroupsTable.id, group.id));
  res.json({ ok: true });
});

// Leden: read-time hercheck tegen de actuele geaccepteerde koppelingen —
// een ontkoppelde sporter verdwijnt onmiddellijk, ook al staat de rij er nog.
router.get("/:id/members", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const group = await loadOwnedGroup(Number(req.params.id), trainerClerkId);
  if (!group) {
    res.status(404).json({ error: "Groep niet gevonden." });
    return;
  }
  const members = await db
    .select()
    .from(trainerGroupMembersTable)
    .where(eq(trainerGroupMembersTable.groupId, group.id));
  const allowed = await acceptedAthleteIds(trainerClerkId);
  res.json(members.filter((m) => allowed.includes(m.athleteClerkId)));
});

router.post("/:id/members", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const group = await loadOwnedGroup(Number(req.params.id), trainerClerkId);
    if (!group) {
      res.status(404).json({ error: "Groep niet gevonden." });
      return;
    }
    const athleteClerkId = str(req.body?.athleteClerkId);
    if (!athleteClerkId) {
      res.status(400).json({ error: "athleteClerkId is verplicht." });
      return;
    }
    const allowed = await acceptedAthleteIds(trainerClerkId);
    if (!allowed.includes(athleteClerkId)) {
      // Rechten gelden vanaf acceptatie — zonder geaccepteerde koppeling geen
      // groepslidmaatschap (fail-closed, geen informatie over het waarom).
      res.status(403).json({ error: "Geen geaccepteerde koppeling met deze sporter." });
      return;
    }
    const [row] = await db
      .insert(trainerGroupMembersTable)
      .values({ groupId: group.id, athleteClerkId })
      .onConflictDoNothing()
      .returning();
    res.status(row ? 201 : 200).json(row ?? { ok: true, alreadyMember: true });
  } catch (err) {
    req.log.error({ err }, "trainer group member add failed");
    res.status(500).json({ error: "Sporter toevoegen is niet gelukt." });
  }
});

router.delete("/:id/members/:athleteClerkId", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const group = await loadOwnedGroup(Number(req.params.id), trainerClerkId);
  if (!group) {
    res.status(404).json({ error: "Groep niet gevonden." });
    return;
  }
  await db
    .delete(trainerGroupMembersTable)
    .where(
      and(
        eq(trainerGroupMembersTable.groupId, group.id),
        eq(trainerGroupMembersTable.athleteClerkId, String(req.params.athleteClerkId)),
      ),
    );
  res.json({ ok: true });
});

export default router;
