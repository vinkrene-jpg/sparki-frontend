// Autonomous training-plan API (task #17). Exposes the current plan, generation,
// regeneration, and adaptation. Coach-gating is enforced here: if the athlete
// has an accepted coach the plan is advisory-only (mode="advisory") and the
// engine never writes planned_workouts — coach workouts are never overwritten.

import { Router } from "express";
import { and, asc, eq, gte } from "drizzle-orm";
import {
  db,
  coachAthleteLinksTable,
  racesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  gatherInputs,
  checkCompleteness,
  generatePlan,
  adaptPlan,
  maybeRollForward,
  loadPlanView,
} from "../engines/training-plan";
import { getRaceWeather } from "../lib/weather/race";

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

// GET /api/training-plan — setup state + current plan (concrete week + preview).
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    // Autonomous roll-forward: once the committed week has elapsed, promote the
    // next provisional week to a fresh committed week (with routes) before we
    // render — no manual regenerate needed. Best-effort: never block the read.
    try {
      await maybeRollForward(clerkId);
    } catch (err) {
      req.log.error({ err }, "training-plan.rollForward failed");
    }
    const [inputs, hasCoach, view] = await Promise.all([
      gatherInputs(clerkId),
      hasAcceptedCoach(clerkId),
      loadPlanView(clerkId),
    ]);
    const completeness = checkCompleteness(inputs);

    // Race-day weather: look up the forecast at the *race location* for the next
    // upcoming race (best-effort, never blocks the plan view).
    let raceWeather: Awaited<ReturnType<typeof getRaceWeather>> | null = null;
    try {
      const today = new Date().toISOString().split("T")[0]!;
      const [nextRace] = await db
        .select({
          name: racesTable.name,
          raceDate: racesTable.raceDate,
          location: racesTable.location,
        })
        .from(racesTable)
        .where(
          and(
            eq(racesTable.clerkId, clerkId),
            gte(racesTable.raceDate, today),
          ),
        )
        .orderBy(asc(racesTable.raceDate))
        .limit(1);
      if (nextRace) {
        raceWeather = await getRaceWeather(nextRace.location, nextRace.raceDate);
      }
    } catch (err) {
      req.log.error({ err }, "training-plan.raceWeather failed");
    }
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
        homeLat: inputs.home?.lat ?? null,
        homeLon: inputs.home?.lon ?? null,
        homeLabel: inputs.home?.label ?? null,
      },
      raceWeather,
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
