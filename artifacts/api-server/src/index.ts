import app from "./app";
import { logger } from "./lib/logger";
import { getRoutingProvider } from "./lib/routing";
import { ensureWorldSeed } from "./lib/world-seed";
import { ensureIntelSeed } from "./lib/intel-seed";
import { backfillDerivedLoad } from "./lib/derived-load-backfill";
import { repair410wFtp } from "./lib/repair-410w-ftp";
import { repairStravaFtpOverride } from "./lib/repair-strava-ftp-override";
import { cleanupStaleConnectorShells } from "./lib/connectors/cleanup";
import { cleanupClimbCacheDb } from "./lib/climbs/cache";
import { startReminderScheduler } from "./lib/reminder-scheduler";
import { startGitMaintenanceScheduler } from "./lib/git-maintenance";
import { startExportsMaintenanceScheduler } from "./lib/exports-maintenance";
import {
  ensureBillingFlagSeed,
  expireBillingStates,
  sweepTrialNotices,
} from "./lib/billing";
import { startRouteEnvWarmupScheduler } from "./lib/route-env-warmup";
import { sweepObservationCleanup } from "./jobs/observation-cleanup";
import { runRouteBewaartermijnRonde } from "./lib/route-limits";

import { ensureGoVariantGrantSeed } from "./lib/entitlements";

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

  // Routekwaliteitsbelofte (taak #419): racefiets/MTB-routes moeten op wegdek
  // en fietslegaliteit sturen. Dat kan alleen met de GraphHopper-motor. Meld
  // het LUID wanneer die wel geconfigureerd is maar niet actief — dan draait
  // routegeneratie stil op ORS en is de belofte niet gedekt.
  {
    const active = getRoutingProvider().name;
    const gh = getRoutingProvider("graphhopper");
    logger.info({ routingProvider: active }, "Actieve routebron");
    if (active !== "graphhopper" && gh?.isConfigured()) {
      logger.warn(
        { routingProvider: active },
        "GRAPHHOPPER_API_KEY is ingesteld maar ROUTING_PROVIDER staat niet op graphhopper — racefiets/MTB-geschiktheid wordt NIET bij de bron afgedwongen",
      );
    }
  }

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

  // One-time idempotent repair: harmoniseer de 410W-FTP-rij naar de standaard
  // [achterhaald]-conventie en null de getroffen belastingscores.
  // Docs: docs/evidence/TSS_410W_AUDIT_2026-07-29.md
  //
  // VOLGORDE: de repair moet volledig klaar zijn voordat backfillDerivedLoad
  // start, zodat de genulled scores in dezelfde serverstart herberekend worden.
  // Daarom: .then-keten (sequentieel), niet twee losse fire-and-forget calls.
  repair410wFtp()
    .then((r) => {
      if (r.applied)
        logger.info(
          { repair: "410w-ftp", sessionsNulled: r.sessionsNulled },
          `410W-FTP-rij geharmoniseerd; ${r.sessionsNulled} belastingscores genulled voor herberekening`,
        );
    })
    .catch((err) =>
      logger.error({ err }, "410W-FTP repair failed — backfill will still run"),
    )
    // DATABRONNEN_EN_FTP_01 H1: demoveer Strava-importrijen die een hogere
    // FTP-bron overschreven, herstel de profiel-FTP en null de getroffen
    // belastingscores — VÓÓR backfillDerivedLoad, zodat dezelfde serverstart
    // ze met de juiste FTP-keten herleidt. Idempotent (leidend-vlag = marker).
    .then(() => repairStravaFtpOverride())
    .then((r) => {
      if (r.usersAffected > 0)
        logger.info(
          { repair: "strava-ftp-override", ...r },
          `Strava-FTP-herstel: ${r.usersAffected} sporter(s), ${r.rowsDemoted} rij(en) gedemoveerd, ${r.profilesRestored} profiel(en) hersteld, ${r.sessionsNulled} belastingscores genulled`,
        );
    })
    .catch((err) =>
      logger.error(
        { err },
        "Strava-FTP-herstel mislukt — backfill draait alsnog",
      ),
    )
    // Fire-and-forget self-heal: rides imported before belastingscore-derivation
    // existed (e.g. Strava history) get their score derived from their own power
    // + the athlete's FTP, and stale ESTIMATED weekly targets are re-derived from
    // real riding. Idempotent (only fills NULL scores) and advisory-locked, so
    // it is safe on every boot, in dev and production.
    .then(() =>
      backfillDerivedLoad({ log: (m) => logger.info({ derived: "load" }, m) }),
    )
    .then((r) => {
      if (r?.ran)
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

  // Automatische .git-opschoning (taak 406): eigen planner, los van de
  // reminder-scheduler, omdat .git juist in de ONTWIKKELomgeving volloopt
  // (waar de reminder-scheduler standaard uit staat). Max 1×/Amsterdamse dag,
  // fail-closed poort main==origin/main, no-op onder ~1 GB .git.
  startGitMaintenanceScheduler();

  // Automatische exports/-opschoning (taak 407): werkmap telt óók mee voor de
  // 8 GiB-publiceerlimiet; export-zips komen via checkpoint-herstel terug.
  // Verwijdert ALLEEN bestanden waarvan de SHA-256 byte-identiek matcht met
  // een extern-veiliggestelde inventarisrij (fail-closed), max 1×/Ams-dag.
  startExportsMaintenanceScheduler();

  // Fire-and-forget: (1) de vier Stripe-betaalflags bestaan als rijen, default
  // UIT (onConflictDoNothing — een beheerbeslissing wordt nooit overschreven);
  // (2) de vervalcontrole (grace/canceled voorbij ⇒ expired + FREE) draait
  // idempotent bij boot en daarna dagelijks — geen webhook-afhankelijkheid.
  ensureBillingFlagSeed().catch((err) =>
    logger.error({ err }, "billing flag seed failed"),
  );
  // Go-variantrechten (taak 385): sparki_go krijgt de vier Go-onderdelen,
  // sparki_basic bewust niets. Idempotent; beheerbeslissingen blijven staan.
  ensureGoVariantGrantSeed().catch((err) =>
    logger.error({ err }, "go variant grant seed failed"),
  );
  expireBillingStates()
    .then((r) => {
      if (r.expiredGrace + r.expiredCanceled > 0)
        logger.info({ billing: "expiry", ...r }, "billing expiry sweep");
    })
    .catch((err) => logger.error({ err }, "billing expiry sweep failed"));
  setInterval(
    () =>
      void expireBillingStates().catch((err) =>
        logger.error({ err }, "billing expiry sweep failed"),
      ),
    24 * 60 * 60 * 1000,
  ).unref?.();
  // Proefperiode-meldingen (ABONNEMENT_01 §1.7): rustige melding vóór en ná
  // afloop; idempotent via dedupeKey, raakt nooit gebruikersdata.
  sweepTrialNotices().catch((err) =>
    logger.error({ err }, "billing trial notice sweep failed"),
  );
  setInterval(
    () =>
      void sweepTrialNotices().catch((err) =>
        logger.error({ err }, "billing trial notice sweep failed"),
      ),
    24 * 60 * 60 * 1000,
  ).unref?.();

  // Periodieke observatie-opschoning: dezelfde regels als de handmatige job
  // (status "outdated", nooit harde deletes, observation_cleanup-event met
  // ids per gebruiker). Draait bij boot en daarna dagelijks, zodat verouderde
  // observaties ook zonder handmatige run verdwijnen. Idempotent: al
  // gemarkeerde rijen zijn niet meer actief.
  const runObservationSweep = () =>
    void sweepObservationCleanup("periodiek")
      .then((r) => {
        if (r.flagged > 0)
          logger.info(
            { cleanup: "observations", ...r },
            "Periodieke observatie-opschoning heeft rijen gemarkeerd",
          );
      })
      .catch((err) =>
        logger.error({ err }, "Periodieke observatie-opschoning faalde"),
      );
  runObservationSweep();
  setInterval(runObservationSweep, 24 * 60 * 60 * 1000).unref?.();

  // ROUTE_PAKKET_02c — dagelijkse bewaartermijnronde voor Gratis-routes:
  // verstreken termijnen naar de herstelbare vervallen-status, termijnen
  // zetten voor nu-Gratis eigenaren, en RAPPORTEER-ALLEEN voor definitieve
  // opruiming (er wordt niets verwijderd tot dat expliciet is vrijgegeven).
  const runRouteBewaarSweep = () =>
    void runRouteBewaartermijnRonde(logger).catch((err) =>
      logger.error({ err }, "Route-bewaartermijnronde faalde"),
    );
  runRouteBewaarSweep();
  setInterval(runRouteBewaarSweep, 24 * 60 * 60 * 1000).unref?.();

  // Achtergrond-warm-up van de route-omgevingsdata (Overpass + wegobjecten-
  // corridor) rond woonlocaties en recent gegenereerde gebieden, zodat de
  // rustige-wegen-vergelijking bij /generate vrijwel altijd op volledige data
  // draait. Productie standaard aan; dev opt-in via ROUTE_ENV_WARMUP=true.
  startRouteEnvWarmupScheduler();
});
