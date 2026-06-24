// Coach Decision Engine V1 — the Adaptive Coach Engine (deterministic, client).
//
// This is the *decision layer* that sits between the sport profile and the
// advice on Home. Given a profile + today's day data it decides, on its own,
// what today's THEME, ADVICE, QUESTION and PRIORITY are — not the UI, not a
// fixed flow. The engine decides; Home only renders the decision.
//
// V1 is intentionally inspectable: every string is deterministic and
// profile-dependent, so no text generator can mask the differences in the
// decision logic. (Splitting the wording into a separate LLM text layer is
// explicitly V2.) The engine is fully synchronous — no network, no storage —
// so output recomputes instantly when the input changes.

export type CoachExperience = "beginner" | "intermediate" | "advanced";

// The intent behind the goal, classified from the free-text goal. Keeps the
// engine decision driven by *what the athlete is training for*, not phrasing.
export type CoachGoalKind = "fitness" | "competition" | "performance";

export type CoachArchetype =
  | "consistentiecoach"
  | "wedstrijdcoach"
  | "prestatiecoach";

export type CoachTopic =
  | "consistentie"
  | "wedstrijdvoorbereiding"
  | "prestatieontwikkeling";

// Today's real (or fictional) day signals. Null when nothing is logged yet.
export type CoachDayData = {
  feelScore: number | null; // check-in feel, 1..5
  fatigueScore: number | null; // check-in fatigue, 1..5 (higher = more tired)
  tsb: number | null; // form/recovery balance (negative = fatigued)
} | null;

export type CoachInput = {
  sport: string;
  experience: CoachExperience;
  goal: string;
  goalKind: CoachGoalKind;
  weeklyHours: number;
  race: { daysUntil: number } | null;
  day: CoachDayData;
};

export type CoachDecision = {
  archetype: CoachArchetype;
  topic: CoachTopic;
  hoofdonderwerp: string;
  advies: string;
  vraag: string | null;
  prioriteit: string;
};

// ── Day-data readers ─────────────────────────────────────────────────────────
// Deterministic interpretation of today's signals. Each coach reads the SAME
// day differently — that is the whole point of the engine.

function hasDay(day: CoachDayData): day is NonNullable<CoachDayData> {
  return day != null;
}

function isLowRecovery(day: CoachDayData): boolean {
  if (!hasDay(day)) return false;
  if (day.tsb != null && day.tsb <= -12) return true;
  if (day.fatigueScore != null && day.fatigueScore >= 4) return true;
  if (day.feelScore != null && day.feelScore <= 2) return true;
  return false;
}

function isGoodRecovery(day: CoachDayData): boolean {
  if (!hasDay(day)) return false;
  if (day.tsb != null && day.tsb >= 5) return true;
  if (day.feelScore != null && day.feelScore >= 4) return true;
  return false;
}

// ── Classification ───────────────────────────────────────────────────────────

/**
 * Pick the coach archetype from the input. A live race (or an explicitly
 * competitive goal) makes race preparation the priority; a performance goal or
 * an advanced athlete gets the performance coach; everything else — beginners,
 * fitness goals, low volume — gets the consistency coach (the safe default).
 */
function classify(input: CoachInput): CoachArchetype {
  const racingSoon =
    input.race != null &&
    input.race.daysUntil >= 0 &&
    input.race.daysUntil <= 28;
  if (racingSoon || input.goalKind === "competition") return "wedstrijdcoach";
  if (input.goalKind === "performance" || input.experience === "advanced") {
    return "prestatiecoach";
  }
  if (
    input.experience === "beginner" ||
    input.goalKind === "fitness" ||
    input.weeklyHours <= 4
  ) {
    return "consistentiecoach";
  }
  // Intermediate athlete with no decisive signal → consistency is the safe base.
  return "consistentiecoach";
}

// ── Per-archetype decisions ──────────────────────────────────────────────────

function consistentiecoach(input: CoachInput): CoachDecision {
  const advies = isLowRecovery(input.day)
    ? "Voel je je vandaag wat minder? Dan is een korte, rustige rit al genoeg — blijven bewegen telt nu zwaarder dan hard gaan."
    : "Je grootste winst zit nu niet in harder trainen maar in regelmatig trainen.";
  return {
    archetype: "consistentiecoach",
    topic: "consistentie",
    hoofdonderwerp: "Consistentie",
    advies,
    vraag: "Welke dag lukt trainen meestal het makkelijkst?",
    prioriteit: "Regelmaat — hoe vaak je deze week traint, niet hoe hard.",
  };
}

function wedstrijdcoach(input: CoachInput): CoachDecision {
  const days = input.race?.daysUntil ?? null;
  let advies: string;
  if (days != null && days <= 3) {
    advies =
      "Je wedstrijd is bijna daar. Fris zijn telt nu zwaarder dan extra trainen — we taperen en bewaken je herstel.";
  } else if (isLowRecovery(input.day)) {
    advies =
      "De wedstrijd komt dichterbij en je herstel is nu beperkt. Ik geef herstel voorrang zodat je fris aan de start staat.";
  } else {
    advies =
      "De wedstrijd komt dichterbij. Ik kijk vooral naar belasting en herstel.";
  }
  const prioriteit =
    days != null
      ? `Balans tussen belasting en herstel — nog ${days} ${days === 1 ? "dag" : "dagen"} tot je wedstrijd.`
      : "Balans tussen belasting en herstel richting je wedstrijd.";
  return {
    archetype: "wedstrijdcoach",
    topic: "wedstrijdvoorbereiding",
    hoofdonderwerp: "Wedstrijdvoorbereiding",
    advies,
    vraag: "Voel je wedstrijdspanning?",
    prioriteit,
  };
}

function prestatiecoach(input: CoachInput): CoachDecision {
  let advies: string;
  if (isLowRecovery(input.day)) {
    advies =
      "Je herstelscore is vandaag wat lager, maar je trainingsbelasting op lange termijn weegt nu zwaarder — we houden koers en letten op je signalen.";
  } else if (isGoodRecovery(input.day)) {
    advies =
      "Je staat er goed voor. Dit is het moment om je trainingsbelasting verder op te bouwen.";
  } else {
    advies =
      "Je trainingsbelasting is momenteel belangrijker dan je herstelscore van vandaag.";
  }
  return {
    archetype: "prestatiecoach",
    topic: "prestatieontwikkeling",
    hoofdonderwerp: "Prestatieontwikkeling",
    advies,
    vraag: "Voelde de laatste intervaltraining uitvoerbaar?",
    prioriteit:
      "Progressieve belasting — je langetermijnontwikkeling boven de dagscore.",
  };
}

/**
 * The engine entry point. Deterministic and synchronous: same input always
 * yields the same decision, recomputed instantly on every input change.
 */
export function decideCoach(input: CoachInput): CoachDecision {
  switch (classify(input)) {
    case "wedstrijdcoach":
      return wedstrijdcoach(input);
    case "prestatiecoach":
      return prestatiecoach(input);
    case "consistentiecoach":
    default:
      return consistentiecoach(input);
  }
}

// ── Live mapping: real profile → engine input ────────────────────────────────

const COMPETITION_KEYWORDS = [
  "wedstrijd",
  "nk ",
  "criterium",
  "race",
  "podium",
  "top 10",
  "top10",
  "winnen",
  "kampioen",
  "koers",
  "competitie",
  "gran fondo",
];

const PERFORMANCE_KEYWORDS = [
  "ftp",
  "vermogen",
  "watt",
  "sneller",
  "prestatie",
  "threshold",
  "drempel",
  "w/kg",
  "wkg",
];

/** Classify a free-text goal into the engine's goal-intent buckets. */
export function classifyGoal(goal: string | null | undefined): CoachGoalKind {
  const g = (goal ?? "").toLowerCase();
  if (g && COMPETITION_KEYWORDS.some((k) => g.includes(k))) return "competition";
  if (g && PERFORMANCE_KEYWORDS.some((k) => g.includes(k))) return "performance";
  return "fitness";
}

/** Infer experience from training volume when no explicit field exists. */
export function inferExperience(weeklyHours: number): CoachExperience {
  if (weeklyHours >= 8) return "advanced";
  if (weeklyHours >= 5) return "intermediate";
  return "beginner";
}

/**
 * Build the engine input from the real athlete profile + today's day data.
 * Returns null when there is no profile yet (nothing to coach on).
 */
export function coachInputFromProfile(
  profile:
    | {
        discipline: string | null;
        goals: string | null;
        weeklyHourTarget: number | null;
      }
    | null
    | undefined,
  day: CoachDayData,
  race: { daysUntil: number } | null,
): CoachInput | null {
  if (!profile) return null;
  const weeklyHours = profile.weeklyHourTarget ?? 0;
  const goal = profile.goals ?? "";
  return {
    sport: profile.discipline ?? "wielrennen",
    experience: inferExperience(weeklyHours),
    goal: goal || "Algemene fitheid",
    goalKind: classifyGoal(goal),
    weeklyHours,
    race,
    day,
  };
}

// ── Dev/preview scenarios (fictional) ────────────────────────────────────────
// Three example athletes straight from the engine's reference decision rules.
// Used ONLY by the dev/preview selector; never referenced in production paths.

export type CoachScenarioKey = "beginner" | "wedstrijdrenner" | "ervaren";
export type CoachOverrideMode = "profile" | "scenario";

export type CoachScenario = {
  key: CoachScenarioKey;
  label: string;
  input: CoachInput;
};

export const COACH_SCENARIOS: Record<CoachScenarioKey, CoachScenario> = {
  beginner: {
    key: "beginner",
    label: "Beginner",
    input: {
      sport: "wielrennen",
      experience: "beginner",
      goal: "Fitter worden",
      goalKind: "fitness",
      weeklyHours: 3,
      race: null,
      day: { feelScore: 3, fatigueScore: 3, tsb: 0 },
    },
  },
  wedstrijdrenner: {
    key: "wedstrijdrenner",
    label: "Wedstrijdrenner",
    input: {
      sport: "wielrennen",
      experience: "advanced",
      goal: "Top 10 NK criterium",
      goalKind: "competition",
      weeklyHours: 12,
      race: { daysUntil: 10 },
      day: { feelScore: 3, fatigueScore: 4, tsb: -8 },
    },
  },
  ervaren: {
    key: "ervaren",
    label: "Ervaren sporter",
    input: {
      sport: "wielrennen",
      experience: "advanced",
      goal: "FTP verhogen",
      goalKind: "performance",
      weeklyHours: 10,
      race: null,
      day: { feelScore: 3, fatigueScore: 3, tsb: -5 },
    },
  },
};

export const COACH_SCENARIO_ORDER: CoachScenarioKey[] = [
  "beginner",
  "wedstrijdrenner",
  "ervaren",
];

/**
 * Resolve the engine input for a dev override.
 * - "scenario": the fully fictional scenario (profile + day data + race).
 * - "profile": the scenario's *profile* portion, but today's REAL day data
 *   (check-in / recovery) is preserved — to test whether the same day is
 *   interpreted differently per athlete type.
 */
export function resolveOverrideInput(
  scenario: CoachScenario,
  mode: CoachOverrideMode,
  realDay: CoachDayData,
): CoachInput {
  if (mode === "scenario") return scenario.input;
  return { ...scenario.input, day: realDay };
}
