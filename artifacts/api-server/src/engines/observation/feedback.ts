// Coaching feedback loop.
//
// When an athlete reacts to Sparki's coaching ("te streng", "geef meer uitleg",
// advies opgevolgd/genegeerd), that is a real preference signal. We persist it
// into the existing coaching profile (begeleidingsprofiel) so Sparki's voice
// adapts over time. The mapping is pure and testable; persistence reuses the
// coaching-profile tally store — nothing new is invented.

import { observeDimension } from "../../lib/profile/coaching-profile";
import type { CoachingDimensionKey } from "../../lib/profile/coaching-profile";

export const COACH_FEEDBACK_SIGNALS = [
  "advice_followed",
  "advice_ignored",
  "wants_more_detail",
  "wants_less_detail",
  "wants_more_guidance",
  "wants_less_guidance",
  "too_strict",
  "too_soft",
] as const;
export type CoachFeedbackSignal = (typeof COACH_FEEDBACK_SIGNALS)[number];

export function isCoachFeedbackSignal(v: string): v is CoachFeedbackSignal {
  return (COACH_FEEDBACK_SIGNALS as readonly string[]).includes(v);
}

export type DimensionNudge = {
  key: CoachingDimensionKey;
  value: string;
  weight: number;
};

// Each feedback signal nudges one or more coaching dimensions. Weights stay
// modest so a single reaction shifts the tally without overruling deliberate
// onboarding answers (which carry weight 5).
const NUDGES: Record<CoachFeedbackSignal, DimensionNudge[]> = {
  advice_followed: [{ key: "decisionMaking", value: "directed", weight: 0.6 }],
  advice_ignored: [
    { key: "decisionMaking", value: "autonomous", weight: 0.6 },
    { key: "behaviorStyle", value: "spontaneous", weight: 0.3 },
  ],
  wants_more_detail: [
    { key: "communicationStyle", value: "analytical", weight: 1.0 },
    { key: "learningPreference", value: "data", weight: 0.5 },
  ],
  wants_less_detail: [
    { key: "communicationStyle", value: "direct", weight: 1.0 },
  ],
  wants_more_guidance: [{ key: "guidanceNeed", value: "high", weight: 1.0 }],
  wants_less_guidance: [{ key: "guidanceNeed", value: "low", weight: 1.0 }],
  too_strict: [
    { key: "mentalSupportNeed", value: "high", weight: 0.8 },
    { key: "behaviorStyle", value: "flexible", weight: 0.4 },
  ],
  too_soft: [
    { key: "communicationStyle", value: "direct", weight: 0.6 },
    { key: "guidanceNeed", value: "high", weight: 0.4 },
  ],
};

/** Pure: the dimension nudges a feedback signal implies (no persistence). */
export function mapFeedbackToDimensions(
  signal: CoachFeedbackSignal,
): DimensionNudge[] {
  return NUDGES[signal] ?? [];
}

/**
 * Persist a coaching-preference signal into the begeleidingsprofiel. Validates
 * the signal first; unknown signals are ignored. Returns the nudges applied.
 */
export async function recordCoachingFeedback(
  clerkId: string,
  signal: string,
): Promise<DimensionNudge[]> {
  if (!isCoachFeedbackSignal(signal)) return [];
  const nudges = mapFeedbackToDimensions(signal);
  for (const n of nudges) {
    await observeDimension(clerkId, n.key, n.value, n.weight);
  }
  return nudges;
}
