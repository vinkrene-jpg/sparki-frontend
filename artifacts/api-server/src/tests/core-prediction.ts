// Core-prediction engine — pure-compute test.
//
// The engine's forecast is deterministic over a synthetic intake + workout, so
// the bulk of these tests need no database: the load projection maths, the
// honest "no TSS, no structure" degrade, the TSS estimate from blocks, the
// monotonic now→during→end fatigue path, the confidence cap (never 1.0), the
// determining-factor availability, the predicted-vs-actual comparison and the
// "no AI / plain Dutch" copy contract.
//
// Run: `pnpm --filter @workspace/api-server run test:core-prediction`

import { buildSignals, type IntakeMetrics, type SignalIntake } from "../engines/observation";
import { computeState } from "../engines/state/compute";
import type { WorkoutStructure } from "@workspace/db";
import {
  computePrediction,
  projectLoad,
  estimateTssFromStructure,
  compareExecution,
  computeInputHash,
  RECOVERY_DAYS,
  type CorePrediction,
  type PredictWorkout,
  type InputHashWorkout,
} from "../engines/core-prediction";

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

function bannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bai\b/.test(lower)) return "AI";
  if (/a\.i\./.test(lower)) return "A.I.";
  return null;
}

// ── Synthetic intake builder (mirrors observation test) ──────────────────────
function baseMetrics(over: Partial<IntakeMetrics> = {}): IntakeMetrics {
  return {
    load: { ctl: 50, atl: 50, tsb: 0 },
    loadSessions: 10,
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
    sessionsPerWeek: null,
    healthStatus: "ok",
    ...over,
  };
}

function intake(over: Partial<IntakeMetrics> = {}): SignalIntake {
  const metrics = baseMetrics(over);
  const signals = buildSignals(metrics);
  return {
    clerkId: "synthetic",
    today: "2026-06-24",
    athleteName: "Renner",
    metrics,
    signals,
    missing: signals.filter((s) => s.status === "missing").map((s) => s.kind),
  };
}

const STRUCT: WorkoutStructure = {
  phase: "build",
  week: 2,
  intensity: "Drempel",
  primaryZone: 4,
  routeNeed: "indoor_ok",
  equipment: [],
  blocks: [
    { kind: "warmup", label: "Inrijden", durationMin: 15, zone: 2, targetPctFtp: 60 },
    { kind: "interval", label: "Drempel", durationMin: 10, zone: 4, targetPctFtp: 95, reps: 3 },
    { kind: "cooldown", label: "Uitrijden", durationMin: 10, zone: 1, targetPctFtp: 50 },
  ],
  recoveryAdvice: "rustig uitrijden",
  rationale: {
    whyToday: "x",
    supportsGoal: "x",
    whatToFeel: "x",
    tooHardSigns: "x",
    tooLightSigns: "x",
    safeAdjust: "x",
  },
};

function workout(over: Partial<PredictWorkout> = {}): PredictWorkout {
  return {
    id: 1,
    title: "Drempelblokken",
    scheduledDate: "2026-06-24",
    targetTSS: 75,
    targetDurationMin: 60,
    structure: STRUCT,
    ...over,
  };
}

function buildPrediction(
  metricsOver: Partial<IntakeMetrics> = {},
  workoutOver: Partial<PredictWorkout> = {},
): CorePrediction {
  const intk = intake(metricsOver);
  const currentState = computeState(intk);
  return computePrediction({
    today: intk.today,
    athleteName: intk.athleteName,
    metrics: intk.metrics,
    signals: intk.signals,
    missing: intk.missing,
    currentState,
    workout: workout(workoutOver),
  });
}

function main() {
  // ── projectLoad maths ────────────────────────────────────────────────────
  scenario("projectLoad: a stimulus raises ATL more than CTL", () => {
    const out = projectLoad({ ctl: 50, atl: 50, tsb: 0 }, 100, 0);
    assert(out.atl > 50 && out.ctl > 50, `atl ${out.atl} ctl ${out.ctl}`);
    assert(out.atl > out.ctl, "ATL should rise faster than CTL");
    assert(out.tsb < 0, `tsb ${out.tsb} should drop (more fatigue)`);
  });
  scenario("projectLoad: rest days rebound TSB upward", () => {
    const end = projectLoad({ ctl: 50, atl: 50, tsb: 0 }, 100, 0);
    const rebound = projectLoad({ ctl: 50, atl: 50, tsb: 0 }, 100, RECOVERY_DAYS);
    assert(rebound.tsb > end.tsb, `rebound ${rebound.tsb} not > end ${end.tsb}`);
    assert(rebound.atl < end.atl, "ATL should decay during rest");
  });
  scenario("projectLoad: zero stimulus + rest decays load", () => {
    const out = projectLoad({ ctl: 60, atl: 60, tsb: 0 }, 0, 3);
    assert(out.atl < 60 && out.ctl < 60, "load should decay toward zero");
  });

  // ── TSS estimate from structure ──────────────────────────────────────────
  scenario("estimateTss: returns a positive number from blocks", () => {
    const t = estimateTssFromStructure(STRUCT);
    assert(t != null && t > 0, `got ${t}`);
  });
  scenario("estimateTss: honest null with no blocks", () => {
    assert(estimateTssFromStructure(null) == null, "null structure → null");
    assert(
      estimateTssFromStructure({ ...STRUCT, blocks: [] }) == null,
      "empty blocks → null",
    );
  });
  scenario("estimateTss: harder blocks → more TSS", () => {
    const easy = estimateTssFromStructure({
      ...STRUCT,
      blocks: [{ kind: "steady", label: "Z2", durationMin: 60, zone: 2, targetPctFtp: 65 }],
    })!;
    const hard = estimateTssFromStructure({
      ...STRUCT,
      blocks: [{ kind: "interval", label: "Z5", durationMin: 60, zone: 5, targetPctFtp: 110 }],
    })!;
    assert(hard > easy, `hard ${hard} not > easy ${easy}`);
  });

  // ── Frames: monotonic fatigue path ───────────────────────────────────────
  scenario("frames: now/during/end/recovery present when predictable", () => {
    const p = buildPrediction();
    assert(p.predictable, "should be predictable");
    assert(p.frames.length === 4, `got ${p.frames.length} frames`);
    assert(
      p.frames.map((f) => f.phase).join(",") === "now,during,end,recovery",
      "frame order wrong",
    );
  });
  scenario("frames: fatigue deepens now→during→end (TSB falls)", () => {
    const p = buildPrediction();
    const now = p.frames[0]!.load.tsb;
    const during = p.frames[1]!.load.tsb;
    const end = p.frames[2]!.load.tsb;
    assert(now >= during && during >= end, `tsb path ${now}/${during}/${end}`);
  });
  scenario("frames: recovery rebounds above end", () => {
    const p = buildPrediction();
    const end = p.frames[2]!.load.tsb;
    const rec = p.frames[3]!.load.tsb;
    assert(rec > end, `recovery ${rec} not > end ${end}`);
  });

  // ── Confidence is never 1.0 ──────────────────────────────────────────────
  scenario("confidence: never reaches 1.0 even with full data", () => {
    const p = buildPrediction({
      loadSessions: 30,
      readiness: { label: "fresh", score: 90, basis: [] },
    });
    assert(p.confidence < 1, `confidence ${p.confidence}`);
    assert(p.confidence <= 0.85, `confidence ${p.confidence} exceeded 0.85 cap`);
    for (const f of p.frames) assert(f.confidence < 1, `frame ${f.phase} conf ${f.confidence}`);
  });
  scenario("confidence: estimated TSS lowers confidence vs planned", () => {
    const planned = buildPrediction({ loadSessions: 30 });
    const estimated = buildPrediction({ loadSessions: 30 }, { targetTSS: null });
    assert(
      estimated.confidence < planned.confidence,
      `estimated ${estimated.confidence} not < planned ${planned.confidence}`,
    );
  });

  // ── Honest degrade: no TSS, no structure ─────────────────────────────────
  scenario("degrade: no TSS + no structure → not predictable, only now frame", () => {
    const p = buildPrediction({}, { targetTSS: null, structure: null });
    assert(!p.predictable, "should not be predictable");
    assert(p.frames.length === 1 && p.frames[0]!.phase === "now", "should keep only now");
    assert(p.tss === null, "tss should be null");
    assert(p.tssBasis === "missing", "tssBasis should be missing");
  });
  scenario("degrade: no targetTSS but structure → estimated basis", () => {
    const p = buildPrediction({}, { targetTSS: null });
    assert(p.predictable, "estimable from structure");
    assert(p.tssBasis === "estimated", `basis ${p.tssBasis}`);
    assert(p.tss != null && p.tss > 0, "estimated tss present");
  });

  // ── Determining factors carry honest availability ────────────────────────
  scenario("factors: missing channels reported as missing", () => {
    const p = buildPrediction(); // no hrv/sleep/checkin
    const rec = p.factors.find((f) => f.key === "recovery_signals")!;
    const sleep = p.factors.find((f) => f.key === "sleep")!;
    const readiness = p.factors.find((f) => f.key === "readiness")!;
    assert(rec.availability === "missing", "recovery should be missing");
    assert(sleep.availability === "missing", "sleep should be missing");
    assert(readiness.availability === "missing", "readiness should be missing");
    assert(rec.impact === "", "missing factor must not claim impact");
  });
  scenario("factors: every pre-known domain is listed (honest coverage)", () => {
    const p = buildPrediction(); // minimal data — most channels missing
    const keys = p.factors.map((f) => f.key);
    for (const k of [
      "planned_load",
      "load_base",
      "readiness",
      "health",
      "structure",
      "recovery_signals",
      "sleep",
      "subjective",
      "power_dev",
      "nutrition",
      "race_calendar",
      "weather",
      "route_profile",
    ]) {
      assert(keys.includes(k), `factor "${k}" must be present in coverage`);
    }
    // Unwired channels are honestly missing, never silently dropped.
    assert(
      p.factors.find((f) => f.key === "weather")!.availability === "missing",
      "weather is an honest gap",
    );
    assert(
      p.factors.find((f) => f.key === "route_profile")!.availability === "missing",
      "route profile is an honest gap",
    );
  });
  scenario("factors: present channels reported as present", () => {
    const p = buildPrediction({
      readiness: { label: "fresh", score: 88, basis: [] },
      sleep: { latest: 8, avg: 8, days: 7 },
    });
    assert(p.factors.find((f) => f.key === "readiness")!.availability === "present", "readiness present");
    assert(p.factors.find((f) => f.key === "sleep")!.availability === "present", "sleep present");
    assert(p.factors.find((f) => f.key === "planned_load")!.availability === "present", "planned load present");
  });

  // ── Comparison: predicted vs actual ──────────────────────────────────────
  scenario("compare: harder-than-planned session deepens fatigue note", () => {
    const p = buildPrediction({ loadSessions: 30 });
    const cmp = compareExecution(
      p,
      { tss: 120, durationMin: 70, feelScore: null, sessionDate: "2026-06-24" },
      {
        x: 0.4,
        y: 0.6,
        tsb: -10,
        band: "wisselend",
        tension: 0.5,
        distortion: 0.3,
        movement: { direction: "stabiel", label: "" },
      },
      "present",
      120,
      computeState(intake({ loadSessions: 30 })),
      "2026-06-24",
    );
    assert(cmp.executed, "executed");
    assert(cmp.actualTss === 120 && cmp.plannedTss === p.tss, "tss recorded");
    assert(cmp.actualTssBasis === "present", "basis is present with real tss");
    assert(
      cmp.deviations.some((d) => /dieper in vermoeidheid/.test(d)),
      "should note deeper fatigue",
    );
  });
  scenario("compare: actual path renders start + end + recovery", () => {
    const p = buildPrediction({ loadSessions: 30 });
    const cmp = compareExecution(
      p,
      { tss: 75, durationMin: 60, feelScore: null, sessionDate: "2026-06-24" },
      {
        x: 0.5,
        y: 0.5,
        tsb: -5,
        band: "solide",
        tension: 0.4,
        distortion: 0.2,
        movement: { direction: "stabiel", label: "" },
      },
      "present",
      75,
      computeState(intake({ loadSessions: 30 })),
      "2026-06-25", // recovery still pending
    );
    assert(cmp.actualPath.length === 3, "start + end + recovery frames");
    const start = cmp.actualPath.find((f) => f.phase === "start")!;
    const end = cmp.actualPath.find((f) => f.phase === "end")!;
    const rec = cmp.actualPath.find((f) => f.phase === "recovery")!;
    assert(start.status === "measured" && start.x != null, "start measured");
    assert(end.status === "measured" && end.band === "solide", "end measured");
    assert(rec.status === "pending" && rec.x === null, "recovery pending");
  });
  scenario("compare: coarse start→end estimate from duration when TSS missing", () => {
    const p = buildPrediction({ loadSessions: 30 });
    // Facade-style coarse estimate (~ (90/60)*0.49*100 ≈ 74) keeps end available.
    const coarse = 74;
    const cmp = compareExecution(
      p,
      { tss: null, durationMin: 90, feelScore: null, sessionDate: "2026-06-24" },
      {
        x: 0.45,
        y: 0.55,
        tsb: -8,
        band: "wisselend",
        tension: 0.5,
        distortion: 0.3,
        movement: { direction: "stabiel", label: "" },
      },
      "estimated",
      coarse,
      computeState(intake({ loadSessions: 30 })),
      "2026-06-24",
    );
    assert(cmp.actualTssBasis === "estimated", "basis is estimated");
    const end = cmp.actualPath.find((f) => f.phase === "end")!;
    assert(end.status === "estimated" && end.x != null, "end available, marked estimated");
    assert(
      cmp.deviations.some((d) => /grof schatte|grof geschat|uit de duur/.test(d)),
      "should disclose the coarse estimate",
    );
  });
  scenario("compare: missing actual load is honest, not fabricated", () => {
    const p = buildPrediction({ loadSessions: 30 });
    const cmp = compareExecution(
      p,
      { tss: null, durationMin: null, feelScore: null, sessionDate: "2026-06-24" },
      null,
      "missing",
      null,
      computeState(intake({ loadSessions: 30 })),
      "2026-06-24",
    );
    assert(cmp.actualEnd === null, "no actual end without any load");
    assert(
      cmp.deviations.some((d) => /geen belasting én geen duur/.test(d)),
      "should be honest about missing load",
    );
  });
  scenario("compare: rebound pending until enough days pass", () => {
    const p = buildPrediction({ loadSessions: 30 });
    const cmp = compareExecution(
      p,
      { tss: 75, durationMin: 60, feelScore: null, sessionDate: "2026-06-24" },
      {
        x: 0.5,
        y: 0.5,
        tsb: -5,
        band: "solide",
        tension: 0.4,
        distortion: 0.2,
        movement: { direction: "stabiel", label: "" },
      },
      "present",
      75,
      computeState(intake({ loadSessions: 30 })),
      "2026-06-25", // 1 day < RECOVERY_DAYS
    );
    assert(cmp.reboundStatus === "pending", "rebound should be pending after 1 day");
  });

  // ── Copy contract: plain Dutch, no "AI" ──────────────────────────────────
  scenario("copy: no 'AI' wording anywhere in a prediction", () => {
    const p = buildPrediction({
      readiness: { label: "tired", score: 40, basis: [] },
    });
    const strings: string[] = [p.headline, p.summary, p.confidenceLabel];
    for (const f of p.frames) strings.push(f.label, f.caption, f.movement.label);
    for (const fa of p.factors) strings.push(fa.label, fa.reading, fa.impact);
    for (const s of strings) {
      const bad = bannedWord(s);
      assert(bad === null, `banned word "${bad}" in: ${s}`);
    }
  });
  scenario("copy: unpredictable state explains the gap in plain Dutch", () => {
    const p = buildPrediction({}, { targetTSS: null, structure: null });
    assert(/Het effect is nog niet te voorspellen/.test(p.headline), "honest headline");
    assert(p.summary.length > 0 && bannedWord(p.summary) === null, "honest summary");
  });

  // ── Snapshot fingerprint (computeInputHash) ──────────────────────────────
  // The immutability contract: while a workout is upcoming, recompute ONLY when a
  // pre-known input changes. The fingerprint must therefore move on EVERY input
  // that drives the forecast or a factor, and stay put on volatile/irrelevant
  // fields. These pure-function tests assert that contract without a database.
  const hashWorkout = (over: Partial<InputHashWorkout> = {}): InputHashWorkout => ({
    targetTSS: 75,
    targetDurationMin: 60,
    scheduledDate: "2026-06-24",
    type: "ride",
    structure: STRUCT,
    ...over,
  });
  const baseHash = () => computeInputHash(intake(), hashWorkout());

  scenario("hash: identical inputs produce the same fingerprint", () => {
    assert(baseHash() === baseHash(), "hash must be deterministic");
  });

  // Each pre-known signal that moves the prediction/factors must change the hash.
  const changes: { name: string; intake?: Partial<IntakeMetrics>; workout?: Partial<InputHashWorkout> }[] = [
    { name: "sleep", intake: { sleep: { latest: 6, avg: 6.5, days: 7 } } },
    { name: "HRV", intake: { hrv: { direction: "falling", first: 65, last: 55, delta: -10, days: 7 } } },
    { name: "resting HR", intake: { restingHr: { direction: "rising", first: 45, last: 50, delta: 5, days: 7 } } },
    { name: "feel", intake: { feel: { latest: 2, avg: 2.5, days: 5 } } },
    { name: "fatigue", intake: { fatigue: { latest: 4, avg: 3.5, days: 5 } } },
    { name: "FTP trend", intake: { ftp: { trend: { direction: "rising", first: 260, last: 280, delta: 20, days: 30 }, latest: 280 } } },
    { name: "nutrition", intake: { nutrition: { logs: 3 } } },
    { name: "readiness", intake: { readiness: { label: "tired", score: 35, basis: [] } } },
    { name: "health", intake: { healthStatus: "warn" } },
    { name: "load base", intake: { load: { ctl: 55, atl: 70, tsb: -15 } } },
    { name: "race context", intake: { races: { nextA: { name: "Ronde", date: "2026-06-30", daysUntil: 5 }, nextAny: null, count: 1 } } },
    { name: "target TSS", workout: { targetTSS: 120 } },
    { name: "duration", workout: { targetDurationMin: 90 } },
    { name: "date", workout: { scheduledDate: "2026-06-26" } },
    { name: "workout type", workout: { type: "race" } },
  ];
  for (const c of changes) {
    scenario(`hash: changing ${c.name} supersedes the snapshot`, () => {
      const after = computeInputHash(intake(c.intake ?? {}), hashWorkout(c.workout ?? {}));
      assert(after !== baseHash(), `${c.name} change must alter the fingerprint`);
    });
  }

  scenario("hash: deep structure (block %FTP/duration/reps) changes the fingerprint", () => {
    const deeper: WorkoutStructure = {
      ...STRUCT,
      blocks: STRUCT.blocks.map((b, i) =>
        i === 1 ? { ...b, durationMin: 20, targetPctFtp: 105, reps: 5 } : b,
      ),
    };
    const after = computeInputHash(intake(), hashWorkout({ structure: deeper }));
    assert(after !== baseHash(), "deep structure edit must alter the fingerprint");
  });

  scenario("hash: signal availability flip changes the fingerprint", () => {
    // Same numbers absent vs present: providing sleep flips its signal status,
    // which must register even though the rest is identical.
    const withSleep = computeInputHash(intake({ sleep: { latest: 8, avg: 8, days: 7 } }), hashWorkout());
    assert(withSleep !== baseHash(), "availability change must alter the fingerprint");
  });

  scenario("hash: volatile/irrelevant fields do NOT change the fingerprint", () => {
    // athleteName is not a prediction input; the hash must ignore it.
    const a = intake();
    const b = { ...intake(), athleteName: "Iemand Anders" };
    assert(
      computeInputHash(a, hashWorkout()) === computeInputHash(b, hashWorkout()),
      "athleteName must not affect the fingerprint",
    );
  });

  // ── Report ────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    const tag = r.status === "pass" ? "PASS" : "FAIL";
    console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) process.exit(1);
}

main();
