// Onboarding engine.
//
// Owns onboarding state: the adaptive core-question selection, fact parsing,
// quick-start baseline estimates, and the "what is still missing before a first
// plan can be built" check. Consumed by the onboarding route; feeds the Training
// Plan engine (first plan) and writes into the athlete profile (Profile).

// Adaptive questions, fact parsing, baseline estimates.
export * from "../../lib/onboarding-questions";

// Missing-data check that gates the first plan.
export * from "../../lib/connectors/missing-data";

// Coaching-dimension (begeleidingsprofiel) gradual collection. Onboarding feeds
// these via short follow-up prompts; the Athlete Profile engine owns the storage.
export {
  selectNextCoachingQuestions,
  parseCoachingAnswer,
  recordCoachingAnswer,
  isCoachingDimensionKey,
} from "../../lib/profile/coaching-profile";
