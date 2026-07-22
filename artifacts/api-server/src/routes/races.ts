import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, racesTable, athleteProfilesTable, routesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { registerRouteUsage } from "../lib/route-usage";
import { autoAdaptPlan } from "../engines/training-plan";
import {
  buildCourseAnalysis,
  buildRaceAdvice,
  buildRaceContext,
  buildRaceDossier,
  buildRaceEvaluation,
  buildRaceIntelEnriched,
  deriveRaceTypeValue,
  persistRaceEvaluation,
} from "../engines/race";
import { buildRaceInsight } from "../lib/race-insight";
import { removeWorldRefsForSource } from "./world-social";
import type { RaceResult } from "@workspace/db";

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
  raceType?: string | null;
  result?: RaceResult | null;
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
  // Golf 16 — één wedstrijdflow.
  routeId?: number | null;
  category?: string | null;
  registrationStatus?: string | null;
  goal?: string | null;
  status?: string;
};

const RACE_STATUSES = ["gepland", "geannuleerd"] as const;
const REGISTRATION_STATUSES = [
  "niet_ingeschreven",
  "ingeschreven",
  "bevestigd",
] as const;

function normalizeStatus(s: string | undefined): string | undefined {
  if (s == null) return undefined;
  return RACE_STATUSES.includes(s as (typeof RACE_STATUSES)[number]) ? s : undefined;
}
function normalizeRegistration(s: string | null | undefined): string | null | undefined {
  if (s === undefined) return undefined;
  if (s === null) return null;
  return REGISTRATION_STATUSES.includes(s as (typeof REGISTRATION_STATUSES)[number])
    ? s
    : undefined;
}

// Verify a route id belongs to the athlete before linking it to a race.
// Returns the id when owned, null for an explicit unlink, undefined to skip.
async function checkRouteOwnership(
  clerkId: string,
  routeId: number | null | undefined,
): Promise<number | null | undefined> {
  if (routeId === undefined) return undefined;
  if (routeId === null) return null;
  const id = Number(routeId);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  const [r] = await db
    .select({ id: routesTable.id })
    .from(routesTable)
    .where(and(eq(routesTable.id, id), eq(routesTable.clerkId, clerkId)))
    .limit(1);
  return r ? id : undefined;
}

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

    res.json(await buildRaceIntelEnriched(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race intel GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/context ───────────────────────────────────────────────
// The central race-context object: every field Sparki could find/derive for this
// race, each tagged found/derived/missing with herkomst, plus honest gaps and
// per-domain guidance. Source-agnostic — surfaces render it generically.
router.get("/:id/context", requireAuth, async (req, res) => {
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
    res.json(await buildRaceContext(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race context GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/evaluation ────────────────────────────────────────────
// Post-race evaluation: honest comparison of the real outcome (result or matched
// activity) against Sparki's expectation. Read-only — a future race is reported
// as not-yet-evaluable; persistence to memory happens when a result is saved.
router.get("/:id/evaluation", requireAuth, async (req, res) => {
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
    res.json(await buildRaceEvaluation(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race evaluation GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/course ────────────────────────────────────────────────
// Parcoursanalyse uit de gekoppelde route (klimmen, ondergrond, profiel) plus de
// wedstrijdvelden — elk feit draagt zijn soort (feit/afgeleid/inschatting/
// ontbreekt). Geen route en geen gidsdata ⇒ eerlijke gaten, nooit verzonnen.
router.get("/:id/course", requireAuth, async (req, res) => {
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
    res.json(await buildCourseAnalysis(race));
  } catch (err) {
    req.log.error({ err }, "race course GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/advice ────────────────────────────────────────────────
// Deterministische adviezen (pacing, bandendruk, warming-up, tactiek, risico's)
// met typologie; een coachinstructie staat altijd bovenaan en is leidend.
router.get("/:id/advice", requireAuth, async (req, res) => {
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
    res.json(await buildRaceAdvice(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race advice GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/races/:id/dossier ───────────────────────────────────────────────
// Het volledige wedstrijddossier voor de hele flow (info → parcours →
// voorbereiding → racedag → gekoppelde activiteit → evaluatie), op leesmoment
// samengesteld uit de bestaande engines — geen tweede bron van waarheid.
router.get("/:id/dossier", requireAuth, async (req, res) => {
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
    res.json(await buildRaceDossier(race, athlete ?? null));
  } catch (err) {
    req.log.error({ err }, "race dossier GET failed");
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
    const ownedRouteId = await checkRouteOwnership(clerkId, body.routeId);
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
        // Auto-derive the race type on create when the athlete didn't supply one
        // (from discipline, else name). Stays null when nothing matches — never guessed.
        raceType:
          body.raceType ??
          deriveRaceTypeValue({ discipline: body.discipline ?? null, name: body.name }) ??
          null,
        result: body.result ?? null,
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
        // Golf 16 — route alleen gekoppeld als hij van deze renner is.
        routeId: ownedRouteId ?? null,
        category: body.category ?? null,
        registrationStatus: normalizeRegistration(body.registrationStatus) ?? null,
        goal: body.goal ?? null,
        status: normalizeStatus(body.status) ?? "gepland",
      })
      .returning();
    // Golf 19 — leg vast WELKE routeversie aan deze wedstrijd is gekoppeld.
    if (race && race.routeId != null) {
      const [route] = await db
        .select({
          id: routesTable.id,
          name: routesTable.name,
          version: routesTable.version,
        })
        .from(routesTable)
        .where(eq(routesTable.id, race.routeId))
        .limit(1);
      if (route) {
        await registerRouteUsage(route, "wedstrijd", race.id, clerkId).catch(
          (err) => req.log.error({ err }, "race route usage failed"),
        );
      }
    }
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
    // Load the existing race (ownership-checked) first so we can auto-enrich the
    // race type on edit when the athlete changes the name/discipline.
    const [existing] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)));
    if (!existing) {
      res.status(404).json({ error: "Race not found" });
      return;
    }

    // Auto-derive raceType on edit: only when no explicit raceType is sent, the
    // name or discipline is changing, and the race has no type yet. Never clobber
    // an athlete's explicit choice and stay null when nothing matches — no guessing.
    let autoRaceType: string | undefined;
    if (
      body.raceType === undefined &&
      (body.name !== undefined || body.discipline !== undefined) &&
      !(existing.raceType && existing.raceType.trim())
    ) {
      const derived = deriveRaceTypeValue({
        discipline: body.discipline !== undefined ? body.discipline : existing.discipline,
        name: body.name !== undefined ? body.name : existing.name,
      });
      if (derived) autoRaceType = derived;
    }

    const ownedRouteId = await checkRouteOwnership(clerkId, body.routeId);
    const registration = normalizeRegistration(body.registrationStatus);
    const status = normalizeStatus(body.status);

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
        ...(body.raceType !== undefined && { raceType: body.raceType }),
        ...(autoRaceType !== undefined && { raceType: autoRaceType }),
        ...(body.result !== undefined && { result: body.result }),
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
        // Golf 16 — route alleen (ont)koppelen als hij van deze renner is.
        ...(ownedRouteId !== undefined && { routeId: ownedRouteId }),
        ...(body.category !== undefined && { category: body.category }),
        ...(registration !== undefined && { registrationStatus: registration }),
        ...(body.goal !== undefined && { goal: body.goal }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      })
      .where(and(eq(racesTable.id, id), eq(racesTable.clerkId, clerkId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Race not found" });
      return;
    }
    // Golf 19 — nieuw gekoppelde route: versiegebruik vastleggen (idempotent).
    if (
      updated.routeId != null &&
      updated.routeId !== existing.routeId
    ) {
      const [route] = await db
        .select({
          id: routesTable.id,
          name: routesTable.name,
          version: routesTable.version,
        })
        .from(routesTable)
        .where(eq(routesTable.id, updated.routeId))
        .limit(1);
      if (route) {
        await registerRouteUsage(route, "wedstrijd", updated.id, clerkId).catch(
          (err) => req.log.error({ err }, "race route usage failed"),
        );
      }
    }
    triggerPlanRefresh(req, clerkId);
    // When a result is saved for a race that has already happened, run the
    // post-race evaluation and persist its conclusion to memory (privacy-gated +
    // deduped). Best-effort and non-blocking — never delays or fails the response.
    if (body.result !== undefined && updated.result) {
      void persistRaceEvaluation(updated, null).catch((err) =>
        req.log.error({ err }, "race evaluation persist failed"),
      );
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
    triggerPlanRefresh(req, clerkId);
    // Sparki World: gedeelde referenties naar deze wedstrijd opruimen.
    await removeWorldRefsForSource(clerkId, "race", id);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "races DELETE failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
