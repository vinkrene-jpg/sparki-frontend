// Autonomous training-plan API (task #17). Exposes the current plan, generation,
// regeneration, and adaptation. Coach-gating is enforced here: if the athlete
// has an accepted coach the plan is advisory-only (mode="advisory") and the
// engine never writes planned_workouts — coach workouts are never overwritten.

import { Router } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  coachAthleteLinksTable,
  trainingPlansTable,
  planDaysTable,
  plannedWorkoutsTable,
  routesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  gatherInputs,
  checkCompleteness,
  generatePlan,
  adaptPlan,
} from "../lib/training-plan";

const router = Router();

async function hasAcceptedCoach(athleteClerkId: string): Promise<boolean> {
  const [row] = await db
    .select({ coachClerkId: coachAthleteLinksTable.coachClerkId })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.athleteClerkId, athleteClerkId),
        eq(coachAthleteLinksTable.status, "accepted"),
      ),
    )
    .limit(1);
  return !!row;
}

// Assemble the full plan view: every plan day enriched with its committed
// workout status and any attached real route.
async function loadPlanView(clerkId: string) {
  const [plan] = await db
    .select()
    .from(trainingPlansTable)
    .where(
      and(
        eq(trainingPlansTable.clerkId, clerkId),
        eq(trainingPlansTable.status, "active"),
      ),
    )
    .limit(1);
  if (!plan) return null;

  const days = await db
    .select()
    .from(planDaysTable)
    .where(eq(planDaysTable.planId, plan.id))
    .orderBy(asc(planDaysTable.dayDate));

  const workouts = await db
    .select()
    .from(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.planId, plan.id));
  const workoutById = new Map(workouts.map((w) => [w.id, w]));

  const routeIds = workouts
    .map((w) => w.routeId)
    .filter((id): id is number => id != null);
  const routeById = new Map<
    number,
    { id: number; name: string; distanceKm: number | null; elevationGainM: number | null; startName: string | null }
  >();
  if (routeIds.length > 0) {
    const routes = await db
      .select({
        id: routesTable.id,
        name: routesTable.name,
        distanceKm: routesTable.distanceKm,
        elevationGainM: routesTable.elevationGainM,
        startName: routesTable.startName,
      })
      .from(routesTable)
      .where(inArray(routesTable.id, routeIds));
    for (const r of routes) routeById.set(r.id, r);
  }

  const enriched = days.map((d) => {
    const w = d.plannedWorkoutId ? workoutById.get(d.plannedWorkoutId) : null;
    const route = w?.routeId ? (routeById.get(w.routeId) ?? null) : null;
    return {
      id: d.id,
      dayDate: d.dayDate,
      weekIndex: d.weekIndex,
      focus: d.focus,
      trainingType: d.trainingType,
      intensityLabel: d.intensityLabel,
      estDurationMin: d.estDurationMin,
      isRest: d.isRest,
      routeNeeded: d.routeNeeded,
      rationale: d.rationale,
      adaptationReason: d.adaptationReason,
      committed: d.committed,
      workout: w
        ? { id: w.id, title: w.title, type: w.type, status: w.status }
        : null,
      route,
    };
  });

  return {
    plan: {
      id: plan.id,
      mode: plan.mode,
      status: plan.status,
      summary: plan.summary,
      weekStartDate: plan.weekStartDate,
      horizonEndDate: plan.horizonEndDate,
      weeklyHourTarget: plan.weeklyHourTarget,
      generatedAt: plan.generatedAt,
      adaptationState: plan.adaptationState,
      inputSnapshot: plan.inputSnapshot,
    },
    days: enriched,
  };
}

// GET /api/training-plan — setup state + current plan (concrete week + preview).
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [inputs, hasCoach, view] = await Promise.all([
      gatherInputs(clerkId),
      hasAcceptedCoach(clerkId),
      loadPlanView(clerkId),
    ]);
    const completeness = checkCompleteness(inputs);
    res.json({
      hasCoach,
      mode: hasCoach ? "advisory" : "autonomous",
      needsSetup: !completeness.ready,
      missing: completeness.missing,
      hasHome: inputs.home != null,
      inputs: {
        experienceLevel: inputs.experienceLevel,
        availableDays: inputs.availableDays,
        weeklyHourTarget: inputs.weeklyHourTarget,
        loadCapacity: inputs.loadCapacity,
        injuryHistory: inputs.injuryHistory,
        trainingPreferences: inputs.trainingPreferences,
        discipline: inputs.discipline,
        phase: inputs.phase,
        readiness: inputs.readiness,
        healthStatus: inputs.healthStatus,
        nextRace: inputs.nextRace,
        homeLabel: inputs.home?.label ?? null,
      },
      plan: view?.plan ?? null,
      days: view?.days ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "training-plan.get failed");
    res.status(500).json({ error: "Kon trainingsschema niet laden" });
  }
});

// POST /api/training-plan/generate — build (or rebuild) the plan. Coach-gated:
// advisory-only when the athlete has an accepted coach.
async function handleGenerate(
  req: import("express").Request,
  res: import("express").Response,
) {
  const clerkId = getClerkUserId(req)!;
  try {
    const inputs = await gatherInputs(clerkId);
    const completeness = checkCompleteness(inputs);
    if (!completeness.ready) {
      res.status(400).json({
        error: "Profiel onvolledig voor planning",
        missing: completeness.missing,
      });
      return;
    }
    const hasCoach = await hasAcceptedCoach(clerkId);
    const mode = hasCoach ? "advisory" : "autonomous";
    const result = await generatePlan(clerkId, mode);
    const view = await loadPlanView(clerkId);
    res.status(201).json({
      mode,
      hasCoach,
      routesGenerated: result.routesGenerated,
      routesAttempted: result.routesAttempted,
      plan: view?.plan ?? null,
      days: view?.days ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "training-plan.generate failed");
    res.status(500).json({ error: "Kon trainingsschema niet genereren" });
  }
}

router.post("/generate", requireAuth, handleGenerate);
router.post("/regenerate", requireAuth, handleGenerate);

// POST /api/training-plan/adapt — re-evaluate provisional days vs current recovery.
router.post("/adapt", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const result = await adaptPlan(clerkId);
    const view = await loadPlanView(clerkId);
    res.json({
      ...result,
      plan: view?.plan ?? null,
      days: view?.days ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "training-plan.adapt failed");
    res.status(500).json({ error: "Kon trainingsschema niet aanpassen" });
  }
});

export default router;
