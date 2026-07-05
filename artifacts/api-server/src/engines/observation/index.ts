// Observation & Coach Engine V1 — public facade.
//
// Sparki's deterministic coach brain: it weighs every real signal, produces
// confidence-scored observations with honest reasons + gaps, raises follow-up
// questions on conflicts, and composes a six-part daily analysis with explainable
// advice — all without an LLM, all in plain Dutch, with missing data treated as a
// first-class fact. Routes/jobs should import from here, not the internals.

export * from "./types";
export { gatherSignals, buildSignals } from "./intake";
export { resolvePersonality, term, encouragementLine } from "./personality";
export type { PersonalityInput } from "./personality";
export { computeConfidence, deriveObservations } from "./observations";
export {
  detectContradictions,
  buildFollowUps,
  type ContradictionFinding,
} from "./contradiction";
export { generateAdvice } from "./advice";
export { composeCoachAnalysis, runCoachAnalysis } from "./analysis";
export {
  FOLLOWUP_OPTIONS,
  optionsFor,
  isKnownFollowUp,
  isValidFollowUpAnswer,
  checkInFromAnswer,
  applyFollowUpAnswers,
  type StoredFollowUpAnswer,
} from "./followups";
export {
  detectProfileInconsistencies,
  loadProfileFacts,
  applyProfileCorrection,
  isProfileFollowUp,
  type ProfileInconsistency,
  type ProfileInconsistencyId,
} from "./profile-consistency";
export {
  mapFeedbackToDimensions,
  recordCoachingFeedback,
  isCoachFeedbackSignal,
  COACH_FEEDBACK_SIGNALS,
  type CoachFeedbackSignal,
  type DimensionNudge,
} from "./feedback";
