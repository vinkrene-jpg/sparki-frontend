// Training Plan engine.
//
// Owns plan generation, preview/skeleton building, adaptation and roll-forward.
// Reads athlete profile (Profile), readiness/load (Recovery & Load) and routes
// (Route) to produce the periodised plan. Consumed by the training-plan, athlete
// (health-status triggers), races and onboarding (first-plan) routes.

export {
  gatherInputs,
  checkCompleteness,
  buildSkeleton,
  generatePlan,
  adaptPlan,
  maybeRollForward,
  autoAdaptPlan,
  loadPlanView,
} from "../../lib/training-plan";
export type {
  PlanInputs,
  InputCompleteness,
  DaySkeleton,
  GenerateResult,
  AdaptResult,
  RollForwardResult,
  AutoRefreshResult,
} from "../../lib/training-plan";

export { generateThreeWeekPlan } from "../../lib/training/plan-generator";
export type { GeneratePlanInput } from "../../lib/training/plan-generator";
