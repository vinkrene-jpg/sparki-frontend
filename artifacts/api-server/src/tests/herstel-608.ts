// Herstel #608 — regressietest tegen een geseede testgebruiker met precies de
// Dylan-situatie: leidende 272 W-importrij, gemeten ondergrens 278 W, en een
// verdachte rit op 08-07 (337 W gemiddeld, 4 uur, geen NP).
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  ftpHistoryTable,
  trainingSessionsTable,
} from "@workspace/db";
import { repairTrainerFtp345 } from "../lib/repair-trainer-ftp-345";

const RUN = "test-herstel-608";

async function cleanup() {
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, RUN));
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({ clerkId: RUN, email: `${RUN}@test.local` });
  await db.insert(athleteProfilesTable).values({ clerkId: RUN, ftp: 272, ftpEstimated: false });
  await db.insert(ftpHistoryTable).values([
    // gemeten ondergrens — blijft zichtbaar als onderbouwing
    { clerkId: RUN, measuredAt: "2026-07-10", ftpWatts: 278, testType: "derived", bron: "sparki_afgeleid", leidend: true, notes: "ondergrens" },
    // foute Strava-import die leidend werd
    { clerkId: RUN, measuredAt: "2026-08-01", ftpWatts: 272, testType: "strava", bron: "import", leidend: true, notes: null },
  ]);
  await db.insert(trainingSessionsTable).values([
    // verdachte rit 08-07: 337 W gemiddeld, 4 uur, geen NP
    { clerkId: RUN, sessionDate: "2026-07-08", type: "ride", sport: "cycling", title: "Verdachte rit", durationMin: 240, avgPower: 337, tss: 400, source: "strava" },
    // rit na de foute import — score moet herrekend worden
    { clerkId: RUN, sessionDate: "2026-08-03", type: "ride", sport: "cycling", title: "Rit na import", durationMin: 60, avgPower: 200, tss: 87, source: "strava" },
  ]);

  const r1 = await repairTrainerFtp345({ clerkId: RUN });
  assert.equal(r1.ran, true);
  assert.equal(r1.rowsDemoted, 1, "272-importrij gedemoveerd");
  assert.equal(r1.trainerRowEnsured, true, "trainerrij 345 aangemaakt");
  assert.equal(r1.profileRestored, true);
  assert.equal(r1.doubtfulMarked, 1, "verdachte rit gemarkeerd");
  assert.ok(r1.sessionsNulled >= 1, "scores vanaf 01-08 genulled");

  const historie = await db
    .select()
    .from(ftpHistoryTable)
    .where(eq(ftpHistoryTable.clerkId, RUN));
  const importRij = historie.find((h) => h.testType === "strava");
  assert.equal(importRij!.leidend, false, "272 bewaard als niet-leidend");
  const trainerRij = historie.find((h) => h.bron === "trainer");
  assert.equal(trainerRij!.ftpWatts, 345);
  assert.equal(trainerRij!.leidend, true);
  assert.equal(trainerRij!.measuredAt, "2026-08-05");
  assert.ok(trainerRij!.notes!.includes("niet bevestigd"), "gemarkeerd als niet bevestigd");
  assert.ok(trainerRij!.notes!.includes("278"), "ondergrens als onderbouwing benoemd");
  const ondergrens = historie.find((h) => h.ftpWatts === 278);
  assert.ok(ondergrens, "ondergrens-rij blijft bestaan");
  console.log("✓ historie: 345 leidend (niet bevestigd), 272 niet-leidend, 278 zichtbaar");

  const [profiel] = await db
    .select({ ftp: athleteProfilesTable.ftp, est: athleteProfilesTable.ftpEstimated })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, RUN));
  assert.equal(profiel!.ftp, 345);
  console.log("✓ profiel-FTP terug op 345");

  const [verdacht] = await db
    .select({ notes: trainingSessionsTable.notes, tss: trainingSessionsTable.tss })
    .from(trainingSessionsTable)
    .where(and(eq(trainingSessionsTable.clerkId, RUN), eq(trainingSessionsTable.sessionDate, "2026-07-08")));
  assert.ok(verdacht!.notes!.startsWith("[twijfelachtige data]"), "twijfel-markering met reden");
  assert.ok(verdacht!.notes!.includes("vermoedelijk foutieve vermogensdata"));
  const [naImport] = await db
    .select({ tss: trainingSessionsTable.tss })
    .from(trainingSessionsTable)
    .where(and(eq(trainingSessionsTable.clerkId, RUN), eq(trainingSessionsTable.sessionDate, "2026-08-03")));
  assert.equal(naImport!.tss, null, "score na 01-08 genulled voor herberekening");
  console.log("✓ verdachte rit gemarkeerd, betrokken scores genulled");

  // Idempotent: tweede run verandert niets meer.
  const r2 = await repairTrainerFtp345({ clerkId: RUN });
  assert.equal(r2.rowsDemoted, 0);
  assert.equal(r2.trainerRowEnsured, false);
  assert.equal(r2.profileRestored, false);
  assert.equal(r2.doubtfulMarked, 0);
  assert.equal(r2.sessionsNulled, 0);
  const historie2 = await db
    .select()
    .from(ftpHistoryTable)
    .where(and(eq(ftpHistoryTable.clerkId, RUN), eq(ftpHistoryTable.bron, "trainer")));
  assert.equal(historie2.length, 1, "geen dubbele trainerrij");
  console.log("✓ idempotent");

  await cleanup();
  console.log("\nAlle herstel-608-tests geslaagd.");
}

main()
  .catch(async (err) => {
    console.error("GEFAALD:", err);
    await cleanup().catch(() => undefined);
    process.exit(1);
  })
  .then(() => process.exit(0));
