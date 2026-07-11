// In-process reminder scheduler.
//
// WHY THIS EXISTS: reminder + nudge delivery (including the smartly-timed "er is
// iets nieuws voor je" pulse) only reaches an athlete who is AWAY from the app,
// so it must run on a server-side timer. A non-technical user never configures a
// Replit Scheduled Deployment, so relying on that alone means nudges never fire
// (the same root cause that once left the news feed stale). This runs the real,
// idempotent delivery pipeline periodically from inside the long-running API
// server so it works with zero setup.
//
// SAFETY: every reminder is created in-app and emailed/pushed at most once
// (idempotent via the notifications dedupeKey unique index + freshly-created
// signal), so overlapping or duplicate runs only cost redundant work. Runs are
// single-flighted, errors are swallowed (never crash the server), and the timer
// is unref'd so it never keeps the process alive on its own.

import { deliverReminders } from "../engines/reminders";
import { logger } from "./logger";

let started = false;
let inFlight = false;

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function startReminderScheduler(): void {
  if (started) return;

  // Enabled in production by default (where a real user needs it and no
  // Scheduled Deployment is configured). Opt-in during development with
  // REMINDERS_IN_PROCESS=true; force-off anywhere with REMINDERS_IN_PROCESS=false.
  const flag = process.env.REMINDERS_IN_PROCESS;
  const enabled =
    flag === "true"
      ? true
      : flag === "false"
        ? false
        : process.env.NODE_ENV === "production";
  if (!enabled) {
    logger.info(
      { reminders: "scheduler" },
      "in-process reminder scheduler disabled (set REMINDERS_IN_PROCESS=true to enable)",
    );
    return;
  }

  started = true;
  const intervalMin = intEnv("REMINDERS_INTERVAL_MIN", 60);
  const intervalMs = intervalMin * 60_000;
  const maxAthletesEnv = process.env.REMINDERS_MAX_ATHLETES
    ? intEnv("REMINDERS_MAX_ATHLETES", 5000)
    : undefined;

  const run = async () => {
    if (inFlight) return; // single-flight — never overlap runs
    inFlight = true;
    try {
      const summary = await deliverReminders(
        maxAthletesEnv ? { maxAthletes: maxAthletesEnv } : {},
      );
      logger.info(
        { reminders: "scheduler", ...summary },
        "in-process reminder run done",
      );
    } catch (err) {
      logger.error({ err, reminders: "scheduler" }, "in-process reminder run failed");
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => void run(), intervalMs);
  timer.unref?.();
  logger.info(
    { reminders: "scheduler", intervalMin },
    "in-process reminder scheduler started",
  );

  // First run shortly after boot, once the server has settled.
  const kickoff = setTimeout(() => void run(), 30_000);
  kickoff.unref?.();
}
