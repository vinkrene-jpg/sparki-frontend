// Phased adaptive onboarding (task #18).
//
// The 4-question quick start collects the minimum needed to build a real first
// plan (sport, goal, experience, training days/week). From those answers Sparki
// derives an ESTIMATED weekly hour target + FTP (flagged as estimates) and a
// default weekday spread so the autonomous engine can immediately produce a
// committed first week + provisional 3-week preview.
//
// Everything else is gathered gradually via short follow-up prompts during
// normal use. This module owns the deterministic estimation helpers and the
// adaptive question catalog/engine. "Known" is derived from the athlete profile
// itself; the ask/skip lifecycle is tracked separately in onboarding_state.

import type { AthleteProfile, InsertAthleteProfile } from "@workspace/db";

// ── Core quick-start estimation ──────────────────────────────────────────────

export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "elite";

export const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "elite",
];

const HOURS_PER_DAY: Record<ExperienceLevel, number> = {
  beginner: 1.0,
  intermediate: 1.3,
  advanced: 1.6,
  elite: 2.0,
};

const ESTIMATED_FTP: Record<ExperienceLevel, number> = {
  beginner: 150,
  intermediate: 210,
  advanced: 270,
  elite: 320,
};

// Sensible default weekday spread for a given number of training days, biased
// toward mid-week quality + weekend long rides. The athlete can refine this
// later; the autonomous engine only needs *some* real available-day set.
const DAY_SPREADS: Record<number, string[]> = {
  1: ["sat"],
  2: ["tue", "sat"],
  3: ["tue", "thu", "sat"],
  4: ["tue", "thu", "sat", "sun"],
  5: ["mon", "tue", "thu", "sat", "sun"],
  6: ["mon", "tue", "wed", "thu", "sat", "sun"],
  7: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
};

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function estimateWeeklyHours(
  experience: ExperienceLevel,
  daysPerWeek: number,
): number {
  const perDay = HOURS_PER_DAY[experience] ?? 1.0;
  return Math.max(2, Math.round(perDay * clampInt(daysPerWeek, 1, 7)));
}

export function estimateFtp(experience: ExperienceLevel): number {
  return ESTIMATED_FTP[experience] ?? 180;
}

export function defaultAvailableDays(daysPerWeek: number): string[] {
  return DAY_SPREADS[clampInt(daysPerWeek, 1, 7)] ?? DAY_SPREADS[3]!;
}

// ── Progressive fact catalog ─────────────────────────────────────────────────

export type FactInputType = "number" | "text" | "choice";
export type FactOption = { value: string; label: string };
export type ProfilePatch = Partial<InsertAthleteProfile>;

export type FactKey =
  | "coachingMode"
  | "ftp"
  | "weightKg"
  | "loadCapacity"
  | "discipline"
  | "competitionLevel"
  | "age"
  | "heightCm"
  | "injuryHistory"
  | "motivation"
  | "typicalSleepHours"
  | "trainingPreferences";

type FactDef = {
  key: FactKey;
  prompt: string;
  help?: string;
  inputType: FactInputType;
  options?: FactOption[];
  unit?: string;
  placeholder?: string;
  // Higher = surfaced sooner. Adaptive deltas in `adjust` layer on top.
  basePriority: number;
  // Answering this changes a planning input → autonomous plan is regenerated.
  regeneratePlan?: boolean;
  isKnown: (p: AthleteProfile) => boolean;
  applies?: (p: AthleteProfile) => boolean;
  adjust?: (p: AthleteProfile) => number;
  // Validate raw input → profile patch, or null when invalid.
  parse: (value: unknown) => ProfilePatch | null;
};

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function currentYear(): number {
  return new Date().getUTCFullYear();
}

export function ageFromBirthYear(birthYear: number | null): number | null {
  if (birthYear == null) return null;
  return currentYear() - birthYear;
}

const DISCIPLINES: FactOption[] = [
  { value: "Road", label: "Road" },
  { value: "Gravel", label: "Gravel" },
  { value: "Mountain", label: "Mountain" },
  { value: "Track", label: "Track" },
];

const LOAD_OPTIONS: FactOption[] = [
  { value: "low", label: "I recover slowly — keep it gentle" },
  { value: "moderate", label: "Average — a normal build works" },
  { value: "high", label: "I can take a big load" },
];

const COMPETITION_OPTIONS: FactOption[] = [
  { value: "none", label: "Just for fitness & fun" },
  { value: "recreational", label: "Gran fondos / sportives" },
  { value: "local", label: "Local races" },
  { value: "regional", label: "Regional races" },
  { value: "national", label: "National / elite level" },
];

const COACHING_OPTIONS: FactOption[] = [
  { value: "sparki", label: "Train with Sparki" },
  { value: "coach", label: "Train with a coach" },
];

const FACTS: FactDef[] = [
  {
    key: "coachingMode",
    prompt: "Who's guiding your training?",
    help: "Sparki can coach you autonomously, or you can connect with a human coach.",
    inputType: "choice",
    options: COACHING_OPTIONS,
    basePriority: 100,
    isKnown: (p) => p.coachingMode != null,
    parse: (v) =>
      v === "sparki" || v === "coach" ? { coachingMode: v } : null,
  },
  {
    key: "ftp",
    prompt: "Do you know your FTP?",
    help: "Your Functional Threshold Power sharpens your training zones. Sparki is using an estimate until you set it.",
    inputType: "number",
    unit: "W",
    placeholder: "e.g. 250",
    basePriority: 72,
    isKnown: (p) => p.ftp != null && p.ftpEstimated === false,
    adjust: (p) => {
      let d = 0;
      if (p.experienceLevel === "advanced" || p.experienceLevel === "elite")
        d += 25;
      if (p.experienceLevel === "beginner") d -= 15;
      const age = ageFromBirthYear(p.birthYear);
      if (age != null && age < 18) d -= 20;
      if (p.coachingMode === "coach") d -= 25;
      return d;
    },
    parse: (v) => {
      const n = num(v);
      if (n == null || n < 50 || n > 600) return null;
      return { ftp: Math.round(n), ftpEstimated: false };
    },
  },
  {
    key: "weightKg",
    prompt: "What's your weight?",
    help: "Used for power-to-weight (W/kg) and load tracking.",
    inputType: "number",
    unit: "kg",
    placeholder: "e.g. 72",
    basePriority: 66,
    isKnown: (p) => p.weightKg != null,
    parse: (v) => {
      const n = num(v);
      if (n == null || n < 30 || n > 250) return null;
      return { weightKg: String(Math.round(n * 10) / 10) };
    },
  },
  {
    key: "loadCapacity",
    prompt: "How well do you handle training load?",
    help: "Sparki scales how aggressively your week builds.",
    inputType: "choice",
    options: LOAD_OPTIONS,
    basePriority: 58,
    regeneratePlan: true,
    isKnown: (p) => p.loadCapacity != null,
    adjust: (p) => {
      let d = 0;
      if (p.experienceLevel === "advanced" || p.experienceLevel === "elite")
        d += 10;
      if (p.coachingMode === "coach") d -= 20;
      return d;
    },
    parse: (v) =>
      v === "low" || v === "moderate" || v === "high"
        ? { loadCapacity: v }
        : null,
  },
  {
    key: "discipline",
    prompt: "Which kind of riding is your focus?",
    help: "Shapes your routes and sessions.",
    inputType: "choice",
    options: DISCIPLINES,
    basePriority: 55,
    regeneratePlan: true,
    isKnown: (p) => p.discipline != null,
    adjust: (p) =>
      p.competitionLevel && p.competitionLevel !== "none" ? 10 : 0,
    parse: (v) =>
      DISCIPLINES.some((d) => d.value === v)
        ? { discipline: String(v) }
        : null,
  },
  {
    key: "competitionLevel",
    prompt: "How competitive do you want to be?",
    help: "Sparki uses this to prioritise what to ask next and how to periodise.",
    inputType: "choice",
    options: COMPETITION_OPTIONS,
    basePriority: 52,
    isKnown: (p) => p.competitionLevel != null,
    parse: (v) =>
      COMPETITION_OPTIONS.some((o) => o.value === v)
        ? { competitionLevel: String(v) }
        : null,
  },
  {
    key: "age",
    prompt: "How old are you?",
    help: "Age helps Sparki tune intensity and recovery.",
    inputType: "number",
    unit: "yr",
    placeholder: "e.g. 34",
    basePriority: 50,
    isKnown: (p) => p.birthYear != null,
    parse: (v) => {
      const n = num(v);
      if (n == null || n < 8 || n > 100) return null;
      return { birthYear: currentYear() - Math.round(n) };
    },
  },
  {
    key: "motivation",
    prompt: "What keeps you riding?",
    help: "A line in your own words — it personalises Sparki's coaching.",
    inputType: "text",
    placeholder: "e.g. clear my head and chase weekend KOMs",
    basePriority: 44,
    isKnown: (p) => p.motivation != null,
    parse: (v) => {
      const s = str(v);
      return s ? { motivation: s.slice(0, 400) } : null;
    },
  },
  {
    key: "injuryHistory",
    prompt: "Any injuries or limitations Sparki should know about?",
    help: "Helps Sparki keep your plan safe. Say \"none\" if all good.",
    inputType: "text",
    placeholder: "e.g. left knee niggle on long climbs",
    basePriority: 43,
    isKnown: (p) => p.injuryHistory != null,
    adjust: (p) => {
      const age = ageFromBirthYear(p.birthYear);
      return age != null && (age < 18 || age >= 50) ? 8 : 0;
    },
    parse: (v) => {
      const s = str(v);
      return s ? { injuryHistory: s.slice(0, 600) } : null;
    },
  },
  {
    key: "typicalSleepHours",
    prompt: "How much do you usually sleep?",
    help: "Recovery context for Sparki's daily guidance.",
    inputType: "number",
    unit: "hr",
    placeholder: "e.g. 7.5",
    basePriority: 38,
    isKnown: (p) => p.typicalSleepHours != null,
    parse: (v) => {
      const n = num(v);
      if (n == null || n < 3 || n > 14) return null;
      return { typicalSleepHours: String(Math.round(n * 10) / 10) };
    },
  },
  {
    key: "heightCm",
    prompt: "How tall are you?",
    help: "Completes your athlete profile.",
    inputType: "number",
    unit: "cm",
    placeholder: "e.g. 178",
    basePriority: 36,
    isKnown: (p) => p.heightCm != null,
    parse: (v) => {
      const n = num(v);
      if (n == null || n < 100 || n > 250) return null;
      return { heightCm: Math.round(n) };
    },
  },
  {
    key: "trainingPreferences",
    prompt: "Any training preferences?",
    help: "Terrain, indoor vs outdoor, sessions you love or avoid.",
    inputType: "text",
    placeholder: "e.g. prefer outdoor, hate the turbo",
    basePriority: 34,
    isKnown: (p) => p.trainingPreferences != null,
    parse: (v) => {
      const s = str(v);
      return s ? { trainingPreferences: s.slice(0, 600) } : null;
    },
  },
];

const FACT_BY_KEY = new Map<FactKey, FactDef>(FACTS.map((f) => [f.key, f]));

export type ProgressiveFactState = {
  status: "asked" | "answered" | "skipped";
  askedCount?: number;
  lastAskedAt?: string;
  skippedUntil?: string;
};
export type ProgressiveFacts = Record<string, ProgressiveFactState>;

export type OnboardingQuestion = {
  key: FactKey;
  prompt: string;
  help?: string;
  inputType: FactInputType;
  options?: FactOption[];
  unit?: string;
  placeholder?: string;
};

function toQuestion(f: FactDef): OnboardingQuestion {
  return {
    key: f.key,
    prompt: f.prompt,
    ...(f.help != null && { help: f.help }),
    inputType: f.inputType,
    ...(f.options != null && { options: f.options }),
    ...(f.unit != null && { unit: f.unit }),
    ...(f.placeholder != null && { placeholder: f.placeholder }),
  };
}

function priority(f: FactDef, p: AthleteProfile, st?: ProgressiveFactState): number {
  let score = f.basePriority + (f.adjust ? f.adjust(p) : 0);
  // Previously-skipped facts ease off a little so fresh questions surface first.
  if (st?.status === "skipped") score -= 6 * (st.askedCount ?? 1);
  return score;
}

// Adaptive selection: unknown + applicable + not currently snoozed, ranked by
// adaptive priority (experience / age / coach-status / competition-level).
export function selectNextQuestions(
  profile: AthleteProfile,
  facts: ProgressiveFacts,
  limit = 3,
): OnboardingQuestion[] {
  const now = Date.now();
  const candidates = FACTS.filter((f) => {
    if (f.isKnown(profile)) return false;
    if (f.applies && !f.applies(profile)) return false;
    const st = facts[f.key];
    if (st?.skippedUntil && new Date(st.skippedUntil).getTime() > now)
      return false;
    return true;
  });
  candidates.sort(
    (a, b) => priority(b, profile, facts[b.key]) - priority(a, profile, facts[a.key]),
  );
  return candidates.slice(0, Math.max(1, limit)).map(toQuestion);
}

export function getFact(key: string): FactDef | undefined {
  return FACT_BY_KEY.get(key as FactKey);
}

export function parseFactAnswer(
  key: string,
  value: unknown,
): { patch: ProfilePatch; regeneratePlan: boolean } | null {
  const f = FACT_BY_KEY.get(key as FactKey);
  if (!f) return null;
  const patch = f.parse(value);
  if (!patch) return null;
  return { patch, regeneratePlan: f.regeneratePlan === true };
}
