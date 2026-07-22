// Race Intelligence — post-race evaluation & learning.
//
// After the race date, Sparki compares the REAL outcome (athlete-entered result or
// a matched training activity on the race day) against its own expectation, names
// honest learnings, and persists the conclusion so future advice weighs it. Nothing
// is assumed: a future race is not evaluable, and a past race with no result and no
// matched activity yields a plain-Dutch question instead of a fabricated verdict.
// The term "AI" never appears in any user-facing string.

import { and, eq } from "drizzle-orm";
import {
  db,
  journeyReflectionsTable,
  type Race,
  type AthleteProfile,
} from "@workspace/db";
import { buildRaceFuel, daysUntil } from "./race-intel";
import { persistObservation } from "./ai-memory";
import { resolveLinkedActivity } from "./journey";

export type RaceEvalComparison = {
  label: string;
  expected: string | null;
  actual: string | null;
  read: string;
};

export type RaceEvalGap = { key: string; label: string; question: string };

export type RaceEvaluation = {
  raceId: number;
  raceName: string;
  raceDate: string;
  daysSince: number;
  /** True only once the race day has passed. */
  evaluable: boolean;
  hasResult: boolean;
  hasActivity: boolean;
  comparisons: RaceEvalComparison[];
  learnings: string[];
  gaps: RaceEvalGap[];
  /** One-line conclusion to persist to memory, or null when nothing is known. */
  summary: string | null;
  /** Calibrated confidence for the persisted conclusion, always < 1.0. */
  confidenceScore: number | null;
};

export type MatchedActivity = {
  durationMin: number | null;
  distanceKm: number | null;
  avgPower: number | null;
  tss: number | null;
} | null;

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m} min`;
  return `${h}u${String(m).padStart(2, "0")}`;
}

const STATUS_LEARNING: Record<string, string> = {
  dnf: "Je hebt niet gefinisht (DNF). Noteer wat er gebeurde (lek, val, of de benen) zodat Sparki dat meeweegt.",
  dns: "Je bent niet gestart (DNS). Als er een reden was (ziekte, materiaal), helpt het om die te noteren.",
  dsq: "Je bent gediskwalificeerd (DSQ). Noteer kort wat er speelde zodat Sparki er rekening mee houdt.",
};

// Pure evaluation over a race + the athlete + already-fetched matched activity.
export function composeRaceEvaluation(
  race: Race,
  _athlete: AthleteProfile | null,
  opts: { today?: Date; activity?: MatchedActivity } = {},
): RaceEvaluation {
  const today = opts.today ?? new Date();
  const d = daysUntil(race.raceDate, today);
  const daysSince = -d;
  const activity = opts.activity ?? null;

  const base: RaceEvaluation = {
    raceId: race.id,
    raceName: race.name,
    raceDate: race.raceDate,
    daysSince,
    evaluable: false,
    hasResult: false,
    hasActivity: false,
    comparisons: [],
    learnings: [],
    gaps: [],
    summary: null,
    confidenceScore: null,
  };

  // Geannuleerde wedstrijd: geen evaluatie, geen vragen om een uitslag en geen
  // kapotte statistiek — de annulering is zelf het eerlijke antwoord.
  if (race.status === "geannuleerd") {
    return {
      ...base,
      gaps: [
        {
          key: "geannuleerd",
          label: "Wedstrijd geannuleerd",
          question: "Deze wedstrijd is geannuleerd en telt nergens in mee.",
        },
      ],
    };
  }

  // Future race (or race day itself) — not evaluable yet, honest about why.
  if (d >= 0) {
    return {
      ...base,
      gaps: [
        {
          key: "timing",
          label: "Wedstrijd nog niet geweest",
          question: "Na de wedstrijd vergelijkt Sparki je resultaat met de verwachting.",
        },
      ],
    };
  }

  const result = race.result ?? null;
  const hasResult = !!(
    result &&
    (result.status || result.position != null || result.timeSec != null)
  );
  const hasActivity = !!(
    activity &&
    (activity.durationMin != null || activity.distanceKm != null)
  );

  // Past race but nothing to learn from — ask, never assume.
  if (!hasResult && !hasActivity) {
    return {
      ...base,
      evaluable: true,
      gaps: [
        {
          key: "result",
          label: "Uitslag",
          question: `Hoe ging ${race.name}? Vul je uitslag in zodat Sparki ervan leert.`,
        },
      ],
    };
  }

  const comparisons: RaceEvalComparison[] = [];
  const learnings: string[] = [];
  const gaps: RaceEvalGap[] = [];

  // Status-based learnings (DNF/DNS/DSQ).
  if (result?.status && result.status !== "finished") {
    learnings.push(STATUS_LEARNING[result.status] ?? "Geen finish geregistreerd.");
  }

  // Duration: expectation (from distance × pace) vs the real time.
  const fuel = buildRaceFuel(race);
  const expectedMin = fuel.durationKnown ? fuel.estimatedDurationMin : null;
  const actualMin =
    result?.timeSec != null
      ? Math.round(result.timeSec / 60)
      : activity?.durationMin ?? null;

  if (expectedMin != null && actualMin != null) {
    const deltaMin = actualMin - expectedMin;
    const rel = Math.abs(deltaMin) / expectedMin;
    let read: string;
    if (rel <= 0.08) read = "Ongeveer gelijk aan de schatting (de schatting is indicatief).";
    else if (deltaMin < 0)
      read = `Sneller dan de schatting (~${fmtDuration(Math.abs(deltaMin))} korter) — sterk tempo of een snelle koers.`;
    else
      read = `Langzamer dan de schatting (~${fmtDuration(deltaMin)} langer) — zwaardere koers, wind of een rustiger tempo.`;
    comparisons.push({
      label: "Wedstrijdtijd",
      expected: fmtDuration(expectedMin),
      actual: fmtDuration(actualMin),
      read,
    });
    learnings.push(read);
  } else if (actualMin != null && expectedMin == null) {
    gaps.push({
      key: "afstand",
      label: "Afstand",
      question: "Vul de afstand in zodat Sparki je tijd met een verwachting kan vergelijken.",
    });
  }

  // Placing.
  if (result?.position != null) {
    const field = result.fieldSize ?? null;
    const placing =
      field != null
        ? `Geëindigd op plek ${result.position} van ${field}.`
        : `Geëindigd op plek ${result.position}.`;
    comparisons.push({
      label: "Klassement",
      expected: null,
      actual: field != null ? `${result.position}/${field}` : `${result.position}`,
      read: placing,
    });
    if (field != null && field > 0) {
      const pct = result.position / field;
      if (pct <= 0.1) learnings.push(`${placing} Een sterke uitslag in dit deelnemersveld.`);
      else if (pct <= 0.33) learnings.push(`${placing} Een degelijke uitslag in het voorste deel.`);
      else learnings.push(placing);
    } else {
      learnings.push(placing);
    }
  }

  if (result?.note && result.note.trim()) {
    learnings.push(`Eigen notitie: ${result.note.trim()}`);
  }

  const summary =
    learnings.length > 0
      ? `${race.name} (${race.raceDate}): ${learnings[0]}`.slice(0, 280)
      : null;

  return {
    raceId: race.id,
    raceName: race.name,
    raceDate: race.raceDate,
    daysSince,
    evaluable: true,
    hasResult,
    hasActivity,
    comparisons,
    learnings,
    gaps,
    summary,
    confidenceScore: summary ? 0.5 : null,
  };
}

// The matched activity is the SAME linked activity as in the wedstrijddossier —
// resolved via journey's resolveLinkedActivity (correctie-voorrang: handmatig >
// bewust geen > automatisch de langste sessie op de wedstrijddag). Eén bron van
// waarheid, dus dossier en evaluatie spreken elkaar nooit tegen.
async function findMatchedActivity(race: Race): Promise<MatchedActivity> {
  try {
    const [reflection] = await db
      .select()
      .from(journeyReflectionsTable)
      .where(
        and(
          eq(journeyReflectionsTable.clerkId, race.clerkId),
          eq(journeyReflectionsTable.raceId, race.id),
        ),
      )
      .limit(1);
    const linked = await resolveLinkedActivity(race, reflection ?? null);
    if (!linked.session) return null;
    return {
      durationMin: linked.session.durationMin,
      distanceKm: linked.session.distanceKm,
      avgPower: linked.session.avgPower,
      tss: linked.session.tss,
    };
  } catch {
    return null;
  }
}

// Full evaluation with the matched activity resolved (read-only).
export async function buildRaceEvaluation(
  race: Race,
  athlete: AthleteProfile | null,
): Promise<RaceEvaluation> {
  const activity = await findMatchedActivity(race);
  return composeRaceEvaluation(race, athlete, { activity });
}

// Evaluate and persist the conclusion to memory (privacy-gated + deduped per race),
// so future briefings weigh it. Returns the evaluation regardless of persistence.
export async function persistRaceEvaluation(
  race: Race,
  athlete: AthleteProfile | null,
): Promise<RaceEvaluation> {
  const evaluation = await buildRaceEvaluation(race, athlete);
  if (evaluation.evaluable && evaluation.summary) {
    await persistObservation({
      clerkId: race.clerkId,
      sourceType: "race_analysis",
      title: `Wedstrijdevaluatie: ${race.name}`,
      summary: evaluation.summary,
      observationText: evaluation.learnings.join(" "),
      category: "race",
      severity: "info",
      confidence: "medium",
      confidenceScore: evaluation.confidenceScore ?? 0.5,
      dedupeKey: `race-eval:${race.id}`,
    });
  }
  return evaluation;
}
