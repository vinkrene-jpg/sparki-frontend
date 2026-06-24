// Sparki's curiosity open-loops. Each loop is a single teaser line that Sparki
// only opens when there is REAL evidence behind it (rule: no fabricated
// suspense). The catalog is deterministic: same signals → same set of loops, in
// a stable priority order. A loop with no evidence is simply never returned.

import type { InsightSignals } from "./signals";

export type OpenLoopId =
  | "theory_about_you"
  | "missing_puzzle"
  | "something_in_data"
  | "two_explanations"
  | "starting_to_understand";

export type OpenLoop = {
  id: OpenLoopId;
  /** The user-facing teaser (plain Dutch, never reveals the conclusion). */
  text: string;
  /** Why Sparki is allowed to open this loop — drives the evidence gate. */
  evidence: (s: InsightSignals) => boolean;
};

// Order = priority. The route returns evidence-backed loops in this order.
export const OPEN_LOOPS: OpenLoop[] = [
  {
    id: "theory_about_you",
    text: "Ik heb een theorie over jou.",
    // A self-claim to test, plus enough real rides to start forming a counter-view.
    evidence: (s) => s.selfType != null && s.totalSessions >= 3,
  },
  {
    id: "missing_puzzle",
    text: "Ik mis nog één puzzelstuk.",
    // A concretely missing input Sparki still needs (estimated FTP or no weight).
    evidence: (s) => s.ftpEstimated || s.weightMissing,
  },
  {
    id: "something_in_data",
    text: "Er zit iets opvallends in jouw data.",
    // Enough sessions on record that a pattern could genuinely exist.
    evidence: (s) => s.totalSessions >= 5,
  },
  {
    id: "two_explanations",
    text: "Ik twijfel tussen twee verklaringen.",
    // Mixed session types give two real candidate stories to weigh.
    evidence: (s) => s.distinctTypes >= 2 && s.totalSessions >= 4,
  },
  {
    id: "starting_to_understand",
    text: "Ik denk dat ik je begin te begrijpen.",
    // Time together plus something shared or trained — a real relationship signal.
    evidence: (s) => s.daysKnown >= 7 && (s.memoriesCount >= 1 || s.totalSessions >= 6),
  },
];

/** All loops whose real-evidence gate is currently satisfied, in priority order. */
export function computeOpenLoops(
  s: InsightSignals,
): { id: OpenLoopId; text: string }[] {
  return OPEN_LOOPS.filter((l) => l.evidence(s)).map((l) => ({
    id: l.id,
    text: l.text,
  }));
}
