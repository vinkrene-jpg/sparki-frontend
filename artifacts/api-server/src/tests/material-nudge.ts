// Materiaalcoach proactive nudge integration test.
//
// Exercises the deterministic wear-nudge engine + notification ensure flow
// against the dev DB. Every scenario uses a disposable clerkId and is cleaned up
// afterwards, so the test is safe to re-run against a shared database.
//
// Run: `pnpm --filter @workspace/api-server run test:material-nudge`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import {
  db,
  pool,
  trainingSessionsTable,
  materialAnalysesTable,
  notificationsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  evaluateMaterialNudge,
  ensureMaterialNudgeNotification,
} from "../engines/material";

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

const RUN = `test_matnudge_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}
const emailFor = (id: string) => `${id}@example.test`;

async function cleanup() {
  if (ids.length === 0) return;
  // training_sessions, material_analyses, notifications all cascade off
  // user_profiles, but delete explicitly to be safe / fast.
  await db
    .delete(notificationsTable)
    .where(inArray(notificationsTable.clerkId, ids));
  await db
    .delete(materialAnalysesTable)
    .where(inArray(materialAnalysesTable.clerkId, ids));
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, ids));
  // user_profiles last (children gone). Use raw delete via pool to avoid extra imports.
  await pool.query(`DELETE FROM user_profiles WHERE clerk_id = ANY($1::text[])`, [
    ids,
  ]);
}

function dayAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function addCyclingSession(clerkId: string, km: number, daysAgo: number) {
  await db.insert(trainingSessionsTable).values({
    clerkId,
    sessionDate: dayAgo(daysAgo),
    sport: "cycling",
    distanceKm: km.toFixed(2),
  });
}

async function main() {
  await scenario("no data → no nudge", async () => {
    const id = newId("nodata");
    await ensureAccount(id, emailFor(id), "Geen Data", silentLogger);
    const nudge = await evaluateMaterialNudge(id);
    assert(nudge === null, "expected null nudge when there is no cycling data");
  });

  await scenario("below threshold → no nudge", async () => {
    const id = newId("below");
    await ensureAccount(id, emailFor(id), "Onder Drempel", silentLogger);
    await addCyclingSession(id, 1000, 30);
    await addCyclingSession(id, 800, 10);
    const nudge = await evaluateMaterialNudge(id);
    assert(nudge === null, "1800 km < 3000 km chain threshold should not nudge");
  });

  await scenario("chain threshold crossed → chain nudge", async () => {
    const id = newId("chain");
    await ensureAccount(id, emailFor(id), "Ketting", silentLogger);
    await addCyclingSession(id, 1800, 40);
    await addCyclingSession(id, 1800, 5);
    const nudge = await evaluateMaterialNudge(id);
    assert(nudge != null, "3600 km should produce a nudge");
    assert(nudge!.category === "chain", `expected chain, got ${nudge!.category}`);
    assert(nudge!.bucket === 1, `expected bucket 1, got ${nudge!.bucket}`);
    assert(
      nudge!.lastCheckedAt === null,
      "never-checked nudge should have null lastCheckedAt",
    );
    assert(
      nudge!.actionUrl === "/dashboard?materiaal=chain&n=1",
      `unexpected actionUrl ${nudge!.actionUrl}`,
    );
    assert(
      /nog nooit bekeken/.test(nudge!.message),
      "never-checked message should say Sparki never saw it",
    );
  });

  await scenario("most-overdue part wins", async () => {
    const id = newId("overdue");
    await ensureAccount(id, emailFor(id), "Meest Overdue", silentLogger);
    // 10000 km: chain ratio 3.33, tyres 2.5, brakes 2.0 → chain wins.
    await addCyclingSession(id, 5000, 60);
    await addCyclingSession(id, 5000, 5);
    const nudge = await evaluateMaterialNudge(id);
    assert(nudge != null, "expected a nudge at 10000 km");
    assert(
      nudge!.category === "chain",
      `chain is most overdue, got ${nudge!.category}`,
    );
    assert(nudge!.bucket === 3, `expected bucket 3, got ${nudge!.bucket}`);
  });

  await scenario("recent check resets the baseline", async () => {
    const id = newId("reset");
    await ensureAccount(id, emailFor(id), "Reset", silentLogger);
    // 3600 km total, but a chain check 2 days ago means only ~0 km since.
    await addCyclingSession(id, 3600, 30);
    await db.insert(materialAnalysesTable).values({
      clerkId: id,
      category: "chain",
      status: "analyzed",
      confidence: "high",
      photoPaths: [],
      createdAt: new Date(Date.now() - 2 * 86_400_000),
    });
    const nudge = await evaluateMaterialNudge(id);
    assert(
      nudge === null,
      "a recent chain check should clear the chain nudge (no new km since)",
    );
  });

  await scenario("km after a check re-triggers with checked phrasing", async () => {
    const id = newId("recheck");
    await ensureAccount(id, emailFor(id), "Recheck", silentLogger);
    await db.insert(materialAnalysesTable).values({
      clerkId: id,
      category: "chain",
      status: "analyzed",
      confidence: "high",
      photoPaths: [],
      createdAt: new Date(Date.now() - 20 * 86_400_000),
    });
    // Ride 3500 km AFTER the check (10 days ago < 20 days ago check).
    await addCyclingSession(id, 3500, 10);
    const nudge = await evaluateMaterialNudge(id);
    assert(nudge != null, "expected a nudge after riding past the check");
    assert(nudge!.category === "chain", "expected chain category");
    assert(
      nudge!.lastCheckedAt !== null,
      "checked nudge should carry lastCheckedAt",
    );
    assert(
      /voor het laatst is bekeken/.test(nudge!.message),
      "checked message should reference the last check moment",
    );
  });

  await scenario(
    "ensure notification is idempotent per (category, bucket)",
    async () => {
      const id = newId("notif");
      await ensureAccount(id, emailFor(id), "Melding", silentLogger);
      await addCyclingSession(id, 3600, 5);

      const first = await ensureMaterialNudgeNotification(id);
      assert(first != null, "expected an ensured nudge");
      assert(first!.dismissed === false, "fresh nudge should not be dismissed");

      const second = await ensureMaterialNudgeNotification(id);
      assert(second != null, "second call should still return the nudge");
      assert(
        second!.notificationId === first!.notificationId,
        "same (category, bucket) must reuse the same notification",
      );

      const rows = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(inArray(notificationsTable.clerkId, [id]));
      assert(
        rows.length === 1,
        `expected exactly 1 notification, found ${rows.length}`,
      );
    },
  );
}

main()
  .catch((err) => {
    results.push({
      scenario: "fatal",
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await pool.end().catch(() => {});

    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail");
    for (const r of results) {
      const tag = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${passed}/${results.length} passed`);
    process.exit(failed.length > 0 ? 1 : 0);
  });
