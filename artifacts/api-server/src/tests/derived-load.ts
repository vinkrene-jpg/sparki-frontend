// Derived-load test: belastingscore-derivation + weekly-target recalibration.
//
// The pure functions (deriveTss / ftpAtDate / medianWeeklyHours) run without a
// database; a scenario block at the end seeds a disposable athlete to verify
// the DB backfill + recalibration end-to-end.
//
// Run: `pnpm --filter @workspace/api-server run test:derived-load`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import { db, pool, trainingSessionsTable, athleteProfilesTable, userProfilesTable, ftpHistoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  deriveTss,
  ftpAtDate,
  medianWeeklyHours,
} from "../lib/derived-load";
import {
  backfillTssForAthlete,
  recalibrateWeeklyTarget,
} from "../lib/derived-load-backfill";
import { buildMergePatch } from "../engines/data-hub/dedupe";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => void | Promise<void>) {
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

async function main() {
  // ── deriveTss (pure) ───────────────────────────────────────────────────────
  await scenario("deriveTss: standard ride NP 200 / FTP 250 / 90min", () => {
    const r = deriveTss({ durationMin: 90, normalizedPower: 200, avgPower: 180, ftp: 250 });
    assert(r, "expected a derivation");
    // IF = 0.8 → TSS = 1.5h × 0.64 × 100 = 96
    assert(r!.tss === 96, `tss ${r!.tss} !== 96`);
    assert(r!.intensityFactor === 0.8, `if ${r!.intensityFactor} !== 0.8`);
  });

  await scenario("deriveTss: falls back to avgPower when NP missing", () => {
    const r = deriveTss({ durationMin: 60, normalizedPower: null, avgPower: 250, ftp: 250 });
    assert(r && r.tss === 100, `tss ${r?.tss} !== 100`);
  });

  await scenario("deriveTss: honest null when power missing", () => {
    assert(
      deriveTss({ durationMin: 60, normalizedPower: null, avgPower: null, ftp: 250 }) === null,
      "should be null without power",
    );
  });

  await scenario("deriveTss: honest null when FTP missing/implausible", () => {
    assert(deriveTss({ durationMin: 60, normalizedPower: 200, avgPower: null, ftp: null }) === null, "null ftp");
    assert(deriveTss({ durationMin: 60, normalizedPower: 200, avgPower: null, ftp: 20 }) === null, "ftp 20");
  });

  await scenario("deriveTss: refuses implausible IF > 2 (wrong FTP)", () => {
    assert(
      deriveTss({ durationMin: 60, normalizedPower: 500, avgPower: null, ftp: 100 }) === null,
      "IF 5 must not be stored",
    );
  });

  await scenario("deriveTss: rejects tss out of 0–1000 range", () => {
    // 20h at IF 1.0 → 2000 TSS: corrupt duration/power combo.
    assert(
      deriveTss({ durationMin: 1200, normalizedPower: 250, avgPower: null, ftp: 250 }) === null,
      "2000 tss must be rejected",
    );
  });

  // ── ftpAtDate (pure) ───────────────────────────────────────────────────────
  const hist = [
    { measuredAt: "2026-03-01", ftpWatts: 240 },
    { measuredAt: "2026-05-01", ftpWatts: 260 },
  ];
  await scenario("ftpAtDate: latest at-or-before ride date", () => {
    assert(ftpAtDate(hist, "2026-04-15", 272) === 240, "april → march test");
    assert(ftpAtDate(hist, "2026-05-01", 272) === 260, "same day counts");
    assert(ftpAtDate(hist, "2026-06-10", 272) === 260, "june → may test");
  });
  await scenario("ftpAtDate: rides older than first test use first test", () => {
    assert(ftpAtDate(hist, "2026-01-01", 272) === 240, "pre-history → earliest");
  });
  await scenario("ftpAtDate: no history → profile ftp (may be null)", () => {
    assert(ftpAtDate([], "2026-01-01", 272) === 272, "profile fallback");
    assert(ftpAtDate([], "2026-01-01", null) === null, "honest null");
  });

  // ── medianWeeklyHours (pure) ───────────────────────────────────────────────
  const now = new Date("2026-07-01T12:00:00"); // Wednesday; current week = 2026-06-29
  await scenario("medianWeeklyHours: median over complete weeks, current week excluded", () => {
    const mk = (date: string, min: number) => ({ sessionDate: date, durationMin: min });
    const sessions = [
      // 4 complete weeks: 8h, 10h, 12h, 10h → median 10
      mk("2026-06-01", 480), // wk 6/1
      mk("2026-06-09", 300), mk("2026-06-13", 300), // wk 6/8 = 10h
      mk("2026-06-17", 720), // wk 6/15
      mk("2026-06-25", 600), // wk 6/22
      mk("2026-06-30", 6000), // current week — must be ignored
    ];
    const r = medianWeeklyHours(sessions, now);
    assert(r.weeksWithRiding === 4, `weeks ${r.weeksWithRiding} !== 4`);
    assert(r.medianHours === 10, `median ${r.medianHours} !== 10`);
  });
  await scenario("medianWeeklyHours: honest null under 4 riding weeks", () => {
    const r = medianWeeklyHours(
      [
        { sessionDate: "2026-06-09", durationMin: 300 },
        { sessionDate: "2026-06-17", durationMin: 300 },
      ],
      now,
    );
    assert(r.medianHours === null, "should refuse with 2 weeks");
  });
  await scenario("medianWeeklyHours: empty weeks don't drag the median down", () => {
    // Rode only 4 of the last 8 weeks, each 10h → median 10 (not 5).
    const r = medianWeeklyHours(
      [
        { sessionDate: "2026-05-05", durationMin: 600 },
        { sessionDate: "2026-05-20", durationMin: 600 },
        { sessionDate: "2026-06-02", durationMin: 600 },
        { sessionDate: "2026-06-16", durationMin: 600 },
      ],
      now,
    );
    assert(r.medianHours === 10, `median ${r.medianHours} !== 10`);
  });

  // ── Merge path (pure) ──────────────────────────────────────────────────────
  await scenario("buildMergePatch: fills missing tss AND intensityFactor, existing wins", () => {
    const patch = buildMergePatch(
      { tss: null, intensityFactor: null, avgPower: 210 },
      { tss: 96, intensityFactor: "0.8", avgPower: 205 },
    );
    assert(patch["tss"] === 96, "tss must be filled");
    assert(patch["intensityFactor"] === "0.8", "intensityFactor must be filled");
    assert(!("avgPower" in patch), "existing avgPower must win");
  });

  // ── DB backfill + recalibration (integration) ──────────────────────────────
  const RUN = `test_derived_${Date.now()}`;
  try {
    await db.insert(userProfilesTable).values({
      clerkId: RUN,
      email: `${RUN}@test.local`,
      displayName: "Derived Load Test",
    });
    await db.insert(athleteProfilesTable).values({
      clerkId: RUN,
      ftp: 250,
      weeklyHourTarget: 3,
      weeklyHourTargetEstimated: true,
    });
    await db.insert(ftpHistoryTable).values({
      clerkId: RUN,
      measuredAt: "2026-01-01",
      ftpWatts: 200,
      testType: "manual",
    });

    // Recent complete weeks with real riding (10h/wk), all without a score.
    const day = (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offsetDays);
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
    };
    const rides: (typeof trainingSessionsTable.$inferInsert)[] = [];
    for (let w = 1; w <= 5; w++) {
      rides.push({
        clerkId: RUN,
        sessionDate: day(w * 7),
        type: "ride",
        sport: "cycling",
        durationMin: 600,
        normalizedPower: 200,
        tss: null,
      });
    }
    // One ride without power: must stay honestly score-less.
    rides.push({
      clerkId: RUN,
      sessionDate: day(3),
      type: "ride",
      sport: "cycling",
      durationMin: 60,
      tss: null,
    });
    // One ride with a provider score: must NOT be overwritten.
    rides.push({
      clerkId: RUN,
      sessionDate: day(4),
      type: "ride",
      sport: "cycling",
      durationMin: 60,
      normalizedPower: 200,
      tss: 77,
    });
    await db.insert(trainingSessionsTable).values(rides);

    await scenario("backfill: derives only NULL scores with power+ftp", async () => {
      const r = await backfillTssForAthlete(RUN);
      assert(r.updated === 5, `updated ${r.updated} !== 5`);
      // The powerless ride is excluded by the query itself (never a candidate),
      // so nothing is "skipped" — it simply stays honestly score-less.
      assert(r.skipped === 0, `skipped ${r.skipped} !== 0`);
      const rows = await db
        .select({
          tss: trainingSessionsTable.tss,
          intensityFactor: trainingSessionsTable.intensityFactor,
          normalizedPower: trainingSessionsTable.normalizedPower,
          durationMin: trainingSessionsTable.durationMin,
        })
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.clerkId, RUN));
      const provider = rows.find((x) => x.tss === 77);
      assert(provider, "provider score 77 must survive");
      const powerless = rows.find((x) => x.normalizedPower == null);
      assert(powerless && powerless.tss === null, "powerless ride stays null");
      // 10h at NP200/FTP200 (history applies) → IF 1.0 → 1000 TSS is range-max;
      // 600min × 1.0² × 100/60 = 1000 → allowed.
      const derived = rows.filter((x) => x.durationMin === 600);
      assert(
        derived.every((x) => x.tss === 1000 && x.intensityFactor != null),
        `derived rows wrong: ${JSON.stringify(derived)}`,
      );
    });

    await scenario("backfill: second run is a no-op (idempotent)", async () => {
      const r = await backfillTssForAthlete(RUN);
      assert(r.updated === 0, `second run updated ${r.updated} !== 0`);
    });

    await scenario("recalibrate: estimated 3h target becomes real 10h median", async () => {
      const r = await recalibrateWeeklyTarget(RUN);
      assert(r.changed, "target should change");
      assert(r.hours === 10, `hours ${r.hours} !== 10`);
      const [p] = await db
        .select({
          t: athleteProfilesTable.weeklyHourTarget,
          e: athleteProfilesTable.weeklyHourTargetEstimated,
        })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, RUN));
      assert(p!.t === 10, `stored target ${p!.t} !== 10`);
      assert(p!.e === true, "must stay flagged as estimated");
    });

    await scenario("recalibrate: user-set target is never touched", async () => {
      await db
        .update(athleteProfilesTable)
        .set({ weeklyHourTarget: 6, weeklyHourTargetEstimated: false })
        .where(eq(athleteProfilesTable.clerkId, RUN));
      const r = await recalibrateWeeklyTarget(RUN);
      assert(!r.changed, "user-set target changed!");
      const [p] = await db
        .select({ t: athleteProfilesTable.weeklyHourTarget })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, RUN));
      assert(p!.t === 6, "target must remain 6");
    });
  } finally {
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, RUN));
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
