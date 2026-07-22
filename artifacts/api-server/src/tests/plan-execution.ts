// Uitvoeringskoppeling (Golf 23) — DB-backed engine + route contract test.
//
// Covers the execution-link layer that ties a REAL activity (training_sessions)
// to the planned workout of that day and keeps the plan honest:
//   1. Pure verdict rules (classifyExecution): completed/partial/adjusted +
//      honest "no targets" reason.
//   2. Pure matching (matchSessionToWorkout): same day, unlinked, linkable
//      status; closest duration wins on ties.
//   3. autoLinkSession: links + sets verdict status + append-only history row;
//      never re-links an already linked workout (manual link wins).
//   4. Manual link via PUT /api/athlete/workouts/:id (sessionId): same-day own
//      session ⇒ verdict status; other-day ⇒ 400; foreign session ⇒ 404.
//   5. Unlink via PUT sessionId:null ⇒ back to planned + "ontkoppeld" history.
//   6. Cancel via DELETE ⇒ soft "cancelled" (row survives) + history; coach
//      workouts ⇒ 403 untouched.
//   7. Lazy self-heal (markOverdueAsMissed via GET /workouts/today): past
//      unlinked planned ⇒ missed; linked past workouts untouched.
//   8. History endpoint: cross-account denied (404), owner sees the log.
//
// Run: `pnpm --filter @workspace/api-server run test:plan-execution`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  plannedWorkoutsTable,
  plannedWorkoutChangesTable,
  trainingSessionsTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  autoLinkSession,
  classifyExecution,
  matchSessionToWorkout,
  type WorkoutCandidate,
} from "../lib/workout-execution";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
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

// ── Server boot ──────────────────────────────────────────────────────────────
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

// ── Seeded fixtures ──────────────────────────────────────────────────────────
const RUN = `test_planexec_${Date.now()}`;
const clerkId = `${RUN}_athlete`;
const clerkIdB = `${RUN}_athlete_b`;
const seeded = {
  workoutIds: [] as number[],
  sessionIds: [] as number[],
};

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function seedWorkout(over: {
  scheduledDate: string;
  targetDurationMin?: number | null;
  targetTSS?: number | null;
  source?: string;
  status?: string;
  owner?: string;
}): Promise<number> {
  const [w] = await db
    .insert(plannedWorkoutsTable)
    .values({
      clerkId: over.owner ?? clerkId,
      scheduledDate: over.scheduledDate,
      type: "ride",
      title: "Testtraining",
      targetDurationMin:
        over.targetDurationMin === undefined ? 90 : over.targetDurationMin,
      targetTSS: over.targetTSS === undefined ? 75 : over.targetTSS,
      status: over.status ?? "planned",
      source: over.source ?? "sparki",
    })
    .returning({ id: plannedWorkoutsTable.id });
  seeded.workoutIds.push(w!.id);
  return w!.id;
}

async function seedSession(over: {
  sessionDate: string;
  durationMin?: number | null;
  tss?: number | null;
  owner?: string;
}): Promise<number> {
  const [s] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId: over.owner ?? clerkId,
      sessionDate: over.sessionDate,
      type: "ride",
      sport: "cycling",
      title: "Testrit",
      durationMin: over.durationMin === undefined ? 90 : over.durationMin,
      tss: over.tss === undefined ? 75 : over.tss,
      source: "manual",
    })
    .returning({ id: trainingSessionsTable.id });
  seeded.sessionIds.push(s!.id);
  return s!.id;
}

// ── HTTP helpers (dev-bypass header) ─────────────────────────────────────────
async function api(
  method: string,
  path: string,
  body?: unknown,
  actor: string = clerkId,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed };
}

async function workoutRow(id: number) {
  const [w] = await db
    .select()
    .from(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.id, id));
  return w ?? null;
}

async function historyRows(id: number) {
  return db
    .select()
    .from(plannedWorkoutChangesTable)
    .where(eq(plannedWorkoutChangesTable.workoutId, id));
}

async function cleanup() {
  if (seeded.workoutIds.length > 0) {
    await db
      .delete(plannedWorkoutChangesTable)
      .where(inArray(plannedWorkoutChangesTable.workoutId, seeded.workoutIds));
    await db
      .delete(plannedWorkoutsTable)
      .where(inArray(plannedWorkoutsTable.id, seeded.workoutIds));
  }
  if (seeded.sessionIds.length > 0) {
    await db
      .delete(trainingSessionsTable)
      .where(inArray(trainingSessionsTable.id, seeded.sessionIds));
  }
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [clerkId, clerkIdB]));
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await startServer();
  await ensureAccount(clerkId, `${RUN}@test.local`, "Plan Exec Tester", silentLogger);
  await ensureAccount(clerkIdB, `${RUN}_b@test.local`, "Athlete B", silentLogger);

  // ── 1. Pure verdict rules ──────────────────────────────────────────────────
  await scenario("classifyExecution: within 70–130% ⇒ completed", () => {
    const r = classifyExecution(
      { id: 1, sessionDate: "2026-01-01", durationMin: 85, tss: 80 },
      { targetDurationMin: 90, targetTSS: 75 },
    );
    assert(r.verdict === "completed", `expected completed, got ${r.verdict}`);
  });

  await scenario("classifyExecution: clearly shorter/lighter ⇒ partial", () => {
    const r = classifyExecution(
      { id: 1, sessionDate: "2026-01-01", durationMin: 40, tss: 30 },
      { targetDurationMin: 90, targetTSS: 75 },
    );
    assert(r.verdict === "partial", `expected partial, got ${r.verdict}`);
    assert(/korter of lichter/.test(r.reason), "reason must be honest Dutch");
  });

  await scenario("classifyExecution: clearly longer/heavier ⇒ adjusted", () => {
    const r = classifyExecution(
      { id: 1, sessionDate: "2026-01-01", durationMin: 150, tss: 120 },
      { targetDurationMin: 90, targetTSS: 75 },
    );
    assert(r.verdict === "adjusted", `expected adjusted, got ${r.verdict}`);
  });

  await scenario(
    "classifyExecution: no targets ⇒ completed with honest 'no targets' reason",
    () => {
      const r = classifyExecution(
        { id: 1, sessionDate: "2026-01-01", durationMin: 60, tss: 50 },
        { targetDurationMin: null, targetTSS: null },
      );
      assert(r.verdict === "completed", `expected completed, got ${r.verdict}`);
      assert(
        /Geen doelwaarden/.test(r.reason),
        `reason must state there were no targets, got: ${r.reason}`,
      );
    },
  );

  // ── 2. Pure matching ───────────────────────────────────────────────────────
  await scenario(
    "matchSessionToWorkout: same-day + closest duration wins; linked/cancelled skipped",
    () => {
      const base: Omit<WorkoutCandidate, "id" | "targetDurationMin"> = {
        scheduledDate: "2026-07-20",
        type: "ride",
        status: "planned",
        sessionId: null,
        targetTSS: 75,
        source: "sparki",
      };
      const candidates: WorkoutCandidate[] = [
        { ...base, id: 1, targetDurationMin: 60 },
        { ...base, id: 2, targetDurationMin: 118 },
        { ...base, id: 3, targetDurationMin: 120, sessionId: 999 }, // already linked
        { ...base, id: 4, targetDurationMin: 120, status: "cancelled" },
        { ...base, id: 5, targetDurationMin: 120, scheduledDate: "2026-07-21" },
      ];
      const m = matchSessionToWorkout(
        { id: 10, sessionDate: "2026-07-20", durationMin: 120, tss: 90 },
        candidates,
      );
      assert(m?.id === 2, `closest unlinked same-day must win (id 2), got ${m?.id}`);
      const none = matchSessionToWorkout(
        { id: 11, sessionDate: "2026-07-22", durationMin: 120, tss: 90 },
        candidates,
      );
      assert(none == null, "no same-day candidate must yield null, never a guess");
    },
  );

  // ── 3. autoLinkSession ─────────────────────────────────────────────────────
  await scenario(
    "autoLinkSession links same-day session, sets verdict status + history; manual link never overwritten",
    async () => {
      const day = isoOffset(-2);
      const workoutId = await seedWorkout({ scheduledDate: day });
      const sessionId = await seedSession({ sessionDate: day, durationMin: 85, tss: 80 });

      const linked = await autoLinkSession(clerkId, {
        id: sessionId,
        sessionDate: day,
        sport: "cycling",
        type: "ride",
        durationMin: 85,
        tss: 80,
      });
      assert(linked?.workoutId === workoutId, "autoLink must link the seeded workout");
      assert(linked?.verdict === "completed", `verdict must be completed, got ${linked?.verdict}`);

      const w = await workoutRow(workoutId);
      assert(w?.sessionId === sessionId, "workout.sessionId must be set");
      assert(w?.status === "completed", `status must mirror verdict, got ${w?.status}`);

      const hist = await historyRows(workoutId);
      assert(
        hist.some((h) => h.action === "gekoppeld" && h.actor === "sparki"),
        "autoLink must write a 'gekoppeld' history row by sparki",
      );

      // Second session on the same day must NOT steal the link (idempotent,
      // existing link — manual or auto — always wins).
      const session2 = await seedSession({ sessionDate: day, durationMin: 80, tss: 70 });
      const second = await autoLinkSession(clerkId, {
        id: session2,
        sessionDate: day,
        sport: "cycling",
        type: "ride",
        durationMin: 80,
        tss: 70,
      });
      assert(second == null, "already linked workout must never be re-linked");
      const w2 = await workoutRow(workoutId);
      assert(w2?.sessionId === sessionId, "original link must survive");
    },
  );

  // ── 4. Manual link via PUT ─────────────────────────────────────────────────
  await scenario(
    "manual link: same-day own session ⇒ verdict status; other-day ⇒ 400; foreign session ⇒ 404",
    async () => {
      const day = isoOffset(-1);
      const workoutId = await seedWorkout({ scheduledDate: day });
      const shortSession = await seedSession({ sessionDate: day, durationMin: 40, tss: 30 });
      const otherDaySession = await seedSession({ sessionDate: isoOffset(-3) });
      const foreignSession = await seedSession({ sessionDate: day, owner: clerkIdB });

      // Other-day link refused (an execution link on the wrong day would lie).
      const badDay = await api("PUT", `/api/athlete/workouts/${workoutId}`, {
        sessionId: otherDaySession,
      });
      assert(badDay.status === 400, `other-day link must be 400, got ${badDay.status}`);

      // Foreign session refused.
      const foreign = await api("PUT", `/api/athlete/workouts/${workoutId}`, {
        sessionId: foreignSession,
      });
      assert(foreign.status === 404, `foreign session link must be 404, got ${foreign.status}`);

      // Valid same-day link gets the honest verdict (40/90 min ⇒ partial).
      const ok = await api("PUT", `/api/athlete/workouts/${workoutId}`, {
        sessionId: shortSession,
      });
      assert(ok.status === 200, `same-day link must be 200, got ${ok.status}`);
      const w = await workoutRow(workoutId);
      assert(w?.sessionId === shortSession, "sessionId must be persisted");
      assert(w?.status === "partial", `40/90min link must classify partial, got ${w?.status}`);
      const hist = await historyRows(workoutId);
      assert(
        hist.some((h) => h.action === "gekoppeld" && h.actor === "sporter"),
        "manual link must write a 'gekoppeld' history row by sporter",
      );
    },
  );

  // ── 5. Unlink via PUT sessionId:null ───────────────────────────────────────
  await scenario(
    "unlink: PUT sessionId=null returns workout to planned + 'ontkoppeld' history",
    async () => {
      const day = isoOffset(-1);
      const workoutId = await seedWorkout({ scheduledDate: day });
      const sessionId = await seedSession({ sessionDate: day });
      const link = await api("PUT", `/api/athlete/workouts/${workoutId}`, { sessionId });
      assert(link.status === 200, `link must be 200, got ${link.status}`);

      const unlink = await api("PUT", `/api/athlete/workouts/${workoutId}`, {
        sessionId: null,
      });
      assert(unlink.status === 200, `unlink must be 200, got ${unlink.status}`);
      const w = await workoutRow(workoutId);
      assert(w?.sessionId == null, "sessionId must be cleared");
      assert(w?.status === "planned", `unlink must restore planned, got ${w?.status}`);
      const hist = await historyRows(workoutId);
      assert(
        hist.some((h) => h.action === "ontkoppeld"),
        "unlink must write an 'ontkoppeld' history row",
      );
    },
  );

  // ── 6. Cancel ──────────────────────────────────────────────────────────────
  await scenario(
    "cancel: DELETE soft-cancels (row survives + history); coach workout ⇒ 403 untouched",
    async () => {
      const workoutId = await seedWorkout({ scheduledDate: isoOffset(3) });
      const del = await api("DELETE", `/api/athlete/workouts/${workoutId}`, {
        reason: "geen tijd deze week",
      });
      assert(del.status === 200, `cancel must be 200, got ${del.status}`);
      const w = await workoutRow(workoutId);
      assert(w != null, "cancelled workout row must SURVIVE (soft cancel)");
      assert(w?.status === "cancelled", `status must be cancelled, got ${w?.status}`);
      const hist = await historyRows(workoutId);
      assert(
        hist.some((h) => h.action === "geannuleerd" && h.reason === "geen tijd deze week"),
        "cancel must write a 'geannuleerd' history row with the reason",
      );

      const coachWorkoutId = await seedWorkout({
        scheduledDate: isoOffset(4),
        source: "coach",
      });
      const coachDel = await api("DELETE", `/api/athlete/workouts/${coachWorkoutId}`);
      assert(coachDel.status === 403, `coach workout cancel must be 403, got ${coachDel.status}`);
      const cw = await workoutRow(coachWorkoutId);
      assert(cw?.status === "planned", "coach workout must stay planned");
    },
  );

  // ── 7. Lazy self-heal ──────────────────────────────────────────────────────
  await scenario(
    "self-heal: past unlinked planned ⇒ missed on read; linked past workout untouched",
    async () => {
      const overdueid = await seedWorkout({ scheduledDate: isoOffset(-5) });
      const day = isoOffset(-6);
      const linkedId = await seedWorkout({ scheduledDate: day });
      const sessionId = await seedSession({ sessionDate: day });
      const link = await api("PUT", `/api/athlete/workouts/${linkedId}`, { sessionId });
      assert(link.status === 200, `link must be 200, got ${link.status}`);

      // Any read triggers markOverdueAsMissed.
      const read = await api("GET", "/api/athlete/workouts/today");
      assert(read.status === 200, `today read must be 200, got ${read.status}`);

      const overdue = await workoutRow(overdueid);
      assert(overdue?.status === "missed", `overdue must be missed, got ${overdue?.status}`);
      const hist = await historyRows(overdueid);
      assert(
        hist.some((h) => h.action === "gemist" && h.actor === "sparki"),
        "self-heal must write a 'gemist' history row",
      );

      const linked = await workoutRow(linkedId);
      assert(
        linked?.status !== "missed" && linked?.sessionId === sessionId,
        "linked past workout must never be marked missed",
      );
    },
  );

  // ── 8. History endpoint + isolation ────────────────────────────────────────
  await scenario(
    "history: owner reads the append-only log; athlete B gets 404",
    async () => {
      const workoutId = await seedWorkout({ scheduledDate: isoOffset(5) });
      await api("DELETE", `/api/athlete/workouts/${workoutId}`);

      const own = await api("GET", `/api/athlete/workouts/${workoutId}/history`);
      assert(own.status === 200, `owner history must be 200, got ${own.status}`);
      const changes = own.body["changes"] as { action: string }[] | undefined;
      assert(
        Array.isArray(changes) && changes.some((c) => c.action === "geannuleerd"),
        "history must contain the 'geannuleerd' entry",
      );

      const b = await api(
        "GET",
        `/api/athlete/workouts/${workoutId}/history`,
        undefined,
        clerkIdB,
      );
      assert(b.status === 404, `B reading A's history must be 404, got ${b.status}`);
    },
  );
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== uitvoeringskoppeling (plan-execution) — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
