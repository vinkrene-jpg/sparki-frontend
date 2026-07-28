// "Sparki, eerlijk?" — one honest observation, founded only on real signals.
//
// Hard rules (mirrors the voice engine): Sparki is never mean, never arrogant,
// never ungrounded. When the data does not support a claim it says so plainly
// ("Onvoldoende data voor een onderbouwde observatie.") rather than inventing one. The
// composition is deterministic: same signals → same observation.

import type { InsightSignals, SelfType } from "./signals";
import { insightLineAllowed } from "../voice";
import type { TrustTier, VoiceTone } from "../voice";

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
  text: "Onvoldoende data voor een onderbouwde observatie.",
  founded: false,
  kind: "insufficient",
};

// The voice tone each founded observation embodies. The pointed "I doubt your
// theory" line is dry humor — earned at higher trust; until then Sparki simply
// holds it back (honest "not yet") rather than being pointed too early. The
// supportive / observational lines are available from the first tier.
const OBSERVATION_TONE: Record<
  Exclude<HonestObservation["kind"], "insufficient">,
  VoiceTone
> = {
  better_than_thought: "supportive",
  underestimates: "observer",
  doubts_theory: "dry_humor",
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

export function composeHonest(
  s: InsightSignals,
  trust: TrustTier,
): HonestObservation {
  // Need a real base of evidence before Sparki says anything pointed at all.
  if (s.totalSessions < 3) return INSUFFICIENT;

  let candidate: HonestObservation | null = null;

  // 1. A clear, measurable step up versus the athlete's own baseline.
  if (
    s.recentAvgTss != null &&
    s.baselineAvgTss != null &&
    s.recentAvgTss > Math.round(s.baselineAvgTss * 1.1)
  ) {
    candidate = {
      text: "Dat was beter dan jij dacht.",
      founded: true,
      kind: "better_than_thought",
    };
  }

  // 2. A confident claim the real rides contradict.
  else if (s.selfType != null && claimContradicted(s.selfType, s)) {
    candidate = {
      text: "Ik heb twijfels bij jouw theorie.",
      founded: true,
      kind: "doubts_theory",
    };
  }

  // 3. Modest self-claim, but a steady real base that holds up — gentle nudge.
  else if (
    (s.selfType === "geen_idee" || s.selfType === "ik_zie_wel") &&
    s.totalSessions >= 5 &&
    s.recentAvgTss != null &&
    s.baselineAvgTss != null &&
    s.recentAvgTss >= s.baselineAvgTss
  ) {
    candidate = {
      text: "Volgens mij onderschat je jezelf regelmatig.",
      founded: true,
      kind: "underestimates",
    };
  }

  // Nothing the data truly supports yet — say so honestly.
  if (candidate === null) return INSUFFICIENT;

  // Trust gates tone: a pointed observation that the athlete hasn't earned yet
  // stays unspoken (honest "not yet") rather than landing too early.
  const tone = OBSERVATION_TONE[candidate.kind as keyof typeof OBSERVATION_TONE];
  if (!insightLineAllowed({ trust, tone, evidence: true })) return INSUFFICIENT;

  return candidate;
}
