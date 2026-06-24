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

// Per-athlete coaching profile (begeleidingsprofiel) directive — shapes Sparki's
// voice from the athlete's behavioural/motivational dimensions. Storage is owned
// by the Profile engine; Coaching consumes it.
export {
  getCoachingProfile,
  coachingProfileDirective,
} from "../../lib/profile/coaching-profile";

// Coach / parent sharing-access relationships and consent.
export {
  hasAcceptedCoachLink,
  hasAcceptedParentLink,
  coachSharingLevel,
  parentSharingLevel,
  getEffectiveParentConsent,
  hasRole,
} from "../../lib/sharing";
