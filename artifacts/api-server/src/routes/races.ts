import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, racesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

const router = Router();

const PRIORITIES = ["A", "B", "C"] as const;

// Fields the athlete (or, later, an integration adapter) may write. Structured
// sub-objects (logistics / checklist / teamRiders) are stored as jsonb and kept
// integration-ready — the typed provider layer on the client maps them.
type RaceBody = {
  name?: string;
  raceDate?: string;
  startTime?: string | null;
  location?: string | null;
  priority?: string;
  discipline?: string | null;
  notes?: string | null;
  plannedWorkoutId?: number | null;
  travelDate?: string | null;
  course?: string | null;
  distanceKm?: string | null;
  elevationM?: number | null;
  technicalSections?: string | null;
  weatherNote?: string | null;
  teamName?: string | null;
  teamInfo?: string | null;
  coachInstructions?: string | null;
  logistics?: unknown;
  checklist?: unknown;
  teamRiders?: unknown;
};

function normalizePriority(p: string | undefined): string | undefined {
  if (p == null) return undefined;
  const up = p.toUpperCase();
  return PRIORITIES.includes(up as (typeof PRIORITIES)[number]) ? up : undefined;
}

// ── GET /api/races ───────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const races = await db
      .select()
      .from(racesTable)
      .where(eq(racesTable.clerkId, clerkId))
      .orderBy(asc(racesTable.raceDate));
    res.json(races);
  } catch (err) {
    req.log.error({ err }, "races GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/races ──────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as RaceBody;

  if (!body.name || !body.raceDate) {
    res.status(400).json({ error: "name and raceDate are required" });
    return;
  }

  try {
    const [race] = await db
      .insert(racesTable)
      .values({
        clerkId,
        name: body.name,
        raceDate: body.raceDate,
        startTime: body.startTime ?? null,
        location: body.location ?? null,
        priority: normalizePriority(body.priority) ?? "B",
        discipline: body.discipline ?? null,
        notes: body.notes ?? null,
        plannedWorkoutId: body.plannedWorkoutId ?? null,
        travelDate: body.travelDate ?? null,
        course: body.course ?? null,
        distanceKm: body.distanceKm ?? null,
        elevationM: body.elevationM ?? null,
        technicalSections: body.technicalSections ?? null,
        weatherNote: body.weatherNote ?? null,
        teamName: body.teamName ?? null,
        teamInfo: body.teamInfo ?? null,
        coachInstructions: body.coachInstructions ?? null,
        logistics: body.logistics ?? null,
        checklist: body.checklist ?? null,
        teamRiders: body.teamRiders ?? null,
      })
      .returning();
    res.status(201).json(race);
  } catch (err) {
    req.log.error({ err }, "races POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/races/:id ───────────────────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }
  const body = req.body as RaceBody;
  const priority = normalizePriority(body.priority);

  try {
    const [updated] = await db
      .update(racesTable)
      .set({
        ...(body.name != null && { name: body.name }),
        ...(body.raceDate != null && { raceDate: body.raceDate }),
        ...(body.startTime !== undefined && { startTime: body.startTime }),
        ...(body.location !== undefined && { location: body.location }),
        ...(priority != null && { priority }),
        ...(body.discipline !== undefined && { discipline: body.discipline }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.plannedWorkoutId !== undefined && {
          plannedWorkoutId: body.plannedWorkoutId,
        }),
        ...(body.travelDate !== undefined && { travelDate: body.travelDate }),
        ...(body.course !== undefined && { course: body.course }),
        ...(body.distanceKm !== undefined && { distanceKm: body.distanceKm }),
        ...(body.elevationM !== undefined && { elevationM: body.elevationM }),
        ...(body.technicalSections !== undefined && {
          technicalSections: body.technicalSections,
        }),
        ...(body.weatherNote !== undefined && { weatherNote: body.weatherNote }),
        ...(body.teamName !== undefined && { teamName: body.teamName }),
        ...(body.teamInfo !== undefined && { teamInfo: body.teamInfo }),
        ...(body.coachInstructions !== undefined && {
          coachInstructions: body.coachInstructions,
        }),
        ...(body.logistics !== undefined && { logistics: body.logistics }),
        ...(body.checklist !== undefined && { checklist: body.checklist }),
        ...(body.teamRiders !== undefined && { teamRiders: body.teamRiders }),
        updatedAt: new Date(),
      })
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "races PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/races/:id/checklist ─────────────────────────────────────────────
// Dedicated endpoint so the Day-Before checklist can persist its checked state
// per race without sending the whole race object on every toggle.
router.put("/:id/checklist", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }
  const { checklist } = req.body as { checklist?: Record<string, boolean> };
  if (checklist == null || typeof checklist !== "object") {
    res.status(400).json({ error: "checklist object is required" });
    return;
  }

  try {
    const [updated] = await db
      .update(racesTable)
      .set({ checklist, updatedAt: new Date() })
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "races checklist PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/races/:id ────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "races DELETE failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
