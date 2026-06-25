// Test Management Dashboard scoring — deterministic unit test.
//
// The scoring lib is a pure function over real data, so this test needs no DB.
// It pins the honesty contract: a tester without usage telemetry must never be
// shown as if they exercised the app — testscore is 0, reliability "geen" and
// phase "nog-niet-gestart", REGARDLESS of onboarding or feedback. Real
// non-telemetry signals (compleetheid, feedbackkwaliteit) stay visible.
//
// Run: `pnpm --filter @workspace/api-server run test:test-dashboard`
// Exits non-zero on any failure.

import {
  scoreTester,
  buildCoverage,
  coveragePct,
  coverageStatus,
  type TesterRawData,
} from "../lib/test-dashboard/scoring";

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

const EMPTY: TesterRawData = {
  sessions: 0,
  totalSeconds: 0,
  activeDays30: 0,
  lastActivityAt: null,
  featureUses: 0,
  coverage: {},
  onboarding: null,
  connectedConnectors: 0,
  feedback: { total: 0, bugs: 0, ideas: 0, others: 0, avgDescLen: 0 },
};

function withData(over: Partial<TesterRawData>): TesterRawData {
  return { ...EMPTY, ...over };
}

// (a) No telemetry + onboarding complete → usage scores 0, but compleetheid real.
scenario("no telemetry + onboarding complete", () => {
  const s = scoreTester(
    withData({
      onboarding: {
        coreCompletedAt: new Date(),
        isComplete: true,
        completedSteps: 6,
      },
      connectedConnectors: 1,
    }),
  );
  assert(s.compleetheid === 100, `compleetheid should be 100, got ${s.compleetheid}`);
  assert(s.activiteit === 0, `activiteit must be 0, got ${s.activiteit}`);
  assert(s.herhaalbaarheid === 0, `herhaalbaarheid must be 0, got ${s.herhaalbaarheid}`);
  assert(s.testscore === 0, `testscore must be 0 without telemetry, got ${s.testscore}`);
  assert(s.reliability === "geen", `reliability must be "geen", got ${s.reliability}`);
  assert(
    s.phase === "nog-niet-gestart",
    `phase must be "nog-niet-gestart", got ${s.phase}`,
  );
});

// (b) No telemetry + feedback present → still gated; feedbackkwaliteit stays real.
scenario("no telemetry + feedback present", () => {
  const s = scoreTester(
    withData({
      feedback: { total: 3, bugs: 2, ideas: 1, others: 0, avgDescLen: 90 },
    }),
  );
  assert(
    s.feedbackkwaliteit > 0,
    `feedbackkwaliteit should reflect real feedback, got ${s.feedbackkwaliteit}`,
  );
  assert(s.testscore === 0, `testscore must be 0 without telemetry, got ${s.testscore}`);
  assert(s.reliability === "geen", `reliability must be "geen", got ${s.reliability}`);
  assert(
    s.phase === "nog-niet-gestart",
    `phase must be "nog-niet-gestart", got ${s.phase}`,
  );
});

// A single feature_use (no sessions) still counts as "has telemetry".
scenario("feature use alone lifts the gate", () => {
  const s = scoreTester(withData({ featureUses: 1 }));
  assert(s.phase !== "nog-niet-gestart", "feature use means the tester started");
  assert(s.reliability !== "geen", "feature use is measurable usage");
});

// (c) Telemetry present → full scoring, deterministic and bounded.
scenario("active tester scores across the board", () => {
  const s = scoreTester(
    withData({
      sessions: 8,
      totalSeconds: 9000,
      activeDays30: 6,
      lastActivityAt: new Date(),
      featureUses: 12,
      onboarding: {
        coreCompletedAt: new Date(),
        isComplete: true,
        completedSteps: 6,
      },
      connectedConnectors: 1,
      feedback: { total: 5, bugs: 2, ideas: 2, others: 1, avgDescLen: 140 },
    }),
  );
  assert(s.activiteit > 0, "active tester must have activity");
  assert(s.testscore > 0, "active tester must have a testscore");
  assert(s.testscore <= 100, `testscore must be <= 100, got ${s.testscore}`);
  assert(s.reliability === "hoog", `expected "hoog", got ${s.reliability}`);
  assert(s.phase === "grondig", `expected "grondig", got ${s.phase}`);
});

// Determinism: same input → identical output (no time-of-day drift in the math).
scenario("scoring is deterministic", () => {
  const input = withData({
    sessions: 3,
    totalSeconds: 1800,
    activeDays30: 2,
    lastActivityAt: new Date("2026-06-01T10:00:00Z"),
    featureUses: 4,
    feedback: { total: 2, bugs: 1, ideas: 1, others: 0, avgDescLen: 60 },
  });
  const a = scoreTester(input);
  const b = scoreTester(input);
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    "identical input must yield identical scores",
  );
});

// Coverage status thresholds: 0 = never, 1-2 = viewed, 3+ = active.
scenario("coverage status thresholds", () => {
  assert(coverageStatus(0) === "never", "0 views = never");
  assert(coverageStatus(1) === "viewed", "1 view = viewed");
  assert(coverageStatus(2) === "viewed", "2 views = viewed");
  assert(coverageStatus(3) === "active", "3 views = active");
});

// Coverage percentage counts distinct opened canonical screens.
scenario("coverage percentage", () => {
  assert(coveragePct({}) === 0, "no views = 0%");
  const cov = buildCoverage({ home: 5, training: 1 });
  assert(cov.length === 10, `expected 10 canonical screens, got ${cov.length}`);
  // 2 of 10 opened → 20%.
  assert(coveragePct({ home: 5, training: 1 }) === 20, "2/10 screens = 20%");
});

const passed = results.filter((r) => r.status === "pass").length;
const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL";
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${passed}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
