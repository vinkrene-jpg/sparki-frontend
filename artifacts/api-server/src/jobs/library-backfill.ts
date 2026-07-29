import { logger } from "../lib/logger";
import { runLibraryBackfill } from "../lib/library-backfill";

// CLI entry voor de nachtelijke bibliotheek-backfill: vult de EU-kaart
// geleidelijk met bibliotheekroutes rond de woonlocaties van bestaande
// gebruikers. Bedoeld als Replit Scheduled Deployment (zoals job:sync).
// Veilig om herhaald te draaien: celkeuze is idempotent (al gevulde cellen
// worden overgeslagen) en het gedeelde ORS-dagplafond begrenst het verbruik.
//
// Schedule via Publishing → Scheduled Deployments:
//   • Dagelijks 's nachts, bv. 03:30 Europe/Amsterdam (cron: 30 3 * * *).
// Run command: `pnpm --filter @workspace/api-server run job:library-backfill`.
//
// Optional env:
//   LIBRARY_BACKFILL_MAX_CELLS — max nieuwe cellen per run (standaard 5,
//   bewust onder het gedeelde dagplafond van 10 zodat er overdag ruimte
//   overblijft voor on-demand generatie).

function intEnv(name: string): number | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const start = Date.now();
  logger.info("library-backfill: starting");
  const summary = await runLibraryBackfill({
    maxCells: intEnv("LIBRARY_BACKFILL_MAX_CELLS"),
  });
  const out = { ...summary, durationMs: Date.now() - start };
  logger.info(out, "library-backfill: done");
  // Synchronous stdout summary — the pretty pino transport runs in a worker
  // thread whose buffer is lost on process.exit.
  console.log("library-backfill summary:", JSON.stringify(out));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "library-backfill: fatal");
    console.error("library-backfill FATAL:", err);
    process.exit(1);
  });
