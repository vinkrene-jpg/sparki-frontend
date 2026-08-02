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
import { runSurfaceBackfill } from "./surface-backfill";
import { runScheduledObservationCleanup } from "../jobs/observation-cleanup";
import { runParentAgeTransition } from "./parent-age-transition";
import { runHealthChecks } from "./health/engine";
import { eq, sql } from "drizzle-orm";
import { db, pool, athleteGoalsTable } from "@workspace/db";
import { buildMonthlyProposals } from "./goals";
import { runClubMessageRetention } from "./club-message-retention";

let started = false;
let inFlight = false;

// Cross-instance vergrendeling voor de geplande jobs. Proces-lokale booleans
// zijn NIET genoeg zodra er meer dan één instantie draait: dan zou elke
// instantie de dag- of maand-job draaien. We combineren daarom twee lagen:
//   1. Een Postgres ADVISORY LOCK (pg_try_advisory_lock) — voorkomt dat twee
//      instanties tegelijk aan dezelfde job beginnen. LET OP (memory-les):
//      advisory locks zijn SESSIE-gebonden, dus lock én unlock MOETEN op
//      dezelfde verbinding gebeuren. We houden daarom één toegewijde client
//      vast voor de hele claim-en-run, en geven die pas in finally vrij.
//   2. Een DB-CLAIM per Amsterdamse dag/maand (INSERT ON CONFLICT DO NOTHING in
//      route_library_daily_state) — de instantie die de rij als eerste plaatst,
//      wint en draait; verlies = stil overslaan. Zo draait de job hooguit één
//      keer per dag/maand, óók na een herstart (de claim overleeft het proces).
// Vaste namespace voor de scheduler-advisory-locks (los van andere locks).
const SCHEDULER_LOCK_NS = 748_120_001;

/**
 * Draait `job` hooguit één keer per unieke `claimKey`, over ALLE instanties
 * heen. Retourneert of deze instantie de claim won (en dus draaide). Fouten uit
 * `job` propageren naar de aanroeper (die ze logt); de lock/claim wordt altijd
 * netjes opgeruimd.
 */
async function withJobClaim(
  claimKey: string,
  job: () => Promise<void>,
): Promise<boolean> {
  // Toegewijde verbinding: advisory lock + unlock op DEZELFDE sessie.
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1, hashtext($2)) AS locked",
      [SCHEDULER_LOCK_NS, claimKey],
    );
    locked = lock.rows[0]?.locked === true;
    if (!locked) return false; // een andere instantie is er al mee bezig

    // DB-claim: wie de rij als eerste plaatst, draait — anders stil overslaan.
    const claimed = await db.execute(sql`
      INSERT INTO route_library_daily_state (key, count) VALUES (${claimKey}, 0)
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `);
    if (claimed.rows.length === 0) return false;

    await job();
    return true;
  } finally {
    if (locked) {
      await client
        .query("SELECT pg_advisory_unlock($1, hashtext($2))", [
          SCHEDULER_LOCK_NS,
          claimKey,
        ])
        .catch(() => {});
    }
    client.release();
  }
}

// Nachtelijke bibliotheek-backfill: max één poging per Amsterdamse nacht
// vanuit dit proces (goedkope pre-check); de échte éénmaligheid over ALLE
// processen heen wordt afgedwongen door de dag-vergrendeling in de database
// (runLibraryBackfill claimt "backfill:<dag>" atomair).
let lastBackfillDay = "";

function amsterdamParts(now = new Date()): {
  day: string;
  hour: number;
  dayOfMonth: number;
} {
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
    dayOfMonth: Number.parseInt(parts.day ?? "1", 10),
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

// Wegdek-verificatie-backfill (taak #496): meet bestaande racefiets-rijen
// zonder engineSurface na op hun opgeslagen geometrie. Zelfde nachtvenster en
// dezelfde pre-check als de bibliotheek-backfill; de échte éénmaligheid per
// dag zit in de DB-vergrendeling (runSurfaceBackfill claimt
// "surface-backfill:<dag>" atomair).
let lastSurfaceBackfillDay = "";

async function maybeRunSurfaceBackfill(): Promise<void> {
  const flag = process.env.SURFACE_BACKFILL_IN_PROCESS;
  const enabled =
    flag === "true"
      ? true
      : flag === "false"
        ? false
        : process.env.NODE_ENV === "production";
  if (!enabled) return;
  const { day, hour } = amsterdamParts();
  if (hour < 2 || hour >= 6) return;
  if (day === lastSurfaceBackfillDay) return;
  lastSurfaceBackfillDay = day;
  const summary = await runSurfaceBackfill();
  logger.info(
    { surfaceBackfill: "scheduler", ...summary },
    "in-process surface backfill run done",
  );
}

// Nachtelijke gezondheidscheck (job:health): max één automatische run per
// Amsterdamse dag vanuit dit proces. Draait in het nachtvenster (04:00–05:59
// Amsterdam) zodat de uitslag 's ochtends klaarstaat en het overdag geen
// on-demand werk verdringt. Los in-/uitschakelbaar met HEALTH_CHECK_IN_PROCESS
// (default: aan in productie). Elke run schrijft een health_check_batches-rij
// met triggeredBy "scheduler" — precies de trace die /admin leest, zodat
// "nog nooit gedraaid" meetbaar verdwijnt. Fouten worden gelogd, nooit fataal.
//
// Éénmaligheid over ALLE instanties heen loopt via withJobClaim (advisory lock
// + DB-claim per Amsterdamse dag); de proces-lokale boolean is vervangen omdat
// die bij meerdere instanties tot dubbelruns leidde.
async function maybeRunHealthCheck(): Promise<void> {
  const flag = process.env.HEALTH_CHECK_IN_PROCESS;
  const enabled =
    flag === "true"
      ? true
      : flag === "false"
        ? false
        : process.env.NODE_ENV === "production";
  if (!enabled) return;
  const { day, hour } = amsterdamParts();
  if (hour < 4 || hour >= 6) return;
  const won = await withJobClaim(`job:health:${day}`, async () => {
    const { batchId, outcomes } = await runHealthChecks({
      mode: "daily",
      triggeredBy: "scheduler",
    });
    const counts = outcomes.reduce(
      (acc, o) => {
        acc[o.statusColor] = (acc[o.statusColor] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    logger.info(
      { healthCheck: "scheduler", batchId, total: outcomes.length, ...counts },
      "in-process health check run done",
    );
  });
  if (!won) {
    logger.info(
      { healthCheck: "scheduler", day },
      "health check al geclaimd door andere instantie — overslaan",
    );
  }
}

// Maandelijkse doelen-review (job:goal-review): max één automatische run per
// Amsterdamse maand vanuit dit proces. Draait op de 1e van de maand in het
// venster 06:00–06:59 Amsterdam. Voor elke sporter met minstens één ACTIEF doel
// bouwt het idempotente bijstuur-voorstellen (dedupeKey per doel+soort+maand);
// er wordt niets toegepast zonder expliciete bevestiging in de app. Elke run
// schrijft goal_proposals-rijen — de trace die /admin leest. Los in-/
// uitschakelbaar met GOAL_REVIEW_IN_PROCESS (default: aan in productie).
//
// Éénmaligheid over ALLE instanties heen loopt via withJobClaim (advisory lock
// + DB-claim per Amsterdamse MAAND); de proces-lokale boolean is vervangen
// omdat die bij meerdere instanties tot dubbelruns leidde.
async function maybeRunGoalReview(): Promise<void> {
  const flag = process.env.GOAL_REVIEW_IN_PROCESS;
  const enabled =
    flag === "true"
      ? true
      : flag === "false"
        ? false
        : process.env.NODE_ENV === "production";
  if (!enabled) return;
  const { day, hour, dayOfMonth } = amsterdamParts();
  if (dayOfMonth !== 1) return;
  if (hour < 6 || hour >= 7) return;
  // day is "YYYY-MM-DD"; de maand-sleutel "YYYY-MM" begrenst tot 1×/maand.
  const monthKey = day.slice(0, 7);

  const won = await withJobClaim(`job:goal-review:${monthKey}`, async () => {
    const rows = await db
      .selectDistinct({ clerkId: athleteGoalsTable.clerkId })
      .from(athleteGoalsTable)
      .where(eq(athleteGoalsTable.status, "active"));

    let created = 0;
    let skipped = 0;
    let failed = 0;
    for (const { clerkId } of rows) {
      try {
        const result = await buildMonthlyProposals(clerkId);
        created += result.created;
        skipped += result.skipped;
      } catch (err) {
        failed++;
        logger.error({ err, clerkId }, "in-process goal-review athlete failed");
      }
    }
    logger.info(
      { goalReview: "scheduler", athletes: rows.length, created, skipped, failed },
      "in-process goal-review run done",
    );
  });
  if (!won) {
    logger.info(
      { goalReview: "scheduler", monthKey },
      "goal-review al geclaimd door andere instantie — overslaan",
    );
  }
}

// SPARKI_BUILD_01 F7: dagelijkse retentie-opruiming van clubberichten +
// bijlagen (job:club-message-retention). Max één run per Amsterdamse dag over
// alle instanties heen (withJobClaim). Bewaartermijn is configureerbaar
// (CLUB_MESSAGE_RETENTION_DAYS, default 365), nooit hardcoded.
async function maybeRunClubMessageRetention(): Promise<void> {
  const { day, hour } = amsterdamParts();
  // Ochtendvenster 03:00–03:59 Amsterdam (los van de andere nachtjobs).
  if (hour < 3 || hour >= 4) return;
  const won = await withJobClaim(`job:club-message-retention:${day}`, async () => {
    const result = await runClubMessageRetention();
    logger.info(
      { clubMessageRetention: "scheduler", day, ...result },
      "in-process club message retention run done",
    );
  });
  if (!won) {
    logger.info(
      { clubMessageRetention: "scheduler", day },
      "club message retention al geclaimd door andere instantie — overslaan",
    );
  }
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
      // Nachtelijke wegdek-verificatie-backfill (eigen fouten-log).
      try {
        await maybeRunSurfaceBackfill();
      } catch (err) {
        logger.error({ err }, "in-process surface backfill failed");
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
      // Besluitenpatch 2026-08-01: ouderkoppeling stopt automatisch bij 18,
      // met bericht één week vooraf (idempotent via dedupeKey + soft-end).
      try {
        await runParentAgeTransition();
      } catch (err) {
        logger.error({ err }, "parent age transition run failed");
      }
      // Nachtelijke gezondheidscheck (job:health): dagelijks in het nachtvenster,
      // schrijft de scheduler-trace die /admin leest (eigen fouten-log).
      try {
        await maybeRunHealthCheck();
      } catch (err) {
        logger.error({ err }, "in-process health check failed");
      }
      // Maandelijkse doelen-review (job:goal-review): 1e van de maand, schrijft
      // goal_proposals-trace die /admin leest (eigen fouten-log).
      try {
        await maybeRunGoalReview();
      } catch (err) {
        logger.error({ err }, "in-process goal-review failed");
      }
      // SPARKI_BUILD_01 F7: retentie-opschoning clubberichten + bijlagen.
      try {
        await maybeRunClubMessageRetention();
      } catch (err) {
        logger.error({ err }, "in-process club message retention failed");
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
