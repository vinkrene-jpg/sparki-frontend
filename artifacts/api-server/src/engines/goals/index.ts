// Doelen engine — public facade.
//
// The athlete's multi-year goal picture: manual main/sub goals + derived goals
// from existing sources (A/B races, developmentGoal, nutrition season goal),
// deterministic daily progress judgement with honest "niet meetbaar" outcomes,
// a one-question-at-a-time doorvraagladder, monthly adjustment proposals that
// require explicit confirmation, and health-triggered reassessment. Routes and
// jobs import from here, not the internals.

export {
  loadGoalPicture,
  composeGoalDailySummary,
  reassessGoalsOnHealthChange,
  buildMonthlyProposals,
  decideProposal,
  recordGoalEvent,
  goalsContextLine,
  loadSteeringDirectives,
  directivesFromProposals,
  buildProposalCandidates,
  deriveGoalPatch,
  judgeProgress,
  nextGoalQuestion,
  isValidHorizon,
  isValidStatus,
} from "../../lib/goals";

export type {
  GoalPicture,
  GoalWithProgress,
  DerivedGoal,
  GoalProgress,
  ProgressVerdict,
  GoalQuestion,
  GoalDailySummary,
  ProposalBuildResult,
  ProposalCandidate,
  SteeringDirective,
  MeasureContext,
} from "../../lib/goals";
