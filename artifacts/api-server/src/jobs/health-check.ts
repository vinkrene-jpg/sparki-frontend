import { runHealthChecks, hasCriticalFailures } from "../lib/health/engine";
import { logger } from "../lib/logger";

// CLI entry for the automated Health Check engine. Intended to run as a Replit
// Scheduled Deployment. Modes (set HEALTH_CHECK_MODE):
//   daily   — the standard nightly run (recommended 04:00). Default.
//   weekly  — full end-to-end run (same checks; tagged "weekly" for history).
//   release — pre-release gate: runs all checks and exits NON-ZERO if any
//             critical (red, unresolved) failure exists, so it can block a
//             release pipeline.
//
// Schedule it via Publishing → Scheduled Deployments:
//   • Daily  04:00   →  HEALTH_CHECK_MODE=daily   (cron: 0 4 * * *)
//   • Weekly Mon 04:30 → HEALTH_CHECK_MODE=weekly (cron: 30 4 * * 1)
//   • Pre-release      → HEALTH_CHECK_MODE=release (run before promoting a build)
// Run command for each: `pnpm --filter @workspace/api-server run job:health`.

type Mode = "daily" | "weekly" | "release";

function resolveMode(): Mode {
  const raw = (process.env.HEALTH_CHECK_MODE ?? "daily").toLowerCase();
  if (raw === "weekly") return "weekly";
  if (raw === "release") return "release";
  return "daily";
}

async function main() {
  const start = Date.now();
  const mode = resolveMode();
  logger.info({ mode }, "health-check: starting");

  const { batchId, outcomes } = await runHealthChecks({
    mode,
    triggeredBy: "scheduler",
  });

  const counts = outcomes.reduce(
    (acc, o) => {
      acc[o.statusColor]++;
      return acc;
    },
    { green: 0, orange: 0, red: 0, grey: 0 } as Record<string, number>,
  );

  const summary = {
    mode,
    batchId,
    total: outcomes.length,
    ...counts,
    durationMs: Date.now() - start,
  };
  logger.info(summary, "health-check: done");

  const failing = outcomes.filter((o) => o.statusColor === "red");
  if (failing.length) {
    logger.warn(
      { failing: failing.map((f) => ({ key: f.key, message: f.message })) },
      "health-check: red failures",
    );
  }

  // Synchronous stdout summary — the pretty pino transport runs in a worker
  // thread whose buffer is lost on process.exit; this is what a Scheduled
  // Deployment surfaces in its logs.
  console.log("health-check summary:", JSON.stringify(summary));

  // Pre-release gate: fail the run so a release pipeline can stop.
  if (mode === "release" && (await hasCriticalFailures())) {
    console.error(
      "health-check: critical (red) failures present — failing release gate.",
    );
    process.exit(2);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "health-check: fatal");
    console.error("health-check FATAL:", err);
    process.exit(1);
  });
