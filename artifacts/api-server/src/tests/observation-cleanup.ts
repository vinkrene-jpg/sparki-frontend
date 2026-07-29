// Test voor de observatie-opschoning (task: verouderde/dubbele AI-observaties).
//
// Puur: planCleanup-regels (achterhaalde FTP, verouderd doel, zelfde
// strekking + representant blijft nieuwste) en de content-dedupe-heuristiek.
// DB-gebonden: persistObservation weigert een observatie die een
// [achterhaald]-FTP citeert en slaat dezelfde strekking niet dubbel op.
// Alles wat geseed wordt, wordt opgeruimd.
//
// Run: `pnpm --filter @workspace/api-server run test:observation-cleanup`

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  ftpHistoryTable,
  aiObservationsTable,
  aiMemoryEventsTable,
  privacySettingsTable,
} from "@workspace/db";
import {
  planCleanup,
  runObservationCleanup,
  runAutomaticObservationCleanup,
} from "../jobs/observation-cleanup";
import {
  citesWattValue,
  contentSignature,
  isNearDuplicateContent,
} from "../engines/observation/content-dedupe";
import { persistObservation, getOutdatedFtpWatts } from "../lib/ai-memory";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// ── Puur ─────────────────────────────────────────────────────────────────────
function pureTests() {
  check(
    "citesWattValue matcht 331W/331 watt maar niet los getal",
    citesWattValue("terugval van 331W naar 258 W", [331]) &&
      citesWattValue("je oude 331 watt", [331]) &&
      !citesWattValue("331 kcal verbruikt", [331]),
  );

  const a = contentSignature("Je ritten van 25 mei en 28 mei liggen boven je FTP van 258W");
  const b = contentSignature("De rit van 20 juni ligt opnieuw boven de FTP van 258W (zie 25 mei, 28 mei)");
  check("zelfde strekking via gedeelde getallen", isNearDuplicateContent(a, b));

  const c = contentSignature("Je slaapt gemiddeld 6,2 uur, dat is aan de korte kant");
  check("andere strekking blijft apart", !isNearDuplicateContent(a, c));

  const now = new Date("2026-07-29T12:00:00Z");
  const obs = [
    { id: 1, title: "FTP-terugval", summary: null, observationText: "Terugval van 331W naar 258W", createdAt: "2026-07-20T00:00:00Z" },
    { id: 2, title: "Oud doel", summary: null, observationText: "Je doel is van 250W naar 270W te groeien", createdAt: "2026-06-23T00:00:00Z" },
    { id: 3, title: "Boven FTP", summary: null, observationText: "Ritten van 25 mei en 28 mei liggen boven je FTP van 258W", createdAt: "2026-07-01T00:00:00Z" },
    { id: 4, title: "Boven FTP opnieuw", summary: null, observationText: "Ook de rit van 20 juni ligt boven de FTP van 258W, net als 25 mei en 28 mei", createdAt: "2026-07-10T00:00:00Z" },
    { id: 5, title: "Slaap", summary: null, observationText: "Je slaapt gemiddeld 6,2 uur per nacht", createdAt: "2026-07-15T00:00:00Z" },
    { id: 6, title: "Vers doel", summary: null, observationText: "Je nieuwe doel: van 258W naar 275W", createdAt: "2026-07-28T00:00:00Z" },
  ];
  const flagged = planCleanup(obs, [331], 258, now);
  const byId = new Map(flagged.map((f) => [f.id, f]));

  check("achterhaalde 331W-rij gemarkeerd", byId.get(1)?.reason === "achterhaalde_ftp_waarde");
  check("verouderd doel (250→270, >14d oud) gemarkeerd", byId.get(2)?.reason === "verouderd_doel");
  const dupFlag = byId.get(3);
  check(
    "oudste duplicaat gemarkeerd, nieuwste blijft representant",
    dupFlag?.reason === "zelfde_strekking" && dupFlag.keptRepresentativeId === 4 && !byId.has(4),
    JSON.stringify(dupFlag ?? null),
  );
  check("losse slaap-observatie blijft actief", !byId.has(5));
  check("vers doel met huidige FTP blijft actief", !byId.has(6));
}

// ── DB-gebonden ──────────────────────────────────────────────────────────────
const TEST_CLERK = "user_test_obs_cleanup_383";

async function cleanup() {
  await db.delete(aiMemoryEventsTable).where(eq(aiMemoryEventsTable.clerkId, TEST_CLERK));
  await db.delete(aiObservationsTable).where(eq(aiObservationsTable.clerkId, TEST_CLERK));
  await db.delete(ftpHistoryTable).where(eq(ftpHistoryTable.clerkId, TEST_CLERK));
  await db.delete(privacySettingsTable).where(eq(privacySettingsTable.clerkId, TEST_CLERK));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, TEST_CLERK));
}

async function dbTests() {
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: TEST_CLERK,
    email: "obs-cleanup-test@example.com",
  } as typeof userProfilesTable.$inferInsert);
  await db.insert(privacySettingsTable).values({
    clerkId: TEST_CLERK,
    aiMemoryEnabled: true,
  } as typeof privacySettingsTable.$inferInsert);
  await db.insert(ftpHistoryTable).values({
    clerkId: TEST_CLERK,
    measuredAt: "2026-05-01",
    ftpWatts: 331,
    testType: "derived",
    notes: "[achterhaald] afgeleid uit onvolledige data",
  });

  const outdated = await getOutdatedFtpWatts(TEST_CLERK);
  check("getOutdatedFtpWatts vindt 331", outdated.includes(331));

  const suppressed = await persistObservation({
    clerkId: TEST_CLERK,
    sourceType: "training_analysis",
    title: "FTP-terugval",
    observationText: "Je FTP viel terug van 331W naar 258W in zes weken.",
  });
  check("persist weigert observatie met achterhaalde 331W", suppressed === null);

  const first = await persistObservation({
    clerkId: TEST_CLERK,
    sourceType: "training_analysis",
    title: "Ritten boven FTP",
    observationText: "Je ritten van 25 mei en 28 mei liggen boven je FTP van 258W.",
  });
  check("eerste observatie wordt opgeslagen", first != null);

  const second = await persistObservation({
    clerkId: TEST_CLERK,
    sourceType: "training_analysis",
    title: "Opnieuw boven FTP",
    observationText: "Ook 20 juni ligt boven de FTP van 258W, net als 25 mei en 28 mei.",
  });
  check(
    "zelfde strekking levert bestaande rij, geen nieuwe",
    second != null && first != null && second.id === first.id,
  );

  const rows = await db
    .select()
    .from(aiObservationsTable)
    .where(eq(aiObservationsTable.clerkId, TEST_CLERK));
  check("er staat precies 1 observatie in de DB", rows.length === 1, `rows=${rows.length}`);

  const events = await db
    .select()
    .from(aiMemoryEventsTable)
    .where(eq(aiMemoryEventsTable.clerkId, TEST_CLERK));
  const suppressedEvents = events.filter((e) => e.eventType === "observation_suppressed");
  check("beide onderdrukkingen zijn als event verantwoord", suppressedEvents.length === 2);

  // Apply-pad van de opschoontaak: seed een 331W-artefact-rij rechtstreeks en
  // draai de echte cleanup met apply=true.
  await db.insert(aiObservationsTable).values({
    clerkId: TEST_CLERK,
    sourceType: "training_analysis",
    title: "FTP-terugval",
    observationText: "Je FTP viel terug van 331W naar 258W.",
    status: "new",
  } as typeof aiObservationsTable.$inferInsert);
  const report = await runObservationCleanup(TEST_CLERK, true);
  check(
    "cleanup markeert de 331W-rij en laat de representant staan",
    report.applied &&
      report.flagged.length === 1 &&
      report.flagged[0]?.reason === "achterhaalde_ftp_waarde" &&
      report.activeAfter === 1,
    JSON.stringify(report.flagged),
  );
  const outdatedRows = await db
    .select()
    .from(aiObservationsTable)
    .where(eq(aiObservationsTable.clerkId, TEST_CLERK));
  check(
    "status is 'outdated', geen harde delete",
    outdatedRows.length === 2 &&
      outdatedRows.some((r) => r.status === "outdated") &&
      outdatedRows.some((r) => r.status === "new"),
  );

  // Automatisch pad (event-gedreven/periodiek): zelfde regels, zelfde event,
  // met trigger-metadata zodat te zien is wáárom de run draaide.
  await db.insert(aiObservationsTable).values({
    clerkId: TEST_CLERK,
    sourceType: "training_analysis",
    title: "FTP-terugval opnieuw",
    observationText: "Opnieuw een terugval van 331W zichtbaar in je data.",
    status: "new",
  } as typeof aiObservationsTable.$inferInsert);
  const autoReport = await runAutomaticObservationCleanup(
    TEST_CLERK,
    "ftp_achterhaald",
  );
  check(
    "automatische run markeert de nieuwe 331W-rij",
    autoReport != null &&
      autoReport.applied &&
      autoReport.flagged.length === 1 &&
      autoReport.flagged[0]?.reason === "achterhaalde_ftp_waarde",
    JSON.stringify(autoReport?.flagged),
  );
  const cleanupEvents = (
    await db
      .select()
      .from(aiMemoryEventsTable)
      .where(eq(aiMemoryEventsTable.clerkId, TEST_CLERK))
  ).filter((e) => e.eventType === "observation_cleanup");
  const autoEvent = cleanupEvents.find(
    (e) => (e.metadata as { trigger?: string } | null)?.trigger === "ftp_achterhaald",
  );
  check(
    "automatische run logt observation_cleanup-event met trigger en ids",
    cleanupEvents.length === 2 &&
      autoEvent != null &&
      Array.isArray((autoEvent.metadata as { ids?: number[] }).ids) &&
      (autoEvent.metadata as { ids: number[] }).ids.length === 1,
    JSON.stringify(cleanupEvents.map((e) => e.metadata)),
  );

  await cleanup();
}

async function main() {
  pureTests();
  if (process.env.DATABASE_URL) {
    await dbTests();
  } else {
    console.log("SKIP  DB-gebonden checks (geen DATABASE_URL)");
  }
  await pool.end();
  console.log(failures === 0 ? "\nALLES GESLAAGD" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("test faalde:", err);
  try { await cleanup(); await pool.end(); } catch {}
  process.exit(1);
});
