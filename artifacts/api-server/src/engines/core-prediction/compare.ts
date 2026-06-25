// Core-prediction engine — predicted-vs-actual.
//
// Once a workout is executed we hold Sparki to its forecast. The comparison is
// honest and deterministic: the END position is recomputed from the athlete's
// REAL session load (the same projection used to predict, but with the actual
// TSS, fed through the same computeState by the facade) and contrasted with the
// frozen prediction, then every deviation is explained in plain Dutch. A coarse
// start→end is ALWAYS available from session-summary data — when no TSS was
// logged the facade estimates the load from duration and marks it "geschat",
// never fabricated. The recovery rebound is only judged once enough real days
// have passed — until then it is honestly "nog niet te bepalen".

import type { MovementDirection, SparkiState } from "../state/types";
import { RECOVERY_DAYS } from "./predict";
import type { ActualFrame, CorePrediction, FactorAvailability, PredictionComparison } from "./types";

export type ExecutedSession = {
  tss: number | null;
  durationMin: number | null;
  feelScore: number | null;
  sessionDate: string;
};

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** The Core recomputed from the REAL (or coarse-estimated) session load. */
export type ActualEnd = {
  x: number;
  y: number;
  tsb: number;
  band: SparkiState["band"];
  tension: number;
  distortion: number;
  movement: { direction: MovementDirection; label: string };
};

export function compareExecution(
  prediction: CorePrediction,
  session: ExecutedSession,
  actualEnd: ActualEnd | null,
  /** How the actual load was resolved: present (logged TSS), estimated (from duration), missing. */
  actualTssBasis: FactorAvailability,
  /** The effective actual TSS used for the end position (real or coarse). */
  effectiveActualTss: number | null,
  /** Today's live Core — the real recovery rebound once enough days have passed. */
  currentState: SparkiState,
  today: string,
): PredictionComparison {
  const nowFrame = prediction.frames.find((f) => f.phase === "now") ?? null;
  const endFrame = prediction.frames.find((f) => f.phase === "end") ?? null;
  const recoveryFrame = prediction.frames.find((f) => f.phase === "recovery") ?? null;

  const plannedTss = prediction.tss;
  const actualTss = session.tss;
  const deviations: string[] = [];

  const predictedEnd = endFrame
    ? { x: endFrame.x, y: endFrame.y, tsb: endFrame.load.tsb }
    : null;
  const actualEndOut = actualEnd
    ? { x: actualEnd.x, y: actualEnd.y, tsb: actualEnd.tsb }
    : null;

  // ── Load deviation, against the EFFECTIVE actual (real or coarse) ───────────
  if (effectiveActualTss != null && plannedTss != null) {
    const diff = effectiveActualTss - plannedTss;
    const threshold = Math.max(8, Math.round(plannedTss * 0.12));
    const basisNote = actualTssBasis === "estimated" ? " (grof geschat uit de duur)" : "";
    if (diff > threshold) {
      deviations.push(
        `Je reed ${effectiveActualTss}${basisNote} belastingspunten in plaats van de geplande ${plannedTss}, dus je zakte dieper in vermoeidheid dan voorspeld.`,
      );
    } else if (diff < -threshold) {
      deviations.push(
        `Je reed ${effectiveActualTss}${basisNote} belastingspunten in plaats van de geplande ${plannedTss}, dus je hield meer over dan voorspeld.`,
      );
    } else {
      deviations.push(
        `Je belasting (${effectiveActualTss}${basisNote}) lag dicht bij de geplande ${plannedTss} — de voorspelling klopte goed.`,
      );
    }
  }
  if (actualTssBasis === "estimated") {
    deviations.push(
      "Er is geen exacte belasting (TSS) vastgelegd, dus Sparki schatte je werkelijke belasting grof uit de duur van de sessie.",
    );
  } else if (actualTssBasis === "missing") {
    deviations.push(
      "Voor deze sessie is geen belasting én geen duur vastgelegd, dus Sparki kan het werkelijke effect alleen ruw inschatten.",
    );
  }

  // Band shift, predicted vs actual (when we could recompute it).
  if (actualEnd && endFrame && actualEnd.band !== endFrame.band) {
    deviations.push(
      `Direct na de training sta je ${actualEnd.band}, terwijl Sparki ${endFrame.band} voorspelde.`,
    );
  }

  // Feel cross-check (only when logged).
  if (session.feelScore != null) {
    if (session.feelScore <= 4) {
      deviations.push(
        "Je gaf de sessie als zwaar aan — dat sluit aan bij een diepere dip dan op papier.",
      );
    } else if (session.feelScore >= 8) {
      deviations.push("Je gaf de sessie als licht aan — je herstelt waarschijnlijk vlotter.");
    }
  }

  // ── Recovery rebound: only readable once enough real days have passed ───────
  const daysSince = daysBetween(session.sessionDate, today);
  const reboundReady = daysSince >= RECOVERY_DAYS;
  let reboundNote: string;
  if (reboundReady && recoveryFrame) {
    reboundNote =
      currentState.band === recoveryFrame.band
        ? `Je terugveer klopt: je staat nu ${currentState.band}, zoals voorspeld.`
        : `Voorspeld na herstel: ${recoveryFrame.band}. Je staat nu ${currentState.band}.`;
  } else {
    reboundNote = `Je herstel-terugveer is na ~${RECOVERY_DAYS} dagen rust af te lezen — nu nog te vroeg.`;
  }

  // ── The REAL Core path, side-by-side with the predicted frames ─────────────
  // start: the frozen "now" the athlete actually departed from (measured).
  // end:   recomputed from the real/coarse session load.
  // recovery: today's live Core once enough days passed; otherwise pending.
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
  if (actualEnd) {
    actualPath.push({
      phase: "end",
      label: "Direct na",
      status: actualTssBasis === "estimated" ? "estimated" : "measured",
      x: actualEnd.x,
      y: actualEnd.y,
      band: actualEnd.band,
      tension: actualEnd.tension,
      distortion: actualEnd.distortion,
      movement: actualEnd.movement,
      tsb: actualEnd.tsb,
      note:
        actualTssBasis === "estimated"
          ? `Grof geschat sta je ${actualEnd.band}.`
          : `Direct na de training sta je ${actualEnd.band}.`,
    });
  }
  if (reboundReady) {
    actualPath.push({
      phase: "recovery",
      label: "Na herstel",
      status: "measured",
      x: currentState.x,
      y: currentState.y,
      band: currentState.band,
      tension: currentState.tension,
      distortion: currentState.distortion,
      movement: currentState.movement,
      tsb: null,
      note: `Nu sta je ${currentState.band}.`,
    });
  } else {
    actualPath.push({
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
      note: `Af te lezen na ~${RECOVERY_DAYS} dagen rust.`,
    });
  }

  return {
    executed: true,
    plannedTss,
    actualTss,
    actualTssBasis,
    predictedEnd,
    actualEnd: actualEndOut,
    actualPath,
    deviations,
    reboundStatus: reboundReady ? "available" : "pending",
    reboundNote,
  };
}
