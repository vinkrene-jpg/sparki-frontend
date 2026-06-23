import type {
  ObservationSignal,
  AiObservationCategory,
  AiObservationSeverity,
  AiObservationConfidence,
} from "@workspace/db";

// A cross-domain connection Sparki has formed. Every connection is fully
// explainable: the concrete `signals` it weighed, a precise `confidenceScore`
// (0..1, never 1.0 — Sparki is never certain), and honest
// `alternativeExplanations`. This is the contract the UI renders verbatim.
export type Connection = {
  dedupeKey: string;
  title: string;
  summary: string;
  observationText: string;
  category: AiObservationCategory;
  severity: AiObservationSeverity;
  detectedPattern: string;
  signals: ObservationSignal[];
  confidenceScore: number;
  confidence: AiObservationConfidence;
  alternativeExplanations: string[];
  recommendedAction?: string;
};

export function scoreToConfidence(score: number): AiObservationConfidence {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

// Confidence is built from three honest ingredients and clamped to [0.1, 0.95]:
//   - sample: how many independent data points support it
//   - effect: how strong the difference / trend is (0..1, caller-normalised)
//   - agreement: fraction of points that point the same way (0..1)
// A memory reinforcement (a prior observation saying the same thing) adds a
// small, bounded boost. Sparki never reaches absolute certainty.
export function buildConfidence(opts: {
  sample: number;
  effect: number;
  agreement: number;
  memoryReinforced?: boolean;
}): number {
  const sampleTerm =
    opts.sample >= 8 ? 0.5 : opts.sample >= 5 ? 0.42 : opts.sample >= 3 ? 0.32 : 0.2;
  const effectTerm = Math.max(0, Math.min(1, opts.effect)) * 0.25;
  const agreementTerm = Math.max(0, Math.min(1, opts.agreement)) * 0.2;
  const memoryTerm = opts.memoryReinforced ? 0.1 : 0;
  const raw = sampleTerm + effectTerm + agreementTerm + memoryTerm;
  return Math.max(0.1, Math.min(0.95, Number(raw.toFixed(2))));
}
