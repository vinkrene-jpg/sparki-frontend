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
import { processDueAccountDeletions } from "./account-privacy";
import { runLibraryBackfill } from "./library-backfill";
import { runScheduledObservationCleanup } from "../jobs/observation-cleanup";

let started = false;
let inFlight = false;

// Nachtelijke bibliotheek-backfill: max één poging per Amsterdamse nacht
// vanuit dit proces (goedkope pre-check); de échte éénmaligheid over ALLE
// processen heen wordt afgedwongen door de dag-vergrendeling in de database
// (runLibraryBackfill claimt "backfill:<dag>" atomair).
let lastBackfillDay = "";

function amsterdamParts(now = new Date()): { day: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number.parseInt(parts.hour ?? "0", 10) % 24,
  };
}

// Draai de backfill alleen in het nachtvenster (02:00–05:59 Amsterdam), zodat
// het ORS-budget 's nachts wordt gebruikt en overdag ruimte blijft voor
// on-demand generatie. Los in-/uitschakelbaar met LIBRARY_BACKFILL_IN_PROCESS.
async function maybeRunLibraryBackfill(): Promise<void> {
  const flag = process.env.LIBRARY_BACKFILL_IN_PROCESS;
  const enabled =
    flag === "true"
      ? true
      : flag === "false"
        ? false
        : process.env.NODE_ENV === "production";
  if (!enabled) return;
  const { day, hour } = amsterdamParts();
  if (hour < 2 || hour >= 6) return;
  if (day === lastBackfillDay) return;
  lastBackfillDay = day;
  const summary = await runLibraryBackfill();
  logger.info(
    { libraryBackfill: "scheduler", ...summary },
    "in-process library backfill run done",
  );
}

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
      // Zelfde ritme: voer verlopen accountverwijderingen definitief uit.
      const deleted = await processDueAccountDeletions();
      if (deleted > 0) {
        logger.info({ deleted }, "due account deletions executed");
      }
      // Nachtelijke kaart-backfill (eigen fouten-log, nooit de run breken).
      try {
        await maybeRunLibraryBackfill();
      } catch (err) {
        logger.error({ err }, "in-process library backfill failed");
      }
      // Automatische observatie-opschoning: verwijdert verouderde en dubbele
      // AI-observaties voor alle gebruikers (max éénmalig per Amsterdamse dag,
      // idempotent — nooit hard-delete, alleen status "outdated").
      try {
        const obsCleaned = await runScheduledObservationCleanup();
        if (obsCleaned && obsCleaned.totalFlagged > 0) {
          logger.info(
            { observationCleanup: "scheduler", ...obsCleaned },
            "in-process observation cleanup run done",
          );
        }
      } catch (err) {
        logger.error({ err }, "in-process observation cleanup failed");
      }
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
