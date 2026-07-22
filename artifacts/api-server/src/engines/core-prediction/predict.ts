// Core-prediction engine — the pure compute.
//
// Deterministic: identical inputs always yield the same prediction. The Core
// path is grounded in the SAME exponentially-weighted load model the State
// Engine consumes — we project the athlete's CTL/ATL/TSB forward (session
// stimulus, then recovery decay) and feed each projected state through the very
// same computeState that drives the live Core, so a predicted frame and a real
// frame speak one visual language. Future readiness/health are NOT fabricated:
// they are held at today's known values and the certainty is lowered to be
// honest about it. Missing determining factors are listed, never guessed.

import type {
  IntakeMetrics,
  IntakeSignal,
  SignalKind,
  SignalStatus,
} from "../observation/types";
import { computeState } from "../state/compute";
import type { SparkiState, StateBand } from "../state/types";
import { computeRiskSignal, type Load } from "../../lib/recovery-load";
import type { WorkoutStructure } from "@workspace/db";
import { estimateTssFromStructure } from "./tss";
import type {
  CorePrediction,
  FactorAvailability,
  PredictionFactor,
  PredictionFrame,
} from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// Days of rest assumed when reading the recovery rebound. A standard 48h window.
export const RECOVERY_DAYS = 2;

export type PredictWorkout = {
  id: number;
  title: string;
  scheduledDate: string;
  targetTSS: number | null;
  targetDurationMin: number | null;
  structure: WorkoutStructure | null;
};

export type PredictInput = {
  today: string;
  athleteName: string;
  metrics: IntakeMetrics;
  signals: IntakeSignal[];
  missing: SignalKind[];
  /** The live, real Core state (drives the "now" frame + confidence baseline). */
  currentState: SparkiState;
  workout: PredictWorkout;
};

const BAND_LABEL: Record<StateBand, string> = {
  belastbaar: "belastbaar",
  solide: "solide",
  wisselend: "wisselend",
  kwetsbaar: "kwetsbaar",
};

// ── Load projection (same EWMA recurrence as computeLoad) ────────────────────
// Start from the athlete's real current load, apply one day's training stimulus,
// then optionally decay over `restDays` rest days. Pure arithmetic over the real
// model — no fabrication.
export function projectLoad(base: Load, tssToday: number, restDays: number): Load {
  let ctl = base.ctl;
  let atl = base.atl;
  ctl = ctl + (tssToday - ctl) / 42;
  atl = atl + (tssToday - atl) / 7;
  for (let i = 0; i < restDays; i++) {
    ctl = ctl + (0 - ctl) / 42;
    atl = atl + (0 - atl) / 7;
  }
  return { ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(ctl - atl) };
}

// Recompute the honest Core state for a projected load, holding the known
// (today's) readiness/health/trends constant — the load shift alone moves the
// position. Reuses the exact State Engine compute so frames match the live Core.
function stateForLoad(input: PredictInput, load: Load): SparkiState {
  const metrics: IntakeMetrics = {
    ...input.metrics,
    load,
    risk: computeRiskSignal({
      load,
      readiness: input.metrics.readiness,
      healthStatus: input.metrics.healthStatus,
    }),
  };
  return computeState({
    today: input.today,
    athleteName: input.athleteName,
    metrics,
    signals: input.signals,
    missing: input.missing,
  });
}

function frame(
  phase: PredictionFrame["phase"],
  label: string,
  caption: string,
  state: SparkiState,
  confidence: number,
  load: Load,
): PredictionFrame {
  return {
    phase,
    label,
    caption,
    x: state.x,
    y: state.y,
    band: state.band,
    tension: state.tension,
    distortion: state.distortion,
    movement: state.movement,
    confidence: clamp01(confidence),
    load,
  };
}

// ── Confidence ───────────────────────────────────────────────────────────────
// Built from real factor coverage and capped well below 1.0 — a forecast is
// inherently less certain than reading today, so it is capped under the State
// Engine's own 0.9 ceiling.
function predictionConfidence(
  m: IntakeMetrics,
  tssBasis: FactorAvailability,
): { confidence: number; label: string } {
  const tssScore = tssBasis === "present" ? 1 : tssBasis === "estimated" ? 0.6 : 0;
  const loadScore = m.loadSessions >= 3 ? 1 : m.loadSessions >= 1 ? 0.55 : 0.2;
  const checkScore = m.readiness.label !== "unknown" ? 1 : 0.7;
  let confidence = 0.5 * tssScore + 0.3 * loadScore + 0.2 * checkScore;
  confidence = clamp01(Math.min(0.85, confidence));
  const label =
    confidence >= 0.6
      ? "redelijk zeker"
      : confidence >= 0.35
        ? "voorzichtige inschatting"
        : "grove inschatting";
  return { confidence, label };
}

// Map a real intake-signal status onto a factor availability. A channel Sparki
// has never received data for is honestly "missing" — never silently dropped.
function availFromSignal(
  signals: IntakeSignal[],
  kind: SignalKind,
): FactorAvailability {
  const status: SignalStatus | undefined = signals.find((s) => s.kind === kind)?.status;
  if (status === "present") return "present";
  if (status === "insufficient") return "estimated";
  return "missing";
}

// ── Determining factors (honest availability) ────────────────────────────────
// EVERY pre-known domain that can shape the Core gets a row — present, estimated
// or "niet beschikbaar" with a plain-Dutch reason. Availability is DETECTED from
// the real signal intake, never assumed; an unwired channel (e.g. weer, parcours)
// is shown as a first-class gap so the forecast is honest about what it can't see.
function buildFactors(
  m: IntakeMetrics,
  workout: PredictWorkout,
  tssBasis: FactorAvailability,
  signals: IntakeSignal[],
): PredictionFactor[] {
  const factors: PredictionFactor[] = [];

  // 1 — Planned load (the strongest driver).
  factors.push({
    key: "planned_load",
    label: "Geplande belasting",
    availability: tssBasis,
    reading:
      tssBasis === "present"
        ? `${workout.targetTSS} belastingspunten gepland`
        : tssBasis === "estimated"
          ? "geen TSS ingevuld — geschat uit de opbouw van de training"
          : "geen belasting of opbouw bekend voor deze training",
    impact:
      tssBasis === "missing"
        ? ""
        : "bepaalt hoe diep je tijdens en na de sessie in vermoeidheid zakt",
  });

  // 2 — Current load base (CTL/ATL/TSB).
  const loadAvail: FactorAvailability =
    m.loadSessions >= 3 ? "present" : m.loadSessions >= 1 ? "estimated" : "missing";
  factors.push({
    key: "load_base",
    label: "Je basis en vermoeidheid",
    availability: loadAvail,
    reading:
      loadAvail === "missing"
        ? "nog geen trainingen om je basis uit te lezen"
        : `vormbalans ${m.load.tsb >= 0 ? "+" : ""}${m.load.tsb}, basis ${m.load.ctl}`,
    impact:
      loadAvail === "missing"
        ? ""
        : "je startpunt — een vermoeide basis zakt sneller door dan een uitgeruste",
  });

  // 3 — Today's check-in (readiness).
  factors.push({
    key: "readiness",
    label: "Hoe je je vandaag voelt",
    availability: m.readiness.label !== "unknown" ? "present" : "missing",
    reading:
      m.readiness.label === "fresh"
        ? "je gaf aan je fris te voelen"
        : m.readiness.label === "tired"
          ? "je gaf aan je vermoeid te voelen"
          : m.readiness.label === "ok"
            ? "je gaf aan je oké te voelen"
            : "niet beschikbaar — nog geen check-in vandaag",
    impact:
      m.readiness.label !== "unknown"
        ? "verfijnt je startpositie en de verwachte terugveer"
        : "",
  });

  // 4 — Health (always known: ok/sick/injured).
  factors.push({
    key: "health",
    label: "Gezondheid",
    availability: "present",
    reading:
      m.healthStatus === "injured"
        ? "je gaf een blessure aan"
        : m.healthStatus === "sick"
          ? "je gaf aan ziek te zijn"
          : "geen klachten aangegeven",
    impact:
      m.healthStatus !== "ok"
        ? "trekt je startpositie en de voorspelling naar de kwetsbare kant"
        : "geen rem op de voorspelling",
  });

  // 5 — Intensity & structure.
  const hasStructure =
    !!workout.structure &&
    Array.isArray(workout.structure.blocks) &&
    workout.structure.blocks.length > 0;
  factors.push({
    key: "structure",
    label: "Intensiteit en opbouw",
    availability: hasStructure ? "present" : "missing",
    reading: hasStructure
      ? `${workout.structure!.intensity} · zone ${workout.structure!.primaryZone}`
      : "niet beschikbaar — geen opbouw met blokken bekend",
    impact: hasStructure
      ? "stuurt de zwaarte van het verloop tijdens de sessie"
      : "",
  });

  // 6 — Recovery signals (HRV / resting HR).
  const hasRecovery = !!m.hrv || !!m.restingHr;
  factors.push({
    key: "recovery_signals",
    label: "Herstelsignalen (HRV/rusthartslag)",
    availability: hasRecovery ? "present" : "missing",
    reading: hasRecovery
      ? "herstelsignalen (HRV/rusthartslag) beschikbaar"
      : "niet beschikbaar — geen HRV of rusthartslag gekoppeld",
    impact: hasRecovery ? "verfijnt de richting van je terugveer" : "",
  });

  // 7 — Sleep.
  const hasSleep = m.sleep.avg != null;
  factors.push({
    key: "sleep",
    label: "Slaap",
    availability: hasSleep ? "present" : "missing",
    reading: hasSleep
      ? `gemiddeld ${m.sleep.avg} u`
      : "niet beschikbaar — geen slaapdata gekoppeld",
    impact: hasSleep ? "weegt licht mee in je herstel" : "",
  });

  // 8 — Subjective feel & fatigue (mentale/fysieke belasting).
  const feelAvail: FactorAvailability =
    m.feel.avg != null || m.fatigue.avg != null ? "present" : "missing";
  factors.push({
    key: "subjective",
    label: "Gevoel en mentale belasting",
    availability: feelAvail,
    reading:
      feelAvail === "present"
        ? [
            m.feel.avg != null ? `gevoel gem. ${m.feel.avg}/10` : null,
            m.fatigue.avg != null ? `vermoeidheid gem. ${m.fatigue.avg}/10` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "niet beschikbaar — nog geen gevoel of vermoeidheid gelogd",
    impact:
      feelAvail === "present"
        ? "kleurt hoe zwaar de sessie aanvoelt naast de pure cijfers"
        : "",
  });

  // 9 — Power development (FTP-trend).
  const ftpAvail: FactorAvailability =
    m.ftp.trend != null ? "present" : m.ftp.latest != null ? "estimated" : "missing";
  factors.push({
    key: "power_dev",
    label: "Vermogensontwikkeling",
    availability: ftpAvail,
    reading:
      ftpAvail === "missing"
        ? "niet beschikbaar — nog geen FTP bekend"
        : m.ftp.trend != null
          ? `FTP ${m.ftp.trend.direction === "rising" ? "stijgend" : m.ftp.trend.direction === "falling" ? "dalend" : "stabiel"} (${m.ftp.latest} W)`
          : `FTP ${m.ftp.latest} W (nog geen trend)`,
    impact: ftpAvail === "missing" ? "" : "ijkt hoe zwaar deze belasting voor jóu is",
  });

  // 10 — Voeding & hydratatie.
  const nutritionAvail = availFromSignal(signals, "nutrition");
  factors.push({
    key: "nutrition",
    label: "Voeding en hydratatie",
    availability: m.nutrition.logs > 0 ? nutritionAvail : "missing",
    reading:
      m.nutrition.logs > 0
        ? `${m.nutrition.logs} voedingsmoment${m.nutrition.logs === 1 ? "" : "en"} gelogd`
        : "niet beschikbaar — nog geen voeding gelogd",
    impact:
      m.nutrition.logs > 0
        ? "weegt mee in hoe goed je de belasting verteert en herstelt"
        : "",
  });

  // 11 — Wedstrijdplanning (context die het advies kleurt).
  const raceAvail: FactorAvailability = m.races.count > 0 ? "present" : "missing";
  factors.push({
    key: "race_calendar",
    label: "Wedstrijdplanning",
    availability: raceAvail,
    reading:
      m.races.nextA != null
        ? `A-wedstrijd "${m.races.nextA.name}" over ${m.races.nextA.daysUntil} dagen`
        : m.races.nextAny != null
          ? `volgende wedstrijd over ${m.races.nextAny.daysUntil} dagen`
          : "niet beschikbaar — geen wedstrijd in de kalender",
    impact:
      raceAvail === "present"
        ? "bepaalt of je nu wilt opbouwen of juist fris naar de start wilt"
        : "",
  });

  // 12 — Weer & temperatuur (nog niet gekoppeld — eerlijk als gat getoond).
  factors.push({
    key: "weather",
    label: "Weer en temperatuur",
    availability: availFromSignal(signals, "weather"),
    reading: "niet beschikbaar — weerdata is nog niet aan Sparki gekoppeld",
    impact: "",
  });

  // 13 — Parcours / hoogtemeters (niet bekend voor een geplande training).
  factors.push({
    key: "route_profile",
    label: "Parcours en hoogtemeters",
    availability: "missing",
    reading: "niet beschikbaar — een geplande training heeft nog geen parcours",
    impact: "",
  });

  return factors;
}

// ── The engine ────────────────────────────────────────────────────────────────
export function computePrediction(input: PredictInput): CorePrediction {
  const { metrics: m, workout, currentState } = input;

  // Resolve the planned load and its honest basis.
  const estimated = estimateTssFromStructure(workout.structure);
  const tss = workout.targetTSS ?? estimated;
  const tssBasis: FactorAvailability =
    workout.targetTSS != null ? "present" : estimated != null ? "estimated" : "missing";

  const factors = buildFactors(m, workout, tssBasis, input.signals);
  const { confidence, label: confidenceLabel } = predictionConfidence(m, tssBasis);
  const predictable = tssBasis !== "missing" && tss != null && tss > 0;

  const baseLoad = m.load;
  const nowFrame = frame(
    "now",
    "Nu",
    `Je staat er ${BAND_LABEL[currentState.band]} voor.`,
    currentState,
    currentState.confidence,
    baseLoad,
  );

  if (!predictable || tss == null) {
    return {
      workoutId: workout.id,
      generatedAt: new Date().toISOString(),
      scheduledDate: workout.scheduledDate,
      workoutTitle: workout.title,
      tss: null,
      tssBasis: "missing",
      frames: [nowFrame],
      factors,
      confidence: clamp01(Math.min(confidence, 0.3)),
      confidenceLabel: "te weinig om te voorspellen",
      headline: "Sparki kan het effect nog niet voorspellen",
      summary:
        "Er is nog geen geplande belasting of opbouw voor deze training. Vul de belasting of de blokken in, dan voorspelt Sparki het effect op hoe je ervoor staat.",
      predictable: false,
      comparison: null,
    };
  }

  // Project the load forward and read the Core at each moment. The end-of-session
  // load is the full stimulus; "during" is the honest midpoint of the now→end
  // path (fatigue accumulates monotonically through the session, so a separate
  // half-stimulus EWMA step — which can paradoxically raise TSB when half the TSS
  // sits below the current ATL — would misrepresent mid-session).
  const endLoad = projectLoad(baseLoad, tss, 0);
  const duringLoad: Load = {
    ctl: Math.round((baseLoad.ctl + endLoad.ctl) / 2),
    atl: Math.round((baseLoad.atl + endLoad.atl) / 2),
    tsb: Math.round((baseLoad.tsb + endLoad.tsb) / 2),
  };
  const recoveryLoad = projectLoad(baseLoad, tss, RECOVERY_DAYS);

  const duringState = stateForLoad(input, duringLoad);
  const endState = stateForLoad(input, endLoad);
  const recoveryState = stateForLoad(input, recoveryLoad);

  const duringFrame = frame(
    "during",
    "Tijdens",
    "Halverwege loopt de belasting op.",
    duringState,
    confidence,
    duringLoad,
  );
  const endFrame = frame(
    "end",
    "Direct na",
    `Vlak na de training: ${BAND_LABEL[endState.band]}.`,
    endState,
    confidence,
    endLoad,
  );
  const recoveryFrame = frame(
    "recovery",
    "Na herstel",
    `Na ~${RECOVERY_DAYS} dagen rust veer je terug naar ${BAND_LABEL[recoveryState.band]}.`,
    recoveryState,
    clamp01(confidence * 0.85),
    recoveryLoad,
  );

  const tsbDrop = baseLoad.tsb - endLoad.tsb;
  const headline =
    endState.band === currentState.band
      ? `Deze training houdt je ${BAND_LABEL[endState.band]}`
      : `Deze training brengt je van ${BAND_LABEL[currentState.band]} naar ${BAND_LABEL[endState.band]}`;

  const reboundPhrase =
    recoveryLoad.tsb > endLoad.tsb
      ? `daarna veer je in ~${RECOVERY_DAYS} dagen rust terug naar ${BAND_LABEL[recoveryState.band]}`
      : `na ~${RECOVERY_DAYS} dagen rust blijf je rond ${BAND_LABEL[recoveryState.band]}`;

  const summary =
    `${tssBasis === "estimated" ? "Geschat uit de opbouw: deze" : "Deze"} training van ${tss} belastingspunten ` +
    `laat je vormbalans zakken van ${baseLoad.tsb >= 0 ? "+" : ""}${baseLoad.tsb} naar ${endLoad.tsb >= 0 ? "+" : ""}${endLoad.tsb}` +
    ` (${tsbDrop > 0 ? `${tsbDrop} punten dieper in vermoeidheid` : "nauwelijks extra vermoeidheid"}); ${reboundPhrase}.`;

  return {
    workoutId: workout.id,
    generatedAt: new Date().toISOString(),
    scheduledDate: workout.scheduledDate,
    workoutTitle: workout.title,
    tss,
    tssBasis,
    frames: [nowFrame, duringFrame, endFrame, recoveryFrame],
    factors,
    confidence,
    confidenceLabel,
    headline,
    summary,
    predictable: true,
    comparison: null,
  };
}
