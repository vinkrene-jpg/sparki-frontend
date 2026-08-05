// DATABRONNEN_EN_FTP_01 D3 — FTP-afleiding uit beste 20 minuten (×0,95) als
// VOORSTEL met bronrit, nooit stil doorgevoerd. Idempotent.
import assert from "node:assert/strict";
import { eq, and, like } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  passportProposalsTable,
} from "@workspace/db";
import { proposeFtpFromBestTwentyMin } from "../lib/derived-load-backfill";

const RUN = "test-ftp20-voorstel";

async function cleanup() {
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, RUN));
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({ clerkId: RUN, email: `${RUN}@test.local` });
  await db.insert(athleteProfilesTable).values({ clerkId: RUN, ftp: 250, ftpEstimated: false });

  const today = new Date().toISOString().slice(0, 10);
  await db.insert(trainingSessionsTable).values({
    clerkId: RUN,
    sessionDate: today,
    type: "ride",
    sport: "cycling",
    title: "Testrit 20 min blok",
    durationMin: 90,
    avgPower: 240,
    powerBests: { "1200": 300 },
    source: "strava",
  });

  // 1) Voorstel wordt aangemaakt: 300 × 0,95 = 285 > 250.
  const r1 = await proposeFtpFromBestTwentyMin(RUN);
  assert.equal(r1.candidate, 285);
  assert.equal(r1.proposed, true);
  const open = await db
    .select()
    .from(passportProposalsTable)
    .where(
      and(
        eq(passportProposalsTable.clerkId, RUN),
        eq(passportProposalsTable.status, "open"),
      ),
    );
  assert.equal(open.length, 1);
  assert.equal(open[0]!.proposedValue, "285");
  assert.ok(open[0]!.reason.includes("Testrit 20 min blok"), "bronrit in reden");
  assert.ok(open[0]!.reason.includes("300 watt"), "bronvermogen in reden");
  console.log("✓ voorstel 285 W met bronrit aangemaakt");

  // 2) Profiel-FTP is NIET stil gewijzigd.
  const [p] = await db
    .select({ ftp: athleteProfilesTable.ftp })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, RUN));
  assert.equal(p!.ftp, 250);
  console.log("✓ FTP niet stil doorgevoerd (blijft 250)");

  // 3) Idempotent: tweede run maakt geen tweede open voorstel.
  const r2 = await proposeFtpFromBestTwentyMin(RUN);
  assert.equal(r2.proposed, false);
  const open2 = await db
    .select()
    .from(passportProposalsTable)
    .where(
      and(
        eq(passportProposalsTable.clerkId, RUN),
        eq(passportProposalsTable.status, "open"),
      ),
    );
  assert.equal(open2.length, 1);
  console.log("✓ idempotent (één open voorstel)");

  // 4) Lager dan huidige FTP → geen voorstel.
  await db
    .update(athleteProfilesTable)
    .set({ ftp: 300 })
    .where(eq(athleteProfilesTable.clerkId, RUN));
  await db
    .delete(passportProposalsTable)
    .where(eq(passportProposalsTable.clerkId, RUN));
  const r3 = await proposeFtpFromBestTwentyMin(RUN);
  assert.equal(r3.proposed, false);
  console.log("✓ geen voorstel wanneer afleiding niet hoger is");

  await cleanup();
  console.log("\nAlle D3-voorsteltests geslaagd.");
}

main()
  .catch(async (err) => {
    console.error("GEFAALD:", err);
    await cleanup().catch(() => undefined);
    process.exit(1);
  })
  .then(() => process.exit(0));
