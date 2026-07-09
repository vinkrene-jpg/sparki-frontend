// Daily six-part coach analysis — the engine's public output.
//
// composeCoachAnalysis() is a pure function over a gathered intake + personality:
// it derives observations, raises follow-up questions, builds explainable advice
// and weaves the six honest parts (Wat valt op? / Welke patronen zie ik? / Wat
// ging beter dan verwacht? / Wat verdient aandacht? / Mijn advies voor vandaag /
// Waarom ik dit advies geef). runCoachAnalysis() wires it to the database and
// persists each observation through the privacy-gated memory store.

import {
  persistObservation,
  type ObservationInput,
} from "../../lib/ai-memory";
import type { ObservationSignal } from "@workspace/db";
import { gatherSignals, buildSignals } from "./intake";
import { deriveObservations } from "./observations";
import { detectContradictions, buildFollowUps } from "./contradiction";
import { generateAdvice } from "./advice";
import {
  applyFollowUpAnswers,
  type StoredFollowUpAnswer,
} from "./followups";
import { resolvePersonality, encouragementLine } from "./personality";
import { rotateWithinGroups } from "../../lib/variation";
import type {
  Advice,
  CoachAction,
  CoachAnalysis,
  Observation,
  Personality,
  SignalIntake,
  SignalKind,
} from "./types";

function confidencePhrase(p: Personality, score: number): string {
  if (p.vocabulary === "technisch") return `zekerheid ${score}%`;
  if (score >= 70) return "redelijk zeker";
  if (score >= 40) return "met enige slag om de arm";
  return "nog voorzichtig";
}

function line(p: Personality, o: Observation): string {
  return `${o.statement} (${confidencePhrase(p, o.confidence.score)})`;
}

function joinObs(p: Personality, obs: Observation[], limit: number): string | null {
  if (obs.length === 0) return null;
  return obs.slice(0, limit).map((o) => line(p, o)).join(" ");
}

function detailLimit(p: Personality): number {
  return p.detail === "kort" ? 1 : p.detail === "uitgebreid" ? 3 : 2;
}

/** Pure: compose the full six-part analysis from a gathered intake. */
export function composeCoachAnalysis(
  intake: SignalIntake,
  personality: Personality,
  opts: { resolvedFollowUpIds?: ReadonlySet<string>; variationSeed?: number } = {},
): CoachAnalysis {
  const resolved = opts.resolvedFollowUpIds ?? new Set<string>();
  const findings = detectContradictions(intake.metrics).filter(
    (f) => !resolved.has(f.id),
  );
  // Honest presentation variation: when a per-app-open session seed is present,
  // rotate the real observations WITHIN their severity tier so a different real
  // insight leads each visit. urgent→important→info always keeps priority; the
  // numbers and conclusions never change. No seed (server jobs/tests) = no-op.
  const derived = deriveObservations(intake, findings);
  const observations = opts.variationSeed
    ? rotateWithinGroups(
        derived,
        (o) => o.severity,
        ["urgent", "important", "info"],
        opts.variationSeed,
      )
    : derived;
  const followUps = buildFollowUps(intake.metrics, findings, resolved);
  const advice = generateAdvice(intake, personality, findings);
  const actions = buildActions(intake, advice);

  const limit = detailLimit(personality);
  const positives = observations.filter((o) => o.tone === "positive");
  const concerns = observations.filter((o) => o.tone === "concern");
  const patterns = observations.filter((o) => o.detectedPattern != null);

  const watValtOp = joinObs(personality, observations, limit);
  const patronen = joinObs(personality, patterns, limit);
  const beterDanVerwacht = joinObs(personality, positives, limit);
  const verdientAandacht = joinObs(personality, concerns, limit);

  let waaromAdvies = `${advice.explainers.waaromDitAdvies} ${advice.explainers.watVerandertMijnAdvies}`;
  if (followUps.length > 0) {
    waaromAdvies += ` Sparki twijfelt nog op één punt: ${followUps[0]!.because}.`;
  }
  const enc = encouragementLine(personality);
  if (enc) waaromAdvies += ` ${enc}`;

  return {
    date: intake.today,
    athleteName: intake.athleteName,
    personality,
    watValtOp,
    patronen,
    beterDanVerwacht,
    verdientAandacht,
    adviesVandaag: advice.headline,
    waaromAdvies,
    observations,
    followUps,
    advice,
    actions,
    missing: intake.missing,
  };
}

// No dead-end insight: every advice produces at least one concrete next step the
// athlete can take in the app. Steps are deterministic and only surfaced when the
// underlying state warrants them (real missing data, real upcoming race, etc.).
function buildActions(intake: SignalIntake, advice: Advice): CoachAction[] {
  const m = intake.metrics;
  const actions: CoachAction[] = [];

  switch (advice.intensity) {
    case "rust":
      actions.push({
        key: "rest",
        kind: "rest",
        label: "Plan rust vandaag",
        reason: "vandaag is herstel belangrijker dan trainen",
      });
      break;
    case "herstel":
    case "rustig":
      actions.push({
        key: "adjust_easier",
        kind: "adjust_training",
        label: "Maak je training lichter",
        reason: "Sparki adviseert vandaag een lichtere prikkel",
      });
      break;
    case "stevig":
      actions.push({
        key: "adjust_harder",
        kind: "adjust_training",
        label: "Bekijk je training",
        reason: "je bent fris genoeg voor een stevige sessie",
      });
      break;
    default:
      actions.push({
        key: "adjust",
        kind: "adjust_training",
        label: "Bekijk je training",
        reason: "blijf vandaag in je geplande belasting",
      });
  }

  if (m.readiness.label === "unknown") {
    actions.push({
      key: "check_in",
      kind: "check_in",
      label: "Vul je check-in in",
      reason: "met je gevoel van vandaag wordt het advies scherper",
    });
  }

  const raceSoon =
    m.races.nextA != null &&
    m.races.nextA.daysUntil >= 0 &&
    m.races.nextA.daysUntil <= 7;
  if (m.nutrition.logs === 0 && (m.loadSessions >= 3 || raceSoon)) {
    actions.push({
      key: "nutrition",
      kind: "nutrition",
      label: "Vul je voeding in",
      reason: "voeding bepaalt mee hoe goed je traint en herstelt",
    });
  }

  if (m.races.count === 0) {
    actions.push({
      key: "add_race",
      kind: "add_race",
      label: "Voeg een wedstrijd toe",
      reason: "met een doel in zicht stemt Sparki je opbouw daarop af",
    });
  } else if (raceSoon && m.races.nextA != null) {
    actions.push({
      key: "check_gear",
      kind: "check_gear",
      label: "Controleer je materiaal",
      reason: `"${m.races.nextA.name}" komt eraan — check je materiaal op tijd`,
    });
  }

  return actions;
}

// Map an engine SignalKind onto the persisted ObservationSignal domain.
const SIGNAL_DOMAIN: Record<SignalKind, ObservationSignal["kind"] | null> = {
  training_load: "training",
  readiness: "recovery",
  hrv_trend: "recovery",
  resting_hr_trend: "recovery",
  sleep: "sleep",
  subjective_feel: "recovery",
  power_dev: "training",
  feedback: "feedback",
  health: "recovery",
  race_calendar: "race",
  nutrition: "training",
  weather: null,
};

function toPersistedSignals(o: Observation): ObservationSignal[] {
  return o.signalsUsed
    .map((s) => {
      const kind = SIGNAL_DOMAIN[s.kind];
      if (!kind || !s.value) return null;
      return { kind, label: s.label, value: s.value };
    })
    .filter((s): s is ObservationSignal => s != null);
}

const LEVEL_TO_CONFIDENCE = {
  low: "low",
  medium: "medium",
  high: "high",
} as const;

/**
 * Gather signals, compose the analysis, and persist each supported observation
 * through the privacy-gated memory store (deduped per topic per day). Returns the
 * full analysis regardless of what persisted, so callers/tests can inspect it.
 */
export async function runCoachAnalysis(
  clerkId: string,
  opts: { persist?: boolean; variationSeed?: number } = {},
): Promise<CoachAnalysis> {
  const intake = await gatherSignals(clerkId);

  // Personality needs the athlete profile + active role; pull the few fields the
  // resolver needs from the intake's already-loaded context where possible. The
  // intake does not expose the raw profile, so resolve from a light follow-up.
  const personality = await resolvePersonalityFor(clerkId);

  // Feed today's stored follow-up answers back in: they adjust the metrics and
  // mark questions resolved, so the advice genuinely changes after the athlete
  // responds (and Sparki stops re-asking what it already knows today).
  const answers = await loadTodayAnswers(clerkId, intake.today);
  const { metrics: adjustedMetrics, resolvedIds } = applyFollowUpAnswers(
    intake.metrics,
    answers,
  );
  let activeIntake = intake;
  if (answers.length > 0) {
    const signals = buildSignals(adjustedMetrics);
    activeIntake = {
      ...intake,
      metrics: adjustedMetrics,
      signals,
      missing: signals
        .filter((s) => s.status === "missing")
        .map((s) => s.kind),
    };
  }
  const resolvedSet = new Set<string>([
    ...resolvedIds,
    ...answers.map((a) => a.questionId),
  ]);
  const analysis = composeCoachAnalysis(activeIntake, personality, {
    resolvedFollowUpIds: resolvedSet,
    variationSeed: opts.variationSeed,
  });

  if (opts.persist) {
    for (const o of analysis.observations) {
      const input: ObservationInput = {
        clerkId,
        sourceType: "training_analysis",
        title: o.statement.slice(0, 120),
        summary: o.statement,
        observationText: o.statement,
        confidence: LEVEL_TO_CONFIDENCE[o.confidence.level],
        confidenceScore: o.confidence.score / 100,
        category: o.category,
        severity: o.severity,
        detectedPattern: o.detectedPattern,
        signals: toPersistedSignals(o),
        alternativeExplanations: o.confidence.uncertainties,
        recommendedAction: analysis.advice.headline,
        dedupeKey: `coach:${o.topic}:${analysis.date}`,
      };
      await persistObservation(input);
    }

    // Doelen-voortgang: one deterministic daily summary of the athlete's goal
    // picture (deduped per day). Skipped honestly when there are no goals.
    try {
      const { composeGoalDailySummary } = await import("../../lib/goals");
      const goalSummary = await composeGoalDailySummary(clerkId);
      if (goalSummary) {
        await persistObservation({
          clerkId,
          sourceType: "training_analysis",
          title: goalSummary.headline.slice(0, 120),
          summary: goalSummary.headline,
          observationText: [goalSummary.headline, ...goalSummary.lines].join(" "),
          confidence: "medium",
          category: "planning",
          severity: goalSummary.headline.includes("onder druk")
            ? "important"
            : "info",
          detectedPattern: "goal_progress",
          dedupeKey: `goal:progress:${analysis.date}`,
        });
      }
    } catch {
      // Goal summary is additive — a failure here never blocks the analysis.
    }
  }

  return analysis;
}

// How long a profile-consistency answer keeps suppressing its question. A
// "laat_staan" is a real decision; re-asking the next day would nag.
const PROFILE_ANSWER_RETENTION_DAYS = 45;

// Load the follow-up answers the athlete gave for today (engine-internal keys),
// plus recent profile_* answers: those questions are about slow-moving profile
// values, so an answer stays valid well beyond one day.
async function loadTodayAnswers(
  clerkId: string,
  analysisDate: string,
): Promise<StoredFollowUpAnswer[]> {
  const { db, coachFollowupAnswersTable } = await import("@workspace/db");
  const { and, eq, gte, like, or } = await import("drizzle-orm");
  const cutoff = new Date(
    new Date(`${analysisDate}T00:00:00Z`).getTime() -
      PROFILE_ANSWER_RETENTION_DAYS * 86_400_000,
  )
    .toISOString()
    .split("T")[0]!;
  const rows = await db
    .select({
      questionId: coachFollowupAnswersTable.questionId,
      answer: coachFollowupAnswersTable.answer,
    })
    .from(coachFollowupAnswersTable)
    .where(
      and(
        eq(coachFollowupAnswersTable.clerkId, clerkId),
        or(
          eq(coachFollowupAnswersTable.analysisDate, analysisDate),
          and(
            like(coachFollowupAnswersTable.questionId, "profile_%"),
            gte(coachFollowupAnswersTable.analysisDate, cutoff),
          ),
        ),
      ),
    )
    .orderBy(coachFollowupAnswersTable.analysisDate);
  // Later answers win when the same question was answered on several days.
  const byId = new Map<string, string>();
  for (const r of rows) byId.set(r.questionId, r.answer);
  return [...byId.entries()].map(([questionId, answer]) => ({
    questionId,
    answer,
  }));
}

// Resolve personality from the athlete's stored profile + active role.
async function resolvePersonalityFor(clerkId: string): Promise<Personality> {
  const { db, athleteProfilesTable, userProfilesTable } = await import(
    "@workspace/db"
  );
  const { eq } = await import("drizzle-orm");
  const [athlete] = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  const [user] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  return resolvePersonality({
    birthYear: athlete?.birthYear ?? null,
    experienceLevel: athlete?.experienceLevel ?? null,
    competitionLevel: athlete?.competitionLevel ?? null,
    activeRole: user?.activeRole ?? null,
  });
}
