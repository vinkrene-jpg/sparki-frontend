import { deliverReminders } from "../engines/reminders";
import { emailChannelStatus } from "../lib/email";
import { logger } from "../lib/logger";

// CLI entry for the scheduled reminder-delivery job. Intended to run as a Replit
// Scheduled Deployment (mirrors the health-check / knowledge-scan jobs). Safe to
// run repeatedly — every reminder is created in-app and emailed at most once
// (idempotent via the notifications dedupeKey unique index), and a previously
// failed email is retried on the next run.
//
// Recommended cadence — run it a few times a day so each reminder lands at a
// sensible time (evening check-ins only fire after 17:00 local):
//   • 18:00 daily  (cron: 0 18 * * *)   captures evening check-ins + tomorrow's
//                                       training + open follow-ups + races.
// Run command: `pnpm --filter @workspace/api-server run job:reminders`.
//
// Optional env:
//   REMINDERS_MAX_ATHLETES  — cap athletes processed in one run (safety valve).
//   REMINDERS_SKIP_EMAIL=true — build + create in-app rows but send no email.

function intEnv(name: string): number | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const start = Date.now();
  const status = await emailChannelStatus();
  logger.info({ emailState: status.state }, "reminders: starting");
  if (status.state !== "ready") {
    // Honest: we still create in-app reminders, but say plainly why no email.
    logger.warn(
      { emailState: status.state },
      "reminders: email channel not ready — reminders are in-app only this run",
    );
  }

  const summary = await deliverReminders({
    maxAthletes: intEnv("REMINDERS_MAX_ATHLETES"),
    skipEmail: process.env.REMINDERS_SKIP_EMAIL === "true",
  });

  const out = { ...summary, durationMs: Date.now() - start };
  logger.info(out, "reminders: done");
  // Synchronous stdout summary — the pretty pino transport runs in a worker
  // thread whose buffer is lost on process.exit; this is the line a Scheduled
  // Deployment surfaces in its logs.
  console.log("reminders summary:", JSON.stringify(out));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "reminders: fatal");
    console.error("reminders FATAL:", err);
    process.exit(1);
  });
