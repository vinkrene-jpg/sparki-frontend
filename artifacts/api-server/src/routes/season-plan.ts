// TRAINEN_DOELEN_SEIZOEN_01 F7 — seizoenslaag-API.
//
// GET  /api/season-plan          → vormblokken + weekdoelen (uren) over de
//                                  hele seizoenslengte. Zonder opgeslagen
//                                  blokken worden ze afgeleid uit hoofddoel,
//                                  tussendoelen en wedstrijdkalender en
//                                  opgeslagen (de tijdlijn is nooit leeg zolang
//                                  er ankers zijn). ?refresh=1 leidt opnieuw af
//                                  en overschrijft ALLEEN afgeleide blokken —
//                                  door de sporter versleepte blokken blijven.
// PUT  /api/season-plan/blocks/:id → blok verslepen (start-/einddatum).

import { Router } from "express";
import { and, asc, eq, gte } from "drizzle-orm";
import {
  db,
  athleteGoalsTable,
  athleteProfilesTable,
  racesTable,
  seasonBlocksTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  buildSeasonBlocks,
  buildSeasonWeekTargets,
  type SeasonAnchor,
} from "../lib/season-layer";

const router = Router();

function todayAms(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function deriveAnchors(clerkId: string): Promise<SeasonAnchor[]> {
  const today = todayAms();
  const [goals, races] = await Promise.all([
    db
      .select({
        title: athleteGoalsTable.title,
        targetDate: athleteGoalsTable.targetDate,
        priority: athleteGoalsTable.priority,
      })
      .from(athleteGoalsTable)
      .where(
        and(eq(athleteGoalsTable.clerkId, clerkId), eq(athleteGoalsTable.status, "active")),
      ),
    db
      .select({ name: racesTable.name, raceDate: racesTable.raceDate, priority: racesTable.priority })
      .from(racesTable)
      .where(and(eq(racesTable.clerkId, clerkId), gte(racesTable.raceDate, today))),
  ]);

  const anchors: SeasonAnchor[] = [];
  for (const g of goals) {
    if (!g.targetDate || g.targetDate < today) continue;
    anchors.push({
      date: g.targetDate,
      title: g.title,
      kind: g.priority === 1 ? "hoofddoel" : "tussendoel",
    });
  }
  // A-wedstrijden zijn eigen pieken; B/C sturen de seizoenslaag niet.
  for (const r of races) {
    if (r.priority === "A" && !anchors.some((a) => a.date === r.raceDate)) {
      anchors.push({ date: r.raceDate, title: r.name, kind: "wedstrijd" });
    }
  }
  return anchors;
}

async function loadBlocks(clerkId: string) {
  return db
    .select()
    .from(seasonBlocksTable)
    .where(eq(seasonBlocksTable.clerkId, clerkId))
    .orderBy(asc(seasonBlocksTable.startDate));
}

router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const refresh = req.query.refresh === "1";
    let rows = await loadBlocks(clerkId);
    const hasUserEdits = rows.some((r) => r.source === "sporter");

    // Reviewfix F7: refresh vernieuwt ALTIJD uitsluitend de afgeleide rijen;
    // sporter-blokken blijven onaangetast (ook als ze bestaan).
    if (rows.length === 0 || refresh) {
      const anchors = await deriveAnchors(clerkId);
      const derived = buildSeasonBlocks(todayAms(), anchors);
      await db.transaction(async (tx) => {
        await tx
          .delete(seasonBlocksTable)
          .where(
            and(eq(seasonBlocksTable.clerkId, clerkId), eq(seasonBlocksTable.source, "afgeleid")),
          );
        if (derived.length > 0) {
          await tx.insert(seasonBlocksTable).values(
            derived.map((b) => ({
              clerkId,
              startDate: b.startDate,
              endDate: b.endDate,
              phase: b.phase,
              label: b.label,
              anchorDate: b.anchorDate,
              anchorTitle: b.anchorTitle,
              source: "afgeleid" as const,
            })),
          );
        }
      });
      rows = await loadBlocks(clerkId);
    }

    const [profile] = await db
      .select({ weeklyHourTarget: athleteProfilesTable.weeklyHourTarget })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1);
    const weekTargets = buildSeasonWeekTargets(
      rows.map((r) => ({
        startDate: r.startDate,
        endDate: r.endDate,
        phase: r.phase,
        label: r.label,
        anchorDate: r.anchorDate,
        anchorTitle: r.anchorTitle,
      })),
      profile?.weeklyHourTarget ?? 0,
    );

    res.json({ blocks: rows, weekTargets });
  } catch (err) {
    req.log.error({ err }, "season-plan.get failed");
    res.status(500).json({ error: "Kon seizoenslaag niet laden" });
  }
});

// Blok verslepen. Alleen start/eind; fase en anker blijven wat ze zijn.
router.put("/blocks/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const { startDate, endDate } = req.body as { startDate?: string; endDate?: string };
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig blok-id" });
    return;
  }
  if (
    (startDate != null && !DATE_RE.test(startDate)) ||
    (endDate != null && !DATE_RE.test(endDate)) ||
    (startDate == null && endDate == null)
  ) {
    res.status(400).json({ error: "Geef startDate en/of endDate als yyyy-mm-dd" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(seasonBlocksTable)
      .where(and(eq(seasonBlocksTable.id, id), eq(seasonBlocksTable.clerkId, clerkId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Blok niet gevonden" });
      return;
    }
    const newStart = startDate ?? existing.startDate;
    const newEnd = endDate ?? existing.endDate;
    if (newEnd < newStart) {
      res.status(400).json({ error: "Einddatum ligt vóór begindatum" });
      return;
    }
    const [row] = await db
      .update(seasonBlocksTable)
      .set({ startDate: newStart, endDate: newEnd, source: "sporter", updatedAt: new Date() })
      .where(and(eq(seasonBlocksTable.id, id), eq(seasonBlocksTable.clerkId, clerkId)))
      .returning();
    res.json({ block: row });
  } catch (err) {
    req.log.error({ err }, "season-plan.block.put failed");
    res.status(500).json({ error: "Kon blok niet verplaatsen" });
  }
});

export default router;
