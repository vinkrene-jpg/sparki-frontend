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
  estimateFtpFloor,
  ftpAtDate,
  medianWeeklyHours,
} from "../lib/derived-load";
import {
  backfillTssForAthlete,
  recalibrateEstimatedFtp,
  recalibrateWeeklyTarget,
  findFtpProfileMismatches,
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

  await scenario("ftpAtDate: same-day duplicates resolve deterministically (highest wins)", () => {
    const history = [
      { measuredAt: "2026-04-04", ftpWatts: 298 },
      { measuredAt: "2026-04-04", ftpWatts: 285 },
      { measuredAt: "2026-01-01", ftpWatts: 250 },
    ];
    assert(ftpAtDate(history, "2026-05-01", null) === 298, "highest same-day row must win");
    // Order-independence: reversed input gives the same answer.
    assert(
      ftpAtDate([...history].reverse(), "2026-05-01", null) === 298,
      "must be order-independent",
    );
  });

  // ── estimateFtpFloor (pure) ────────────────────────────────────────────────
  await scenario("ftpFloor: 45–120min ride gives NP as floor", () => {
    const r = estimateFtpFloor([
      { sessionDate: "2026-06-01", durationMin: 60, normalizedPower: 287, avgPower: 270 },
    ]);
    assert(r && r.floorWatts === 287, `floor ${r?.floorWatts} !== 287`);
    assert(r!.basis.kind === "sustained", "kind must be sustained");
  });

  await scenario("ftpFloor: 20–45min ride gives 95% of NP", () => {
    const r = estimateFtpFloor([
      { sessionDate: "2026-06-01", durationMin: 35, normalizedPower: 388, avgPower: 390 },
    ]);
    assert(r && r.floorWatts === 369, `floor ${r?.floorWatts} !== 369 (0.95×388)`);
    assert(r!.basis.kind === "short", "kind must be short");
  });

  await scenario("ftpFloor: picks the highest floor across rides", () => {
    const r = estimateFtpFloor([
      { sessionDate: "2026-06-01", durationMin: 60, normalizedPower: 287, avgPower: null },
      { sessionDate: "2026-06-10", durationMin: 49, normalizedPower: 298, avgPower: null },
      { sessionDate: "2026-06-15", durationMin: 30, normalizedPower: 300, avgPower: null }, // 285
    ]);
    assert(r && r.floorWatts === 298, `floor ${r?.floorWatts} !== 298`);
    assert(r!.basis.sessionDate === "2026-06-10", "wrong basis ride");
  });

  await scenario("ftpFloor: honest null without qualifying rides", () => {
    assert(
      estimateFtpFloor([
        { sessionDate: "2026-06-01", durationMin: 15, normalizedPower: 400, avgPower: null }, // too short
        { sessionDate: "2026-06-02", durationMin: 180, normalizedPower: 250, avgPower: null }, // too long
        { sessionDate: "2026-06-03", durationMin: 60, normalizedPower: null, avgPower: null }, // no power
      ]) === null,
      "should be null",
    );
  });

  await scenario("ftpFloor: rejects implausible power (corrupt data)", () => {
    assert(
      estimateFtpFloor([
        { sessionDate: "2026-06-01", durationMin: 60, normalizedPower: 900, avgPower: null },
      ]) === null,
      "900W hour must not become a floor",
    );
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

    // De zelfherstel-regel "echte invoer wint van een schatting" zou anders de
    // oude handmatige 200-rij als leidend nemen en het ondergrens-pad nooit
    // bereiken — die rij is hierboven al gebruikt en kan nu weg.
    await db.delete(ftpHistoryTable).where(eq(ftpHistoryTable.clerkId, RUN));

    await scenario("ftp-recalibrate: estimated FTP raised to proven floor + history row", async () => {
      // Recent hard 49-min effort at NP 298 proves FTP ≥ 298.
      await db.insert(trainingSessionsTable).values({
        clerkId: RUN,
        sessionDate: day(10),
        type: "ride",
        sport: "cycling",
        durationMin: 49,
        normalizedPower: 298,
        tss: 80,
      });
      await db
        .update(athleteProfilesTable)
        .set({ ftp: 250, ftpEstimated: true })
        .where(eq(athleteProfilesTable.clerkId, RUN));
      const r = await recalibrateEstimatedFtp(RUN);
      assert(r.changed, "should raise");
      assert(r.ftp === 298, `ftp ${r.ftp} !== 298`);
      const [p] = await db
        .select({ ftp: athleteProfilesTable.ftp, e: athleteProfilesTable.ftpEstimated })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, RUN));
      assert(p!.ftp === 298, `stored ftp ${p!.ftp} !== 298`);
      assert(p!.e === true, "must stay flagged as estimated");
      const hist = await db
        .select({ w: ftpHistoryTable.ftpWatts, t: ftpHistoryTable.testType })
        .from(ftpHistoryTable)
        .where(eq(ftpHistoryTable.clerkId, RUN));
      assert(
        hist.some((h) => h.w === 298 && h.t === "derived"),
        "derived history row missing",
      );
    });

    await scenario("ftp-recalibrate: second run is a no-op (idempotent)", async () => {
      const before = (
        await db.select({ id: ftpHistoryTable.id }).from(ftpHistoryTable).where(eq(ftpHistoryTable.clerkId, RUN))
      ).length;
      const r = await recalibrateEstimatedFtp(RUN);
      assert(!r.changed, "second run must not change");
      const after = (
        await db.select({ id: ftpHistoryTable.id }).from(ftpHistoryTable).where(eq(ftpHistoryTable.clerkId, RUN))
      ).length;
      assert(before === after, "no duplicate history rows");
    });

    await scenario("ftp-recalibrate: same proof-date re-derivation updates row, no duplicate", async () => {
      // The proof ride's power gets corrected upward (e.g. re-import): the
      // derived history row for that date must be UPDATED, not duplicated.
      await db
        .update(trainingSessionsTable)
        .set({ normalizedPower: 305 })
        .where(eq(trainingSessionsTable.normalizedPower, 298));
      const r = await recalibrateEstimatedFtp(RUN);
      assert(r.changed && r.ftp === 305, `ftp ${r.ftp} !== 305`);
      const derivedRows = (
        await db
          .select({ w: ftpHistoryTable.ftpWatts, t: ftpHistoryTable.testType, d: ftpHistoryTable.measuredAt })
          .from(ftpHistoryTable)
          .where(eq(ftpHistoryTable.clerkId, RUN))
      ).filter((h) => h.t === "derived");
      assert(derivedRows.length === 1, `expected 1 derived row, got ${derivedRows.length}`);
      assert(derivedRows[0]!.w === 305, `derived row watts ${derivedRows[0]!.w} !== 305`);
    });

    await scenario("ftp-recalibrate: user-measured FTP is never touched", async () => {
      await db
        .update(athleteProfilesTable)
        .set({ ftp: 240, ftpEstimated: false })
        .where(eq(athleteProfilesTable.clerkId, RUN));
      const r = await recalibrateEstimatedFtp(RUN);
      assert(!r.changed, "measured ftp changed!");
      const [p] = await db
        .select({ ftp: athleteProfilesTable.ftp })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, RUN));
      assert(p!.ftp === 240, `ftp must remain 240, got ${p!.ftp}`);
    });

    await scenario("consistency check: flags profile-FTP that diverges from newest valid history", async () => {
      // Profile is at 240 while the newest valid history row (derived, 305)
      // says otherwise — the check must flag this athlete.
      const flagged = await findFtpProfileMismatches();
      const mine = flagged.find((m) => m.clerkId === RUN);
      assert(mine, "mismatch for test athlete not flagged");
      assert(mine!.profileFtp === 240, `profileFtp ${mine!.profileFtp} !== 240`);
      assert(mine!.latestHistoryFtp === 305, `historyFtp ${mine!.latestHistoryFtp} !== 305`);
    });

    await scenario("consistency check: silent when profile matches newest valid history", async () => {
      await db
        .update(athleteProfilesTable)
        .set({ ftp: 305 })
        .where(eq(athleteProfilesTable.clerkId, RUN));
      const flagged = await findFtpProfileMismatches();
      assert(!flagged.some((m) => m.clerkId === RUN), "consistent athlete wrongly flagged");
    });

    await scenario("consistency check: achterhaalde derived rows do not count as newest", async () => {
      // Mark the derived 305-row as achterhaald: the newest VALID row becomes
      // an older real test, so profile 305 now diverges from it again.
      await db
        .update(ftpHistoryTable)
        .set({ notes: "[achterhaald] test" })
        .where(eq(ftpHistoryTable.clerkId, RUN));
      await db.insert(ftpHistoryTable).values({
        clerkId: RUN,
        measuredAt: day(20),
        ftpWatts: 250,
        testType: "ramp",
      });
      const flagged = await findFtpProfileMismatches();
      const mine = flagged.find((m) => m.clerkId === RUN);
      assert(mine, "should flag: valid history is 250, profile 305");
      assert(mine!.latestHistoryFtp === 250, `historyFtp ${mine!.latestHistoryFtp} !== 250`);
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
