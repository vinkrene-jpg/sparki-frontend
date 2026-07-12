// Rit-verhaal — deterministic helpers (Fase 1 "De keten", flag `rit_verhaal`).
//
// Pure functions only: the schemagevolg-assessment (what a completed ride means
// for the schedule) and the chat context block for "Vraag door over deze rit".
// NO model calls here — this is presentation-grade reasoning over real rows.
//
// Honesty contract:
// - Three honest states only: a proposal path exists (voorstel), the schedule
//   explicitly stays (geen), or it genuinely cannot be determined yet
//   (onbekend) — with exactly WHAT is missing. Race days point to the existing
//   race evaluation instead (wedstrijd).
// - The causal line always names the REAL trigger (feedback given, numbers
//   compared). Never a vague "Sparki heeft iets aangepast".
// - No accuracy percentages, no fabricated comparisons.

import type { TrainingSession } from "@workspace/db";

export type ConsequenceStatus = "voorstel" | "geen" | "onbekend" | "wedstrijd";

// Feedback types (workout_feedback.feedback_type) that mean the athlete
// explicitly flagged the session — the existing feedback→voorstel flow applies.
const PROPOSAL_FEEDBACK = new Set(["too_hard", "too_light", "pain", "tired"]);

export const FEEDBACK_LABELS_NL: Record<string, string> = {
  done: "gedaan",
  missed: "gemist",
  too_hard: "te zwaar",
  too_light: "te licht",
  pain: "pijn",
  tired: "vermoeid",
  move: "verplaatsen",
};

export type ConsequenceInput = {
  session: {
    tss: number | null;
    durationMin: number | null;
    type: string;
  };
  workout: {
    id: number;
    title: string;
    targetTSS: number | null;
    targetDurationMin: number | null;
  } | null;
  /** feedback_type values already given on the linked workout (newest first). */
  feedbackTypes: string[];
  race: { id: number; name: string } | null;
};

export type ConsequenceResult = {
  status: ConsequenceStatus;
  /** Plain-Dutch explanation, always naming the real cause. */
  reason: string;
  /** The explicit causal line ("omdat …") shown with a proposal. */
  causeLine: string | null;
  /** What is genuinely missing when status is "onbekend". */
  missing: string[];
  /**
   * True when the existing feedback→voorstel flow is the next step: either a
   * proposal can be requested now (status "voorstel") or giving feedback would
   * unlock the assessment (status "onbekend" with "feedback" in missing).
   */
  canPropose: boolean;
};

/**
 * Deterministic schemagevolg-assessment for one completed ride.
 * Pure — no I/O, fully unit-testable.
 */
export function assessConsequence(input: ConsequenceInput): ConsequenceResult {
  const { session, workout, feedbackTypes, race } = input;

  // Race day → the race evaluation is the follow-up, not a training proposal.
  if (race || session.type === "race") {
    return {
      status: "wedstrijd",
      reason: race
        ? `Dit was je wedstrijd ${race.name}. Bekijk de wedstrijdevaluatie — je trainingsschema wordt hier niet automatisch op aangepast.`
        : "Dit was een wedstrijd. Bekijk de wedstrijdevaluatie — je trainingsschema wordt hier niet automatisch op aangepast.",
      causeLine: null,
      missing: [],
      canPropose: false,
    };
  }

  const negative = feedbackTypes.find((t) => PROPOSAL_FEEDBACK.has(t));

  if (workout) {
    // Explicit athlete signal wins: the existing voorstel-flow applies.
    if (negative) {
      const label = FEEDBACK_LABELS_NL[negative] ?? negative;
      return {
        status: "voorstel",
        reason: `Omdat je na deze rit "${label}" aangaf, kan Sparki een aanpassing van je schema voorstellen.`,
        causeLine: `Op basis van jouw feedback ("${label}") op deze training.`,
        missing: [],
        canPropose: true,
      };
    }

    // Compare real load against the plan when both sides exist.
    if (workout.targetTSS != null && session.tss != null) {
      const diff = session.tss - workout.targetTSS;
      const tolerance = Math.max(8, Math.round(workout.targetTSS * 0.12));
      if (Math.abs(diff) <= tolerance) {
        return {
          status: "geen",
          reason: `Je reed zoals gepland (belasting ${session.tss} om ${workout.targetTSS} gepland) — je schema blijft staan.`,
          causeLine: null,
          missing: [],
          canPropose: false,
        };
      }
      const richting = diff > 0 ? "zwaarder" : "lichter";
      return {
        status: "onbekend",
        reason: `Je reed duidelijk ${richting} dan gepland (belasting ${session.tss} om ${workout.targetTSS}). Of je schema aanpassing nodig heeft hangt af van hoe het voelde — geef je feedback op deze training, dan bepaalt Sparki het gevolg.`,
        causeLine: null,
        missing: ["feedback"],
        canPropose: true,
      };
    }

    // No comparable numbers. Positive/neutral feedback → schedule stands.
    if (feedbackTypes.includes("done")) {
      return {
        status: "geen",
        reason: "Je gaf aan dat deze training gedaan is — je schema blijft staan.",
        causeLine: null,
        missing: [],
        canPropose: false,
      };
    }

    // Nothing to go on at all: no load numbers, no feedback.
    if (session.tss == null && session.durationMin == null) {
      return {
        status: "onbekend",
        reason:
          "Nog niet te bepalen: deze rit kwam zonder belasting- of duurgegevens binnen en je gaf nog geen feedback.",
        causeLine: null,
        missing: ["sensorgegevens", "feedback"],
        canPropose: true,
      };
    }

    // Duration known but no planned/actual TSS pair — honest, no fake compare.
    return {
      status: "onbekend",
      reason:
        "Nog niet te bepalen: er zijn geen vergelijkbare belastingcijfers (gepland én gereden). Geef je feedback op deze training, dan bepaalt Sparki het gevolg.",
      causeLine: null,
      missing: ["feedback"],
      canPropose: true,
    };
  }

  // Unplanned ride (not linked to a planned workout).
  if (session.tss == null && session.durationMin == null) {
    return {
      status: "onbekend",
      reason:
        "Nog niet te bepalen: deze rit stond niet in je schema en kwam zonder belasting- of duurgegevens binnen.",
      causeLine: null,
      missing: ["sensorgegevens"],
      canPropose: false,
    };
  }
  return {
    status: "geen",
    reason:
      "Deze rit stond niet in je schema. Je geplande trainingen blijven staan; de belasting van deze rit telt wel mee in je totaalbeeld.",
    causeLine: null,
    missing: [],
    canPropose: false,
  };
}

/**
 * Plain-text context block describing ONE owned ride, injected into the chat
 * prompt when the athlete asks a question about that ride. Only real logged
 * fields are named; missing fields are stated as missing.
 */
export function buildSessionContextBlock(session: TrainingSession): string {
  const lines: string[] = [];
  lines.push(`Rit van ${session.sessionDate}${session.title ? ` — "${session.title}"` : ""}`);
  lines.push(`Type: ${session.type}, sport: ${session.sport}, bron: ${session.source}`);
  const facts: string[] = [];
  if (session.durationMin != null) facts.push(`duur ${session.durationMin} min`);
  if (session.distanceKm != null) facts.push(`afstand ${session.distanceKm} km`);
  if (session.tss != null) facts.push(`belastingscore ${session.tss}`);
  if (session.normalizedPower != null) facts.push(`genormaliseerd vermogen ${session.normalizedPower} W`);
  if (session.avgPower != null) facts.push(`gemiddeld vermogen ${session.avgPower} W`);
  if (session.avgHR != null) facts.push(`gemiddelde hartslag ${session.avgHR}`);
  if (session.elevationM != null) facts.push(`hoogtemeters ${session.elevationM} m`);
  if (session.feelScore != null) facts.push(`gevoelsscore ${session.feelScore}/5`);
  lines.push(
    facts.length > 0
      ? `Gelogde waarden: ${facts.join(", ")}.`
      : "Er zijn voor deze rit geen belasting-, vermogens- of hartslagwaarden gelogd — benoem dat eerlijk als het relevant is.",
  );
  if (session.notes) lines.push(`Notitie van de atleet: ${session.notes}`);
  return lines.join("\n");
}
