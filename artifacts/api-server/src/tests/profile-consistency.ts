// Profile-consistency module — tests.
//
// Sparki notices when profile values contradict real riding, names it, asks a
// targeted question and only corrects after the athlete confirms. Detection is
// pure, so most tests run without a database: every threshold edge, both
// directions of the week-target check, the estimated-FTP exclusion, follow-up
// wiring (options, ordering, resolved suppression) and the plain-Dutch/no-"AI"
// copy contract. A DB scenario at the end seeds a disposable athlete and runs
// loadProfileFacts + applyProfileCorrection end-to-end, including the
// re-verification guard (a confirmation on already-consistent data writes
// nothing).
//
// Run: `pnpm --filter @workspace/api-server run test:profile-consistency`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import {
  db,
  pool,
  athleteProfilesTable,
  trainingSessionsTable,
  ftpHistoryTable,
  userProfilesTable,
  coachFollowupAnswersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  detectProfileInconsistencies,
  loadProfileFacts,
  applyProfileCorrection,
  buildFollowUps,
  buildSignals,
  deriveObservations,
  optionsFor,
  isKnownFollowUp,
  isValidFollowUpAnswer,
  type IntakeMetrics,
  type ProfileFacts,
  type SignalIntake,
} from "../engines/observation";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

async function dbScenario(name: string, fn: () => Promise<void>) {
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

function bannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bai\b/.test(lower)) return "AI";
  if (/a\.i\./.test(lower)) return "A.I.";
  return null;
}

// ── Synthetic facts builders ─────────────────────────────────────────────────

function facts(over: Partial<ProfileFacts> = {}): ProfileFacts {
  return {
    ftp: null,
    ftpEstimated: false,
    experienceLevel: null,
    weeklyHourTarget: null,
    weeklyHourTargetEstimated: false,
    ftpFloor: null,
    weeksWithRiding: 0,
    medianHours: null,
    ...over,
  };
}

const PROVEN_FLOOR: ProfileFacts["ftpFloor"] = {
  floorWatts: 250,
  sessionDate: "2026-06-20",
  durationMin: 62,
  watts: 250,
  kind: "sustained",
};

function baseMetrics(over: Partial<IntakeMetrics> = {}): IntakeMetrics {
  return {
    load: { ctl: 50, atl: 50, tsb: 0 },
    loadSessions: 12,
    readiness: { label: "unknown", score: null, basis: [] },
    risk: { level: "low", score: 0, acwr: null, reasons: [] },
    hrv: null,
    restingHr: null,
    sleep: { latest: null, avg: null, days: 0 },
    feel: { latest: null, avg: null, days: 0 },
    fatigue: { latest: null, avg: null, days: 0 },
    ftp: { trend: null, latest: null },
    feedback: { total: 0, done: 0, missed: 0, tooHard: 0, tooLight: 0, pain: 0, tired: 0 },
    races: { nextA: null, nextAny: null, count: 0 },
    nutrition: { logs: 0 },
    sessionsPerWeek: 3,
    healthStatus: "ok",
    ...over,
  };
}

function intake(over: Partial<IntakeMetrics> = {}): SignalIntake {
  const metrics = baseMetrics(over);
  return {
    clerkId: "synthetic",
    today: "2026-07-05",
    athleteName: "Renner",
    metrics,
    signals: buildSignals(metrics),
    missing: buildSignals(metrics)
      .filter((s) => s.status === "missing")
      .map((s) => s.kind),
  };
}

async function main() {
  // ── FTP lower than proven ──────────────────────────────────────────────────
  scenario("ftp_low: user-set FTP below proven floor → flagged with numbers", () => {
    const items = detectProfileInconsistencies(
      facts({ ftp: 200, ftpEstimated: false, ftpFloor: PROVEN_FLOOR }),
    );
    const hit = items.find((i) => i.id === "profile_ftp_low");
    assert(hit, "expected profile_ftp_low");
    assert(hit!.statement.includes("200"), "statement carries current FTP");
    assert(hit!.statement.includes("250"), "statement carries proven floor");
    assert(hit!.question.includes("250"), "question proposes the floor");
    assert(hit!.severity === "important", "ftp mismatch is important");
  });

  scenario("ftp_low: estimated FTP is excluded (self-heals after sync)", () => {
    const items = detectProfileInconsistencies(
      facts({ ftp: 200, ftpEstimated: true, ftpFloor: PROVEN_FLOOR }),
    );
    assert(!items.some((i) => i.id === "profile_ftp_low"), "estimated skipped");
  });

  scenario("ftp_low: within 5% tolerance → silent", () => {
    const items = detectProfileInconsistencies(
      facts({
        ftp: 240,
        ftpFloor: { ...PROVEN_FLOOR!, floorWatts: 250 },
      }),
    );
    assert(!items.some((i) => i.id === "profile_ftp_low"), "250 ≤ 240×1.05 → silent");
  });

  scenario("ftp_low: no proven floor or no FTP → silent (honest gap)", () => {
    assert(
      detectProfileInconsistencies(facts({ ftp: 200 })).length === 0,
      "no floor → nothing",
    );
    assert(
      detectProfileInconsistencies(facts({ ftpFloor: PROVEN_FLOOR })).length === 0,
      "no ftp set → nothing",
    );
    assert(detectProfileInconsistencies(null).length === 0, "null facts → nothing");
  });

  // ── Level vs real riding ───────────────────────────────────────────────────
  scenario("level_mismatch: beginner with 9h median over 5 weeks → flagged", () => {
    const items = detectProfileInconsistencies(
      facts({ experienceLevel: "beginner", medianHours: 9, weeksWithRiding: 5 }),
    );
    const hit = items.find((i) => i.id === "profile_level_mismatch");
    assert(hit, "expected profile_level_mismatch");
    assert(hit!.statement.includes("9"), "statement carries real hours");
    assert(hit!.severity === "watch", "level mismatch is watch");
  });

  scenario("level_mismatch: below thresholds → silent", () => {
    assert(
      detectProfileInconsistencies(
        facts({ experienceLevel: "beginner", medianHours: 7.5, weeksWithRiding: 6 }),
      ).length === 0,
      "7.5h stays silent",
    );
    assert(
      detectProfileInconsistencies(
        facts({ experienceLevel: "beginner", medianHours: 10, weeksWithRiding: 3 }),
      ).length === 0,
      "only 3 weeks of proof stays silent",
    );
    assert(
      detectProfileInconsistencies(
        facts({ experienceLevel: "intermediate", medianHours: 12, weeksWithRiding: 8 }),
      ).length === 0,
      "non-beginner never flagged",
    );
  });

  // ── Week target vs reality ─────────────────────────────────────────────────
  scenario("week_target_off: riding far MORE than target → flagged", () => {
    const items = detectProfileInconsistencies(
      facts({ weeklyHourTarget: 4, medianHours: 9, weeksWithRiding: 6 }),
    );
    const hit = items.find((i) => i.id === "profile_week_target_off");
    assert(hit, "expected profile_week_target_off");
    assert(hit!.statement.includes("4"), "statement carries target");
    assert(hit!.statement.includes("9"), "statement carries reality");
    assert(hit!.question.includes("9"), "question proposes reality");
  });

  scenario("week_target_off: riding far LESS than target → flagged", () => {
    const items = detectProfileInconsistencies(
      facts({ weeklyHourTarget: 10, medianHours: 3, weeksWithRiding: 5 }),
    );
    assert(
      items.some((i) => i.id === "profile_week_target_off"),
      "expected profile_week_target_off (under)",
    );
  });

  scenario("week_target_off: estimated target or small gap → silent", () => {
    assert(
      detectProfileInconsistencies(
        facts({
          weeklyHourTarget: 4,
          weeklyHourTargetEstimated: true,
          medianHours: 9,
          weeksWithRiding: 6,
        }),
      ).length === 0,
      "estimated target self-recalibrates → silent",
    );
    assert(
      detectProfileInconsistencies(
        facts({ weeklyHourTarget: 6, medianHours: 8, weeksWithRiding: 6 }),
      ).length === 0,
      "8h vs 6h target is not far → silent",
    );
    assert(
      detectProfileInconsistencies(
        facts({ weeklyHourTarget: 2, medianHours: 3.5, weeksWithRiding: 6 }),
      ).length === 0,
      "absolute gap < 2h → silent",
    );
  });

  // ── Follow-up wiring ───────────────────────────────────────────────────────
  scenario("followups: profile question raised first, with valid options", () => {
    const m = baseMetrics({
      profile: facts({ ftp: 200, ftpFloor: PROVEN_FLOOR }),
    });
    const qs = buildFollowUps(m, []);
    assert(qs.length > 0, "expected at least one follow-up");
    assert(qs[0]!.id === "profile_ftp_low", "profile question comes first");
    assert(qs[0]!.options.length === 2, "two answer options");
    assert(isKnownFollowUp("profile_ftp_low"), "known follow-up id");
    assert(
      isValidFollowUpAnswer("profile_ftp_low", "pas_aan") &&
        isValidFollowUpAnswer("profile_ftp_low", "laat_staan"),
      "both answers valid",
    );
    assert(
      !isValidFollowUpAnswer("profile_ftp_low", "iets_anders"),
      "unknown answer rejected",
    );
    assert(optionsFor("profile_level_mismatch").length === 2, "level options");
    assert(optionsFor("profile_week_target_off").length === 2, "target options");
  });

  scenario("followups: answered profile question is suppressed", () => {
    const m = baseMetrics({
      profile: facts({ ftp: 200, ftpFloor: PROVEN_FLOOR }),
    });
    const qs = buildFollowUps(m, [], new Set(["profile_ftp_low"]));
    assert(
      !qs.some((q) => q.id === "profile_ftp_low"),
      "resolved id no longer asked",
    );
  });

  // ── Observation surface ────────────────────────────────────────────────────
  scenario("observations: inconsistency becomes a named observation", () => {
    const it = intake({
      profile: facts({ ftp: 200, ftpFloor: PROVEN_FLOOR }),
    });
    const obs = deriveObservations(it, []);
    const hit = obs.find((o) => o.topic === "profile_ftp_low");
    assert(hit, "expected profile_ftp_low observation");
    assert(hit!.statement.includes("250"), "observation carries the numbers");
  });

  scenario("observations: consistent profile stays silent", () => {
    const it = intake({
      profile: facts({
        ftp: 260,
        ftpFloor: PROVEN_FLOOR,
        experienceLevel: "intermediate",
        weeklyHourTarget: 8,
        medianHours: 8,
        weeksWithRiding: 6,
      }),
    });
    const obs = deriveObservations(it, []);
    assert(
      !obs.some((o) => o.topic.startsWith("profile_")),
      "no profile observations when everything matches",
    );
  });

  // ── Copy contract ──────────────────────────────────────────────────────────
  scenario("copy: no 'AI', no narrator framing, plain Dutch", () => {
    const all = detectProfileInconsistencies(
      facts({
        ftp: 200,
        ftpFloor: PROVEN_FLOOR,
        experienceLevel: "beginner",
        medianHours: 9,
        weeksWithRiding: 6,
        weeklyHourTarget: 3,
      }),
    );
    assert(all.length === 3, `expected 3 items, got ${all.length}`);
    for (const i of all) {
      for (const text of [i.statement, i.question, i.because]) {
        const banned = bannedWord(text);
        assert(!banned, `banned word "${banned}" in: ${text}`);
        assert(!/sparki (ziet|denkt|weet|merkt|zag)/i.test(text), `narrator framing in: ${text}`);
      }
    }
    for (const id of ["profile_ftp_low", "profile_level_mismatch", "profile_week_target_off"]) {
      for (const o of optionsFor(id)) {
        const banned = bannedWord(o.label);
        assert(!banned, `banned word in option label: ${o.label}`);
      }
    }
  });

  // ── DB round-trip ──────────────────────────────────────────────────────────
  const CLERK_ID = "test_profile_consistency_user";

  async function cleanup() {
    await db.delete(coachFollowupAnswersTable).where(eq(coachFollowupAnswersTable.clerkId, CLERK_ID));
    await db.delete(ftpHistoryTable).where(eq(ftpHistoryTable.clerkId, CLERK_ID));
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, CLERK_ID));
    await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, CLERK_ID));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, CLERK_ID));
  }

  await dbScenario("db: loadProfileFacts + confirmed FTP correction", async () => {
    await cleanup();
    await ensureAccount(
      CLERK_ID,
      "profile-consistency@example.test",
      "Testrenner",
      silentLogger,
    );
    // User-set FTP of 180 while a recent 60-min ride proves ~250.
    await db
      .update(athleteProfilesTable)
      .set({ ftp: 180, ftpEstimated: false })
      .where(eq(athleteProfilesTable.clerkId, CLERK_ID));
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 10);
    const rideDate = d.toISOString().split("T")[0]!;
    await db.insert(trainingSessionsTable).values({
      clerkId: CLERK_ID,
      sessionDate: rideDate,
      durationMin: 60,
      normalizedPower: 250,
      sport: "cycling",
      source: "test",
    });

    const f = await loadProfileFacts(CLERK_ID);
    assert(f, "facts loaded");
    assert(f!.ftp === 180 && f!.ftpEstimated === false, "profile claims loaded");
    assert(f!.ftpFloor != null && f!.ftpFloor.floorWatts >= 250, `floor proven (${f!.ftpFloor?.floorWatts})`);
    const items = detectProfileInconsistencies(f);
    assert(items.some((i) => i.id === "profile_ftp_low"), "inconsistency detected from real DB data");

    // Confirmed correction: re-verifies, then writes ftp + history.
    const r = await applyProfileCorrection(CLERK_ID, "profile_ftp_low");
    assert(r.applied, `correction applied (${r.message})`);
    const [prof] = await db
      .select({ ftp: athleteProfilesTable.ftp, est: athleteProfilesTable.ftpEstimated })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, CLERK_ID));
    assert(prof!.ftp === f!.ftpFloor!.floorWatts, "ftp raised to proven floor");
    assert(prof!.est === true, "corrected ftp flagged estimated (keeps self-raising)");
    const hist = await db
      .select({ ftpWatts: ftpHistoryTable.ftpWatts, testType: ftpHistoryTable.testType })
      .from(ftpHistoryTable)
      .where(eq(ftpHistoryTable.clerkId, CLERK_ID));
    assert(
      hist.some((h) => h.testType === "derived" && h.ftpWatts === f!.ftpFloor!.floorWatts),
      "ftp_history records the correction",
    );

    // Second confirmation on now-consistent data → honest no-op.
    const again = await applyProfileCorrection(CLERK_ID, "profile_ftp_low");
    assert(!again.applied, "no blind re-write once consistent");
  });

  await dbScenario("db: cleanup", async () => {
    await cleanup();
  });

  // ── Report ─────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
