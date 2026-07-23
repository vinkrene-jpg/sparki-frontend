// Sparki Voice & Personality Engine — public API.
//
// One central place for Sparki's voice. Callers describe the situation (event +
// trust + memory + sport); the engine returns the line. No raw user-facing copy
// should live anywhere else.

export * from "./types";
export { composeVoice, isToneUnlocked, isToneAvailable } from "./compose";
export { insightLineAllowed } from "./policy";
export { computeTrust, computeScore, scoreToTier } from "./trust";
export { EVENTS, SPORT_NOUN } from "./phrases";

import type { TrustTier, VoiceTone, MemoryRef } from "./types";

/** Human-readable Dutch label for each style — for athlete-facing explanations. */
export const TONE_LABELS: Record<VoiceTone, string> = {
  observer: "Observerend",
  curious: "Nieuwsgierig",
  dry_humor: "Droge humor",
  cynical: "Licht cynisch",
  supportive: "Steunend",
};

/** Human-readable Dutch label for each trust tier. */
export const TIER_LABELS: Record<TrustTier, string> = {
  nieuw: "Net kennisgemaakt",
  kennismaking: "Aan het kennismaken",
  vertrouwd: "Vertrouwd",
  maat: "Maatjes",
};

/** One-line Dutch explanation of what a tier means for how Sparki talks. */
export const TIER_BLURB: Record<TrustTier, string> = {
  nieuw: "Sparki houdt het rustig en maakt nog geen aannames.",
  kennismaking: "Sparki wordt nieuwsgieriger naarmate hij je beter leert kennen.",
  vertrouwd: "Sparki durft nu ook droge humor te gebruiken.",
  maat: "Sparki kent je — droog, soms licht cynisch, altijd eerlijk.",
};

/** Map a memory's kind → a ready-to-read Dutch reference for relational lines. */
export function memoryTopic(kind: string): MemoryRef {
  const topics: Record<string, string> = {
    school: "je examen",
    race: "je wedstrijd",
    injury: "je blessure",
    illness: "dat je ziek was",
    camp: "je trainingskamp",
    equipment: "je nieuwe materiaal",
    work: "je drukke week",
    family: "je thuissituatie",
    stress: "de spanning",
    sleep: "je slechte nachten",
    motivation: "je motivatie",
    sport: "je zware benen",
    general: "wat je laatst vertelde",
  };
  return { kind, topic: topics[kind] ?? topics.general! };
}
