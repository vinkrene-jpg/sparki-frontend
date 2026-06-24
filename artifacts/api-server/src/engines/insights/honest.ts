// "Sparki, eerlijk?" — one honest observation, founded only on real signals.
//
// Hard rules (mirrors the voice engine): Sparki is never mean, never arrogant,
// never ungrounded. When the data does not support a claim it says so plainly
// ("Ik heb daar nog onvoldoende bewijs voor.") rather than inventing one. The
// composition is deterministic: same signals → same observation.

import type { InsightSignals, SelfType } from "./signals";

export type HonestObservation = {
  text: string;
  /** True when the line is backed by real evidence; false = honest "not yet". */
  founded: boolean;
  /** Stable identifier for the chosen branch (used by tests + the UI). */
  kind:
    | "underestimates"
    | "better_than_thought"
    | "doubts_theory"
    | "insufficient";
};

const INSUFFICIENT: HonestObservation = {
  text: "Ik heb daar nog onvoldoende bewijs voor.",
  founded: false,
  kind: "insufficient",
};

// A confident self-claim that the data can contradict. "geen_idee" / "ik_zie_wel"
// are modest claims — they can't be "wrong", only under-confident.
function claimContradicted(selfType: SelfType, s: InsightSignals): boolean {
  if (s.totalSessions < 4) return false;
  if (selfType === "sprinter")
    return s.avgDurationMin != null && s.avgDurationMin > 90;
  if (selfType === "diesel")
    return s.avgDurationMin != null && s.avgDurationMin < 45;
  if (selfType === "alleskunner") return s.distinctTypes < 2;
  return false;
}

export function composeHonest(s: InsightSignals): HonestObservation {
  // Need a real base of evidence before Sparki says anything pointed at all.
  if (s.totalSessions < 3) return INSUFFICIENT;

  // 1. A clear, measurable step up versus the athlete's own baseline.
  if (
    s.recentAvgTss != null &&
    s.baselineAvgTss != null &&
    s.recentAvgTss > Math.round(s.baselineAvgTss * 1.1)
  ) {
    return {
      text: "Dat was beter dan jij dacht.",
      founded: true,
      kind: "better_than_thought",
    };
  }

  // 2. A confident claim the real rides contradict.
  if (s.selfType != null && claimContradicted(s.selfType, s)) {
    return {
      text: "Ik heb twijfels bij jouw theorie.",
      founded: true,
      kind: "doubts_theory",
    };
  }

  // 3. Modest self-claim, but a steady real base that holds up — gentle nudge.
  if (
    (s.selfType === "geen_idee" || s.selfType === "ik_zie_wel") &&
    s.totalSessions >= 5 &&
    s.recentAvgTss != null &&
    s.baselineAvgTss != null &&
    s.recentAvgTss >= s.baselineAvgTss
  ) {
    return {
      text: "Volgens mij onderschat je jezelf regelmatig.",
      founded: true,
      kind: "underestimates",
    };
  }

  // Nothing the data truly supports yet — say so honestly.
  return INSUFFICIENT;
}
