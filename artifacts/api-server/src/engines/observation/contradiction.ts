// Doubt / contradiction module.
//
// Sparki names conflicts instead of ignoring the inconvenient signal. When two
// real signals point opposite ways, or a decisive one is missing, it raises a
// short, targeted follow-up question rather than issuing a firm directive. All
// pure over the intake metrics; deterministic; plain Dutch.

import type { IntakeMetrics, FollowUpQuestion, SignalKind } from "./types";
import { optionsFor } from "./followups";

export type ContradictionFinding = {
  id: string;
  /** Plain-Dutch description of the conflict. */
  description: string;
  /** The channels that disagree. */
  kinds: SignalKind[];
};

/** Conflicting real signals — never invented, only flagged when both exist. */
export function detectContradictions(
  m: IntakeMetrics,
): ContradictionFinding[] {
  const out: ContradictionFinding[] = [];
  const feelsGood =
    m.readiness.label === "fresh" || (m.feel.latest != null && m.feel.latest >= 7);

  if (feelsGood && m.load.tsb <= -15 && m.loadSessions >= 3) {
    out.push({
      id: "fresh_but_fatigued",
      description:
        "je voelt je goed, maar op papier draag je flink wat vermoeidheid mee",
      kinds: ["readiness", "subjective_feel", "training_load"],
    });
  }

  if (m.hrv?.direction === "rising" && m.restingHr?.direction === "rising") {
    out.push({
      id: "recovery_split",
      description:
        "je HRV stijgt (gunstig) terwijl je rusthartslag óók stijgt (ongunstig)",
      kinds: ["hrv_trend", "resting_hr_trend"],
    });
  }

  if (
    m.sleep.avg != null &&
    m.sleep.avg >= 7.5 &&
    m.restingHr?.direction === "rising"
  ) {
    out.push({
      id: "sleep_ok_resting_high",
      description:
        "je slaapt voldoende, maar je rusthartslag loopt toch op",
      kinds: ["sleep", "resting_hr_trend"],
    });
  }

  if (m.load.tsb <= -15 && m.feedback.tooLight >= 1) {
    out.push({
      id: "load_high_feedback_light",
      description:
        "je belasting is hoog, maar je gaf aan dat trainingen juist te licht voelden",
      kinds: ["training_load", "feedback"],
    });
  }

  if (
    m.ftp.trend?.direction === "falling" &&
    m.sessionsPerWeek != null &&
    m.sessionsPerWeek >= 4
  ) {
    out.push({
      id: "power_down_load_up",
      description:
        "je traint veel, maar je vermogen daalt in plaats van te stijgen",
      kinds: ["power_dev", "training_load"],
    });
  }

  return out;
}

/**
 * Targeted questions (max 3) Sparki asks before committing: one per real
 * contradiction, plus a request for a decisive missing channel. Ordered by how
 * much an answer would change the advice.
 */
export function buildFollowUps(
  m: IntakeMetrics,
  findings: ContradictionFinding[],
  resolvedIds: ReadonlySet<string> = new Set(),
): FollowUpQuestion[] {
  const out: FollowUpQuestion[] = [];

  for (const f of findings) {
    if (resolvedIds.has(f.id)) continue;
    out.push({
      id: f.id,
      question: questionFor(f.id),
      because: f.description,
      resolves: f.kinds,
      options: optionsFor(f.id),
    });
  }

  // Decisive missing channels — only ask when the gap actually blocks judgement.
  if (m.readiness.label === "unknown" && !resolvedIds.has("missing_checkin")) {
    out.push({
      id: "missing_checkin",
      question: "Hoe voel je je vandaag — fris, oké of vermoeid?",
      because: "zonder check-in van vandaag mist Sparki je belangrijkste signaal",
      resolves: ["readiness", "subjective_feel"],
      options: optionsFor("missing_checkin"),
    });
  }

  if (
    m.hrv == null &&
    m.restingHr == null &&
    m.loadSessions >= 3 &&
    !resolvedIds.has("missing_morning_metrics")
  ) {
    out.push({
      id: "missing_morning_metrics",
      question:
        "Kun je 's ochtends je rusthartslag of HRV bijhouden de komende dagen?",
      because:
        "je traint stevig, maar Sparki kan je herstel nu niet objectief volgen",
      resolves: ["hrv_trend", "resting_hr_trend"],
      options: optionsFor("missing_morning_metrics"),
    });
  }

  return out.slice(0, 3);
}

function questionFor(id: string): string {
  switch (id) {
    case "fresh_but_fatigued":
      return "Voelen je benen echt fris, of vooral je hoofd?";
    case "recovery_split":
      return "Heb je de laatste dagen extra stress of slecht geslapen?";
    case "sleep_ok_resting_high":
      return "Was je de laatste dagen ziek, gestrest of laat naar bed?";
    case "load_high_feedback_light":
      return "Wil je dat Sparki je trainingen zwaarder maakt, of houd je deze belasting aan?";
    case "power_down_load_up":
      return "Heb je genoeg rustdagen, of stapelt de vermoeidheid zich op?";
    default:
      return "Klopt dit beeld met hoe jij je voelt?";
  }
}
