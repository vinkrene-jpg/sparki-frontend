// Observation & Coach Engine V1 — shared types.
//
// Sparki's deterministic "coach brain". It weighs every real signal together,
// produces structured observations with a calibrated confidence (0–100%) plus a
// plain-Dutch reason for that confidence AND its uncertainty, lists which signals
// it used and which were missing, raises follow-up questions when signals
// conflict or a decisive one is absent, and composes a six-part daily analysis
// with explainable advice. Nothing is fabricated: a missing signal is a
// first-class fact, never a guessed value, and no conclusion is ever drawn from a
// single data point.

import type { Load, RiskSignal } from "../../lib/recovery-load";
import type { Readiness } from "../../lib/sharing";
import type { DayForecast } from "../../lib/weather/open-meteo";
import type { WeatherSeverity } from "../../lib/weather/assess";
import type {
  AiObservationCategory,
  AiObservationSeverity,
} from "@workspace/db";

// ── Signals ──────────────────────────────────────────────────────────────────

// Every distinct evidence channel Sparki can weigh. Internal keys stay English;
// every rendered string is Dutch.
export const SIGNAL_KINDS = [
  "training_load",
  "readiness",
  "hrv_trend",
  "resting_hr_trend",
  "sleep",
  "subjective_feel",
  "power_dev",
  "feedback",
  "health",
  "race_calendar",
  "nutrition",
  "weather",
] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

// present = enough real data to weigh; insufficient = some data but not enough to
// conclude on its own; missing = no data at all (an honest gap, never faked).
export type SignalStatus = "present" | "insufficient" | "missing";

export type IntakeSignal = {
  kind: SignalKind;
  status: SignalStatus;
  /** Plain-Dutch label for this channel. */
  label: string;
  /** Human-readable reading, e.g. "vormbalans -22" or null when missing. */
  value: string | null;
  /** Plain-Dutch reason a channel is insufficient/missing (honest gap). */
  reason?: string;
  /** How many real data points back this reading. */
  dataPoints: number;
};

// Direction of a multi-day trend (oldest → newest).
export type TrendInfo = {
  direction: "rising" | "falling" | "stable";
  first: number;
  last: number;
  delta: number;
  days: number;
};

// The numeric side of the intake — what the observation rules actually weigh.
export type IntakeMetrics = {
  load: Load;
  loadSessions: number;
  readiness: Readiness;
  risk: RiskSignal;
  hrv: TrendInfo | null;
  restingHr: TrendInfo | null;
  sleep: { latest: number | null; avg: number | null; days: number };
  feel: { latest: number | null; avg: number | null; days: number };
  fatigue: { latest: number | null; avg: number | null; days: number };
  ftp: { trend: TrendInfo | null; latest: number | null };
  feedback: {
    total: number;
    done: number;
    missed: number;
    tooHard: number;
    tooLight: number;
    pain: number;
    tired: number;
  };
  races: {
    nextA: { name: string; date: string; daysUntil: number } | null;
    nextAny: { name: string; date: string; daysUntil: number } | null;
    count: number;
  };
  nutrition: { logs: number };
  sessionsPerWeek: number | null;
  healthStatus: string;
  /**
   * Today's real weather at the athlete's home location, or an honest gap.
   * Optional so synthetic/test intakes that don't supply it default to a
   * "missing" weather signal (Sparki cannot fetch the weather without a home
   * location), never a fabricated reading.
   */
  weather?: WeatherIntake | null;
};

// Real home-location weather as the intake sees it. todayForecast is kept so the
// advice layer can assess weather against the *specific* session it recommends.
export type WeatherIntake = {
  available: boolean;
  reason: "ok" | "no_home" | "no_forecast";
  locationLabel: string | null;
  /** Plain-Dutch one-liner of today's conditions, e.g. "Regen, 8–14°C". */
  summaryText: string | null;
  /** Severity of today's conditions for an outdoor intensive ride. */
  severity: WeatherSeverity | null;
  todayForecast: DayForecast | null;
};

export type SignalIntake = {
  clerkId: string;
  today: string;
  athleteName: string;
  signals: IntakeSignal[];
  metrics: IntakeMetrics;
  /** Channels with no data at all — surfaced as a first-class list. */
  missing: SignalKind[];
};

// ── Confidence ───────────────────────────────────────────────────────────────

export type ConfidenceLevel = "low" | "medium" | "high";

export type Confidence = {
  /** 0–100, never 100 (Sparki weighs and estimates, it never pronounces). */
  score: number;
  level: ConfidenceLevel;
  /** Reden van vertrouwen — why Sparki is as sure as it is. */
  reasons: string[];
  /** Reden van onzekerheid — what holds the confidence back. */
  uncertainties: string[];
};

// ── Observations ─────────────────────────────────────────────────────────────

export type Observation = {
  /** Stable topic key (English, internal). */
  topic: string;
  /** Whether this is a positive note, a concern, or a neutral pattern. */
  tone: "positive" | "concern" | "neutral";
  /** Plain-Dutch statement (a calibrated observation, never a hard fact). */
  statement: string;
  confidence: Confidence;
  /** The real signals weighed for this observation. */
  signalsUsed: IntakeSignal[];
  /** Decisive channels that were absent (honest gaps). */
  signalsMissing: SignalKind[];
  category: AiObservationCategory;
  severity: AiObservationSeverity;
  /** Set when the observation rests on a recurring/multi-day pattern. */
  detectedPattern: string | null;
};

// ── Follow-up questions (doubt / contradiction module) ───────────────────────

/** One selectable answer to a follow-up question. value = engine-internal key. */
export type FollowUpOption = {
  value: string;
  label: string;
};

export type FollowUpQuestion = {
  id: string;
  /** Plain-Dutch question Sparki asks the athlete. */
  question: string;
  /** Plain-Dutch reason Sparki asks (the doubt or contradiction behind it). */
  because: string;
  /** Which channels an answer would clarify. */
  resolves: SignalKind[];
  /** The fixed set of answers the athlete can pick (in-app, max a few). */
  options: FollowUpOption[];
};

// ── Explainable advice (5 explainers) ────────────────────────────────────────

export const ADVICE_INTENSITIES = [
  "rust",
  "herstel",
  "rustig",
  "normaal",
  "stevig",
] as const;
export type AdviceIntensity = (typeof ADVICE_INTENSITIES)[number];

export type AdviceExplainers = {
  /** 1. Wat ik zie — the concrete signals. */
  watIkZie: string;
  /** 2. Wat ik denk — the interpretation/hypothesis, calibrated. */
  watIkDenk: string;
  /** 3. Waarom dit advies — why those signals lead here. */
  waaromDitAdvies: string;
  /** 4. Wat als het anders is — the most likely alternative explanation. */
  watAlsHetAndersIs: string;
  /** 5. Wat verandert mijn advies — the signal/threshold that would flip it. */
  watVerandertMijnAdvies: string;
};

export type Advice = {
  /** The directive, plain Dutch. */
  headline: string;
  intensity: AdviceIntensity;
  explainers: AdviceExplainers;
  /** Calibrated confidence in this advice (0–100, never 100). */
  confidence: Confidence;
};

// ── Actions (no dead-end insight: every advice gets a next step) ──────────────

export const COACH_ACTION_KINDS = [
  "adjust_training",
  "check_in",
  "rest",
  "nutrition",
  "add_race",
  "check_gear",
] as const;
export type CoachActionKind = (typeof COACH_ACTION_KINDS)[number];

export type CoachAction = {
  /** Stable key (internal). */
  key: string;
  kind: CoachActionKind;
  /** Plain-Dutch button label. */
  label: string;
  /** Plain-Dutch one-liner: why this step follows from the advice. */
  reason: string;
};

// ── Personalities ────────────────────────────────────────────────────────────

export const PERSONALITY_KEYS = [
  "beginner",
  "ervaren",
  "jeugdrenner",
  "ouder",
  "trainer",
  "topsporter",
] as const;
export type PersonalityKey = (typeof PERSONALITY_KEYS)[number];

export type Personality = {
  key: PersonalityKey;
  label: string;
  vocabulary: "simpel" | "normaal" | "technisch";
  encouragement: "hoog" | "normaal" | "laag";
  detail: "kort" | "normaal" | "uitgebreid";
  /** Plain-Dutch one-liner on why this personality was chosen. */
  basis: string;
};

// ── The six-part daily coach analysis ────────────────────────────────────────

export type CoachAnalysis = {
  date: string;
  athleteName: string;
  personality: Personality;
  // The six honest parts. Any part is null when there is too little to say.
  watValtOp: string | null; // Wat valt op?
  patronen: string | null; // Welke patronen zie ik?
  beterDanVerwacht: string | null; // Wat ging beter dan verwacht?
  verdientAandacht: string | null; // Wat verdient aandacht?
  adviesVandaag: string; // Mijn advies voor vandaag
  waaromAdvies: string; // Waarom ik dit advies geef
  // The structured backbone behind the prose.
  observations: Observation[];
  followUps: FollowUpQuestion[];
  advice: Advice;
  /** Concrete next steps — every advice gets at least one (no dead ends). */
  actions: CoachAction[];
  missing: SignalKind[];
};
