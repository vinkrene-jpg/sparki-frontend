// Geplande taken (/admin) overview test — deterministic pure functions.
//
// Locks the classification logic behind GET /api/admin/scheduled-tasks so a
// drifted query, dedupeKey prefix or column name can't silently flip a job to
// stale-green or grey unnoticed. buildScheduledTasks() is pure (traces + `now`),
// so this test needs no database.
//
// Covers:
//  - all 4 jobs (health, goal_review, reminders, knowledge_scan) present with
//    a valid statusColor
//  - classify() recency thresholds: green within cadence, orange when stale,
//    grey when no trace at all
//  - the goal-review "no active goals" honest-grey branch (and the "active
//    goals but no proposal yet" honest-grey branch)
//
// Run: `pnpm --filter @workspace/api-server run test:scheduled-tasks`
// Exits non-zero on any failure.

import {
  classify,
  buildScheduledTasks,
  type StatusColor,
  type ScheduledTaskTraces,
} from "../lib/scheduled-tasks";

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

const DAY_MS = 24 * 60 * 60 * 1000;
// Fixed reference "now" so every age calculation is deterministic.
const NOW = new Date("2026-07-10T12:00:00.000Z").getTime();
const daysAgo = (n: number): Date => new Date(NOW - n * DAY_MS);

const VALID_COLORS: StatusColor[] = ["green", "orange", "grey"];

// A trace set where every job has a fresh (recent) run → all green.
function freshTraces(overrides: Partial<ScheduledTaskTraces> = {}): ScheduledTaskTraces {
  return {
    healthLast: daysAgo(1),
    goalLast: daysAgo(2),
    activeGoals: 3,
    reminderLast: daysAgo(1),
    knowledgeLast: daysAgo(1),
    connectorSyncLast: daysAgo(1),
    connectedConnections: 2,
    ...overrides,
  };
}

// ── classify() recency thresholds ──────────────────────────────────────────
scenario("classify: no trace → grey, not recent", () => {
  const c = classify(null, 8, NOW);
  assert(c.statusColor === "grey", `expected grey, got ${c.statusColor}`);
  assert(c.recent === false, "no trace can't be recent");
});

scenario("classify: within cadence → green + recent", () => {
  const c = classify(daysAgo(3), 8, NOW);
  assert(c.statusColor === "green", `expected green, got ${c.statusColor}`);
  assert(c.recent === true, "within cadence must be recent");
});

scenario("classify: exactly at threshold is still green (inclusive)", () => {
  const c = classify(daysAgo(8), 8, NOW);
  assert(c.statusColor === "green", `expected green at boundary, got ${c.statusColor}`);
});

scenario("classify: past cadence → orange, not recent", () => {
  const c = classify(daysAgo(20), 8, NOW);
  assert(c.statusColor === "orange", `expected orange, got ${c.statusColor}`);
  assert(c.recent === false, "stale trace can't be recent");
});

// ── buildScheduledTasks: shape / presence contract ─────────────────────────
scenario("all 5 jobs present with a valid statusColor", () => {
  const { tasks } = buildScheduledTasks(freshTraces(), NOW);
  const keys = tasks.map((t) => t.key).sort();
  assert(
    JSON.stringify(keys) ===
      JSON.stringify([
        "connector_sync",
        "goal_review",
        "health",
        "knowledge_scan",
        "reminders",
      ]),
    `unexpected keys: ${keys.join(",")}`,
  );
  for (const t of tasks) {
    assert(
      VALID_COLORS.includes(t.statusColor),
      `job ${t.key} has invalid statusColor ${t.statusColor}`,
    );
    assert(typeof t.title === "string" && t.title.length > 0, `job ${t.key} missing title`);
    assert(typeof t.message === "string" && t.message.length > 0, `job ${t.key} missing message`);
    assert(typeof t.runCommand === "string" && t.runCommand.length > 0, `job ${t.key} missing runCommand`);
    assert(typeof t.schedule === "string" && t.schedule.length > 0, `job ${t.key} missing schedule`);
  }
});

scenario("fresh traces → every job green, missing = 0", () => {
  const { tasks, missing } = buildScheduledTasks(freshTraces(), NOW);
  assert(tasks.every((t) => t.statusColor === "green"), "all jobs must be green when fresh");
  assert(missing === 0, `expected missing 0, got ${missing}`);
});

// ── per-job stale (orange) using each job's own cadence ────────────────────
scenario("health goes orange after >8 days", () => {
  const { tasks } = buildScheduledTasks(freshTraces({ healthLast: daysAgo(10) }), NOW);
  const health = tasks.find((t) => t.key === "health")!;
  assert(health.statusColor === "orange", `expected orange, got ${health.statusColor}`);
  assert(health.lastRunAt === daysAgo(10).toISOString(), "lastRunAt must echo the trace date");
});

scenario("reminders go orange after >3 days", () => {
  const fresh = buildScheduledTasks(freshTraces({ reminderLast: daysAgo(3) }), NOW);
  assert(
    fresh.tasks.find((t) => t.key === "reminders")!.statusColor === "green",
    "3 days is within the reminder cadence",
  );
  const stale = buildScheduledTasks(freshTraces({ reminderLast: daysAgo(5) }), NOW);
  assert(
    stale.tasks.find((t) => t.key === "reminders")!.statusColor === "orange",
    "5 days must be stale for reminders",
  );
});

scenario("knowledge goes orange after >8 days", () => {
  const { tasks } = buildScheduledTasks(freshTraces({ knowledgeLast: daysAgo(30) }), NOW);
  assert(
    tasks.find((t) => t.key === "knowledge_scan")!.statusColor === "orange",
    "old knowledge must be orange",
  );
});

scenario("goal-review goes orange after >35 days when proposals exist", () => {
  const { tasks } = buildScheduledTasks(
    freshTraces({ goalLast: daysAgo(40), activeGoals: 2 }),
    NOW,
  );
  assert(
    tasks.find((t) => t.key === "goal_review")!.statusColor === "orange",
    "stale proposals must be orange",
  );
});

// ── no-trace → grey per job ─────────────────────────────────────────────────
scenario("no traces at all → health/reminders/knowledge grey with honest message", () => {
  const { tasks, missing } = buildScheduledTasks(
    {
      healthLast: null,
      goalLast: null,
      activeGoals: 0,
      reminderLast: null,
      knowledgeLast: null,
      connectorSyncLast: null,
      connectedConnections: 0,
    },
    NOW,
  );
  for (const key of ["health", "reminders", "knowledge_scan", "connector_sync"] as const) {
    const t = tasks.find((x) => x.key === key)!;
    assert(t.statusColor === "grey", `${key} must be grey with no trace, got ${t.statusColor}`);
    assert(t.lastRunAt === null, `${key} lastRunAt must be null`);
  }
  // all 5 grey (goal_review grey via no-active-goals branch)
  assert(missing === 5, `expected missing 5, got ${missing}`);
});

// ── connector-sync honest branches ─────────────────────────────────────────
scenario("connector-sync: stale after >2 days", () => {
  const fresh = buildScheduledTasks(freshTraces({ connectorSyncLast: daysAgo(2) }), NOW);
  assert(
    fresh.tasks.find((t) => t.key === "connector_sync")!.statusColor === "green",
    "2 days is within the sync cadence",
  );
  const stale = buildScheduledTasks(freshTraces({ connectorSyncLast: daysAgo(4) }), NOW);
  assert(
    stale.tasks.find((t) => t.key === "connector_sync")!.statusColor === "orange",
    "4 days must be stale for connector-sync",
  );
});

scenario("connector-sync: no connections → honest grey (expected, not a failure)", () => {
  const { tasks } = buildScheduledTasks(
    freshTraces({ connectorSyncLast: null, connectedConnections: 0 }),
    NOW,
  );
  const t = tasks.find((x) => x.key === "connector_sync")!;
  assert(t.statusColor === "grey", `expected grey, got ${t.statusColor}`);
  assert(
    t.message.includes("nog geen gekoppelde platforms"),
    `unexpected message: ${t.message}`,
  );
});

scenario("connector-sync: connections but no scheduled run → grey deployment warning", () => {
  const { tasks } = buildScheduledTasks(
    freshTraces({ connectorSyncLast: null, connectedConnections: 3 }),
    NOW,
  );
  const t = tasks.find((x) => x.key === "connector_sync")!;
  assert(t.statusColor === "grey", `expected grey, got ${t.statusColor}`);
  assert(
    t.message.includes("3 gekoppelde platform(s)") && t.message.includes("job:sync"),
    `unexpected message: ${t.message}`,
  );
});

// ── goal-review honest-grey branches ────────────────────────────────────────
scenario("goal-review: no active goals → honest grey (expected, not a failure)", () => {
  const { tasks } = buildScheduledTasks(
    freshTraces({ goalLast: null, activeGoals: 0 }),
    NOW,
  );
  const goal = tasks.find((t) => t.key === "goal_review")!;
  assert(goal.statusColor === "grey", `expected grey, got ${goal.statusColor}`);
  assert(goal.lastRunAt === null, "no proposal → lastRunAt null");
  assert(
    goal.message.includes("nog geen actieve doelen"),
    `unexpected message: ${goal.message}`,
  );
});

scenario("goal-review: active goals but no proposal → grey warning to check deployment", () => {
  const { tasks } = buildScheduledTasks(
    freshTraces({ goalLast: null, activeGoals: 5 }),
    NOW,
  );
  const goal = tasks.find((t) => t.key === "goal_review")!;
  assert(goal.statusColor === "grey", `expected grey, got ${goal.statusColor}`);
  assert(
    goal.message.includes("5 actieve doel(en)") && goal.message.includes("job:goal-review"),
    `unexpected message: ${goal.message}`,
  );
});

scenario("goal-review: recent proposal → green regardless of active-goal count", () => {
  const { tasks } = buildScheduledTasks(
    freshTraces({ goalLast: daysAgo(10), activeGoals: 0 }),
    NOW,
  );
  const goal = tasks.find((t) => t.key === "goal_review")!;
  assert(goal.statusColor === "green", `expected green, got ${goal.statusColor}`);
});

// ── Report ───────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(`${r.status === "pass" ? "✓" : "✗"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
