// Recovery & Load engine.
//
// Owns the athlete's load model (CTL/ATL/TSB from training stress) and the daily
// readiness signal derived from morning check-in metrics. Consumed by the
// dashboard, the coach views and the Training Plan engine (adaptation inputs).

// Readiness scoring lives in lib/sharing; it is a Recovery & Load concept and is
// exposed here (the coach-access helpers in that file belong to the Coaching engine).
export { computeReadiness } from "../../lib/sharing";
export type { Readiness } from "../../lib/sharing";

// Load model + the real risk signal the Training Plan engine consumes. The pure
// implementation lives in lib/recovery-load so the plan engine can import it
// without an engine→engine cycle.
export { computeLoad, computeRiskSignal } from "../../lib/recovery-load";
export type { Load, RiskSignal, RiskLevel } from "../../lib/recovery-load";
