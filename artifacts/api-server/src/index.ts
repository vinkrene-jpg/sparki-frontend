import app from "./app";
import { logger } from "./lib/logger";
import { ensureWorldSeed } from "./lib/world-seed";
import { ensureIntelSeed } from "./lib/intel-seed";
import { backfillDerivedLoad } from "./lib/derived-load-backfill";
import { cleanupStaleConnectorShells } from "./lib/connectors/cleanup";
import { cleanupClimbCacheDb } from "./lib/climbs/cache";
import { startReminderScheduler } from "./lib/reminder-scheduler";

// Productie faalt hard bij ontbrekende verplichte configuratie — liever een
// duidelijke boot-fout dan een half-werkende app met stille gaten.
if (process.env.NODE_ENV === "production") {
  const required = ["DATABASE_URL", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Verplichte productie-omgevingsvariabelen ontbreken: ${missing.join(", ")}`,
    );
  }
  if (process.env.DEV_AUTH_BYPASS === "true") {
    throw new Error(
      "DEV_AUTH_BYPASS mag nooit aan staan in productie (auth-bypass).",
    );
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Fire-and-forget: a freshly published database has the schema but no Sparki
  // World content, so it would honestly show "nog geen renners". Fill it from
  // the bundled dev export (no image generation — images live in the shared
  // object-storage bucket). No-ops the moment the world already has athletes,
  // so this is safe on every boot and in development.
  ensureWorldSeed({ log: (m) => logger.info({ seed: "world" }, m) })
    .then((r) => {
      if (r.seeded) logger.info({ seed: "world", total: r.total }, "Sparki World seeded");
    })
    .catch((err) => logger.error({ err }, "Sparki World seed failed"));

  // Fire-and-forget: the curated Kennisbank cards ship with each release.
  // Idempotent upsert keyed on dedupeKey, so this is safe on every boot in
  // dev and production; without it a fresh production DB has zero cards.
  ensureIntelSeed({ log: (m) => logger.info({ seed: "intel" }, m) })
    .then((r) => {
      if (r.inserted > 0)
        logger.info({ seed: "intel", ...r }, "Kennisbank cards seeded");
    })
    .catch((err) => logger.error({ err }, "Kennisbank seed failed"));

  // Fire-and-forget self-heal: rides imported before belastingscore-derivation
  // existed (e.g. Strava history) get their score derived from their own power
  // + the athlete's FTP, and stale ESTIMATED weekly targets are re-derived from
  // real riding. Idempotent (only fills NULL scores) and advisory-locked, so
  // it is safe on every boot, in dev and production.
  backfillDerivedLoad({ log: (m) => logger.info({ derived: "load" }, m) })
    .then((r) => {
      if (r.ran)
        logger.info(
          { derived: "load", ...r },
          "Derived-load backfill finished",
        );
    })
    .catch((err) => logger.error({ err }, "Derived-load backfill failed"));

  // Fire-and-forget self-heal: delete stale "koppelen gestart" shells for
  // platforms whose API is not wired (the retired pending-flow) so no
  // dashboard shows an unfinishable "In afwachting" connection. Idempotent.
  cleanupStaleConnectorShells({
    log: (m) => logger.info({ connectors: "cleanup" }, m),
  })
    .then((r) => {
      if (r.deleted > 0)
        logger.info(
          { connectors: "cleanup", deleted: r.deleted },
          "Stale connector shells cleaned up",
        );
    })
    .catch((err) =>
      logger.error({ err }, "Connector shell cleanup failed"),
    );

  // Fire-and-forget opruimstap: verlopen klimmen-cache-rijen (ouder dan de
  // langste TTL) verwijderen zodat de tabel niet eindeloos groeit. Idempotent
  // en logt alleen metadata (aantal verwijderde rijen), nooit cache-inhoud.
  // Draait óók in de nachtelijke job:health voor langdraaiende productie.
  cleanupClimbCacheDb()
    .then((r) => {
      if (r.deleted > 0)
        logger.info(
          { cleanup: "climb-cache", deleted: r.deleted },
          "Verlopen klimmen-cache-rijen opgeruimd",
        );
    })
    .catch((err) => logger.error({ err }, "Klimmen-cache opruimen mislukt"));

  // Start the in-process reminder scheduler so reminders and the smartly-timed
  // "er is iets nieuws voor je" nudge actually fire without any Scheduled
  // Deployment setup. Production-only by default; opt-in in dev via
  // REMINDERS_IN_PROCESS=true. Every reminder is idempotent (dedupeKey), so this
  // is safe alongside a separately-scheduled job.
  startReminderScheduler();
});
