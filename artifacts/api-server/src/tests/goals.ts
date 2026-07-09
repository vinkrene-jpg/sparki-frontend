// Doelen-engine test: deterministic pure functions of the goals engine.
//
// Covers: progress judgement (judgeProgress), the doorvraagladder
// (nextGoalQuestion), monthly proposal candidates incl. the nutrition path
// (buildProposalCandidates), accepted-proposal goal patches (deriveGoalPatch)
// and steering directives from accepted proposals (directivesFromProposals).
// All pure — no database rows are written.
//
// Run: `pnpm --filter @workspace/api-server run test:goals`
// Exits non-zero on any failure.

import {
  judgeProgress,
  nextGoalQuestion,
  buildProposalCandidates,
  deriveGoalPatch,
  directivesFromProposals,
  type MeasureContext,
  type GoalWithProgress,
  type DerivedGoal,
} from "../lib/goals";
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

function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0]!;
}

const TODAY = new Date().toISOString().split("T")[0]!;

function ctx(overrides: Partial<MeasureContext> = {}): MeasureContext {
  return {
    load: { ctl: 40, atl: 40, tsb: 0 },
    prevLoad: { ctl: 40, atl: 40, tsb: 0 },
    doneCount14: 5,
    plannedCount14: 6,
    healthStatus: "ok",
    todayIso: TODAY,
    ...overrides,
  };
}

function goalRow(
  overrides: Partial<GoalWithProgress> = {},
): GoalWithProgress {
  return {
    id: 1,
    clerkId: "test",
    title: "Testdoel",
    horizon: "season",
    priority: 1,
    targetDate: isoInDays(120),
    measure: "meetlat",
    status: "active",
    statusReason: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    progress: {
      verdict: "op_koers",
      reasons: [],
      gaps: [],
      daysToTarget: 120,
    },
    ...overrides,
  } as GoalWithProgress;
}

async function main() {
  // ── judgeProgress ──────────────────────────────────────────────────────────
  await scenario("judgeProgress: healthy + executing + rising CTL = op_koers", () => {
    const p = judgeProgress(
      ctx({ load: { ctl: 45, atl: 40, tsb: 5 }, prevLoad: { ctl: 40, atl: 40, tsb: 0 } }),
      isoInDays(100),
      "meetlat",
    );
    assert(p.verdict === "op_koers", `verdict ${p.verdict} !== op_koers`);
  });

  await scenario("judgeProgress: injured + falling CTL = risico", () => {
    const p = judgeProgress(
      ctx({
        healthStatus: "injured",
        load: { ctl: 30, atl: 20, tsb: 10 },
        prevLoad: { ctl: 40, atl: 40, tsb: 0 },
        doneCount14: 1,
        plannedCount14: 6,
      }),
      isoInDays(100),
      null,
    );
    assert(p.verdict === "risico", `verdict ${p.verdict} !== risico`);
  });

  await scenario("judgeProgress: no data at all = niet_meetbaar with honest gaps", () => {
    const p = judgeProgress(
      ctx({
        load: { ctl: 0, atl: 0, tsb: 0 },
        prevLoad: { ctl: 0, atl: 0, tsb: 0 },
        doneCount14: 0,
        plannedCount14: 0,
      }),
      null,
      null,
    );
    assert(p.verdict === "niet_meetbaar", `verdict ${p.verdict} !== niet_meetbaar`);
    assert(p.gaps.length >= 2, "expected honest gaps listed");
  });

  await scenario("judgeProgress: deadline pressure worsens a negative trend", () => {
    const near = judgeProgress(
      ctx({
        load: { ctl: 30, atl: 30, tsb: 0 },
        prevLoad: { ctl: 40, atl: 40, tsb: 0 },
        doneCount14: 5,
        plannedCount14: 6,
      }),
      isoInDays(20),
      "meetlat",
    );
    // −1 (ctl) +1 (execution) = 0 → aandacht; deadline only bites when score<0.
    assert(near.verdict === "aandacht", `verdict ${near.verdict} !== aandacht`);
  });

  // ── nextGoalQuestion (doorvraagladder) ────────────────────────────────────
  await scenario("question ladder: injury + nearby deadline asks feasibility first", () => {
    const g = goalRow({
      progress: { verdict: "risico", reasons: [], gaps: [], daysToTarget: 60 },
    });
    const q = nextGoalQuestion([g], [], "injured");
    assert(q && q.key.startsWith("injury_feasible:"), `key ${q?.key}`);
    assert(q!.goalId === g.id, "question must target the goal");
  });

  await scenario("question ladder: no main goal + derived context asks confirm_main", () => {
    const derived: DerivedGoal[] = [
      {
        derivedId: "race:1",
        source: "race",
        title: "A-wedstrijd: Test GP",
        targetDate: isoInDays(60),
        detail: null,
        priority: 1,
        progress: { verdict: "aandacht", reasons: [], gaps: [], daysToTarget: 60 },
      },
    ];
    const q = nextGoalQuestion([], derived, "ok");
    assert(q?.key === "confirm_main", `key ${q?.key} !== confirm_main`);
  });

  await scenario("question ladder: missing date → ask_date; missing measure → ask_measure", () => {
    const noDate = goalRow({ id: 2, targetDate: null });
    let q = nextGoalQuestion([noDate], [], "ok");
    assert(q?.key === `ask_date:${noDate.id}`, `key ${q?.key}`);
    const noMeasure = goalRow({ id: 3, measure: null });
    q = nextGoalQuestion([noMeasure], [], "ok");
    assert(q?.key === `ask_measure:${noMeasure.id}`, `key ${q?.key}`);
  });

  await scenario("question ladder: complete picture asks nothing", () => {
    const q = nextGoalQuestion([goalRow()], [], "ok");
    assert(q === null, `expected null, got ${q?.key}`);
  });

  // ── buildProposalCandidates ────────────────────────────────────────────────
  await scenario("candidates: injured risk goal → recovery + date shift", () => {
    const c = buildProposalCandidates(
      ctx({
        healthStatus: "injured",
        load: { ctl: 30, atl: 20, tsb: 10 },
        prevLoad: { ctl: 40, atl: 40, tsb: 0 },
        doneCount14: 1,
        plannedCount14: 6,
      }),
      [{ id: 7, title: "Doel X", targetDate: isoInDays(60), measure: null }],
    );
    const kinds = c.map((x) => x.kind);
    assert(kinds.includes("recovery"), `kinds ${kinds} missing recovery`);
    assert(kinds.includes("goal_adjust"), `kinds ${kinds} missing goal_adjust`);
    const adjust = c.find((x) => x.kind === "goal_adjust")!;
    const change = adjust.proposedChange as { targetDate?: string };
    assert(
      typeof change.targetDate === "string" && change.targetDate > isoInDays(60),
      "date shift must move the target date later",
    );
  });

  await scenario("candidates: healthy but under-executing risk → load verlagen", () => {
    const c = buildProposalCandidates(
      ctx({
        load: { ctl: 30, atl: 30, tsb: 0 },
        prevLoad: { ctl: 40, atl: 40, tsb: 0 },
        doneCount14: 1,
        plannedCount14: 6,
      }),
      [{ id: 8, title: "Doel Y", targetDate: isoInDays(30), measure: null }],
    );
    const load = c.find((x) => x.kind === "load");
    assert(load, "expected a load proposal");
    assert(
      (load!.proposedChange as { weeklyLoad?: string }).weeklyLoad === "verlagen",
      "expected weeklyLoad verlagen",
    );
  });

  await scenario("candidates: nutrition proposal near peak with low execution", () => {
    const c = buildProposalCandidates(
      ctx({ doneCount14: 1, plannedCount14: 6 }),
      [],
      { seasonGoal: { peakDate: isoInDays(45), targetWeightKg: "68.0" } },
    );
    const nutrition = c.find((x) => x.kind === "nutrition");
    assert(nutrition, "expected a nutrition proposal");
    assert(
      (nutrition!.proposedChange as { nutrition?: string }).nutrition ===
        "fuel_training",
      "expected fuel_training change",
    );
    assert(
      nutrition!.reasoning.includes("volledig gevoed"),
      "reasoning must state the fully-fueled rule",
    );
  });

  await scenario("candidates: NO nutrition proposal when peak is far or all is well", () => {
    // Peak too far away.
    let c = buildProposalCandidates(ctx({ doneCount14: 1, plannedCount14: 6 }), [], {
      seasonGoal: { peakDate: isoInDays(200), targetWeightKg: null },
    });
    assert(!c.some((x) => x.kind === "nutrition"), "peak 200d away must not trigger");
    // Executing fine, stable load.
    c = buildProposalCandidates(ctx(), [], {
      seasonGoal: { peakDate: isoInDays(45), targetWeightKg: null },
    });
    assert(!c.some((x) => x.kind === "nutrition"), "healthy execution must not trigger");
    // No season goal at all.
    c = buildProposalCandidates(ctx({ doneCount14: 1, plannedCount14: 6 }), []);
    assert(!c.some((x) => x.kind === "nutrition"), "no season goal must not trigger");
  });

  await scenario("candidates: finished goal triggers picture-level review", () => {
    const c = buildProposalCandidates(ctx(), [
      { id: 9, title: "Doel Z", targetDate: isoInDays(90), measure: "m" },
    ], { finished: [{ title: "Oud doel", status: "achieved" }] });
    assert(c.some((x) => x.kind === "goal_review"), "expected goal_review");
  });

  // ── deriveGoalPatch ────────────────────────────────────────────────────────
  await scenario("deriveGoalPatch: valid targetDate + status pass, junk is dropped", () => {
    let p = deriveGoalPatch({ targetDate: "2026-09-01" });
    assert(p.targetDate === "2026-09-01", "targetDate must apply");
    p = deriveGoalPatch({ targetDate: "01-09-2026", status: "onzin", weeklyLoad: "verlagen" });
    assert(Object.keys(p).length === 0, "invalid fields must yield empty patch");
    p = deriveGoalPatch({ status: "dropped", statusReason: "blessure" });
    assert(p.status === "dropped" && p.statusReason === "blessure", "status patch");
    p = deriveGoalPatch(null);
    assert(Object.keys(p).length === 0, "null change yields empty patch");
  });

  // ── directivesFromProposals ────────────────────────────────────────────────
  await scenario("directives: accepted steering proposals become plan-input lines", () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 5 * 86_400_000);
    const d = directivesFromProposals(
      [
        { kind: "recovery", status: "accepted", decidedAt: recent, proposedChange: { focus: "recovery" }, title: "t" },
        { kind: "load", status: "accepted", decidedAt: recent, proposedChange: { weeklyLoad: "verlagen" }, title: "t" },
        { kind: "nutrition", status: "accepted", decidedAt: recent, proposedChange: { nutrition: "fuel_training" }, title: "t" },
      ],
      now,
    );
    assert(d.length === 3, `expected 3 directives, got ${d.length}`);
    assert(d.every((x) => x.line.startsWith("Afgesproken bijsturing:")), "Dutch prefix");
  });

  await scenario("directives: rejected, stale and goal_adjust proposals yield nothing", () => {
    const now = new Date();
    const stale = new Date(now.getTime() - 60 * 86_400_000);
    const recent = new Date(now.getTime() - 5 * 86_400_000);
    const d = directivesFromProposals(
      [
        { kind: "load", status: "rejected", decidedAt: recent, proposedChange: { weeklyLoad: "verlagen" }, title: "t" },
        { kind: "load", status: "accepted", decidedAt: stale, proposedChange: { weeklyLoad: "verlagen" }, title: "t" },
        { kind: "goal_adjust", status: "accepted", decidedAt: recent, proposedChange: { targetDate: "2026-09-01" }, title: "t" },
        { kind: "load", status: "accepted", decidedAt: null, proposedChange: { weeklyLoad: "verlagen" }, title: "t" },
      ],
      now,
    );
    assert(d.length === 0, `expected 0 directives, got ${d.length}`);
  });

  await scenario("directives: duplicate accepted proposals deduplicate", () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 86_400_000);
    const d = directivesFromProposals(
      [
        { kind: "load", status: "accepted", decidedAt: recent, proposedChange: { weeklyLoad: "verlagen" }, title: "a" },
        { kind: "load", status: "accepted", decidedAt: recent, proposedChange: { weeklyLoad: "verlagen" }, title: "b" },
      ],
      now,
    );
    assert(d.length === 1, `expected 1 directive, got ${d.length}`);
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
