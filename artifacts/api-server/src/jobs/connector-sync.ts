import { logger } from "../lib/logger";
import { runScheduledConnectorSync } from "../engines/data-hub/scheduled-sync";

// CLI entry voor de geplande koppelingen-inhaalsync (Sparki Connect). Bedoeld
// als Replit Scheduled Deployment (zoals job:reminders / job:health). Webhooks
// blijven het primaire kanaal; deze taak dicht het gat voor gebruikers zonder
// (werkende) webhooks: verouderde of mislukte syncs krijgen een begrensde,
// incrementele inhaalsync — nooit een volledige her-import. Veilig om herhaald
// te draaien: dedupe en de busy-wacht maken dubbele verwerking onschadelijk.
//
// Schedule via Publishing → Scheduled Deployments:
//   • Dagelijks, bv. 05:00 Europe/Amsterdam (cron: 0 5 * * *).
// Run command: `pnpm --filter @workspace/api-server run job:sync`.
//
// Optional env:
//   SYNC_JOB_MAX_CONNECTIONS — cap koppelingen per run (veiligheidsklep).

function intEnv(name: string): number | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const start = Date.now();
  logger.info("connector-sync: starting");
  const summary = await runScheduledConnectorSync({
    maxConnections: intEnv("SYNC_JOB_MAX_CONNECTIONS"),
    log: logger,
  });
  const out = { ...summary, durationMs: Date.now() - start };
  logger.info(out, "connector-sync: done");
  // Synchronous stdout summary — the pretty pino transport runs in a worker
  // thread whose buffer is lost on process.exit.
  console.log("connector-sync summary:", JSON.stringify(out));
  if (summary.failed > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    logger.error({ err }, "connector-sync: fatal");
    console.error("connector-sync FATAL:", err);
    process.exit(1);
  });
