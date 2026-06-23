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
  { value: "Road", label: "Weg" },
  { value: "Gravel", label: "Gravel" },
  { value: "Mountain", label: "Mountainbike" },
  { value: "Track", label: "Baan" },
];

const LOAD_OPTIONS: FactOption[] = [
  { value: "low", label: "Ik herstel langzaam — rustig opbouwen" },
  { value: "moderate", label: "Gemiddeld — een normale opbouw werkt" },
  { value: "high", label: "Ik kan een grote belasting aan" },
];

const COMPETITION_OPTIONS: FactOption[] = [
  { value: "none", label: "Puur voor conditie & plezier" },
  { value: "recreational", label: "Toertochten / gran fondo's" },
  { value: "local", label: "Lokale wedstrijden" },
  { value: "regional", label: "Regionale wedstrijden" },
  { value: "national", label: "Nationaal / eliteniveau" },
];

const COACHING_OPTIONS: FactOption[] = [
  { value: "sparki", label: "Trainen met Sparki" },
  { value: "coach", label: "Trainen met een coach" },
];

const FACTS: FactDef[] = [
  {
    key: "coachingMode",
    prompt: "Wie begeleidt jouw training?",
    help: "Sparki kan je zelfstandig begeleiden, of je koppelt een menselijke coach.",
    inputType: "choice",
    options: COACHING_OPTIONS,
    basePriority: 100,
    isKnown: (p) => p.coachingMode != null,
    parse: (v) =>
      v === "sparki" || v === "coach" ? { coachingMode: v } : null,
  },
  {
    key: "ftp",
    prompt: "Ken je je FTP?",
    help: "Je FTP — het vermogen dat je langdurig kunt volhouden — scherpt je trainingszones aan. Sparki gebruikt een schatting totdat je hem instelt.",
    inputType: "number",
    unit: "W",
    placeholder: "bijv. 250",
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
    prompt: "Wat is je gewicht?",
    help: "Gebruikt voor je vermogen-per-kilo (W/kg) en belastingsopvolging.",
    inputType: "number",
    unit: "kg",
    placeholder: "bijv. 72",
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
    prompt: "Hoe goed verwerk je trainingsbelasting?",
    help: "Sparki past aan hoe stevig je week opbouwt.",
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
    prompt: "Welk soort rijden staat centraal?",
    help: "Bepaalt je routes en sessies.",
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
    prompt: "Hoe competitief wil je zijn?",
    help: "Sparki gebruikt dit om te bepalen wat het hierna vraagt en hoe het periodiseert.",
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
    prompt: "Hoe oud ben je?",
    help: "Leeftijd helpt Sparki intensiteit en herstel af te stemmen.",
    inputType: "number",
    unit: "jr",
    placeholder: "bijv. 34",
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
    prompt: "Wat houdt je op de fiets?",
    help: "Een zin in je eigen woorden — het personaliseert Sparki's coaching.",
    inputType: "text",
    placeholder: "bijv. mijn hoofd leegmaken en in het weekend KOM's pakken",
    basePriority: 44,
    isKnown: (p) => p.motivation != null,
    parse: (v) => {
      const s = str(v);
      return s ? { motivation: s.slice(0, 400) } : null;
    },
  },
  {
    key: "injuryHistory",
    prompt: "Blessures of beperkingen die Sparki moet weten?",
    help: "Helpt Sparki je plan veilig te houden. Zeg \"geen\" als alles oké is.",
    inputType: "text",
    placeholder: "bijv. linkerknie zeurt op lange klimmen",
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
    prompt: "Hoeveel slaap je meestal?",
    help: "Herstelcontext voor Sparki's dagelijkse begeleiding.",
    inputType: "number",
    unit: "u",
    placeholder: "bijv. 7.5",
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
    prompt: "Hoe lang ben je?",
    help: "Maakt je atletenprofiel compleet.",
    inputType: "number",
    unit: "cm",
    placeholder: "bijv. 178",
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
    prompt: "Nog trainingsvoorkeuren?",
    help: "Terrein, binnen vs buiten, sessies die je graag of liever niet doet.",
    inputType: "text",
    placeholder: "bijv. liefst buiten, hekel aan de rollerbank",
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
