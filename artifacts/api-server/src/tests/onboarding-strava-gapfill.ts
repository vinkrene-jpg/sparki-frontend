// Strava-connect → gap-fill "don't re-ask imported data" contract test.
//
// The mandatory onboarding connect step triggers + waits for the initial Strava
// import so the VERY NEXT gap-fill screen asks for fewer fields — any data the
// import landed (FTP, weight) must not be re-requested. This flow is nearly
// impossible to verify by hand: dev Preview Mode bypasses onboarding entirely
// and the connect is a real Strava OAuth round-trip. Without this test a future
// change to the OAuth callback, the Data Hub sync, or getMissingOnboardingData
// could silently make onboarding re-ask for data it already imported — breaking
// the "gather first, then ask only the genuinely-missing gaps" doctrine.
//
// getMissingOnboardingData is the single gate the gap-fill renders from. It does
// NOT trust a connection's importedDataTypes flag — it reads the ACTUAL landed
// rows (ftp_history / athlete_daily_metrics). That is the honesty contract: a
// connection can claim "connected" yet have imported nothing, and the athlete
// must still be asked for what is genuinely absent (never fake-green). This test
// seeds both sides of that contract directly against the DB:
//
//   A. Connected Strava whose import LANDED ftp_history + athlete_daily_metrics
//      (weight) → getMissingOnboardingData no longer lists ftp/weightKg.
//   B. Connected Strava with EMPTY importedDataTypes and NO landed rows → both
//      ftp and weightKg are still surfaced as missing (honest failure path).
//
// Run: `pnpm --filter @workspace/api-server run test:onboarding-strava-gapfill`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import {
  db,
  pool,
  connectorConnectionsTable,
  ftpHistoryTable,
  athleteDailyMetricsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { getMissingOnboardingData } from "../engines/onboarding";
import { ensureAccount, silentLogger } from "../lib/account";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

const RUN = `test_strava_gapfill_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}
const emailFor = (id: string) => `${id}@example.test`;

// A fresh account with an empty athlete profile — the truest possible "brand-new
// athlete" state right after the mandatory connect step.
async function freshEmptyAccount(tag: string): Promise<string> {
  const id = newId(tag);
  await ensureAccount(id, emailFor(id), null, silentLogger);
  return id;
}

const today = () => new Date().toISOString().slice(0, 10);

async function cleanup() {
  if (ids.length === 0) return;
  await db
    .delete(ftpHistoryTable)
    .where(inArray(ftpHistoryTable.clerkId, ids));
  await db
    .delete(athleteDailyMetricsTable)
    .where(inArray(athleteDailyMetricsTable.clerkId, ids));
  await db
    .delete(connectorConnectionsTable)
    .where(inArray(connectorConnectionsTable.clerkId, ids));
  // user_profiles row removal cascades athlete_profiles + any remaining children.
  const { userProfilesTable } = await import("@workspace/db");
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  // ── Scenario A: connected Strava whose import LANDED FTP + weight ───────────
  await scenario(
    "A: connected Strava with landed FTP + weight → gap-fill drops ftp/weightKg",
    async () => {
      const id = await freshEmptyAccount("landed");

      // The connect step reports success with real data types imported…
      await db.insert(connectorConnectionsTable).values({
        clerkId: id,
        provider: "strava",
        status: "connected",
        importedDataTypes: ["profile", "ftp", "weight", "activities"],
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      });
      // …and the import actually landed rows in the canonical tables the
      // gap-fill reads from (this is what "imported" must mean, not a flag).
      await db.insert(ftpHistoryTable).values({
        clerkId: id,
        measuredAt: today(),
        ftpWatts: 265,
        testType: "strava",
      });
      await db.insert(athleteDailyMetricsTable).values({
        clerkId: id,
        metricDate: today(),
        weightKg: "71.50",
      });

      const missing = await getMissingOnboardingData(id);
      const missingKeys = new Set(missing.missing.map((f) => f.key));

      assert(
        !missingKeys.has("ftp"),
        `ftp re-asked despite a landed ftp_history row (missing: ${[...missingKeys]})`,
      );
      assert(
        !missingKeys.has("weightKg"),
        `weightKg re-asked despite a landed weight metric (missing: ${[...missingKeys]})`,
      );
      assert(
        missing.present.includes("ftp") && missing.present.includes("weightKg"),
        `ftp/weightKg not reported present: ${missing.present}`,
      );
      // Genuinely-missing fields (name, discipline, hours, days) must remain —
      // the import supplied FTP + weight only, and Sparki never fabricates the rest.
      for (const k of [
        "displayName",
        "discipline",
        "weeklyHourTarget",
        "availableDays",
      ]) {
        assert(
          missingKeys.has(k),
          `genuinely-missing field "${k}" was not surfaced (missing: ${[...missingKeys]})`,
        );
      }
    },
  );

  // ── Scenario B: connected Strava that imported NOTHING (honest failure) ─────
  await scenario(
    "B: connected Strava with empty import → ftp/weightKg still surfaced (no fake-green)",
    async () => {
      const id = await freshEmptyAccount("empty_import");

      // Connection reports "connected" but imported nothing — the callback
      // succeeded yet the sync brought no FTP/weight (best-effort, honest gap).
      await db.insert(connectorConnectionsTable).values({
        clerkId: id,
        provider: "strava",
        status: "connected",
        importedDataTypes: [],
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      });
      // Deliberately no ftp_history / athlete_daily_metrics rows.

      const missing = await getMissingOnboardingData(id);
      const missingKeys = new Set(missing.missing.map((f) => f.key));

      assert(
        missingKeys.has("ftp"),
        "ftp must still be missing when the import landed no ftp_history row (fake-green!)",
      );
      assert(
        missingKeys.has("weightKg"),
        "weightKg must still be missing when the import landed no weight metric (fake-green!)",
      );
      assert(
        !missing.present.includes("ftp") &&
          !missing.present.includes("weightKg"),
        `ftp/weightKg wrongly reported present with no landed data: ${missing.present}`,
      );
    },
  );
}

async function shutdown(code: number) {
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== onboarding Strava gap-fill — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
