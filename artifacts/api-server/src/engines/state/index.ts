// Sparki State Engine — public facade.
//
// One honest toestand for an athlete today, derived from the SAME real signal
// intake the observation engine uses (no duplicate gathering, no fabrication).
// Routes import from here, never the internals.

import { gatherSignals } from "../observation";
import { computeState } from "./compute";
import type { SparkiState } from "./types";

export * from "./types";
export { computeState } from "./compute";
export type { StateComputeInput } from "./compute";

/** Gather every real signal for an athlete and derive today's Sparki state. */
export async function runStateAnalysis(clerkId: string): Promise<SparkiState> {
  const intake = await gatherSignals(clerkId);
  return computeState(intake);
}
