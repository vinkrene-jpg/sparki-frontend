// Sparki Voice & Personality Engine — shared types.
//
// Sparki is one character: intelligent, observing, curious, dry, lightly cynical,
// sometimes funny — never mean, never arrogant, never a schoolteacher or hype-guru.
// Every line is produced deterministically from: tone + trust + event + memory +
// sport. No raw text is scattered through the app; this engine is the only source.

/** The five communication styles Sparki can speak in. */
export const voiceTones = [
  "observer",
  "curious",
  "dry_humor",
  "cynical",
  "supportive",
] as const;
export type VoiceTone = (typeof voiceTones)[number];

/** How well Sparki "knows" the athlete — grows with real interaction. */
export const trustTiers = ["nieuw", "kennismaking", "vertrouwd", "maat"] as const;
export type TrustTier = (typeof trustTiers)[number];

/** The situations Sparki reacts to. Setback events force empathy over humor. */
export const voiceEvents = [
  "greeting",
  "good_form",
  "improvement",
  "plateau",
  "rest_day",
  "streak",
  "missed_training",
  "race_upcoming",
  "race_done_good",
  "race_done_bad",
  "setback",
  "fall",
  "illness",
  "injury",
  "memory_followup",
  "equipment_change",
  "pattern_found",
] as const;
export type VoiceEvent = (typeof voiceEvents)[number];

/** Sport flavour. "general" produces a sport-neutral line. */
export const sportTypes = [
  "wielrennen",
  "mtb",
  "veldrijden",
  "baan",
  "gravel",
  "general",
] as const;
export type SportType = (typeof sportTypes)[number];

/** A relational reference to something the athlete told Sparki earlier. `topic`
 *  is a ready-to-read Dutch noun phrase, e.g. "je examen", "je blessure". */
export type MemoryRef = { kind: string; topic: string };

export type VoiceInput = {
  event: VoiceEvent;
  trust: TrustTier;
  /** Preferred style. The engine may override it for safety (setbacks) or trust. */
  tone?: VoiceTone;
  sport?: SportType;
  memory?: MemoryRef | null;
  /** Open-loop / pattern events only fire when there is real evidence to point at. */
  evidence?: boolean;
  /** Deterministic variant selection. Same seed + input → same line. */
  seed?: number;
};

export type VoiceLine = {
  text: string;
  /** The style actually used — may differ from the requested one. */
  tone: VoiceTone;
  /** True when an empathy check-in led the line (e.g. after a fall). */
  empathyFirst: boolean;
  /** True when the line is a curiosity hook backed by real evidence. */
  openLoop: boolean;
};

/** Interaction signals, read from real data, that feed the trust score. */
export type TrustSignals = {
  daysKnown: number;
  onboardingComplete: boolean;
  memoriesShared: number;
  followUpsAnswered: number;
  followUpsDismissed: number;
  positiveEvents: number;
  metricsLogged: number;
  friends: number;
};

export type TrustProfile = {
  score: number; // 0..1
  tier: TrustTier;
  signals: TrustSignals;
};
