// Core-prediction engine — shared types.
//
// Sparki's honest forecast of what ONE planned training does to the athlete's
// living Core: the current Core, the path it travels DURING the session, the
// position right at the END, and the recovery rebound after rest. Every number
// is deterministic and grounded in the real load model — nothing is fabricated.
// Determining factors carry an honest availability; missing ones are shown as
// "niet beschikbaar" with a reason, never guessed. Confidence is never 1.0.
//
// Internal keys stay English; every rendered string is plain Dutch.

import type { MovementDirection, StateBand } from "../state/types";

// The four moments shown as a filmstrip of the SAME living Core (no route/star/
// waypoint metaphor — the organism changes shape over the session).
export type FramePhase = "now" | "during" | "end" | "recovery";

// One frame of the predicted Core path. The position fields drive the shared
// stateToCore mapping on the client, exactly like a live SparkiState.
export type PredictionFrame = {
  phase: FramePhase;
  /** Plain-Dutch moment label, e.g. "Nu", "Tijdens", "Direct na", "Na herstel". */
  label: string;
  /** Short plain-Dutch one-liner for this moment. */
  caption: string;
  x: number;
  y: number;
  band: StateBand;
  tension: number;
  distortion: number;
  movement: { direction: MovementDirection; label: string };
  /** Per-frame certainty — "now" is the live state; future frames are lower. Never 1.0. */
  confidence: number;
  /** The real load numbers behind this frame. */
  load: { ctl: number; atl: number; tsb: number };
};

// How well Sparki knows a determining factor.
export type FactorAvailability = "present" | "estimated" | "missing";

// One determining factor behind the prediction, with honest availability.
export type PredictionFactor = {
  key: string;
  /** Plain-Dutch label, e.g. "Geplande belasting". */
  label: string;
  availability: FactorAvailability;
  /** Plain-Dutch: what Sparki knows, or why it is missing. */
  reading: string;
  /** Plain-Dutch: how this factor shapes the prediction (empty when missing). */
  impact: string;
};

// One moment of the REAL (post-execution) Core path, shown side-by-side with the
// predicted frames so the athlete sees voorspeld náást werkelijk.
export type ActualFramePhase = "start" | "end" | "recovery";

export type ActualFrame = {
  phase: ActualFramePhase;
  /** Plain-Dutch moment label, e.g. "Start", "Direct na", "Na herstel". */
  label: string;
  /** measured = from real data; estimated = coarse from session-summary (e.g. only duration); pending = not yet readable. */
  status: "measured" | "estimated" | "pending";
  /** Position fields drive the same living-shape Core; null only while pending. */
  x: number | null;
  y: number | null;
  band: StateBand | null;
  tension: number | null;
  distortion: number | null;
  movement: { direction: MovementDirection; label: string } | null;
  tsb: number | null;
  /** Plain-Dutch one-liner for this measured moment. */
  note: string;
};

// Predicted-vs-actual, computed live once the workout is executed.
export type PredictionComparison = {
  executed: boolean;
  plannedTss: number | null;
  actualTss: number | null;
  /** How Sparki knows the actual load: present (logged TSS), estimated (coarse from duration), missing. */
  actualTssBasis: FactorAvailability;
  predictedEnd: { x: number; y: number; tsb: number } | null;
  actualEnd: { x: number; y: number; tsb: number } | null;
  /** The REAL Core path (start → direct na → na herstel), rendered next to the predicted frames. */
  actualPath: ActualFrame[];
  /** Plain-Dutch explanations of every deviation from the prediction. */
  deviations: string[];
  /** Whether enough days have passed to read the real recovery rebound. */
  reboundStatus: "available" | "pending";
  reboundNote: string;
};

export type CorePrediction = {
  workoutId: number;
  generatedAt: string;
  scheduledDate: string;
  workoutTitle: string;
  /** The TSS the prediction was built on, and how Sparki knows it. */
  tss: number | null;
  tssBasis: FactorAvailability;
  /** [now, during, end, recovery] — or just [now] when no real prediction is possible. */
  frames: PredictionFrame[];
  factors: PredictionFactor[];
  /** Overall prediction certainty — always below 1.0. */
  confidence: number;
  confidenceLabel: string;
  /** Plain-Dutch headline + summary of the predicted effect. */
  headline: string;
  summary: string;
  /** Whether Sparki has enough to make a real prediction at all. */
  predictable: boolean;
  /** Predicted-vs-actual after execution; null while still upcoming. */
  comparison: PredictionComparison | null;
};
