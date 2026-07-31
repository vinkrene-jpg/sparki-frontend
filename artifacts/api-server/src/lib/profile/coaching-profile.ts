// Adaptive coaching profile (begeleidingsprofiel) — the behavioural side of the
// Athlete Profile engine.
//
// Eight dimensions describe HOW an athlete wants to be guided. Each dimension is
// gathered gradually: a deliberate onboarding answer carries a strong weight, and
// weaker behavioural signals (daily check-ins, completed trainings) nudge the
// tally over time. The current value of each dimension is the weighted arg-max
// of its tally; confidence comes from the sample count + winning margin. Nothing
// is fabricated — a dimension stays null until real evidence exists.

import { eq } from "drizzle-orm";
import {
  db,
  coachingProfilesTable,
  type CoachingProfile,
  type AthleteDailyMetric,
} from "@workspace/db";
import type {
  OnboardingQuestion,
  ProgressiveFacts,
  ProgressiveFactState,
} from "../onboarding-questions";

// ── Dimension catalog ────────────────────────────────────────────────────────

export type CoachingDimensionKey =
  | "behaviorStyle"
  | "motivationType"
  | "guidanceNeed"
  | "communicationStyle"
  | "learningPreference"
  | "decisionMaking"
  | "mentalSupportNeed"
  | "goalOrientation";

export type DimensionOption = { value: string; label: string };

type DimensionDef = {
  key: CoachingDimensionKey;
  // Dutch, user-facing question (no "AI" wording — framed as Sparki).
  prompt: string;
  help?: string;
  options: DimensionOption[];
  basePriority: number;
};

// All prompts are plain Dutch; option values are stable English enums.
export const COACHING_DIMENSIONS: DimensionDef[] = [
  {
    key: "behaviorStyle",
    prompt: "Hoe pak je je trainingen het liefst aan?",
    help: "Zo is bekend hoeveel structuur je wilt.",
    basePriority: 30,
    options: [
      { value: "structured", label: "Met een vast, duidelijk plan" },
      { value: "flexible", label: "Een richting, maar met ruimte" },
      { value: "spontaneous", label: "Per dag bekijken hoe ik me voel" },
    ],
  },
  {
    key: "motivationType",
    prompt: "Wat drijft je het meest om te fietsen?",
    help: "De toon wordt afgestemd op wat jou motiveert.",
    basePriority: 29,
    options: [
      { value: "intrinsic", label: "Het plezier en mezelf verbeteren" },
      { value: "competitive", label: "Winnen en presteren in wedstrijden" },
      { value: "social", label: "Samen rijden en erbij horen" },
      { value: "health", label: "Fit en gezond blijven" },
    ],
  },
  {
    key: "guidanceNeed",
    prompt: "Hoeveel begeleiding wil je van Sparki?",
    help: "Van losjes meedenken tot je stap voor stap meenemen.",
    basePriority: 28,
    options: [
      { value: "high", label: "Veel — neem me bij de hand" },
      { value: "medium", label: "Gemiddeld — duw me de goede kant op" },
      { value: "low", label: "Weinig — geef me vooral de cijfers" },
    ],
  },
  {
    key: "communicationStyle",
    prompt: "Hoe wil je aangesproken worden?",
    help: "De stijl waarin je gecoacht wordt.",
    basePriority: 27,
    options: [
      { value: "direct", label: "Kort en recht voor z'n raap" },
      { value: "supportive", label: "Aanmoedigend en positief" },
      { value: "analytical", label: "Onderbouwd met data en uitleg" },
    ],
  },
  {
    key: "learningPreference",
    prompt: "Hoe leer je het liefst iets nieuws bij?",
    help: "Zo wordt alles uitgelegd op jouw manier.",
    basePriority: 24,
    options: [
      { value: "practical", label: "Door het gewoon te doen" },
      { value: "visual", label: "Met beelden en voorbeelden" },
      { value: "theoretical", label: "Eerst het waarom begrijpen" },
      { value: "data", label: "Aan de hand van mijn cijfers" },
    ],
  },
  {
    key: "decisionMaking",
    prompt: "Wie beslist over je training?",
    help: "Bepaalt hoeveel er zelf wordt ingevuld of aan jou wordt voorgelegd.",
    basePriority: 23,
    options: [
      { value: "autonomous", label: "Ik beslis zelf, met advies" },
      { value: "collaborative", label: "We beslissen samen" },
      { value: "directed", label: "Het plan bepaalt, ik volg" },
    ],
  },
  {
    key: "mentalSupportNeed",
    prompt: "Hoeveel mentale steun heb je graag?",
    help: "Je krijgt extra bemoediging op zware dagen.",
    basePriority: 22,
    options: [
      { value: "high", label: "Veel — houd me mentaal scherp" },
      { value: "medium", label: "Af en toe een duwtje" },
      { value: "low", label: "Weinig — ik regel mijn kop zelf" },
    ],
  },
  {
    key: "goalOrientation",
    prompt: "Wanneer is een seizoen voor jou geslaagd?",
    help: "Vooruitgang wordt meegewogen zoals jij dat ziet.",
    basePriority: 21,
    options: [
      { value: "process", label: "Als ik trouw mijn proces volg" },
      { value: "outcome", label: "Als ik mijn doelen/resultaten haal" },
      { value: "mastery", label: "Als ik echt beter ben geworden" },
    ],
  },
];

const DIMENSION_BY_KEY = new Map<CoachingDimensionKey, DimensionDef>(
  COACHING_DIMENSIONS.map((d) => [d.key, d]),
);

const DIMENSION_KEYS = COACHING_DIMENSIONS.map((d) => d.key);

export function isCoachingDimensionKey(
  key: string,
): key is CoachingDimensionKey {
  return DIMENSION_BY_KEY.has(key as CoachingDimensionKey);
}

// Direct, deliberate onboarding answers should dominate weak behavioural drift.
const DIRECT_ANSWER_WEIGHT = 5;
// A dimension is considered "known" once a clear winner has emerged.
const KNOWN_THRESHOLD = DIRECT_ANSWER_WEIGHT;

// ── Read / ensure ────────────────────────────────────────────────────────────

export async function getCoachingProfile(
  clerkId: string,
): Promise<CoachingProfile | null> {
  const [row] = await db
    .select()
    .from(coachingProfilesTable)
    .where(eq(coachingProfilesTable.clerkId, clerkId));
  return row ?? null;
}

async function ensureCoachingProfile(
  clerkId: string,
): Promise<CoachingProfile> {
  const existing = await getCoachingProfile(clerkId);
  if (existing) return existing;
  const [row] = await db
    .insert(coachingProfilesTable)
    .values({ clerkId, tallies: {} })
    .onConflictDoNothing({ target: coachingProfilesTable.clerkId })
    .returning();
  return row ?? (await getCoachingProfile(clerkId))!;
}

// ── Tally maths (pure) ───────────────────────────────────────────────────────

/** Winning option for a dimension tally, or null when there is no clear signal. */
export function dominantValue(
  tally: Record<string, number> | undefined,
): { value: string; confidence: "low" | "medium" | "high" } | null {
  if (!tally) return null;
  const entries = Object.entries(tally).filter(([, w]) => w > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [topValue, topWeight] = entries[0]!;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const margin = topWeight - (entries[1]?.[1] ?? 0);
  // Confidence rises with both how much evidence exists and how decisively the
  // winner leads. A single direct answer already lands at "high".
  let confidence: "low" | "medium" | "high" = "low";
  if (topWeight >= KNOWN_THRESHOLD && margin / total >= 0.5) confidence = "high";
  else if (topWeight >= 3 && margin > 0) confidence = "medium";
  return { value: topValue, confidence };
}

function recomputeColumn(
  tallies: Record<string, Record<string, number>>,
  key: CoachingDimensionKey,
): string | null {
  return dominantValue(tallies[key])?.value ?? null;
}

// ── Signal ingestion ─────────────────────────────────────────────────────────

/**
 * Accumulate weighted evidence for one dimension and recompute its stored value.
 * `value` must be a valid option for the dimension; unknown values are ignored.
 */
export async function observeDimension(
  clerkId: string,
  key: CoachingDimensionKey,
  value: string,
  weight: number,
): Promise<void> {
  const def = DIMENSION_BY_KEY.get(key);
  if (!def || !def.options.some((o) => o.value === value)) return;
  if (!Number.isFinite(weight) || weight <= 0) return;

  const profile = await ensureCoachingProfile(clerkId);
  const tallies: Record<string, Record<string, number>> = {
    ...(profile.tallies ?? {}),
  };
  const dim = { ...(tallies[key] ?? {}) };
  dim[value] = (dim[value] ?? 0) + weight;
  tallies[key] = dim;

  await db
    .update(coachingProfilesTable)
    .set({
      tallies,
      [key]: recomputeColumn(tallies, key),
      updatedAt: new Date(),
    })
    .where(eq(coachingProfilesTable.clerkId, clerkId));
}

/** A deliberate answer to a coaching-dimension question (strong weight). */
export async function recordCoachingAnswer(
  clerkId: string,
  key: string,
  value: unknown,
): Promise<boolean> {
  if (!isCoachingDimensionKey(key)) return false;
  if (typeof value !== "string") return false;
  const def = DIMENSION_BY_KEY.get(key)!;
  if (!def.options.some((o) => o.value === value)) return false;
  await observeDimension(clerkId, key, value, DIRECT_ANSWER_WEIGHT);
  return true;
}

/** Validate a coaching-dimension answer without persisting (route guard). */
export function parseCoachingAnswer(
  key: string,
  value: unknown,
): { dimension: CoachingDimensionKey; value: string } | null {
  if (!isCoachingDimensionKey(key)) return null;
  if (typeof value !== "string") return null;
  const def = DIMENSION_BY_KEY.get(key)!;
  return def.options.some((o) => o.value === value)
    ? { dimension: key, value }
    : null;
}

// ── Continuous behavioural updates (real data, not a survey) ─────────────────

/**
 * Nudge dimensions from a daily check-in. Logging a check-in at all is a weak
 * signal of a structured, engaged athlete; a self-reported tough day nudges the
 * mental-support need up. Weights are deliberately small so deliberate answers
 * always dominate.
 */
export async function deriveFromCheckin(
  clerkId: string,
  metric: AthleteDailyMetric,
): Promise<void> {
  // The act of logging a structured morning check-in.
  await observeDimension(clerkId, "behaviorStyle", "structured", 0.4);
  // A clearly low mood/high fatigue day suggests this athlete benefits from more
  // mental support; a consistently great day suggests they need little.
  if (metric.feelScore != null) {
    if (metric.feelScore <= 4) {
      await observeDimension(clerkId, "mentalSupportNeed", "high", 0.5);
    } else if (metric.feelScore >= 8) {
      await observeDimension(clerkId, "mentalSupportNeed", "low", 0.3);
    }
  }
}

/**
 * Nudge dimensions from a completed training relative to its plan. Following the
 * planned session is evidence of a structured, directed-friendly athlete;
 * deviating points to a more autonomous, flexible one.
 */
export async function deriveFromTraining(
  clerkId: string,
  opts: { hadPlannedSession: boolean; completedAsPlanned: boolean },
): Promise<void> {
  if (!opts.hadPlannedSession) {
    // Trained without a planned session → self-directed / spontaneous lean.
    await observeDimension(clerkId, "behaviorStyle", "spontaneous", 0.3);
    await observeDimension(clerkId, "decisionMaking", "autonomous", 0.3);
    return;
  }
  if (opts.completedAsPlanned) {
    await observeDimension(clerkId, "behaviorStyle", "structured", 0.4);
    await observeDimension(clerkId, "decisionMaking", "directed", 0.3);
  } else {
    await observeDimension(clerkId, "behaviorStyle", "flexible", 0.4);
    await observeDimension(clerkId, "decisionMaking", "autonomous", 0.3);
  }
}

// ── Gradual question selection ───────────────────────────────────────────────

const DIMENSION_QUESTION: Record<CoachingDimensionKey, OnboardingQuestion> =
  Object.fromEntries(
    COACHING_DIMENSIONS.map((d) => [
      d.key,
      {
        key: d.key,
        prompt: d.prompt,
        ...(d.help != null && { help: d.help }),
        inputType: "choice" as const,
        options: d.options,
        group: "coaching" as const,
      },
    ]),
  ) as Record<CoachingDimensionKey, OnboardingQuestion>;

function dimensionKnown(
  profile: CoachingProfile | null,
  key: CoachingDimensionKey,
): boolean {
  if (!profile) return false;
  const got = dominantValue(profile.tallies?.[key]);
  return got != null && got.confidence === "high";
}

function dimensionPriority(
  def: DimensionDef,
  st: ProgressiveFactState | undefined,
): number {
  let score = def.basePriority;
  if (st?.status === "skipped") score -= 6 * (st.askedCount ?? 1);
  return score;
}

/**
 * Next coaching-dimension questions to surface: unknown dimensions, not snoozed,
 * ranked by adaptive priority. Shares the same progressive-fact lifecycle map as
 * the profile facts so a dimension can be asked, answered or snoozed.
 */
export function selectNextCoachingQuestions(
  profile: CoachingProfile | null,
  facts: ProgressiveFacts,
  limit = 2,
): OnboardingQuestion[] {
  const now = Date.now();
  const candidates = COACHING_DIMENSIONS.filter((d) => {
    if (dimensionKnown(profile, d.key)) return false;
    const st = facts[d.key];
    if (st?.skippedUntil && new Date(st.skippedUntil).getTime() > now)
      return false;
    return true;
  });
  candidates.sort(
    (a, b) =>
      dimensionPriority(b, facts[b.key]) - dimensionPriority(a, facts[a.key]),
  );
  return candidates
    .slice(0, Math.max(0, limit))
    .map((d) => DIMENSION_QUESTION[d.key]);
}

// ── Coaching directive (consumed by the Coaching engine) ─────────────────────

const DIRECTIVE_PARTS: Record<
  CoachingDimensionKey,
  Record<string, string>
> = {
  behaviorStyle: {
    structured: "This athlete wants a clear, structured plan — be specific and prescriptive.",
    flexible: "This athlete wants direction with room to adapt — offer options, not rigid orders.",
    spontaneous: "This athlete trains by feel — keep guidance loose and day-by-day.",
  },
  motivationType: {
    intrinsic: "They are driven by enjoyment and self-improvement — frame progress around personal growth.",
    competitive: "They are driven by competition and results — tie advice to performance and racing.",
    social: "They are driven by the social side — acknowledge shared rides and belonging.",
    health: "They are driven by health and fitness — frame benefits around long-term wellbeing.",
  },
  guidanceNeed: {
    high: "They want a lot of guidance — walk them through the what and the how.",
    medium: "They want moderate guidance — nudge, don't hover.",
    low: "They want minimal guidance — lead with the numbers and let them decide.",
  },
  communicationStyle: {
    direct: "Communicate short and blunt.",
    supportive: "Communicate with encouragement and positivity.",
    analytical: "Communicate with data and clear reasoning.",
  },
  learningPreference: {
    practical: "They learn by doing — give concrete, actionable steps.",
    visual: "They learn from examples — use vivid, illustrative framing.",
    theoretical: "They want the why first — briefly explain the reasoning.",
    data: "They learn from their own numbers — anchor explanations in their data.",
  },
  decisionMaking: {
    autonomous: "They make their own calls — advise, never dictate.",
    collaborative: "They decide together with you — present trade-offs and ask.",
    directed: "They prefer you to decide — give a clear recommendation.",
  },
  mentalSupportNeed: {
    high: "They value mental support — reinforce confidence, especially on hard days.",
    medium: "They value occasional encouragement — a light push when it counts.",
    low: "They handle their own mindset — skip the pep talks.",
  },
  goalOrientation: {
    process: "Success for them is following the process — praise consistency.",
    outcome: "Success for them is hitting results — measure against their goals.",
    mastery: "Success for them is genuine improvement — highlight skill gains.",
  },
};

/**
 * Build the per-athlete coaching directive appended to Sparki's system prompt.
 * Only high/medium-confidence dimensions are emitted, so the voice only shifts on
 * real evidence. `motivation` is the athlete's own free-text "why".
 */
export function coachingProfileDirective(
  profile: CoachingProfile | null,
  motivation?: string | null,
): string {
  const lines: string[] = [];
  if (profile) {
    for (const key of DIMENSION_KEYS) {
      const got = dominantValue(profile.tallies?.[key]);
      if (!got || got.confidence === "low") continue;
      const part = DIRECTIVE_PARTS[key]?.[got.value];
      if (part) lines.push(part);
    }
  }
  const why = motivation?.trim();
  if (why) lines.push(`Their stated motivation: "${why}".`);
  if (lines.length === 0) return "";
  return `COACHING PROFILE (adapt to this athlete):\n- ${lines.join("\n- ")}`;
}
