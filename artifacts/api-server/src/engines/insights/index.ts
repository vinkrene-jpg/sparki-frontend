// Sparki Insights — curiosity open-loops, the honest observation, and the
// Founding Athlete / Hoofdtester identity. All evidence-gated and deterministic;
// every value traces back to real rows. Public API for the route layer.

export { computeInsightSignals } from "./signals";
export type { InsightSignals, SelfType } from "./signals";

export { computeOpenLoops, OPEN_LOOPS } from "./open-loops";
export type { OpenLoop, OpenLoopId } from "./open-loops";

export { composeHonest } from "./honest";
export type { HonestObservation } from "./honest";

export {
  assignFoundingNumber,
  foundingLabel,
  assignHeadTesterNumber,
  headTesterLabel,
  headTesterLine,
  FOUNDING_LINES,
  HEAD_TESTER_LINES,
} from "./identity";
