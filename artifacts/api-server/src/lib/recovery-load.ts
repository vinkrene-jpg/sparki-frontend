// Recovery & Load model (pure).
//
// Lives in lib/ (not the engine facade) so the Training Plan engine can consume
// the load + risk signal without an engine→engine import cycle. The Recovery &
// Load engine re-exports these. Everything here is deterministic over real,
// caller-supplied data — nothing is fabricated.

import type { Readiness } from "./sharing";

export type Load = { ctl: number; atl: number; tsb: number };

/**
 * Chronic/Acute Training Load and Training Stress Balance from a TSS history.
 * CTL = 42-day, ATL = 7-day exponentially-weighted averages over the trailing
 * ~90 days; TSB = CTL − ATL. Pure: caller supplies the sessions.
 */
export function computeLoad(
  sessions: Array<{ sessionDate: string; tss: number | null }>,
): Load {
  const tssByDate = new Map<string, number>();
  for (const s of sessions) {
    if (s.tss != null) {
      tssByDate.set(s.sessionDate, (tssByDate.get(s.sessionDate) ?? 0) + s.tss);
    }
  }

  const today = new Date();
  let ctl = 0;
  let atl = 0;

  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;
    const tss = tssByDate.get(dateStr) ?? 0;
    ctl = ctl + (tss - ctl) / 42;
    atl = atl + (tss - atl) / 7;
  }

  return {
    ctl: Math.round(ctl),
    atl: Math.round(atl),
    tsb: Math.round(ctl - atl),
  };
}

export type LoadPoint = {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  tss: number;
};

/**
 * Same load model as computeLoad, but also returns the day-by-day series for
 * the trailing `chartDays` window (pre-warmed over the trailing ~90 days so
 * the model state is identical). ONE implementation: routes must use this
 * instead of re-implementing the EWMA inline. TSS per date is summed once per
 * session row — an activity never counts double.
 */
export function computeLoadSeries(
  sessions: Array<{ sessionDate: string; tss: number | null }>,
  chartDays = 42,
): Load & { chartData: LoadPoint[] } {
  const days = Math.max(7, Math.min(365, Math.round(chartDays)));
  const tssByDate = new Map<string, number>();
  for (const s of sessions) {
    if (s.tss != null) {
      tssByDate.set(s.sessionDate, (tssByDate.get(s.sessionDate) ?? 0) + s.tss);
    }
  }

  const today = new Date();
  let ctl = 0;
  let atl = 0;
  const chartData: LoadPoint[] = [];

  // Warmup: het model start altijd 90 dagen vóór het zichtbare venster, zodat
  // CTL/ATL aan de linkerrand van elke gekozen periode al ingelopen zijn.
  for (let i = days + 90; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;
    const tss = tssByDate.get(dateStr) ?? 0;
    ctl = ctl + (tss - ctl) / 42;
    atl = atl + (tss - atl) / 7;
    if (i <= days) {
      chartData.push({
        date: dateStr,
        ctl: Math.round(ctl),
        atl: Math.round(atl),
        tsb: Math.round(ctl - atl),
        tss,
      });
    }
  }

  return {
    ctl: Math.round(ctl),
    atl: Math.round(atl),
    tsb: Math.round(ctl - atl),
    chartData,
  };
}

export type RiskLevel = "low" | "moderate" | "high";

export type RiskSignal = {
  level: RiskLevel;
  // 0–100 composite injury/overreaching risk. Higher = more caution warranted.
  score: number;
  // Acute:chronic workload ratio (ATL/CTL); null when there is no chronic base.
  acwr: number | null;
  // Plain-Dutch reasons, surfaced to the athlete and used by the plan engine.
  reasons: string[];
};

/**
 * Combine the load model, the self-reported readiness and the athlete's health
 * status into one real risk signal the Training Plan engine consumes. Pure and
 * deterministic: identical inputs always yield the same level/score/reasons.
 *
 * Drivers (additive, capped at 100):
 *  - Health status (sick/injured) — hard override toward high.
 *  - TSB (form): deeply negative = accumulated fatigue.
 *  - ACWR (ATL/CTL): an elevated acute:chronic ratio is an UNCERTAIN load-warning
 *    signal, only used here in combination with the other drivers. It does not
 *    by itself predict injury or illness.
 *  - Readiness: a "tired" self-report adds risk; "fresh" relieves a little.
 */
export function computeRiskSignal(input: {
  load: Load;
  readiness: Readiness;
  healthStatus: string;
}): RiskSignal {
  const { load, readiness, healthStatus } = input;
  const reasons: string[] = [];
  let score = 0;

  if (healthStatus === "injured") {
    reasons.push("je hebt een blessure aangegeven");
    score += 70;
  } else if (healthStatus === "sick") {
    reasons.push("je hebt aangegeven ziek te zijn");
    score += 60;
  }

  // Form (TSB). Deeply negative means acute fatigue has outpaced fitness.
  if (load.tsb <= -30) {
    reasons.push("je vormbalans is sterk negatief (veel vermoeidheid)");
    score += 35;
  } else if (load.tsb <= -15) {
    reasons.push("je vormbalans is negatief");
    score += 18;
  }

  // Acute:chronic workload ratio. >1.5 is treated as a strong load-warning
  // signal and 1.3–1.5 as elevated, but this is an UNCERTAIN heuristic: it does
  // not by itself predict injury or illness, is no diagnosis, and is never a
  // standalone reason for automatic escalation — it only adds points to the
  // composite score alongside the other signals (health status, TSB,
  // readiness). Only meaningful once a chronic base exists.
  const acwr = load.ctl > 0 ? Math.round((load.atl / load.ctl) * 100) / 100 : null;
  if (acwr != null) {
    if (acwr >= 1.5) {
      reasons.push("je acute belasting piekt fors boven je basis");
      score += 30;
    } else if (acwr >= 1.3) {
      reasons.push("je acute belasting ligt boven je basis");
      score += 15;
    }
  }

  // Self-reported readiness.
  if (readiness.label === "tired") {
    reasons.push("je voelt je niet hersteld");
    score += 20;
  } else if (readiness.label === "fresh") {
    score = Math.max(0, score - 8);
  }

  score = Math.max(0, Math.min(100, score));
  const level: RiskLevel = score >= 55 ? "high" : score >= 28 ? "moderate" : "low";
  return { level, score, acwr, reasons };
}
