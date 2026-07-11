// Engagement engine — public facade.
//
// A healthy "pull-to-return" foundation: it LEARNS an athlete's real usage
// rhythm from their own telemetry (tester_events) and answers whether there is
// genuinely something new for them, so a nudge can land at a receptive moment
// on real content only. Deterministic, read-only, and honest — it never changes
// a number, a conclusion or any content; it only informs timing. Routes and the
// reminders engine import from here, not the internals.

export {
  computeEngagement,
  amsterdamHour,
  amsterdamYmd,
  type EngagementProfile,
  type EngagementConfidence,
  type ReceptiveWindow,
  type TelemetryHit,
} from "./compute";
export { deriveEngagement } from "./derive";
export { findWhatsNew, type WhatsNew } from "./whats-new";
