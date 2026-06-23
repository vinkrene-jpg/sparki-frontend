// Coaching engine.
//
// Owns Sparki's coaching memory (observations + preferences that shape Sparki's
// voice) and the coach/parent sharing-access relationships. The brief/ask/explain
// HTTP handlers in `routes/ai.ts` compose these with the Knowledge engine and the
// model client. (The term "AI" never leaves this layer in user-facing copy.)

// Coaching memory + style.
export {
  recordMemoryEvent,
  persistObservation,
  getActiveObservations,
  getContextObservations,
  formatObservationsForPrompt,
  getPreferences,
  styleDirective,
  extractObservations,
} from "../../lib/ai-memory";
export type { ObservationInput } from "../../lib/ai-memory";

// Coach / parent sharing-access relationships and consent.
export {
  hasAcceptedCoachLink,
  hasAcceptedParentLink,
  coachSharingLevel,
  parentSharingLevel,
  getEffectiveParentConsent,
  hasRole,
} from "../../lib/sharing";
