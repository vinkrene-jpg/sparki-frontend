// Recovery & Load engine.
//
// Owns the athlete's load model (CTL/ATL/TSB from training stress) and the daily
// readiness signal derived from morning check-in metrics. Consumed by the
// dashboard, the coach views and the Training Plan engine (adaptation inputs).

// Readiness scoring lives in lib/sharing; it is a Recovery & Load concept and is
// exposed here (the coach-access helpers in that file belong to the Coaching engine).
export { computeReadiness } from "../../lib/sharing";
export type { Readiness } from "../../lib/sharing";

/**
 * Compute Chronic/Acute Training Load and Training Stress Balance from the
 * athlete's TSS history over the trailing ~90 days.
 * Pure: caller supplies the sessions; no I/O here.
 */
export function computeLoad(
  sessions: Array<{ sessionDate: string; tss: number | null }>,
) {
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
