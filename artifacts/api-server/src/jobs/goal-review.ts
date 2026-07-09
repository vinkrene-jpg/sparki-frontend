import { eq } from "drizzle-orm";
import { db, athleteGoalsTable } from "@workspace/db";
import { buildMonthlyProposals } from "../engines/goals";
import { logger } from "../lib/logger";

// CLI entry for the monthly goal-review job (Doelen-engine). Intended to run as
// a Replit Scheduled Deployment (mirrors the reminders / health-check jobs).
// For every athlete with at least one ACTIVE goal it builds deterministic
// adjustment proposals (load / recovery / goal_adjust / goal_review). Safe to
// run repeatedly: proposals are idempotent per goal+kind+month via dedupeKey,
// and NOTHING is applied without the athlete's explicit confirmation in-app.
//
// Schedule it via Publishing → Scheduled Deployments:
//   • Monthly, 1st of the month, 06:00 Europe/Amsterdam
//     (cron: 0 6 1 * *  with timezone Europe/Amsterdam).
// Run command: `pnpm --filter @workspace/api-server run job:goal-review`.
// Build command: none needed (the run command builds first via `pnpm run build`).
//
// Optional env:
//   GOAL_REVIEW_MAX_ATHLETES — cap athletes processed in one run (safety valve).

function intEnv(name: string): number | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const start = Date.now();
  logger.info("goal-review: starting");

  const rows = await db
    .selectDistinct({ clerkId: athleteGoalsTable.clerkId })
    .from(athleteGoalsTable)
    .where(eq(athleteGoalsTable.status, "active"));

  const max = intEnv("GOAL_REVIEW_MAX_ATHLETES");
  const athletes = max ? rows.slice(0, max) : rows;

  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const { clerkId } of athletes) {
    try {
      const result = await buildMonthlyProposals(clerkId);
      created += result.created;
      skipped += result.skipped;
    } catch (err) {
      failed++;
      logger.error({ err, clerkId }, "goal-review: athlete failed");
    }
  }

  const out = {
    athletes: athletes.length,
    created,
    skipped,
    failed,
    durationMs: Date.now() - start,
  };
  logger.info(out, "goal-review: done");
  // Synchronous stdout summary — the pretty pino transport runs in a worker
  // thread whose buffer is lost on process.exit.
  console.log("goal-review summary:", JSON.stringify(out));
  if (failed > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    logger.error({ err }, "goal-review: fatal");
    console.error("goal-review FATAL:", err);
    process.exit(1);
  });
