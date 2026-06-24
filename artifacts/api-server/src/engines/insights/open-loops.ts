// Sparki's curiosity open-loops. Each loop is a single teaser line that Sparki
// only opens when there is REAL evidence behind it (rule: no fabricated
// suspense). The catalog is deterministic: same signals → same set of loops, in
// a stable priority order. A loop with no evidence is simply never returned.
//
// Tone governance is delegated to the voice engine: every loop carries the voice
// `tone` it embodies, and the voice policy gate decides whether that tone is
// unlocked at the athlete's trust tier. Observational loops speak early; the more
// interpretive curiosity hooks ("a pattern", "I'm starting to understand you")
// are earned as trust grows — exactly as composeVoice gates its own lines.

import type { InsightSignals } from "./signals";
import { insightLineAllowed } from "../voice";
import type { TrustTier, VoiceTone } from "../voice";

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
  /** The voice tone this line embodies — gated against trust by the voice engine. */
  tone: VoiceTone;
  /** Why Sparki is allowed to open this loop — drives the evidence gate. */
  evidence: (s: InsightSignals) => boolean;
};

// Order = priority. The route returns evidence-backed loops in this order.
export const OPEN_LOOPS: OpenLoop[] = [
  {
    id: "theory_about_you",
    text: "Ik heb een theorie over jou.",
    // Observational: a self-claim plus real rides. Speaks from the first tier.
    tone: "observer",
    evidence: (s) => s.selfType != null && s.totalSessions >= 3,
  },
  {
    id: "missing_puzzle",
    text: "Ik mis nog één puzzelstuk.",
    // Observational: a concretely missing input (estimated FTP or no weight).
    tone: "observer",
    evidence: (s) => s.ftpEstimated || s.weightMissing,
  },
  {
    id: "something_in_data",
    text: "Er zit iets opvallends in jouw data.",
    // Interpretive curiosity — earned once Sparki knows the athlete a little.
    tone: "curious",
    evidence: (s) => s.totalSessions >= 5,
  },
  {
    id: "two_explanations",
    text: "Ik twijfel tussen twee verklaringen.",
    // Interpretive: weighing two real candidate stories — a curious hook.
    tone: "curious",
    evidence: (s) => s.distinctTypes >= 2 && s.totalSessions >= 4,
  },
  {
    id: "starting_to_understand",
    text: "Ik denk dat ik je begin te begrijpen.",
    // Relational + interpretive — the most "earned" loop of the set.
    tone: "curious",
    evidence: (s) => s.daysKnown >= 7 && (s.memoriesCount >= 1 || s.totalSessions >= 6),
  },
];

/**
 * All loops whose real-evidence gate is satisfied AND whose tone is unlocked at
 * the athlete's trust tier, in priority order. Brand-new athletes (low trust)
 * only ever see the calm observational loops; curiosity hooks unlock with trust.
 */
export function computeOpenLoops(
  s: InsightSignals,
  trust: TrustTier,
): { id: OpenLoopId; text: string }[] {
  return OPEN_LOOPS.filter(
    (l) =>
      l.evidence(s) &&
      insightLineAllowed({ trust, tone: l.tone, evidence: true }),
  ).map((l) => ({ id: l.id, text: l.text }));
}
