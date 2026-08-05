// DATABRONNEN_EN_FTP_01 — D-T1/H1/H2 regressietest.
//
// Bewijst:
//   1. Rangorde-unit (D2): een import wordt nooit leidend over een leidende
//      hogere bron heen (trainer > sporter > sparki_afgeleid > import);
//      onbekende bronnen tellen fail-closed als laagste rang.
//   2. H1-repair (DB): een sporter met een handmatige FTP (345, sporter) en
//      een latere leidende Strava-importrij (272) die het profiel op 272
//      heeft gezet → repairStravaFtpOverride demoveert de importrij naar
//      niet-leidend, zet de profiel-FTP terug op 345 (met paspoort-event)
//      en nult de belastingscore van getroffen sessies zodat de backfill ze
//      met de juiste FTP-keten herleidt. Tweede run = no-op (idempotent).
//   3. De belastingscore-loaders negeren niet-leidende rijen: ftpAtDate op
//      alleen-leidende historie geeft 345, niet 272.
//
// Run: pnpm --filter @workspace/api-server run test:ftp-bron

import assert from "node:assert/strict";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  ftpHistoryTable,
  trainingSessionsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { isFtpLeidend, ftpAtDate } from "../lib/derived-load";
import { repairStravaFtpOverride } from "../lib/repair-strava-ftp-override";

const CLERK = "test_ftp_bron_rangorde_user";

async function cleanup() {
  await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, CLERK));
  await db.delete(ftpHistoryTable).where(eq(ftpHistoryTable.clerkId, CLERK));
  await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, CLERK));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, CLERK));
}

async function main() {
  let failures = 0;
  const check = (name: string, fn: () => void | Promise<void>) =>
    Promise.resolve()
      .then(fn)
      .then(() => console.log(`✓ ${name}`))
      .catch((err) => {
        failures++;
        console.error(`✗ ${name}\n  ${err?.message ?? err}`);
      });

  // ── 1. Rangorde-unit ──────────────────────────────────────────────────────
  await check("import is niet leidend boven een eerdere sporter-rij", () => {
    assert.equal(
      isFtpLeidend("import", "2026-08-05", [
        { bron: "sporter", measuredAt: "2026-07-09", leidend: true },
      ]),
      false,
    );
  });
  await check("import is wél leidend als er niets hogers is", () => {
    assert.equal(isFtpLeidend("import", "2026-08-05", []), true);
    assert.equal(
      isFtpLeidend("import", "2026-08-05", [
        { bron: "import", measuredAt: "2026-06-26", leidend: true },
      ]),
      true,
    );
  });
  await check("niet-leidende hogere rij blokkeert niet", () => {
    assert.equal(
      isFtpLeidend("import", "2026-08-05", [
        { bron: "sporter", measuredAt: "2026-07-09", leidend: false },
      ]),
      true,
    );
  });
  await check("sparki_afgeleid verliest van sporter, wint van import", () => {
    assert.equal(
      isFtpLeidend("sparki_afgeleid", "2026-08-05", [
        { bron: "sporter", measuredAt: "2026-07-09", leidend: true },
      ]),
      false,
    );
    assert.equal(
      isFtpLeidend("sparki_afgeleid", "2026-08-05", [
        { bron: "import", measuredAt: "2026-07-09", leidend: true },
      ]),
      true,
    );
  });
  await check("onbekende bron telt fail-closed als laagste rang", () => {
    assert.equal(
      isFtpLeidend("???", "2026-08-05", [
        { bron: "import", measuredAt: "2026-07-01", leidend: true },
      ]),
      false,
    );
  });
  await check("hogere bron met LATERE datum blokkeert een eerdere import niet", () => {
    assert.equal(
      isFtpLeidend("import", "2026-06-26", [
        { bron: "sporter", measuredAt: "2026-07-09", leidend: true },
      ]),
      true,
    );
  });

  // ── 2. H1-repair (DB) ─────────────────────────────────────────────────────
  await cleanup();
  await db.insert(userProfilesTable).values({ clerkId: CLERK, email: `${CLERK}@test.local` });
  await db.insert(athleteProfilesTable).values({ clerkId: CLERK, ftp: 272, ftpEstimated: false });
  await db.insert(ftpHistoryTable).values([
    { clerkId: CLERK, measuredAt: "2026-07-09", ftpWatts: 345, testType: "manual", bron: "sporter", leidend: true },
    // De foute situatie van vóór de fix: import staat nog op leidend.
    { clerkId: CLERK, measuredAt: "2026-08-05", ftpWatts: 272, testType: "strava", bron: "import", leidend: true, notes: "Geïmporteerd uit Strava" },
  ]);
  const [sess] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId: CLERK,
      sessionDate: "2026-08-05",
      type: "training",
      durationMin: 60,
      avgPower: 200,
      tss: 54,
      intensityFactor: "0.735",
    })
    .returning({ id: trainingSessionsTable.id });

  const r1 = await repairStravaFtpOverride();
  await check("repair demoveert de leidende strava-rij", async () => {
    assert.ok(r1.rowsDemoted >= 1 && r1.usersAffected >= 1, JSON.stringify(r1));
    const [row] = await db
      .select({ leidend: ftpHistoryTable.leidend, notes: ftpHistoryTable.notes })
      .from(ftpHistoryTable)
      .where(and(eq(ftpHistoryTable.clerkId, CLERK), eq(ftpHistoryTable.testType, "strava")));
    assert.equal(row.leidend, false);
    assert.match(row.notes ?? "", /niet leidend/);
  });
  await check("repair zet de profiel-FTP terug op de handmatige waarde", async () => {
    const [p] = await db
      .select({ ftp: athleteProfilesTable.ftp })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, CLERK));
    assert.equal(p.ftp, 345);
  });
  await check("repair nult de met 272 gerekende belastingscore", async () => {
    const [s] = await db
      .select({ tss: trainingSessionsTable.tss })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, sess.id));
    assert.equal(s.tss, null);
  });
  await check("tweede run is een no-op (idempotent)", async () => {
    const r2 = await repairStravaFtpOverride();
    assert.equal(r2.rowsDemoted, 0);
    assert.equal(r2.profilesRestored, 0);
    assert.equal(r2.sessionsNulled, 0);
  });

  // ── 3. Loader-semantiek ───────────────────────────────────────────────────
  await check("ftpAtDate op alleen-leidende historie geeft 345 op 05-08", async () => {
    const rows = await db
      .select({ measuredAt: ftpHistoryTable.measuredAt, ftpWatts: ftpHistoryTable.ftpWatts })
      .from(ftpHistoryTable)
      .where(and(eq(ftpHistoryTable.clerkId, CLERK), eq(ftpHistoryTable.leidend, true)));
    assert.equal(ftpAtDate(rows, "2026-08-05", null), 345);
  });

  await cleanup();
  await pool.end();
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAlle ftp-bron-rangorde tests geslaagd.");
}

main().catch(async (err) => {
  console.error(err);
  try { await cleanup(); await pool.end(); } catch {}
  process.exit(1);
});
