// Rit-verhaal routes (Fase 1 "De keten", flag `rit_verhaal`).
//
// GET /api/ride-story/sync-status  — honest sync/analysis status line.
// GET /api/ride-story/moment       — the fresh-ride NA-RIT moment for Vandaag.
// GET /api/ride-story/session/:id  — story data for one owned ride: linked
//                                    workout, feedback, deterministic
//                                    schemagevolg, prediction availability.
//
// Honesty contract:
// - Every field maps to a real row (see docs/product/FASE1_EVIDENCE_MATRIX.md).
// - `predictionAvailable` is true ONLY when a core_predictions snapshot exists
//   that was created BEFORE the ride was recorded. We never call the prediction
//   engine here for an executed workout — that would compute-and-freeze a
//   "prediction" after the fact.
// - Safety first: when the athlete's health status is sick/injured the moment
//   is suppressed (`suppressed: true`) so the existing health surface leads.

import { Router, type Request, type Response } from "express";
import { and, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  connectorActivitiesTable,
  connectorConnectionsTable,
  corePredictionsTable,
  plannedWorkoutsTable,
  racesTable,
  syncRunsTable,
  trainingSessionsTable,
  workoutFeedbackTable,
  type TrainingSession,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { assessConsequence, type ConsequenceResult } from "../lib/ride-story";

const router = Router();

// A ride counts as "fresh" (drives the NA-RIT moment) when it was imported
// into the hub within this window.
const FRESH_WINDOW_HOURS = 18;

type SyncStatusPayload = {
  status: "geen" | "bezig" | "mislukt" | "gereed";
  lastActivity: {
    sessionId: number | null;
    provider: string;
    importedAt: string;
    startedAt: string | null;
    title: string | null;
    sessionDate: string | null;
  } | null;
  lastSync: {
    provider: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
  } | null;
  hasConnection: boolean;
  /** Deterministic analysis is available as soon as a session row exists. */
  analysis: "geen" | "bezig" | "gereed";
};

async function buildSyncStatus(clerkId: string): Promise<SyncStatusPayload> {
  const [activities, runs, connections] = await Promise.all([
    db
      .select({
        provider: connectorActivitiesTable.provider,
        importedAt: connectorActivitiesTable.importedAt,
        startedAt: connectorActivitiesTable.startedAt,
        sessionId: connectorActivitiesTable.normalizedSessionId,
        title: trainingSessionsTable.title,
        sessionDate: trainingSessionsTable.sessionDate,
      })
      .from(connectorActivitiesTable)
      .leftJoin(
        trainingSessionsTable,
        eq(connectorActivitiesTable.normalizedSessionId, trainingSessionsTable.id),
      )
      .where(eq(connectorActivitiesTable.clerkId, clerkId))
      .orderBy(desc(connectorActivitiesTable.importedAt))
      .limit(1),
    db
      .select()
      .from(syncRunsTable)
      .where(eq(syncRunsTable.clerkId, clerkId))
      .orderBy(desc(syncRunsTable.startedAt))
      .limit(1),
    db
      .select({ id: connectorConnectionsTable.id })
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.clerkId, clerkId))
      .limit(1),
  ]);

  const act = activities[0] ?? null;
  const run = runs[0] ?? null;
  const hasConnection = connections.length > 0;

  const lastActivity = act
    ? {
        sessionId: act.sessionId,
        provider: act.provider,
        importedAt: act.importedAt.toISOString(),
        startedAt: act.startedAt ? act.startedAt.toISOString() : null,
        title: act.title ?? null,
        sessionDate: act.sessionDate ?? null,
      }
    : null;
  const lastSync = run
    ? {
        provider: run.provider,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
        error: run.error,
      }
    : null;

  let status: SyncStatusPayload["status"];
  if (run && run.status === "running") {
    status = "bezig";
  } else if (
    run &&
    run.status === "failed" &&
    (!act || run.startedAt.getTime() > act.importedAt.getTime())
  ) {
    status = "mislukt";
  } else if (act) {
    status = "gereed";
  } else {
    status = "geen";
  }

  const analysis: SyncStatusPayload["analysis"] =
    status === "bezig" ? "bezig" : act && act.sessionId != null ? "gereed" : "geen";

  return { status, lastActivity, lastSync, hasConnection, analysis };
}

type StoryPayload = {
  session: TrainingSession;
  workout: {
    id: number;
    title: string;
    scheduledDate: string;
    targetTSS: number | null;
    targetDurationMin: number | null;
    status: string;
  } | null;
  feedback: { feedbackType: string; note: string | null; createdAt: string }[];
  consequence: ConsequenceResult;
  race: { id: number; name: string } | null;
  /**
   * True only when a prediction snapshot existed BEFORE this ride was
   * recorded. The client may only fetch /api/core-prediction/:workoutId when
   * this is true — otherwise the engine would freeze a post-hoc "prediction".
   */
  predictionAvailable: boolean;
};

async function buildStory(
  clerkId: string,
  session: TrainingSession,
): Promise<StoryPayload> {
  const [workouts, races] = await Promise.all([
    db
      .select()
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          eq(plannedWorkoutsTable.sessionId, session.id),
        ),
      )
      .orderBy(desc(plannedWorkoutsTable.updatedAt))
      .limit(1),
    db
      .select({ id: racesTable.id, name: racesTable.name })
      .from(racesTable)
      .where(
        and(
          eq(racesTable.clerkId, clerkId),
          eq(racesTable.raceDate, session.sessionDate),
        ),
      )
      .limit(1),
  ]);

  const workout = workouts[0] ?? null;
  const race = races[0] ?? null;

  const feedbackRows = workout
    ? await db
        .select({
          feedbackType: workoutFeedbackTable.feedbackType,
          note: workoutFeedbackTable.note,
          createdAt: workoutFeedbackTable.createdAt,
        })
        .from(workoutFeedbackTable)
        .where(
          and(
            eq(workoutFeedbackTable.clerkId, clerkId),
            eq(workoutFeedbackTable.workoutId, workout.id),
          ),
        )
        .orderBy(desc(workoutFeedbackTable.createdAt))
    : [];

  // Prediction honesty gate: any snapshot (active OR superseded) created
  // before the ride was recorded proves a real forecast existed beforehand.
  let predictionAvailable = false;
  if (workout) {
    const [prior] = await db
      .select({ id: corePredictionsTable.id })
      .from(corePredictionsTable)
      .where(
        and(
          eq(corePredictionsTable.clerkId, clerkId),
          eq(corePredictionsTable.plannedWorkoutId, workout.id),
          lt(corePredictionsTable.createdAt, session.createdAt),
        ),
      )
      .limit(1);
    predictionAvailable = Boolean(prior);
  }

  const consequence = assessConsequence({
    session: {
      tss: session.tss,
      durationMin: session.durationMin,
      type: session.type,
    },
    workout: workout
      ? {
          id: workout.id,
          title: workout.title,
          targetTSS: workout.targetTSS,
          targetDurationMin: workout.targetDurationMin,
        }
      : null,
    feedbackTypes: feedbackRows.map((f) => f.feedbackType),
    race,
  });

  return {
    session,
    workout: workout
      ? {
          id: workout.id,
          title: workout.title,
          scheduledDate: workout.scheduledDate,
          targetTSS: workout.targetTSS,
          targetDurationMin: workout.targetDurationMin,
          status: workout.status,
        }
      : null,
    feedback: feedbackRows.map((f) => ({
      feedbackType: f.feedbackType,
      note: f.note,
      createdAt: f.createdAt.toISOString(),
    })),
    consequence,
    race,
    predictionAvailable,
  };
}

router.get("/sync-status", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json(await buildSyncStatus(clerkId));
  } catch (err) {
    req.log.error({ err }, "ride-story.sync-status failed");
    res.status(500).json({ error: "Synchronisatiestatus ophalen mislukt" });
  }
});

router.get("/moment", requireAuth, async (req: Request, res: Response) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [profileRows, sync] = await Promise.all([
      db
        .select({ healthStatus: athleteProfilesTable.healthStatus })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId))
        .limit(1),
      buildSyncStatus(clerkId),
    ]);

    const healthStatus = profileRows[0]?.healthStatus ?? "ok";
    const suppressed = healthStatus === "sick" || healthStatus === "injured";

    // Freshest hub-imported ride within the window that produced a session.
    const cutoff = new Date(Date.now() - FRESH_WINDOW_HOURS * 60 * 60 * 1000);
    const [fresh] = await db
      .select({ sessionId: connectorActivitiesTable.normalizedSessionId })
      .from(connectorActivitiesTable)
      .where(
        and(
          eq(connectorActivitiesTable.clerkId, clerkId),
          gte(connectorActivitiesTable.importedAt, cutoff),
          isNotNull(connectorActivitiesTable.normalizedSessionId),
        ),
      )
      .orderBy(desc(connectorActivitiesTable.importedAt))
      .limit(1);

    if (suppressed || !fresh?.sessionId) {
      res.json({
        suppressed,
        suppressReason: suppressed ? "health" : null,
        story: null,
        sync,
      });
      return;
    }

    const [session] = await db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.id, fresh.sessionId),
          eq(trainingSessionsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (!session) {
      res.json({ suppressed: false, suppressReason: null, story: null, sync });
      return;
    }

    const story = await buildStory(clerkId, session);
    res.json({ suppressed: false, suppressReason: null, story, sync });
  } catch (err) {
    req.log.error({ err }, "ride-story.moment failed");
    res.status(500).json({ error: "Na-rit moment ophalen mislukt" });
  }
});

router.get(
  "/session/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const sessionId = Number(String(req.params.id));
    if (!Number.isInteger(sessionId)) {
      res.status(400).json({ error: "Ongeldig rit-id" });
      return;
    }
    try {
      const [session] = await db
        .select()
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.id, sessionId),
            eq(trainingSessionsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      if (!session) {
        res.status(404).json({ error: "Deze rit is niet gevonden" });
        return;
      }
      res.json(await buildStory(clerkId, session));
    } catch (err) {
      req.log.error({ err }, "ride-story.session failed");
      res.status(500).json({ error: "Rit-verhaal ophalen mislukt" });
    }
  },
);

export default router;
