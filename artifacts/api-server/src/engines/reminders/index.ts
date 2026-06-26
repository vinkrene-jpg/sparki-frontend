// Reminders engine — public facade.
//
// Real reminder delivery: a deterministic engine that finds genuinely-due
// reminders (evening check-ins, open follow-up questions, upcoming training and
// races), honours each athlete's preferences, creates the in-app notification
// once, and delivers it through a real channel (email via Resend) exactly once.
// Routes and the scheduled job import from here, not the internals.

export { buildDueReminders, type ReminderItem } from "./build";
export {
  deliverReminders,
  pendingEmailCount,
  type DeliverOptions,
  type DeliverSummary,
} from "./deliver";
export {
  getPrefs,
  updatePrefs,
  allows,
  DEFAULT_PREFS,
  type EffectivePrefs,
  type PrefsPatch,
} from "./preferences";
export { emailChannelStatus, type EmailChannelStatus } from "../../lib/email";
