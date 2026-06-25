// Core-prediction engine — public facade.
//
// Sparki's honest forecast of what ONE planned training does to the athlete's
// living Core, frozen as an IMMUTABLE snapshot. Consumers (the route layer) call
// only this facade; the pure compute lives in predict.ts/compare.ts/tss.ts.
//
// Immutability contract:
//  - While a workout is upcoming, the prediction is recomputed ONLY when a
//    pre-known input changes (fingerprinted by inputHash); the previous row is
//    marked superseded (kept for history, never mutated).
//  - Once a workout is executed, the snapshot is never recomputed — we read the
//    frozen row and attach a live predicted-vs-actual comparison.

import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  corePredictionsTable,
  plannedWorkoutsTable,
  trainingSessionsTable,
  type PlannedWorkout,
  type WorkoutStructure,
} from "@workspace/db";
import { gatherSignals } from "../observation";
import { computeState } from "../state/compute";
import type { SignalIntake } from "../observation/types";
import { computeRiskSignal } from "../../lib/recovery-load";
import {
  computePrediction,
  projectLoad,
  type PredictInput,
  type PredictWorkout,
} from "./predict";
import { compareExecution, type ActualEnd, type ExecutedSession } from "./compare";
import type { ActualFrame, CorePrediction } from "./types";

export * from "./types";
export { computePrediction, projectLoad, RECOVERY_DAYS } from "./predict";
export type { PredictWorkout, PredictInput } from "./predict";
export { estimateTssFromStructure } from "./tss";
export { compareExecution } from "./compare";

function toPredictWorkout(w: PlannedWorkout): PredictWorkout {
  return {
    id: w.id,
    title: w.title,
    scheduledDate: w.scheduledDate,
    targetTSS: w.targetTSS,
    targetDurationMin: w.targetDurationMin,
    structure: (w.structure as WorkoutStructure | null) ?? null,
  };
}

// Stable fingerprint of EVERY pre-known input the prediction + its factors
// depend on. A change in ANY of these (while still upcoming) triggers a fresh,
// superseding snapshot. The contract is "re-predict only when a pre-known input
// changes" — so the hash must cover every signal that materially moves the
// forecast or a determining factor, not just a narrow subset. We fingerprint the
// same data fed to `computePrediction` (metrics + deep workout structure + the
// signal-availability map + missing channels), excluding only volatile/derived,
// non-deterministic fields (timestamps, athlete name, computed confidence).
export type InputHashWorkout = {
  targetTSS: number | null;
  targetDurationMin: number | null;
  scheduledDate: string;
  type: string;
  structure: unknown;
};

export function computeInputHash(intake: SignalIntake, w: InputHashWorkout): string {
  const m = intake.metrics;
  const structure = (w.structure as WorkoutStructure | null) ?? null;
  const sig = {
    // Workout — load drivers + the FULL structure (block durations/reps/%FTP/zones),
    // not just the count, since deep structure changes the during/end path.
    workout: {
      tss: w.targetTSS,
      dur: w.targetDurationMin,
      date: w.scheduledDate,
      type: w.type,
      structure,
    },
    // Load base.
    load: { ctl: m.load.ctl, atl: m.load.atl, tsb: m.load.tsb, sessions: m.loadSessions },
    // Today's readiness + health.
    readiness: { label: m.readiness.label, score: m.readiness.score },
    health: m.healthStatus,
    // Recovery + lifestyle signals that shape the rebound and the factor list.
    sleep: m.sleep,
    hrv: m.hrv,
    restingHr: m.restingHr,
    feel: m.feel,
    fatigue: m.fatigue,
    ftp: m.ftp,
    nutrition: m.nutrition,
    // Race context (proximity/priority colours the forecast + factors).
    races: m.races,
    // Availability map of every signal channel — captures a factor flipping
    // present/estimated/missing even when the underlying number is unchanged.
    signals: intake.signals
      .map((s) => `${s.kind}:${s.status}`)
      .sort(),
    missing: [...intake.missing].sort(),
  };
  const json = JSON.stringify(sig);
  // djb2 — deterministic, dependency-free, sufficient as a change fingerprint.
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/**
 * Run (or read) the Core prediction for one planned workout owned by clerkId.
 * Returns null when the workout does not exist or is not owned by the athlete.
 */
export async function runCorePrediction(
  clerkId: string,
  workoutId: number,
): Promise<CorePrediction | null> {
  const [workout] = await db
    .select()
    .from(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.id, workoutId),
        eq(plannedWorkoutsTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  if (!workout) return null;

  const intake = await gatherSignals(clerkId);
  const currentState = computeState(intake);
  const inputHash = computeInputHash(intake, workout);
  const executed = workout.status === "completed" || workout.sessionId != null;

  // The most recent active (non-superseded) snapshot, if any.
  const [active] = await db
    .select()
    .from(corePredictionsTable)
    .where(
      and(
        eq(corePredictionsTable.plannedWorkoutId, workoutId),
        isNull(corePredictionsTable.supersededAt),
      ),
    )
    .orderBy(desc(corePredictionsTable.createdAt))
    .limit(1);

  let prediction: CorePrediction;

  const buildInput = (): PredictInput => ({
    today: intake.today,
    athleteName: intake.athleteName,
    metrics: intake.metrics,
    signals: intake.signals,
    missing: intake.missing,
    currentState,
    workout: toPredictWorkout(workout),
  });

  if (executed) {
    // Frozen forever once executed. Compute + freeze once if it predates the feature.
    if (active) {
      prediction = active.prediction as CorePrediction;
    } else {
      prediction = computePrediction(buildInput());
      await db.insert(corePredictionsTable).values({
        clerkId,
        plannedWorkoutId: workoutId,
        inputHash,
        prediction,
      });
    }
    prediction = await attachComparison(prediction, workout, intake, currentState);
  } else if (active && active.inputHash === inputHash) {
    // Upcoming + nothing pre-known changed → return the frozen snapshot.
    prediction = active.prediction as CorePrediction;
  } else {
    // Upcoming + first run or a pre-known input changed → fresh superseding snapshot.
    prediction = computePrediction(buildInput());
    if (active) {
      await db
        .update(corePredictionsTable)
        .set({ supersededAt: new Date() })
        .where(eq(corePredictionsTable.id, active.id));
    }
    await db.insert(corePredictionsTable).values({
      clerkId,
      plannedWorkoutId: workoutId,
      inputHash,
      prediction,
    });
  }

  return prediction;
}

// A coarse, honest TSS estimate from session duration alone, used ONLY when no
// TSS was logged so the start→end comparison is still possible from summary data.
// Assumes a conservative endurance intensity factor (IF ≈ 0.7): TSS ≈ (min/60)·IF²·100.
// Clearly surfaced as "geschat" everywhere it surfaces — never presented as real.
function coarseTssFromDuration(durationMin: number | null): number | null {
  if (durationMin == null || durationMin <= 0) return null;
  return Math.round((durationMin / 60) * 0.7 * 0.7 * 100);
}

// Attach a live predicted-vs-actual comparison to an executed workout's frozen
// prediction. Honest: the actual end Core is recomputed from the REAL session
// load via the same compute path; if no TSS was logged a coarse estimate from
// duration keeps the start→end path available (marked "geschat"); the rebound is
// only read once enough days have passed.
async function attachComparison(
  prediction: CorePrediction,
  workout: PlannedWorkout,
  intake: SignalIntake,
  currentState: SparkiStateLike,
): Promise<CorePrediction> {
  let session: ExecutedSession | null = null;
  let actualEnd: ActualEnd | null = null;
  let actualTssBasis: "present" | "estimated" | "missing" = "missing";
  let effectiveActualTss: number | null = null;

  if (workout.sessionId != null) {
    const [row] = await db
      .select()
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, workout.sessionId))
      .limit(1);
    if (row) {
      session = {
        tss: row.tss,
        durationMin: row.durationMin,
        feelScore: row.feelScore,
        sessionDate: row.sessionDate,
      };
      // Resolve the effective actual load: real TSS first, else a coarse estimate
      // from duration so a start→end comparison is always possible.
      if (row.tss != null) {
        effectiveActualTss = row.tss;
        actualTssBasis = "present";
      } else {
        const coarse = coarseTssFromDuration(row.durationMin);
        if (coarse != null) {
          effectiveActualTss = coarse;
          actualTssBasis = "estimated";
        }
      }

      // Recompute the end Core from the base load + the effective session load.
      const nowFrame = prediction.frames.find((f) => f.phase === "now");
      if (effectiveActualTss != null && nowFrame) {
        const endLoad = projectLoad(nowFrame.load, effectiveActualTss, 0);
        const endState = computeState({
          today: intake.today,
          athleteName: intake.athleteName,
          metrics: {
            ...intake.metrics,
            load: endLoad,
            risk: computeRiskSignal({
              load: endLoad,
              readiness: intake.metrics.readiness,
              healthStatus: intake.metrics.healthStatus,
            }),
          },
          signals: intake.signals,
          missing: intake.missing,
        });
        actualEnd = {
          x: endState.x,
          y: endState.y,
          tsb: endLoad.tsb,
          band: endState.band,
          tension: endState.tension,
          distortion: endState.distortion,
          movement: endState.movement,
        };
      }
    }
  }

  if (!session) {
    // Marked completed but no linked session — be honest, no fabricated actuals.
    // The start (frozen "now") is still real; end/recovery are pending.
    const nowFrame = prediction.frames.find((f) => f.phase === "now");
    const endFrame = prediction.frames.find((f) => f.phase === "end");
    const actualPath: ActualFrame[] = [];
    if (nowFrame) {
      actualPath.push({
        phase: "start",
        label: "Start",
        status: "measured",
        x: nowFrame.x,
        y: nowFrame.y,
        band: nowFrame.band,
        tension: nowFrame.tension,
        distortion: nowFrame.distortion,
        movement: nowFrame.movement,
        tsb: nowFrame.load.tsb,
        note: `Je begon ${nowFrame.band}.`,
      });
    }
    actualPath.push(
      {
        phase: "end",
        label: "Direct na",
        status: "pending",
        x: null,
        y: null,
        band: null,
        tension: null,
        distortion: null,
        movement: null,
        tsb: null,
        note: "Koppel je rit om het werkelijke effect te zien.",
      },
      {
        phase: "recovery",
        label: "Na herstel",
        status: "pending",
        x: null,
        y: null,
        band: null,
        tension: null,
        distortion: null,
        movement: null,
        tsb: null,
        note: "Af te lezen zodra je rit gekoppeld is.",
      },
    );
    return {
      ...prediction,
      comparison: {
        executed: true,
        plannedTss: prediction.tss,
        actualTss: null,
        actualTssBasis: "missing",
        predictedEnd: endFrame
          ? { x: endFrame.x, y: endFrame.y, tsb: endFrame.load.tsb }
          : null,
        actualEnd: null,
        actualPath,
        deviations: [
          "Deze training is afgerond, maar er is nog geen rit aan gekoppeld — zodra je de sessie koppelt vergelijkt Sparki voorspeld met werkelijk.",
        ],
        reboundStatus: "pending",
        reboundNote: "Koppel je rit om de werkelijke terugveer te kunnen aflezen.",
      },
    };
  }

  const comparison = compareExecution(
    prediction,
    session,
    actualEnd,
    actualTssBasis,
    effectiveActualTss,
    currentState,
    intake.today,
  );
  return { ...prediction, comparison };
}

// Local structural alias to avoid importing the full SparkiState here twice.
type SparkiStateLike = ReturnType<typeof computeState>;
