import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, racesTable, athleteProfilesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { autoAdaptPlan } from "../engines/training-plan";
import { buildRaceIntel } from "../engines/race";
import { buildRaceInsight } from "../lib/race-insight";

const router = Router();

// Adding/moving/removing a race shifts the training phase and any in-horizon
// race days, so re-run the autonomous provisional adaptation. Best-effort and
// non-blocking: the helper never throws and we only log reported failures.
function triggerPlanRefresh(
  req: import("express").Request,
  clerkId: string,
): void {
  void autoAdaptPlan(clerkId).then((r) => {
    if (r.error)
      req.log.error({ err: r.error }, "auto plan adaptation failed");
  });
}

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

// ── GET /api/races/insight ───────────────────────────────────────────────────
// The "intelligent werkblad" behind the race worksheet: everything Sparki can
// derive for a (prospective or saved) race before the athlete types anything —
// race-day weather, home→venue distance, a discipline logistics proposal, and
// the home departure suggestion. Honest about every gap (never fabricated).
// Registered before "/:id/intel" so the literal path is matched first.
router.get("/insight", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const location = req.query["location"] ? String(req.query["location"]) : null;
  const raceDate = req.query["raceDate"] ? String(req.query["raceDate"]) : "";
  const discipline = req.query["discipline"]
    ? String(req.query["discipline"])
    : null;
  if (!raceDate) {
    res.status(400).json({ error: "raceDate is required" });
    return;
  }
  try {
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    res.json(await buildRaceInsight({ location, raceDate, discipline }, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race insight GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/intel ─────────────────────────────────────────────────
// Race Intelligence: phased prep timeline, auto race-day report (honest about
// unknowns), race-fuel advice with budget alternatives, multi-day checklists.
// Computed on demand from the athlete's own race + profile — no stored snapshot.
router.get("/:id/intel", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid race id" });
    return;
  }

  try {
    const [race] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)));

    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }

    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    res.json(buildRaceIntel(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race intel GET failed");
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
    triggerPlanRefresh(req, clerkId);
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
    triggerPlanRefresh(req, clerkId);
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
    triggerPlanRefresh(req, clerkId);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "races DELETE failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
