// Weighted observation model + calibrated confidence.
//
// Each rule weighs MULTIPLE real signals together and only speaks when at least
// two signals agree or a genuine multi-day trend exists — Sparki never concludes
// from a single data point. The one exception is a declared fact (health status),
// which is reported as a fact, not inferred. Confidence is 0–100 (never 100),
// with a plain-Dutch reason for the confidence and for the remaining doubt.

import type {
  AiObservationCategory,
  AiObservationSeverity,
} from "@workspace/db";
import type {
  Confidence,
  ConfidenceLevel,
  IntakeSignal,
  Observation,
  SignalIntake,
  SignalKind,
} from "./types";
import type { ContradictionFinding } from "./contradiction";
import { detectProfileInconsistencies } from "./profile-consistency";

// ── Confidence maths (pure) ──────────────────────────────────────────────────

export function computeConfidence(input: {
  agreeing: number;
  trendDays: number;
  contradictions: number;
  decisiveMissing: number;
  reasons: string[];
  uncertainties: string[];
}): Confidence {
  let score =
    25 +
    20 * Math.min(input.agreeing, 4) +
    4 * Math.min(input.trendDays, 5) -
    18 * input.contradictions -
    12 * input.decisiveMissing;
  score = Math.max(5, Math.min(92, Math.round(score)));
  const level: ConfidenceLevel =
    score < 40 ? "low" : score < 70 ? "medium" : "high";
  return {
    score,
    level,
    reasons: input.reasons,
    uncertainties: input.uncertainties,
  };
}

// ── Rule helpers ─────────────────────────────────────────────────────────────

function signalOf(intake: SignalIntake, kind: SignalKind): IntakeSignal | null {
  return intake.signals.find((s) => s.kind === kind) ?? null;
}

export const KIND_LABEL: Record<SignalKind, string> = {
  training_load: "trainingsbelasting",
  readiness: "check-in van vandaag",
  hrv_trend: "HRV-trend",
  resting_hr_trend: "rusthartslag-trend",
  sleep: "slaap",
  subjective_feel: "eigen gevoel",
  power_dev: "vermogensontwikkeling",
  feedback: "reacties op trainingen",
  health: "gezondheid",
  race_calendar: "wedstrijdkalender",
  nutrition: "voeding",
  weather: "weer",
};

type RuleResult = {
  topic: string;
  tone: Observation["tone"];
  statement: string;
  category: AiObservationCategory;
  severity: AiObservationSeverity;
  usedKinds: SignalKind[];
  decisiveMissing: SignalKind[];
  detectedPattern?: string | null;
  extraReasons?: string[];
  extraUncertainties?: string[];
  allowSingle?: boolean;
};

function build(
  intake: SignalIntake,
  findings: ContradictionFinding[],
  r: RuleResult,
): Observation | null {
  const used = r.usedKinds
    .map((k) => signalOf(intake, k))
    .filter((s): s is IntakeSignal => s != null && s.status === "present");

  const trendDays = Math.max(
    0,
    ...used.map((s) =>
      s.kind === "hrv_trend" ||
      s.kind === "resting_hr_trend" ||
      s.kind === "power_dev"
        ? s.dataPoints
        : 0,
    ),
  );

  // No single-datapoint conclusions: need ≥2 agreeing signals or a real trend.
  if (!r.allowSingle && used.length < 2 && trendDays < 3) return null;

  const contradictions = findings.filter((f) =>
    f.kinds.some((k) => r.usedKinds.includes(k)),
  ).length;

  const reasons: string[] = [...(r.extraReasons ?? [])];
  if (used.length >= 2) {
    reasons.push(`${used.length} signalen wijzen dezelfde kant op`);
  }
  if (trendDays >= 3) {
    reasons.push(`dit is een trend over ${trendDays} dagen, geen losse meting`);
  }

  const uncertainties: string[] = [...(r.extraUncertainties ?? [])];
  for (const k of r.decisiveMissing) {
    if (signalOf(intake, k)?.status !== "present") {
      uncertainties.push(`${KIND_LABEL[k]} ontbreekt`);
    }
  }
  if (contradictions > 0) {
    uncertainties.push("niet alle signalen zijn het met elkaar eens");
  }

  const confidence = computeConfidence({
    agreeing: used.length,
    trendDays,
    contradictions,
    decisiveMissing: uncertainties.length,
    reasons,
    uncertainties,
  });

  return {
    topic: r.topic,
    tone: r.tone,
    statement: r.statement,
    confidence,
    signalsUsed: used,
    signalsMissing: r.decisiveMissing.filter(
      (k) => signalOf(intake, k)?.status !== "present",
    ),
    category: r.category,
    severity: r.severity,
    detectedPattern: r.detectedPattern ?? null,
  };
}

// ── The rules ────────────────────────────────────────────────────────────────

/**
 * Run every deterministic observation rule and return the observations that have
 * real support, strongest (highest severity, then confidence) first.
 */
export function deriveObservations(
  intake: SignalIntake,
  findings: ContradictionFinding[],
): Observation[] {
  const m = intake.metrics;
  const out: (Observation | null)[] = [];

  // Health — a declared fact (allowed as a single signal; not an inference).
  if (m.healthStatus === "injured" || m.healthStatus === "sick") {
    out.push(
      build(intake, findings, {
        topic: "health",
        tone: "concern",
        statement:
          m.healthStatus === "injured"
            ? "Je hebt een blessure aangegeven; trainingsdruk hoort nu opzij te gaan."
            : "Je gaf aan ziek te zijn; rust gaat nu voor training.",
        category: "health",
        severity: "urgent",
        usedKinds: ["health"],
        decisiveMissing: [],
        allowSingle: true,
        extraReasons: ["je hebt dit zelf aangegeven"],
      }),
    );
  }

  // Accumulated fatigue / overreaching.
  {
    const agree: SignalKind[] = [];
    if (m.load.tsb <= -15) agree.push("training_load");
    if (m.readiness.label === "tired") agree.push("readiness");
    if (m.fatigue.latest != null && m.fatigue.latest >= 7)
      agree.push("subjective_feel");
    if (m.risk.acwr != null && m.risk.acwr >= 1.3) agree.push("training_load");
    if (m.restingHr?.direction === "rising") agree.push("resting_hr_trend");
    const uniq = [...new Set(agree)];
    if (uniq.length >= 2) {
      out.push(
        build(intake, findings, {
          topic: "fatigue_load",
          tone: "concern",
          statement:
            "Het lijkt erop dat de vermoeidheid zich opstapelt; je vraagt meer van je lichaam dan het op dit moment terugkrijgt.",
          category: "recovery",
          severity: m.risk.level === "high" ? "important" : "watch",
          usedKinds: uniq,
          decisiveMissing: ["hrv_trend", "readiness"],
        }),
      );
    }
  }

  // Good form / freshness.
  {
    const agree: SignalKind[] = [];
    if (m.load.tsb >= 5) agree.push("training_load");
    if (m.readiness.label === "fresh") agree.push("readiness");
    if (m.sleep.avg != null && m.sleep.avg >= 7.5) agree.push("sleep");
    if (m.risk.level === "low" && m.loadSessions >= 3)
      agree.push("training_load");
    const uniq = [...new Set(agree)];
    if (uniq.length >= 2) {
      out.push(
        build(intake, findings, {
          topic: "good_form",
          tone: "positive",
          statement:
            "Je lijkt fris en goed hersteld; dit is waarschijnlijk een dag waarop je iets extra's aankunt.",
          category: "training",
          severity: "info",
          usedKinds: uniq,
          decisiveMissing: [],
        }),
      );
    }
  }

  // Recovery concern (objective markers).
  {
    const agree: SignalKind[] = [];
    if (m.restingHr?.direction === "rising") agree.push("resting_hr_trend");
    if (m.hrv?.direction === "falling") agree.push("hrv_trend");
    if (m.sleep.avg != null && m.sleep.avg < 6.5) agree.push("sleep");
    const uniq = [...new Set(agree)];
    if (uniq.length >= 2) {
      out.push(
        build(intake, findings, {
          topic: "recovery_concern",
          tone: "concern",
          statement:
            "Je herstelsignalen wijzen mogelijk de verkeerde kant op; je lichaam lijkt nog niet helemaal bij te komen.",
          category: "recovery",
          severity: "watch",
          usedKinds: uniq,
          decisiveMissing: ["readiness"],
          detectedPattern: "herstelmarkers verslechteren samen",
        }),
      );
    }
  }

  // Power progress.
  {
    const agree: SignalKind[] = [];
    if (m.ftp.trend?.direction === "rising") agree.push("power_dev");
    if (m.sessionsPerWeek != null && m.sessionsPerWeek >= 3)
      agree.push("training_load");
    const uniq = [...new Set(agree)];
    if (m.ftp.trend?.direction === "rising" && uniq.length >= 2) {
      out.push(
        build(intake, findings, {
          topic: "power_progress",
          tone: "positive",
          statement:
            "Je vermogen ontwikkelt zich de goede kant op; je training lijkt aan te slaan.",
          category: "training",
          severity: "info",
          usedKinds: uniq,
          decisiveMissing: [],
          detectedPattern: "FTP stijgt over meerdere metingen",
        }),
      );
    }
  }

  // Power decline / detraining.
  {
    const agree: SignalKind[] = [];
    if (m.ftp.trend?.direction === "falling") agree.push("power_dev");
    if (m.sessionsPerWeek != null && m.sessionsPerWeek < 2)
      agree.push("training_load");
    if (m.load.tsb >= 15) agree.push("training_load");
    const uniq = [...new Set(agree)];
    if (m.ftp.trend?.direction === "falling" && uniq.length >= 2) {
      out.push(
        build(intake, findings, {
          topic: "power_decline",
          tone: "concern",
          statement:
            "Je vermogen zakt terwijl je weinig traint; het lijkt op vormverlies door te weinig prikkels.",
          category: "training",
          severity: "watch",
          usedKinds: uniq,
          decisiveMissing: [],
          detectedPattern: "FTP daalt bij lage trainingsfrequentie",
        }),
      );
    }
  }

  // Consistency (positive pattern).
  {
    const agree: SignalKind[] = [];
    if (m.sessionsPerWeek != null && m.sessionsPerWeek >= 4)
      agree.push("training_load");
    if (m.feedback.done >= 3) agree.push("feedback");
    const uniq = [...new Set(agree)];
    if (uniq.length >= 2) {
      out.push(
        build(intake, findings, {
          topic: "consistency",
          tone: "positive",
          statement:
            "Je bent consistent: je traint regelmatig en maakt je sessies af.",
          category: "training",
          severity: "info",
          usedKinds: uniq,
          decisiveMissing: [],
          detectedPattern: "stabiele trainingsfrequentie",
        }),
      );
    }
  }

  // Missed-sessions pattern.
  {
    const agree: SignalKind[] = [];
    if (m.feedback.missed >= 2) agree.push("feedback");
    if (m.sessionsPerWeek != null && m.sessionsPerWeek < 3)
      agree.push("training_load");
    const uniq = [...new Set(agree)];
    if (m.feedback.missed >= 2 && uniq.length >= 2) {
      out.push(
        build(intake, findings, {
          topic: "missed_pattern",
          tone: "concern",
          statement:
            "Je laat de laatste tijd vaker trainingen vallen; misschien sluit het plan niet goed aan op je week.",
          category: "planning",
          severity: "watch",
          usedKinds: uniq,
          decisiveMissing: [],
          detectedPattern: "herhaald gemiste trainingen",
        }),
      );
    }
  }

  // Too-hard pattern.
  {
    const agree: SignalKind[] = [];
    if (m.feedback.tooHard >= 2) agree.push("feedback");
    if (m.fatigue.latest != null && m.fatigue.latest >= 7)
      agree.push("subjective_feel");
    if (m.readiness.label === "tired") agree.push("readiness");
    const uniq = [...new Set(agree)];
    if (m.feedback.tooHard >= 2 && uniq.length >= 2) {
      out.push(
        build(intake, findings, {
          topic: "too_hard_pattern",
          tone: "concern",
          statement:
            "Meerdere trainingen voelden te zwaar terwijl je vermoeid bent; de belasting ligt mogelijk te hoog voor nu.",
          category: "training",
          severity: "important",
          usedKinds: uniq,
          decisiveMissing: [],
          detectedPattern: "herhaald te zware trainingen bij vermoeidheid",
        }),
      );
    }
  }

  // Race approaching.
  if (m.races.nextA && m.races.nextA.daysUntil <= 14) {
    const agree: SignalKind[] = ["race_calendar"];
    if (m.readiness.label !== "unknown") agree.push("readiness");
    if (m.loadSessions >= 3) agree.push("training_load");
    const uniq = [...new Set(agree)];
    if (uniq.length >= 2) {
      out.push(
        build(intake, findings, {
          topic: "race_prep",
          tone: "neutral",
          statement: `Je A-wedstrijd "${m.races.nextA.name}" is over ${m.races.nextA.daysUntil} dagen; vanaf nu telt scherp worden zwaarder dan extra belasting.`,
          category: "race",
          severity: "watch",
          usedKinds: uniq,
          decisiveMissing: ["readiness"],
        }),
      );
    }
  }

  // Profile claims vs proven riding — Sparki names implausible profile values
  // (FTP lower than a proven effort, "beginner" with big weeks, a week target
  // far from reality). The evidence is many real rides, never a single point;
  // the numbers are already in the statement.
  for (const item of detectProfileInconsistencies(m.profile)) {
    out.push(
      build(intake, findings, {
        topic: item.id,
        tone: item.tone,
        statement: item.statement,
        category: item.category,
        severity: item.severity,
        usedKinds: ["training_load"],
        decisiveMissing: [],
        allowSingle: true,
        extraReasons: [
          "gebaseerd op je echte ritten van de afgelopen weken",
        ],
        detectedPattern: "profielwaarde past niet bij je echte ritten",
      }),
    );
  }

  const observations = out.filter((o): o is Observation => o != null);
  const severityRank: Record<AiObservationSeverity, number> = {
    urgent: 3,
    important: 2,
    watch: 1,
    info: 0,
  };
  observations.sort(
    (a, b) =>
      severityRank[b.severity] - severityRank[a.severity] ||
      b.confidence.score - a.confidence.score,
  );
  return observations;
}
