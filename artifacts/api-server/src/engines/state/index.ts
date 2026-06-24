// Sparki State Engine — public facade.
//
// A generic, surface-agnostic service that derives one honest toestand for an
// athlete today from the SAME real signal intake the observation engine uses
// (no duplicate gathering, no fabrication). It belongs to no single screen: it
// is the shared source for Vandaag (its first consumer), and — without any
// change — for Training, Races, Routeplanner, Live Ride, notifications, widgets,
// Sparki Display, coach views and public APIs. Consumers import from here only,
// never the internals.

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
