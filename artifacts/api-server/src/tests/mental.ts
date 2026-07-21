// Mentale Weerbaarheid engine test: deterministic pure functions.
//
// Locks in the honesty contract of the Mentale Weerbaarheid engine surfaced on
// Lab and Lichaam: insufficient-state honesty below the minimum, correct score
// bounds + capped confidence, ≥2-occurrence pattern gating, honest week nulls on
// thin weeks, and honest debrief facts. All pure — no database rows are written;
// inputs are seeded as in-memory planned workouts + sessions + feedback.
//
// Run: `pnpm --filter @workspace/api-server run test:mental`
// Exits non-zero on any failure.

import {
  buildWorkoutFacts,
  computeMentalOverview,
  buildDebrief,
} from "../engines/mental";
import type {
  PlannedWorkout,
  TrainingSession,
  WorkoutFeedback,
} from "@workspace/db";
import { pool } from "@workspace/db";

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

// Local-date offset, matching the engine's local (not UTC) date handling.
function isoInDays(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const TODAY = isoInDays(0);

let nextId = 1;

function workout(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  const id = overrides.id ?? nextId++;
  return {
    id,
    clerkId: "test",
    scheduledDate: isoInDays(-3),
    type: "ride",
    title: "Testtraining",
    description: null,
    targetDurationMin: 60,
    targetTSS: 50,
    structure: null,
    status: "planned",
    source: "sparki",
    sessionId: null,
    planId: null,
    routeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PlannedWorkout;
}

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: nextId++,
    clerkId: "test",
    sessionDate: isoInDays(-3),
    type: "ride",
    title: "Rit",
    durationMin: 60,
    distanceKm: null,
    elevationM: null,
    normalizedPower: null,
    avgPower: null,
    avgHR: null,
    tss: null,
    intensityFactor: null,
    notes: null,
    feelScore: null,
    sport: "cycling",
    avgCadence: null,
    avgSpeedKph: null,
    maxHR: null,
    source: "manual",
    externalRef: null,
    dedupeKey: null,
    sources: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as TrainingSession;
}

function feedback(
  workoutId: number,
  feedbackType: WorkoutFeedback["feedbackType"],
): WorkoutFeedback {
  return {
    id: nextId++,
    clerkId: "test",
    workoutId,
    feedbackType,
    note: null,
    createdAt: new Date(),
  } as WorkoutFeedback;
}

// Build a "done" workout linked to a session of `actualMin` minutes.
function doneWorkout(dayOffset: number, targetMin = 60, actualMin = 60, over: Partial<PlannedWorkout> = {}) {
  const s = session({ sessionDate: isoInDays(dayOffset), durationMin: actualMin });
  const w = workout({
    scheduledDate: isoInDays(dayOffset),
    targetDurationMin: targetMin,
    status: "done",
    sessionId: s.id,
    ...over,
  });
  return { w, s };
}

async function main() {
  // ── Insufficient-state honesty ──────────────────────────────────────────────
  await scenario("insufficient: below MIN_PLANNED_FOR_SCORE → state insufficient, null score", () => {
    const parts = [doneWorkout(-2), doneWorkout(-5), doneWorkout(-9)]; // 3 < 4
    const ws = parts.map((p) => p.w);
    const ss = parts.map((p) => p.s);
    const facts = buildWorkoutFacts(ws, ss, [], TODAY);
    const o = computeMentalOverview(facts, TODAY);
    assert(o.state === "insufficient", `state ${o.state} !== insufficient`);
    assert(o.score === null, "score must be null when insufficient");
    assert(o.confidence === null, "confidence must be null when insufficient");
    assert(o.patterns.length === 0, "no patterns when insufficient");
    assert(typeof o.reason === "string" && o.reason.length > 0, "honest reason required");
  });

  // ── Score bounds + capped confidence ───────────────────────────────────────
  await scenario("ok: score within 0-100 and confidence capped ≤0.9", () => {
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push(doneWorkout(-2 - i * 2)); // 8 completed within 28d
    const ws = parts.map((p) => p.w);
    const ss = parts.map((p) => p.s);
    const facts = buildWorkoutFacts(ws, ss, [], TODAY);
    const o = computeMentalOverview(facts, TODAY);
    assert(o.state === "ok", `state ${o.state} !== ok`);
    assert(o.score != null && o.score >= 0 && o.score <= 100, `score ${o.score} out of bounds`);
    assert(o.confidence != null && o.confidence > 0 && o.confidence <= 0.9, `confidence ${o.confidence} not capped`);
    assert(o.plannedCount === 8, `plannedCount ${o.plannedCount} !== 8`);
    assert(o.completedCount === 8, `completedCount ${o.completedCount} !== 8`);
  });

  await scenario("ok: all-completed score is higher than half-missed score", () => {
    const perfect = [];
    for (let i = 0; i < 6; i++) perfect.push(doneWorkout(-2 - i * 2));
    const perfectO = computeMentalOverview(
      buildWorkoutFacts(perfect.map((p) => p.w), perfect.map((p) => p.s), [], TODAY),
      TODAY,
    );
    // 6 planned, 3 missed (past, no session), 3 done.
    const mixedDone = [doneWorkout(-2), doneWorkout(-4), doneWorkout(-6)];
    const mixedMissed = [workout({ scheduledDate: isoInDays(-8) }), workout({ scheduledDate: isoInDays(-10) }), workout({ scheduledDate: isoInDays(-12) })];
    const mixedO = computeMentalOverview(
      buildWorkoutFacts([...mixedDone.map((p) => p.w), ...mixedMissed], mixedDone.map((p) => p.s), [], TODAY),
      TODAY,
    );
    assert(perfectO.score! > mixedO.score!, `perfect ${perfectO.score} must beat mixed ${mixedO.score}`);
  });

  // ── Pattern ≥2-occurrence gating ───────────────────────────────────────────
  await scenario("pattern gating: 1 missed → no 'uitstellen' pattern", () => {
    const done = [];
    for (let i = 0; i < 5; i++) done.push(doneWorkout(-2 - i * 2));
    const missed = [workout({ scheduledDate: isoInDays(-14) })]; // 1 missed
    const facts = buildWorkoutFacts([...done.map((p) => p.w), ...missed], done.map((p) => p.s), [], TODAY);
    const o = computeMentalOverview(facts, TODAY);
    assert(o.state === "ok", `state ${o.state}`);
    assert(!o.patterns.some((p) => p.key === "uitstellen"), "1 occurrence must not surface a pattern");
  });

  await scenario("pattern gating: 2 missed → 'uitstellen' pattern with real occurrences", () => {
    const done = [];
    for (let i = 0; i < 4; i++) done.push(doneWorkout(-2 - i * 2));
    const missed = [workout({ scheduledDate: isoInDays(-14) }), workout({ scheduledDate: isoInDays(-16) })];
    const facts = buildWorkoutFacts([...done.map((p) => p.w), ...missed], done.map((p) => p.s), [], TODAY);
    const o = computeMentalOverview(facts, TODAY);
    const p = o.patterns.find((x) => x.key === "uitstellen");
    assert(p, "expected 'uitstellen' pattern at 2 occurrences");
    assert(p!.occurrences === 2, `occurrences ${p!.occurrences} !== 2`);
    assert(o.riskFactors.length > 0 && o.advice.length > 0, "pattern must yield risk + advice");
  });

  await scenario("pattern gating: 2 shortened rides → 'inkorten' pattern", () => {
    const short = [doneWorkout(-2, 60, 20), doneWorkout(-4, 60, 20)]; // <75% of target
    const full = [];
    for (let i = 0; i < 3; i++) full.push(doneWorkout(-6 - i * 2));
    const facts = buildWorkoutFacts([...short, ...full].map((p) => p.w), [...short, ...full].map((p) => p.s), [], TODAY);
    const o = computeMentalOverview(facts, TODAY);
    const p = o.patterns.find((x) => x.key === "inkorten");
    assert(p && p.occurrences === 2, `expected inkorten with 2 occurrences, got ${p?.occurrences}`);
  });

  // ── Feedback-driven classification & patterns ──────────────────────────────
  await scenario("feedback: 'done' feedback (no session row) counts as completed", () => {
    const ws = [];
    const fb: WorkoutFeedback[] = [];
    for (let i = 0; i < 4; i++) {
      const w = workout({ scheduledDate: isoInDays(-2 - i * 2) });
      ws.push(w);
      fb.push(feedback(w.id, "done"));
    }
    const facts = buildWorkoutFacts(ws, [], fb, TODAY);
    assert(facts.every((f) => f.completed), "'done' feedback must mark completed");
    const o = computeMentalOverview(facts, TODAY);
    assert(o.state === "ok", `state ${o.state}`);
    assert(o.completedCount === 4, `completedCount ${o.completedCount} !== 4 via feedback`);
  });

  await scenario("feedback: 2× 'move' → 'uitstellen' pattern with occurrences 2", () => {
    const done = [];
    for (let i = 0; i < 4; i++) done.push(doneWorkout(-2 - i * 2));
    const moved = [workout({ scheduledDate: isoInDays(-3) }), workout({ scheduledDate: isoInDays(-5) })];
    const fb = [feedback(moved[0]!.id, "move"), feedback(moved[1]!.id, "move")];
    const facts = buildWorkoutFacts(
      [...done.map((p) => p.w), ...moved],
      done.map((p) => p.s),
      fb,
      TODAY,
    );
    const p = computeMentalOverview(facts, TODAY).patterns.find((x) => x.key === "uitstellen");
    assert(p && p.occurrences === 2, `expected uitstellen(2) from 'move' feedback, got ${p?.occurrences}`);
  });

  await scenario("feedback: 'too_hard'/'tired' on ≥2 rides → 'afbreken' pattern", () => {
    const done = [];
    for (let i = 0; i < 3; i++) done.push(doneWorkout(-2 - i * 2));
    const hard = [doneWorkout(-9), doneWorkout(-11)]; // completed rides marked too heavy
    const fb = [feedback(hard[0]!.w.id, "too_hard"), feedback(hard[1]!.w.id, "tired")];
    const facts = buildWorkoutFacts(
      [...done, ...hard].map((p) => p.w),
      [...done, ...hard].map((p) => p.s),
      fb,
      TODAY,
    );
    const p = computeMentalOverview(facts, TODAY).patterns.find((x) => x.key === "afbreken");
    assert(p && p.occurrences === 2, `expected afbreken(2) from too_hard/tired, got ${p?.occurrences}`);
  });

  await scenario("feedback: 1× 'too_hard' → NO 'afbreken' pattern (gating holds)", () => {
    const done = [];
    for (let i = 0; i < 4; i++) done.push(doneWorkout(-2 - i * 2));
    const hard = doneWorkout(-11);
    const fb = [feedback(hard.w.id, "too_hard")];
    const facts = buildWorkoutFacts(
      [...done, hard].map((p) => p.w),
      [...done, hard].map((p) => p.s),
      fb,
      TODAY,
    );
    assert(
      !computeMentalOverview(facts, TODAY).patterns.some((x) => x.key === "afbreken"),
      "single too_hard must not surface afbreken",
    );
  });

  // ── Honest week nulls on thin weeks ────────────────────────────────────────
  await scenario("weeks: a single-workout week has a null score; a filled week does not", () => {
    // Lone workout ~5 weeks back (its own week, planned=1 → null), plus a recent
    // week with ≥2 completed (score non-null). Enough total for score to compute.
    const lone = doneWorkout(-35);
    const recent = [];
    for (let i = 0; i < 5; i++) recent.push(doneWorkout(-2 - i)); // clustered recent days
    const all = [lone, ...recent];
    const facts = buildWorkoutFacts(all.map((p) => p.w), all.map((p) => p.s), [], TODAY);
    const o = computeMentalOverview(facts, TODAY);
    assert(o.weeks.some((w) => w.planned === 1 && w.score === null), "thin week must have null score");
    assert(o.weeks.some((w) => w.planned >= 2 && w.score !== null), "filled week must have a score");
  });

  // ── Debrief honesty (real numbers only) ────────────────────────────────────
  await scenario("debrief: shortened ride → outcome 'ingekort' with real planned vs actual", () => {
    const { w, s } = doneWorkout(-1, 60, 30);
    const facts = buildWorkoutFacts([w], [s], [], TODAY);
    const d = buildDebrief(facts);
    assert(d, "expected a debrief");
    assert(d!.outcome === "ingekort", `outcome ${d!.outcome} !== ingekort`);
    assert(d!.facts.includes("60") && d!.facts.includes("30"), `facts must state planned+actual: ${d!.facts}`);
  });

  await scenario("debrief: missed past workout → outcome 'gemist', honest fact line", () => {
    const w = workout({ scheduledDate: isoInDays(-1) }); // past, no session
    const facts = buildWorkoutFacts([w], [], [], TODAY);
    const d = buildDebrief(facts);
    assert(d && d.outcome === "gemist", `outcome ${d?.outcome} !== gemist`);
  });

  await scenario("debrief: no past workouts → null (never fabricated)", () => {
    const w = workout({ scheduledDate: isoInDays(3) }); // future only
    const facts = buildWorkoutFacts([w], [], [], TODAY);
    assert(buildDebrief(facts) === null, "future-only must yield no debrief");
  });

  // ── Report ─────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✓" : "✗"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  await pool.end().catch(() => {});
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
