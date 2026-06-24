// Follow-up answers — the feedback loop that lets Sparki's daily analysis change
// after the athlete responds.
//
// Every follow-up question Sparki raises has a small, fixed set of answers. When
// an athlete picks one, that answer is REAL input (never fabricated). This module
// (1) defines the options per question, (2) validates a chosen answer, and
// (3) deterministically applies stored answers back onto the gathered intake so
// the next analysis reflects them: a confirmed fatigue answer pushes the advice
// toward rest, a "feels fresh" answer resolves the doubt, and so on. An answered
// question is marked resolved so Sparki does not keep asking the same thing.

import type { IntakeMetrics } from "./types";
import type { FollowUpOption } from "./types";

// One stored answer (mirrors coach_followup_answers, engine-internal keys).
export type StoredFollowUpAnswer = {
  questionId: string;
  answer: string;
};

// The fixed answer set per follow-up id. Labels are plain Dutch; values are
// engine-internal keys persisted verbatim.
export const FOLLOWUP_OPTIONS: Record<string, FollowUpOption[]> = {
  fresh_but_fatigued: [
    { value: "benen_fris", label: "Mijn benen voelen écht fris" },
    { value: "benen_zwaar", label: "Vooral mijn hoofd, benen zijn zwaar" },
  ],
  recovery_split: [
    { value: "ja_extern", label: "Ja, stress of slecht geslapen" },
    { value: "nee_normaal", label: "Nee, alles voelt normaal" },
  ],
  sleep_ok_resting_high: [
    { value: "ja_verklaring", label: "Ja (ziek, gestrest of laat naar bed)" },
    { value: "nee_geen", label: "Nee, niets bijzonders" },
  ],
  load_high_feedback_light: [
    { value: "zwaarder", label: "Maak mijn trainingen zwaarder" },
    { value: "houden", label: "Houd deze belasting aan" },
  ],
  power_down_load_up: [
    { value: "genoeg_rust", label: "Ik heb genoeg rustdagen" },
    { value: "stapelt_op", label: "De vermoeidheid stapelt op" },
  ],
  missing_checkin: [
    { value: "fris", label: "Fris" },
    { value: "oke", label: "Oké" },
    { value: "vermoeid", label: "Vermoeid" },
  ],
  missing_morning_metrics: [
    { value: "ga_bijhouden", label: "Ja, ik ga het bijhouden" },
    { value: "lukt_niet", label: "Lukt me nu niet" },
  ],
};

/** The follow-up ids Sparki can raise (and therefore accept answers for). */
export function isKnownFollowUp(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(FOLLOWUP_OPTIONS, id);
}

export function optionsFor(id: string): FollowUpOption[] {
  return FOLLOWUP_OPTIONS[id] ?? [];
}

/** True only when `answer` is one of the fixed options for `questionId`. */
export function isValidFollowUpAnswer(
  questionId: string,
  answer: string,
): boolean {
  return optionsFor(questionId).some((o) => o.value === answer);
}

// A "fris/oké/vermoeid" answer to the missing-check-in question IS a real
// readiness check-in. The route persists it as actual athlete_daily_metrics, so
// it is real data — not a guess. Returns null for anything that is not a check-in
// answer.
export function checkInFromAnswer(
  answer: string,
): { feelScore: number; fatigueScore: number } | null {
  switch (answer) {
    case "fris":
      return { feelScore: 8, fatigueScore: 3 };
    case "oke":
      return { feelScore: 6, fatigueScore: 5 };
    case "vermoeid":
      return { feelScore: 3, fatigueScore: 7 };
    default:
      return null;
  }
}

function withReadiness(
  m: IntakeMetrics,
  label: "fresh" | "ok" | "tired",
  score: number,
): IntakeMetrics {
  return {
    ...m,
    readiness: { label, score, basis: ["je eigen antwoord aan Sparki"] },
  };
}

function withFeel(m: IntakeMetrics, latest: number): IntakeMetrics {
  return { ...m, feel: { ...m.feel, latest, days: Math.max(m.feel.days, 1) } };
}

function withFatigue(m: IntakeMetrics, latest: number): IntakeMetrics {
  return {
    ...m,
    fatigue: { ...m.fatigue, latest, days: Math.max(m.fatigue.days, 1) },
  };
}

function applyOne(
  m: IntakeMetrics,
  questionId: string,
  answer: string,
): IntakeMetrics {
  switch (questionId) {
    case "fresh_but_fatigued":
      if (answer === "benen_zwaar") {
        return withFatigue(withFeel(withReadiness(m, "tired", 35), 4), 7);
      }
      // benen_fris — trust the freshness; the doubt is resolved either way.
      return withFeel(withReadiness(m, "fresh", 70), 8);

    case "power_down_load_up":
      if (answer === "stapelt_op") {
        const raised = withFatigue(withFeel(withReadiness(m, "tired", 35), 4), 7);
        return {
          ...raised,
          risk: {
            ...raised.risk,
            level: "high",
            score: Math.max(raised.risk.score, 60),
            reasons: [
              ...raised.risk.reasons,
              "je gaf aan dat de vermoeidheid zich opstapelt",
            ],
          },
        };
      }
      return m;

    case "missing_checkin": {
      // Only adjust in-memory when no real check-in landed yet; the route
      // persists the answer as a real metric, which gatherSignals then reads.
      if (m.readiness.label !== "unknown") return m;
      const ci = checkInFromAnswer(answer);
      if (!ci) return m;
      const label =
        answer === "fris" ? "fresh" : answer === "oke" ? "ok" : "tired";
      const score = answer === "fris" ? 75 : answer === "oke" ? 55 : 30;
      return withFatigue(
        withFeel(withReadiness(m, label, score), ci.feelScore),
        ci.fatigueScore,
      );
    }

    // recovery_split / sleep_ok_resting_high / load_high_feedback_light /
    // missing_morning_metrics: the answer clears the doubt (handled via
    // resolvedIds) but does not invent a metric change.
    default:
      return m;
  }
}

/**
 * Apply today's stored answers onto the gathered metrics. Returns the adjusted
 * metrics plus the ids that are now resolved (answered) so the analysis stops
 * re-asking them. Invalid/unknown answers are ignored. Pure & deterministic.
 */
export function applyFollowUpAnswers(
  metrics: IntakeMetrics,
  answers: StoredFollowUpAnswer[],
): { metrics: IntakeMetrics; resolvedIds: string[] } {
  let m = metrics;
  const resolved = new Set<string>();
  for (const a of answers) {
    if (!isValidFollowUpAnswer(a.questionId, a.answer)) continue;
    resolved.add(a.questionId);
    m = applyOne(m, a.questionId, a.answer);
  }
  return { metrics: m, resolvedIds: [...resolved] };
}
