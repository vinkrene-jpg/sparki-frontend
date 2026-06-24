// Sparki State Engine — the pure compute.
//
// Maps the real signal intake into one honest toestand. Deterministic: identical
// inputs always yield the same state. Nothing is fabricated — missing signals
// only lower certainty and are passed through as honest gaps. There is no live
// "stress" source, so stress is never invented; HRV + resting-HR + feel act as a
// transparent recovery-strain proxy that nudges tension only when those trends
// actually exist.

import type {
  IntakeMetrics,
  IntakeSignal,
  SignalIntake,
  TrendInfo,
} from "../observation/types";
import type {
  MovementDirection,
  SparkiState,
  StateAction,
  StateBand,
  StateMetric,
  StateSignal,
} from "./types";

export type StateComputeInput = Pick<
  SignalIntake,
  "today" | "athleteName" | "metrics" | "signals" | "missing"
>;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function readinessNL(label: IntakeMetrics["readiness"]["label"]): string {
  switch (label) {
    case "fresh":
      return "fris";
    case "ok":
      return "oké";
    case "tired":
      return "vermoeid";
    default:
      return "onbekend";
  }
}

function trendNL(t: TrendInfo): string {
  return t.direction === "rising"
    ? "stijgend"
    : t.direction === "falling"
      ? "dalend"
      : "stabiel";
}

// ── Position ──────────────────────────────────────────────────────────────────

// Y: 0 = belastbaar (top/robuust), 1 = kwetsbaar (bottom). Built from the risk
// composite (which already folds in health, TSB, ACWR and readiness) and, when a
// real check-in exists, the readiness score for finer granularity. Health is a
// hard override toward the bottom.
function computeY(m: IntakeMetrics): number {
  const riskNorm = m.risk.score / 100; // 0 good .. 1 vulnerable
  let vulnerability = riskNorm;
  if (m.readiness.label !== "unknown" && m.readiness.score != null) {
    const ready = m.readiness.score / 100;
    vulnerability = clamp01(0.6 * riskNorm + 0.4 * (1 - ready));
  }
  if (m.healthStatus === "injured") vulnerability = Math.max(vulnerability, 0.9);
  else if (m.healthStatus === "sick")
    vulnerability = Math.max(vulnerability, 0.8);
  return clamp01(vulnerability);
}

// X: 0 = hersteltekort (links), 1 = hersteloverschot (rechts). TSB anchors it;
// an acute spike, a tired check-in and a sleep deficit pull toward deficit.
function computeX(m: IntakeMetrics): number {
  let x = 0.5 + m.load.tsb / 60; // ±30 TSB → extremes
  const acwr = m.risk.acwr;
  if (acwr != null) {
    if (acwr >= 1.5) x -= 0.15;
    else if (acwr >= 1.3) x -= 0.08;
  }
  if (m.readiness.label === "tired") x -= 0.08;
  else if (m.readiness.label === "fresh") x += 0.08;
  if (m.sleep.avg != null) {
    if (m.sleep.avg < 6.5) x -= 0.06;
    else if (m.sleep.avg >= 8) x += 0.04;
  }
  return clamp01(x);
}

// ── Conflict / distortion ──────────────────────────────────────────────────────

function countConflicts(m: IntakeMetrics): number {
  let conflicts = 0;
  // Says fresh/ok, yet the risk model flags high caution.
  if (
    (m.readiness.label === "fresh" || m.readiness.label === "ok") &&
    m.risk.level === "high"
  )
    conflicts++;
  // Rested form, yet feels wrecked.
  if (
    m.load.tsb > 5 &&
    ((m.fatigue.latest != null && m.fatigue.latest >= 7) ||
      (m.feel.latest != null && m.feel.latest <= 4))
  )
    conflicts++;
  // Pain/too-hard feedback, yet a fresh check-in.
  if ((m.feedback.pain > 0 || m.feedback.tooHard > 0) && m.readiness.label === "fresh")
    conflicts++;
  // HRV rising (good) while resting HR also rising (bad).
  if (m.hrv?.direction === "rising" && m.restingHr?.direction === "rising")
    conflicts++;
  // Deeply negative form, yet self-reports fresh.
  if (m.load.tsb <= -20 && m.readiness.label === "fresh") conflicts++;
  return conflicts;
}

// ── Tension (spanning) ──────────────────────────────────────────────────────────

function computeTension(m: IntakeMetrics): number {
  let tension = 0;
  const race = m.races.nextA ?? m.races.nextAny;
  if (race && race.daysUntil >= 0) {
    if (race.daysUntil <= 1) tension += 0.55;
    else if (race.daysUntil <= 3) tension += 0.45;
    else if (race.daysUntil <= 7) tension += 0.32;
    else if (race.daysUntil <= 14) tension += 0.18;
  }
  const acwr = m.risk.acwr;
  if (acwr != null) {
    if (acwr >= 1.5) tension += 0.3;
    else if (acwr >= 1.3) tension += 0.18;
  }
  if (m.load.tsb <= -25) tension += 0.22;
  else if (m.load.tsb <= -15) tension += 0.12;
  // Recovery-strain proxy — an honest stand-in for stress (which has no live
  // source). Only contributes when these trends actually exist.
  if (m.hrv?.direction === "falling") tension += 0.1;
  if (m.restingHr?.direction === "rising") tension += 0.1;
  if (m.fatigue.latest != null && m.fatigue.latest >= 7) tension += 0.08;
  return clamp01(tension);
}

// ── Movement (composite 7-day direction) ────────────────────────────────────────

function computeMovement(m: IntakeMetrics): {
  direction: MovementDirection;
  label: string;
} {
  const contribs: number[] = [];
  if (m.hrv)
    contribs.push(
      m.hrv.direction === "rising" ? 1 : m.hrv.direction === "falling" ? -1 : 0,
    );
  if (m.restingHr)
    contribs.push(
      m.restingHr.direction === "rising"
        ? -1
        : m.restingHr.direction === "falling"
          ? 1
          : 0,
    );
  if (m.ftp.trend)
    contribs.push(
      m.ftp.trend.direction === "rising"
        ? 1
        : m.ftp.trend.direction === "falling"
          ? -1
          : 0,
    );

  if (contribs.length === 0) {
    return {
      direction: "onbekend",
      label: "Nog te weinig om een richting te zien",
    };
  }
  const net = contribs.reduce((a, b) => a + b, 0) / contribs.length;
  const direction: MovementDirection =
    net > 0.2 ? "stijgend" : net < -0.2 ? "dalend" : "stabiel";
  const label =
    direction === "stijgend"
      ? "Je gaat vooruit"
      : direction === "dalend"
        ? "Je zakt iets"
        : "Je blijft stabiel";
  return { direction, label };
}

// ── Confidence ──────────────────────────────────────────────────────────────────

function computeConfidence(
  signals: IntakeSignal[],
  m: IntakeMetrics,
): { confidence: number; label: string } {
  // Weather has no live feed at all — excluding it keeps a permanent structural
  // gap from unfairly dragging every athlete's certainty down.
  const weighable = signals.filter((s) => s.kind !== "weather");
  const score = weighable.reduce(
    (a, s) => a + (s.status === "present" ? 1 : s.status === "insufficient" ? 0.5 : 0),
    0,
  );
  let confidence = weighable.length ? score / weighable.length : 0;
  // No check-in today → today's state is read with less certainty.
  if (m.readiness.label === "unknown") confidence *= 0.8;
  // Sparki weighs and estimates, it never pronounces.
  confidence = clamp01(Math.min(confidence, 0.9));
  const label =
    confidence >= 0.6
      ? "veel data"
      : confidence >= 0.35
        ? "genoeg data"
        : "weinig data";
  return { confidence, label };
}

// ── Status line + action ────────────────────────────────────────────────────────

function bandPhrase(band: StateBand): string {
  switch (band) {
    case "belastbaar":
      return "Je bent goed belastbaar";
    case "solide":
      return "Je staat er solide voor";
    case "wisselend":
      return "Je beeld is wisselend";
    case "kwetsbaar":
      return "Je bent kwetsbaar vandaag";
  }
}

function computeStatus(
  band: StateBand,
  movement: MovementDirection,
  healthStatus: string,
): string {
  if (healthStatus === "injured")
    return "Je gaf een blessure aan — wees voorzichtig vandaag.";
  if (healthStatus === "sick")
    return "Je gaf aan ziek te zijn — focus op herstel.";
  const base = bandPhrase(band);
  const tail =
    movement === "stijgend"
      ? " en je gaat vooruit."
      : movement === "dalend"
        ? " maar je zakt iets."
        : movement === "stabiel"
          ? " en blijft stabiel."
          : ".";
  return base + tail;
}

function computeAction(
  band: StateBand,
  x: number,
  y: number,
  m: IntakeMetrics,
): StateAction {
  if (m.healthStatus === "injured")
    return {
      label: "Houd het rustig en check je blessure",
      reason: "trainen op een blessure maakt het meestal erger",
    };
  if (m.healthStatus === "sick")
    return {
      label: "Geef je lichaam rust",
      reason: "doortrainen tijdens ziekte vertraagt je herstel",
    };
  if (band === "kwetsbaar")
    return {
      label: "Kies een lichte prikkel of rust vandaag",
      reason: "je staat er kwetsbaar voor — forceren kost je meer dan het oplevert",
    };
  const race = m.races.nextA ?? m.races.nextAny;
  if (race && race.daysUntil >= 0 && race.daysUntil <= 3)
    return {
      label: "Houd het scherp maar rustig richting je wedstrijd",
      reason: `${race.name} is ${daysPhrase(race.daysUntil)} — je wilt fris aan de start staan`,
    };
  if (x < 0.35 && y >= 0.55)
    return {
      label: "Kies vandaag een lichtere sessie",
      reason: "je hebt een hersteltekort — eerst opladen, dan weer belasten",
    };
  if (band === "belastbaar" && x > 0.6)
    return {
      label: "Je bent fris — een stevige prikkel kan",
      reason: "je staat er belastbaar en uitgerust voor",
    };
  return {
    label: "Blijf bij je geplande belasting",
    reason: "je signalen geven geen reden om af te wijken",
  };
}

// Plain-Dutch day phrasing — no "dag(en)" plural hack ever reaches a user.
function daysPhrase(n: number): string {
  if (n <= 0) return "vandaag";
  if (n === 1) return "over 1 dag";
  return `over ${n} dagen`;
}

// ── Glanceable metrics (level 1) ────────────────────────────────────────────────

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

// The few real numbers an athlete wants to see at a glance. Built ONLY from real
// training load — when no sessions have fed the load model yet, we return an
// empty list rather than show a fabricated 0. Each value drills into the full
// analysis on the consumer side.
function buildMetrics(m: IntakeMetrics): StateMetric[] {
  if (m.loadSessions < 1) return [];
  const tsb = m.load.tsb;
  return [
    {
      key: "form",
      label: "Vorm",
      value: signed(tsb),
      hint: tsb <= -15 ? "vermoeid" : tsb >= 10 ? "fris" : "in balans",
      tone: tsb <= -15 ? "concern" : tsb >= 10 ? "positive" : "neutral",
    },
    {
      key: "fitness",
      label: "Conditie",
      value: `${m.load.ctl}`,
      hint: "je basis",
      tone: "neutral",
    },
    {
      key: "fatigue",
      label: "Belasting",
      value: `${m.load.atl}`,
      hint: "recent",
      tone: "neutral",
    },
  ];
}

// ── Why (top 3 signals) ──────────────────────────────────────────────────────────

type WhyCandidate = StateSignal & { weight: number };

function buildWhy(m: IntakeMetrics): StateSignal[] {
  const c: WhyCandidate[] = [];

  // Health override — only when it is not the default "ok".
  if (m.healthStatus !== "ok") {
    c.push({
      kind: "health",
      label: "Gezondheid",
      reading:
        m.healthStatus === "injured"
          ? "blessure aangegeven"
          : m.healthStatus === "sick"
            ? "ziek aangegeven"
            : m.healthStatus,
      tone: "concern",
      weight: 5,
    });
  }

  // Training load / form. We describe the balance in words — the raw "vormbalans"
  // number means nothing to a youth rider or parent.
  if (m.loadSessions >= 1) {
    const tsb = m.load.tsb;
    c.push({
      kind: "training_load",
      label: "Je trainingen",
      reading:
        tsb <= -15
          ? "Je trainde stevig en bent nog wat vermoeid"
          : tsb >= 10
            ? "Je bent goed uitgerust van je trainingen"
            : "Je belasting en herstel zijn in balans",
      tone: tsb <= -15 ? "concern" : tsb >= 10 ? "positive" : "neutral",
      weight: m.loadSessions >= 3 ? 3 : 1.5,
    });
  }

  // Today's check-in.
  if (m.readiness.label !== "unknown") {
    c.push({
      kind: "readiness",
      label: "Hoe je je voelt",
      reading: `Je gaf aan je ${readinessNL(m.readiness.label)} te voelen`,
      tone:
        m.readiness.label === "fresh"
          ? "positive"
          : m.readiness.label === "tired"
            ? "concern"
            : "neutral",
      weight: 3,
    });
  }

  // High risk from the composite.
  if (m.risk.level === "high" && m.risk.reasons.length > 0) {
    c.push({
      kind: "training_load",
      label: "Belastingsrisico",
      reading: m.risk.reasons[0]!,
      tone: "concern",
      weight: 3.2,
    });
  }

  // HRV trend.
  if (m.hrv) {
    c.push({
      kind: "hrv_trend",
      label: "Herstel (HRV)",
      reading: trendNL(m.hrv),
      tone:
        m.hrv.direction === "rising"
          ? "positive"
          : m.hrv.direction === "falling"
            ? "concern"
            : "neutral",
      weight: 2,
    });
  }

  // Resting-HR trend.
  if (m.restingHr) {
    c.push({
      kind: "resting_hr_trend",
      label: "Rusthartslag",
      reading: trendNL(m.restingHr),
      tone:
        m.restingHr.direction === "rising"
          ? "concern"
          : m.restingHr.direction === "falling"
            ? "positive"
            : "neutral",
      weight: 2,
    });
  }

  // Sleep deficit.
  if (m.sleep.avg != null && m.sleep.avg < 6.5) {
    c.push({
      kind: "sleep",
      label: "Slaap",
      reading: `gemiddeld ${m.sleep.avg} u — aan de lage kant`,
      tone: "concern",
      weight: 2,
    });
  }

  // Pain / too-hard feedback.
  if (m.feedback.pain > 0 || m.feedback.tooHard > 0) {
    c.push({
      kind: "feedback",
      label: "Reacties op trainingen",
      reading:
        m.feedback.pain > 0
          ? `${m.feedback.pain}× pijn gemeld`
          : `${m.feedback.tooHard}× te zwaar gemeld`,
      tone: "concern",
      weight: 2.2,
    });
  }

  // Upcoming race.
  const race = m.races.nextA ?? m.races.nextAny;
  if (race && race.daysUntil >= 0 && race.daysUntil <= 14) {
    c.push({
      kind: "race_calendar",
      label: "Wedstrijd",
      reading: `${race.name} — ${daysPhrase(race.daysUntil)}`,
      tone: "neutral",
      weight: 2.5,
    });
  }

  // Sort: weight desc, concern before others on a tie, then dedupe by kind+reading.
  const tonePriority = (t: StateSignal["tone"]) =>
    t === "concern" ? 0 : t === "positive" ? 1 : 2;
  c.sort((a, b) =>
    b.weight !== a.weight
      ? b.weight - a.weight
      : tonePriority(a.tone) - tonePriority(b.tone),
  );

  const seen = new Set<string>();
  const out: StateSignal[] = [];
  for (const cand of c) {
    const key = `${cand.kind}:${cand.reading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind: cand.kind,
      label: cand.label,
      reading: cand.reading,
      tone: cand.tone,
    });
    if (out.length === 3) break;
  }
  return out;
}

// ── The engine ────────────────────────────────────────────────────────────────

export function computeState(input: StateComputeInput): SparkiState {
  const { metrics: m, signals } = input;

  const x = computeX(m);
  const y = computeY(m);

  const conflicts = countConflicts(m);
  const distortion = clamp01(conflicts * 0.28);

  let band: StateBand =
    y <= 0.3
      ? "belastbaar"
      : y <= 0.55
        ? "solide"
        : y <= 0.75
          ? "wisselend"
          : "kwetsbaar";
  // Conflicting signals are an honest "wisselend", even on a good position.
  if (distortion >= 0.28 && (band === "belastbaar" || band === "solide")) {
    band = "wisselend";
  }

  const tension = computeTension(m);
  const movement = computeMovement(m);
  const { confidence, label: confidenceLabel } = computeConfidence(signals, m);
  const checkInDone = m.readiness.label !== "unknown";

  return {
    date: input.today,
    athleteName: input.athleteName,
    x,
    y,
    band,
    tension,
    distortion,
    movement,
    confidence,
    confidenceLabel,
    status: computeStatus(band, movement.direction, m.healthStatus),
    action: computeAction(band, x, y, m),
    metrics: buildMetrics(m),
    checkInDone,
    why: buildWhy(m),
    missing: input.missing,
  };
}
