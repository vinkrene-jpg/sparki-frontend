import { logger } from "../lib/logger";
import { runSurfaceBackfill } from "../lib/surface-backfill";

// CLI entry voor de wegdek-verificatie-backfill (taak #496): geeft bestaande
// racefiets-bibliotheekroutes en eerder automatisch gegenereerde routes zonder
// engineSurface alsnog een ECHTE wegdekmeting (OSM/Overpass + BGT/GRB) op hun
// opgeslagen geometrie. Veilig om herhaald te draaien: gemeten rijen worden
// nooit opnieuw geselecteerd, één run per Amsterdamse dag (DB-vergrendeling),
// en per run geldt een plafond met pauzes tussen metingen.
//
// Schedule (optioneel) via Publishing → Scheduled Deployments, bv. dagelijks
// 04:30 Europe/Amsterdam (cron: 30 4 * * *).
// Run command: `pnpm --filter @workspace/api-server run job:surface-backfill`.
//
// Optional env:
//   SURFACE_BACKFILL_MAX_ROUTES — max te meten routes per run (standaard 20).

function intEnv(name: string): number | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const start = Date.now();
  logger.info("surface-backfill: starting");
  const summary = await runSurfaceBackfill({
    maxRoutes: intEnv("SURFACE_BACKFILL_MAX_ROUTES"),
  });
  const out = { ...summary, durationMs: Date.now() - start };
  logger.info(out, "surface-backfill: done");
  // Synchronous stdout summary — the pretty pino transport runs in a worker
  // thread whose buffer is lost on process.exit.
  console.log("surface-backfill summary:", JSON.stringify(out));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "surface-backfill: fatal");
    console.error("surface-backfill FATAL:", err);
    process.exit(1);
  });
