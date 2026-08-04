// Belastingsmodel-SSOT — GET /api/athlete/load regressietest (Golf 22).
//
// The /load route previously re-implemented the CTL/ATL EWMA inline, a second
// belastingsmodel next to lib/recovery-load's computeLoad (used by dashboard,
// plan, goals, nutrition). Golf 22 consolidated it onto computeLoadSeries.
// This test pins that contract:
//   - the endpoint's ctl/atl/tsb EXACTLY equal computeLoad over the same rows
//     (one model, one truth);
//   - two sessions on the SAME day are summed once per date (an activity never
//     counts double, and never gets lost);
//   - ?days= steers only the chart window (clamped 7..365, default 42) while
//     the end-state numbers stay identical;
//   - sessions of ANOTHER user never leak into the numbers.
//
// Run: `pnpm --filter @workspace/api-server run test:athlete-load` (or via
// shell: NODE_ENV=development DEV_AUTH_BYPASS=true node ./scripts/run-test.mjs athlete-load)
// Requires DATABASE_URL. Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  trainingSessionsTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { computeLoad, computeLoadSeries } from "../lib/recovery-load";

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

const RUN = `test_load_${Date.now()}`;
const userId = `${RUN}_user`;
const otherId = `${RUN}_other`;

let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else {
        reject(new Error("failed to determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split("T")[0]!;
}

type LoadBody = {
  ctl: number;
  atl: number;
  tsb: number;
  chartData: Array<{ date: string; ctl: number; atl: number; tsb: number; tss: number }>;
};

async function fetchLoad(query = ""): Promise<{ status: number; body: LoadBody }> {
  const res = await fetch(`${baseUrl}/api/athlete/load${query}`, {
    headers: { "x-dev-clerk-id": userId },
  });
  return { status: res.status, body: (await res.json()) as LoadBody };
}

// Seeded TSS history: two sessions on the SAME day (must be summed, not
// double-counted per EWMA step) plus spread-out singles.
const SEED: Array<{ date: string; tss: number }> = [
  { date: daysAgoIso(3), tss: 60 },
  { date: daysAgoIso(3), tss: 40 }, // same day as above
  { date: daysAgoIso(7), tss: 90 },
  { date: daysAgoIso(20), tss: 75 },
  { date: daysAgoIso(45), tss: 120 },
];

async function main() {
  await ensureAccount(userId, `${RUN}@test.local`, "Load Tester", silentLogger);
  await ensureAccount(otherId, `${RUN}_other@test.local`, "Other", silentLogger);

  await db.insert(trainingSessionsTable).values(
    SEED.map((s) => ({
      clerkId: userId,
      sessionDate: s.date,
      type: "endurance",
      tss: s.tss,
    })),
  );
  // Foreign rows that must NOT influence the numbers.
  await db.insert(trainingSessionsTable).values([
    { clerkId: otherId, sessionDate: daysAgoIso(3), type: "endurance", tss: 500 },
  ]);

  await startServer();

  const expectedRows = SEED.map((s) => ({ sessionDate: s.date, tss: s.tss }));

  await scenario("endpoint equals shared computeLoad (one model, one truth)", async () => {
    const { status, body } = await fetchLoad();
    assert(status === 200, `status ${status}`);
    const expected = computeLoad(expectedRows);
    assert(body.ctl === expected.ctl, `ctl ${body.ctl} ≠ ${expected.ctl}`);
    assert(body.atl === expected.atl, `atl ${body.atl} ≠ ${expected.atl}`);
    assert(body.tsb === expected.tsb, `tsb ${body.tsb} ≠ ${expected.tsb}`);
  });

  await scenario("same-day sessions are summed once per date (100 TSS)", async () => {
    const { body } = await fetchLoad();
    const day = body.chartData.find((p) => p.date === daysAgoIso(3));
    assert(day, "chart point for seeded day missing");
    assert(day!.tss === 100, `expected 100 TSS on that date, got ${day!.tss}`);
  });

  await scenario("chart series matches computeLoadSeries exactly", async () => {
    const { body } = await fetchLoad();
    const expected = computeLoadSeries(expectedRows, 42);
    assert(
      body.chartData.length === expected.chartData.length,
      `series length ${body.chartData.length} ≠ ${expected.chartData.length}`,
    );
    for (let i = 0; i < expected.chartData.length; i++) {
      const a = body.chartData[i]!;
      const e = expected.chartData[i]!;
      assert(
        a.date === e.date && a.ctl === e.ctl && a.atl === e.atl && a.tsb === e.tsb && a.tss === e.tss,
        `mismatch at ${e.date}`,
      );
    }
  });

  await scenario("?days= steers only the window; end-state identical", async () => {
    const d14 = await fetchLoad("?days=14");
    const d90 = await fetchLoad("?days=90");
    assert(d14.body.chartData.length === 15, `14d → 15 points, got ${d14.body.chartData.length}`);
    assert(d90.body.chartData.length === 91, `90d → 91 points, got ${d90.body.chartData.length}`);
    assert(
      d14.body.ctl === d90.body.ctl && d14.body.atl === d90.body.atl,
      "window must not change the model end-state",
    );
  });

  await scenario("?days= is clamped (999 → 365, garbage → default 42)", async () => {
    const big = await fetchLoad("?days=999");
    assert(big.body.chartData.length === 366, `clamp to 365, got ${big.body.chartData.length - 1}d`);
    const junk = await fetchLoad("?days=abc");
    assert(junk.body.chartData.length === 43, `default 42, got ${junk.body.chartData.length - 1}d`);
  });

  await scenario("another user's sessions never leak in", async () => {
    const { body } = await fetchLoad();
    const day = body.chartData.find((p) => p.date === daysAgoIso(3));
    assert(day!.tss === 100, `foreign 500-TSS row leaked: got ${day!.tss}`);
  });

  await stopServer();

  // Cleanup: only what this test created.
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, [userId, otherId]));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, userId));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, otherId));
  await pool.end();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
