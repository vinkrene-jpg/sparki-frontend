import { Router } from "express";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  coachAthleteLinksTable,
  userProfilesTable,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  plannedWorkoutsTable,
  aiObservationsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { computeReadiness } from "../engines/recovery-load";
import {
  coachSharingLevel,
  hasAcceptedCoachLink,
  hasRole,
} from "../engines/coaching";
import { loadPlanView } from "../engines/training-plan";
import { getAthleteContextForViewer } from "../engines/context-memory";

const router = Router();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function requireCoach(clerkId: string, res: import("express").Response) {
  if (!(await hasRole(clerkId, "coach"))) {
    res.status(403).json({ error: "Coach-rol vereist" });
    return false;
  }
  return true;
}

// GET /api/coach/athletes — roster of accepted athletes, each gated by the
// athlete's own dataSharingCoach preference.
router.get("/athletes", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  try {
    const links = await db
      .select({ athleteClerkId: coachAthleteLinksTable.athleteClerkId })
      .from(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, coachId),
          eq(coachAthleteLinksTable.status, "accepted"),
        ),
      );
    const ids = links.map((l) => l.athleteClerkId);
    if (ids.length === 0) {
      res.json({ athletes: [] });
      return;
    }

    const profiles = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        discipline: athleteProfilesTable.discipline,
        healthStatus: athleteProfilesTable.healthStatus,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(inArray(userProfilesTable.clerkId, ids));

    const athletes = await Promise.all(
      profiles.map(async (p) => {
        const sharing = await coachSharingLevel(p.clerkId);
        const base = {
          athleteClerkId: p.clerkId,
          displayName: p.displayName,
          sharing,
        };
        if (sharing === "none") return base;

        const [metric] = await db
          .select()
          .from(athleteDailyMetricsTable)
          .where(eq(athleteDailyMetricsTable.clerkId, p.clerkId))
          .orderBy(desc(athleteDailyMetricsTable.metricDate))
          .limit(1);
        const [nextWorkout] = await db
          .select({
            scheduledDate: plannedWorkoutsTable.scheduledDate,
            title: plannedWorkoutsTable.title,
            type: plannedWorkoutsTable.type,
          })
          .from(plannedWorkoutsTable)
          .where(
            and(
              eq(plannedWorkoutsTable.clerkId, p.clerkId),
              gte(plannedWorkoutsTable.scheduledDate, todayISO()),
            ),
          )
          .orderBy(plannedWorkoutsTable.scheduledDate)
          .limit(1);

        return {
          ...base,
          discipline: p.discipline,
          healthStatus: p.healthStatus,
          readiness: computeReadiness(metric ?? null),
          nextSession: nextWorkout ?? null,
          // "full" sharing exposes the raw latest metric; "summary" hides it.
          latestMetric: sharing === "full" ? (metric ?? null) : undefined,
        };
      }),
    );
    res.json({ athletes });
  } catch (err) {
    req.log.error({ err }, "coach.athletes failed");
    res.status(500).json({ error: "Kon roster niet laden" });
  }
});

// GET /api/coach/athletes/:athleteId — detail view, requires accepted link and
// sharing != none. Shareable observations are athlete observations the athlete
// has saved/acknowledged (not dismissed/new drafts).
router.get("/athletes/:athleteId", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await hasAcceptedCoachLink(coachId, athleteId))) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const sharing = await coachSharingLevel(athleteId);
    if (sharing === "none") {
      res.json({ sharing, athlete: null, message: "Atleet deelt geen data" });
      return;
    }

    const [profile] = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        discipline: athleteProfilesTable.discipline,
        healthStatus: athleteProfilesTable.healthStatus,
        ftp: athleteProfilesTable.ftp,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(eq(userProfilesTable.clerkId, athleteId));

    const metrics = await db
      .select()
      .from(athleteDailyMetricsTable)
      .where(eq(athleteDailyMetricsTable.clerkId, athleteId))
      .orderBy(desc(athleteDailyMetricsTable.metricDate))
      .limit(sharing === "full" ? 14 : 7);

    const schedule = await db
      .select({
        scheduledDate: plannedWorkoutsTable.scheduledDate,
        title: plannedWorkoutsTable.title,
        type: plannedWorkoutsTable.type,
        targetDurationMin: plannedWorkoutsTable.targetDurationMin,
        status: plannedWorkoutsTable.status,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, athleteId),
          gte(plannedWorkoutsTable.scheduledDate, todayISO()),
        ),
      )
      .orderBy(plannedWorkoutsTable.scheduledDate)
      .limit(7);

    const observations = await db
      .select({
        id: aiObservationsTable.id,
        title: aiObservationsTable.title,
        summary: aiObservationsTable.summary,
        category: aiObservationsTable.category,
        severity: aiObservationsTable.severity,
        createdAt: aiObservationsTable.createdAt,
      })
      .from(aiObservationsTable)
      .where(
        and(
          eq(aiObservationsTable.clerkId, athleteId),
          inArray(aiObservationsTable.status, ["acknowledged", "saved"]),
        ),
      )
      .orderBy(desc(aiObservationsTable.createdAt))
      .limit(10);

    res.json({
      sharing,
      athlete: {
        ...profile,
        readiness: computeReadiness(metrics[0] ?? null),
        metrics: sharing === "full" ? metrics : metrics.slice(0, 3),
        schedule,
        observations,
      },
    });
  } catch (err) {
    req.log.error({ err }, "coach.athlete-detail failed");
    res.status(500).json({ error: "Kon atleet niet laden" });
  }
});

// GET /api/coach/athletes/:athleteId/plan — read-only view of the athlete's
// current Sparki advisory plan (mode "advisory"). Requires an accepted link and
// the athlete sharing != none. This NEVER modifies the coach's planned_workouts;
// it only surfaces Sparki's suggestion so the coach can decide what to act on.
router.get("/athletes/:athleteId/plan", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await hasAcceptedCoachLink(coachId, athleteId))) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const sharing = await coachSharingLevel(athleteId);
    if (sharing === "none") {
      res.json({
        sharing,
        athlete: null,
        plan: null,
        days: [],
        message: "Atleet deelt geen data",
      });
      return;
    }

    const [profile] = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        discipline: athleteProfilesTable.discipline,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(eq(userProfilesTable.clerkId, athleteId));

    const view = await loadPlanView(athleteId);
    // Only surface advisory plans. An autonomous plan means the athlete is
    // self-coached and there is no advice to show in the coach portal.
    const isAdvisory = view?.plan?.mode === "advisory";

    res.json({
      sharing,
      athlete: {
        athleteClerkId: athleteId,
        displayName: profile?.displayName ?? null,
        discipline: profile?.discipline ?? null,
      },
      plan: isAdvisory ? view!.plan : null,
      days: isAdvisory ? view!.days : [],
    });
  } catch (err) {
    req.log.error({ err }, "coach.athlete-plan failed");
    res.status(500).json({ error: "Kon adviesschema niet laden" });
  }
});

// GET /api/coach/athletes/:athleteId/context — the athlete's personal-context
// memories (examen, wedstrijd, blessure, slaap/spanning, kamp). Requires an
// accepted link AND sharing != none. Only Sparki's neutral title/detail is
// exposed — never the athlete's raw words or their personal answers.
router.get("/athletes/:athleteId/context", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await hasAcceptedCoachLink(coachId, athleteId))) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const sharing = await coachSharingLevel(athleteId);
    if (sharing === "none") {
      res.json({ sharing, memories: [], message: "Atleet deelt geen data" });
      return;
    }
    const memories = await getAthleteContextForViewer(athleteId);
    res.json({ sharing, memories });
  } catch (err) {
    req.log.error({ err }, "coach.athlete-context failed");
    res.status(500).json({ error: "Kon context niet laden" });
  }
});

export default router;
