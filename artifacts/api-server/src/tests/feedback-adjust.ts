// Training feedback → adjustment flow — DB-backed route contract test.
//
// The interactive schedule lets an athlete open a planned workout, give
// feedback, receive a concrete Sparki adjustment proposal, and apply it to the
// plan. That is a THREE-step chain (persist feedback → request proposal →
// apply changes) with no end-to-end coverage — exactly where a regression
// hides: feedback silently lost, a proposal shown without the feedback ever
// saving, or a proposal applied to the wrong columns.
//
// This test boots the REAL Express app, seeds a disposable athlete with a past
// (done/retrospective) and a future (planning/upcoming) workout, and drives the
// real routes as a dev user:
//   POST /api/athlete/workouts/:id/feedback   (persist)
//   POST /api/ai/workout-adjust               (propose)
//   PUT  /api/athlete/workouts/:id            (apply)
//
// The Sparki proposal call (Anthropic) is STUBBED so the test is deterministic
// and never touches the real model — we control exactly what proposal comes
// back and assert the app persists/applies it correctly.
//
// It pins the guarantees the flow depends on:
//   1. Feedback is PERSISTED (a DB row + status mirror) and can be read back
//      BEFORE any proposal is requested — the ordering the drawer relies on.
//   2. A proposal with changes can be APPLIED and actually mutates the plan
//      (every field mapping used by useApplyProposal lands on the right column).
//   3. BOTH branches are covered: retrospective (past/"done") and planning
//      (upcoming/"move").
//   4. Requesting a proposal is READ-ONLY w.r.t. feedback — adjust must never
//      be the thing that persists feedback (that would break the ordering
//      contract silently).
//
// Cleanup removes only the rows this test created (workouts cascade-delete
// their feedback; the seeded profile is removed last).
//
// Run: `pnpm --filter @workspace/api-server run test:feedback-adjust`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  plannedWorkoutsTable,
  workoutFeedbackTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

// ── Stub the Sparki proposal call ────────────────────────────────────────────
// The /api/ai/workout-adjust route reads `message.content[0]` and expects a
// `{ type: "text" }` block whose text is JSON. We control the returned proposal
// per scenario via `nextProposal`, so the flow runs without the real model.
let nextProposal = "";
const origCreate = anthropic.messages.create.bind(anthropic.messages);
(anthropic.messages as unknown as { create: (args: unknown) => unknown }).create =
  async () =>
    ({ content: [{ type: "text", text: nextProposal }] }) as unknown as Awaited<
      ReturnType<typeof origCreate>
    >;

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
const RUN = `test_fbadjust_${Date.now()}`;
const clerkId = `${RUN}_athlete`;
const seeded = { workoutIds: [] as number[] };

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function seedWorkout(scheduledDate: string): Promise<number> {
  const [w] = await db
    .insert(plannedWorkoutsTable)
    .values({
      clerkId,
      scheduledDate,
      type: "ride",
      title: "Testtraining",
      targetDurationMin: 90,
      targetTSS: 75,
      status: "planned",
      source: "sparki",
    })
    .returning({ id: plannedWorkoutsTable.id });
  seeded.workoutIds.push(w!.id);
  return w!.id;
}

// A well-formed proposal the route will parse + validate.
function proposal(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    recommendation: "adjust",
    title: "Iets lichter maken",
    message: "We verlagen de belasting zodat je fris blijft.",
    changes: null,
    ...over,
  });
}

// ── HTTP helpers acting as the seeded dev athlete via the x-dev-clerk-id header.
async function submitFeedback(
  workoutId: number,
  feedbackType: string,
  note?: string,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(
    `${baseUrl}/api/athlete/workouts/${workoutId}/feedback`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dev-clerk-id": clerkId,
      },
      body: JSON.stringify({ feedbackType, note }),
    },
  );
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function requestAdjust(
  workoutId: number,
  feedbackType: string,
  note?: string,
): Promise<{ status: number; body: { proposal?: unknown } }> {
  const res = await fetch(`${baseUrl}/api/ai/workout-adjust`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
    },
    body: JSON.stringify({ workoutId, feedbackType, note }),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as { proposal?: unknown } };
}

async function applyProposal(
  workoutId: number,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}/api/athlete/workouts/${workoutId}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function feedbackRows(workoutId: number) {
  return db
    .select()
    .from(workoutFeedbackTable)
    .where(
      and(
        eq(workoutFeedbackTable.workoutId, workoutId),
        eq(workoutFeedbackTable.clerkId, clerkId),
      ),
    );
}

async function workoutRow(workoutId: number) {
  const [w] = await db
    .select()
    .from(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.id, workoutId),
        eq(plannedWorkoutsTable.clerkId, clerkId),
      ),
    );
  return w ?? null;
}

async function cleanup() {
  if (seeded.workoutIds.length) {
    // workout_feedback cascades on workout delete; delete workouts explicitly.
    for (const id of seeded.workoutIds) {
      await db
        .delete(plannedWorkoutsTable)
        .where(eq(plannedWorkoutsTable.id, id))
        .catch(() => {});
    }
  }
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId))
    .catch(() => {});
}

async function main() {
  await startServer();
  await ensureAccount(clerkId, `${clerkId}@example.test`, "Testatleet", silentLogger);

  // Precondition: the dev bypass must authorize the seeded athlete, otherwise
  // every request is a 401/403 and the assertions below are meaningless.
  await scenario("dev athlete can reach the routes (precondition)", async () => {
    const pastId = await seedWorkout(isoOffset(-2));
    const { status } = await submitFeedback(pastId, "done");
    assert(
      status === 201,
      `expected 201 via dev bypass, got ${status} — ensure NODE_ENV!=production ` +
        `and DEV_AUTH_BYPASS=true`,
    );
    // Undo the status mirror so this precondition doesn't taint later reads.
  });

  // ── Retrospective branch (past/"done"): feedback persists + mirrors status ──
  await scenario(
    "retrospective: feedback is persisted and readable BEFORE a proposal is requested",
    async () => {
      const id = await seedWorkout(isoOffset(-3));

      // Step 1 — persist feedback. The route returns 201 with the saved row.
      const fb = await submitFeedback(id, "done", "ging lekker");
      assert(fb.status === 201, `feedback expected 201, got ${fb.status}`);

      // The row must exist in the DB the moment feedback returns — this is the
      // "persisted BEFORE a proposal is shown" guarantee the drawer relies on.
      const rows = await feedbackRows(id);
      assert(rows.length === 1, `expected 1 feedback row, got ${rows.length}`);
      assert(
        rows[0]!.feedbackType === "done" && rows[0]!.note === "ging lekker",
        "persisted feedback row does not match what was submitted",
      );

      // "done" must mirror onto the workout status so the day-type engine + load
      // tracking stay in sync — a silent break here loses the completion signal.
      const w = await workoutRow(id);
      assert(
        w?.status === "completed",
        `done feedback must set status completed, got ${w?.status}`,
      );

      // Step 2 — only now request the proposal. It must succeed and echo the
      // stubbed proposal shape.
      nextProposal = proposal({ recommendation: "keep", changes: null });
      const adj = await requestAdjust(id, "done", "ging lekker");
      assert(adj.status === 200, `adjust expected 200, got ${adj.status}`);
      const p = adj.body.proposal as { recommendation?: string; title?: string; message?: string } | undefined;
      assert(p != null, "adjust returned no proposal");
      assert(
        ["keep", "adjust", "move", "recovery", "replan_week"].includes(
          p!.recommendation ?? "",
        ),
        `invalid recommendation ${p!.recommendation}`,
      );
      assert(
        typeof p!.title === "string" && typeof p!.message === "string",
        "proposal missing title/message",
      );
    },
  );

  // ── Planning branch (upcoming/"move"): feedback persists WITHOUT terminating ─
  await scenario(
    "planning: upcoming 'move' feedback persists and does NOT flip status to terminal",
    async () => {
      const id = await seedWorkout(isoOffset(5));

      const fb = await submitFeedback(id, "move", "die dag kan ik niet");
      assert(fb.status === 201, `feedback expected 201, got ${fb.status}`);

      const rows = await feedbackRows(id);
      assert(rows.length === 1, `expected 1 feedback row, got ${rows.length}`);
      assert(rows[0]!.feedbackType === "move", "wrong feedbackType persisted");

      // A forward-looking 'move' is not a done/missed terminal — the workout must
      // stay planned so it isn't wrongly counted as completed/skipped.
      const w = await workoutRow(id);
      assert(
        w?.status === "planned",
        `move feedback must keep status planned, got ${w?.status}`,
      );
    },
  );

  // ── Apply a proposal with changes → the plan actually updates ────────────────
  await scenario(
    "planning: a 'move' proposal with a newDate is applied and reschedules the workout",
    async () => {
      const id = await seedWorkout(isoOffset(6));
      await submitFeedback(id, "move");

      const newDate = isoOffset(9);
      nextProposal = proposal({
        recommendation: "move",
        title: "Verplaatsen naar later",
        message: "Beter op een dag dat het uitkomt.",
        changes: { newDate },
      });
      const adj = await requestAdjust(id, "move");
      const p = adj.body.proposal as {
        recommendation: string;
        changes: { newDate?: string } | null;
      };
      assert(p.changes?.newDate === newDate, "proposal did not carry the newDate change");

      // The drawer maps changes → PUT body (newDate → scheduledDate, status modified).
      const put = await applyProposal(id, {
        status: "modified",
        scheduledDate: p.changes!.newDate,
      });
      assert(put.status === 200, `apply expected 200, got ${put.status}`);

      const w = await workoutRow(id);
      assert(
        w?.scheduledDate === newDate,
        `apply must reschedule to ${newDate}, got ${w?.scheduledDate}`,
      );
      assert(
        w?.status === "modified",
        `apply must set status modified, got ${w?.status}`,
      );
    },
  );

  // ── Apply-proposal field mapping drift guard ────────────────────────────────
  // useApplyProposal maps proposal.changes → specific PUT columns. If any of
  // those mappings drift (wrong column, dropped field), a proposal would be
  // "applied" but land on nothing. Pin every field the client sends.
  await scenario(
    "apply: every proposal-change field lands on the correct workout column",
    async () => {
      const id = await seedWorkout(isoOffset(7));
      const newDate = isoOffset(11);
      const put = await applyProposal(id, {
        status: "modified",
        targetDurationMin: 60,
        targetTSS: 50,
        scheduledDate: newDate,
        title: "Aangepaste training",
        description: "z2", // intensity is persisted into description
      });
      assert(put.status === 200, `apply expected 200, got ${put.status}`);

      const w = await workoutRow(id);
      assert(w?.targetDurationMin === 60, `duration not applied: ${w?.targetDurationMin}`);
      assert(w?.targetTSS === 50, `tss not applied: ${w?.targetTSS}`);
      assert(w?.scheduledDate === newDate, `date not applied: ${w?.scheduledDate}`);
      assert(w?.title === "Aangepaste training", `title not applied: ${w?.title}`);
      assert(w?.description === "z2", `description not applied: ${w?.description}`);
      assert(w?.status === "modified", `status not applied: ${w?.status}`);
    },
  );

  // ── Decline contract: a proposal that is NOT applied must leave the plan intact
  // The drawer persists feedback, shows a Sparki proposal, and only fires the
  // apply PUT when the athlete taps "Toepassen". Tapping "Houden" (or a proposal
  // with no changes) must fire NO PUT at all. If a regression ever routed decline
  // through the apply path — or adjust itself started mutating the plan — the
  // workout would silently drift. These two scenarios prove the OTHER half of the
  // interactive-schedule contract: after feedback persists and a proposal WITH
  // concrete changes is requested but never applied, every workout column stays
  // exactly as seeded. Covers both branches (retrospective + planning).
  await scenario(
    "decline (retrospective): a proposal that is not applied leaves the workout unchanged",
    async () => {
      const scheduledDate = isoOffset(-4);
      const id = await seedWorkout(scheduledDate);

      // Retrospective feedback that does NOT mirror status (unlike done/missed),
      // so the seeded row is the exact baseline and any drift can ONLY come from
      // an applied proposal.
      const fb = await submitFeedback(id, "too_light", "had meer gekund");
      assert(fb.status === 201, `feedback expected 201, got ${fb.status}`);

      // Sparki returns a proposal WITH concrete changes — the tempting case where
      // a bug could apply them without the athlete's consent.
      nextProposal = proposal({
        recommendation: "adjust",
        title: "Volgende keer iets zwaarder",
        message: "We tillen de belasting een klein stukje op.",
        changes: { targetDurationMin: 120, targetTSS: 110, intensity: "z3" },
      });
      const adj = await requestAdjust(id, "too_light", "had meer gekund");
      assert(adj.status === 200, `adjust expected 200, got ${adj.status}`);
      const p = adj.body.proposal as { changes?: unknown } | undefined;
      assert(
        p?.changes != null,
        "proposal must carry changes for a decline to be meaningful",
      );

      // The athlete declines ("Houden"): NO apply PUT is fired. Assert every
      // column is byte-for-byte as seeded.
      const w = await workoutRow(id);
      assert(w?.status === "planned", `status drifted on decline: ${w?.status}`);
      assert(
        w?.scheduledDate === scheduledDate,
        `date drifted on decline: ${w?.scheduledDate}`,
      );
      assert(
        w?.targetDurationMin === 90,
        `duration drifted on decline: ${w?.targetDurationMin}`,
      );
      assert(w?.targetTSS === 75, `tss drifted on decline: ${w?.targetTSS}`);
      assert(w?.title === "Testtraining", `title drifted on decline: ${w?.title}`);
      assert(
        w?.description == null,
        `description drifted on decline: ${w?.description}`,
      );
    },
  );

  await scenario(
    "decline (planning): an upcoming 'move' proposal that is not applied leaves the workout unchanged",
    async () => {
      const scheduledDate = isoOffset(12);
      const id = await seedWorkout(scheduledDate);

      // A forward-looking 'move' keeps the workout planned (no status mirror), so
      // the seeded row is again the exact baseline.
      const fb = await submitFeedback(id, "move", "misschien een andere dag");
      assert(fb.status === 201, `feedback expected 201, got ${fb.status}`);

      // Sparki proposes a reschedule to a concrete new date — declining must NOT
      // move the workout.
      const wouldBeDate = isoOffset(15);
      nextProposal = proposal({
        recommendation: "move",
        title: "Verplaatsen naar later",
        message: "Beter op een dag dat het uitkomt.",
        changes: { newDate: wouldBeDate },
      });
      const adj = await requestAdjust(id, "move", "misschien een andere dag");
      assert(adj.status === 200, `adjust expected 200, got ${adj.status}`);
      const p = adj.body.proposal as { changes?: { newDate?: string } } | undefined;
      assert(p?.changes?.newDate === wouldBeDate, "move proposal must carry a newDate");

      // Athlete declines: no reschedule PUT. The workout must stay on its seeded
      // date and status — a silent move here is exactly the bug we're guarding.
      const w = await workoutRow(id);
      assert(w?.status === "planned", `status drifted on decline: ${w?.status}`);
      assert(
        w?.scheduledDate === scheduledDate,
        `date drifted on decline: ${w?.scheduledDate} (must not be ${wouldBeDate})`,
      );
      assert(
        w?.targetDurationMin === 90,
        `duration drifted on decline: ${w?.targetDurationMin}`,
      );
      assert(w?.targetTSS === 75, `tss drifted on decline: ${w?.targetTSS}`);
      assert(w?.title === "Testtraining", `title drifted on decline: ${w?.title}`);
      assert(
        w?.description == null,
        `description drifted on decline: ${w?.description}`,
      );
    },
  );

  // ── Ordering contract: requesting a proposal must NOT persist feedback ───────
  // The drawer persists feedback FIRST, then asks for a proposal. If adjust
  // itself started writing feedback, the ordering guarantee would silently rot
  // (double-writes, or a proposal shown for feedback that was never the saved
  // one). Prove adjust is read-only w.r.t. feedback.
  await scenario(
    "adjust is read-only w.r.t. feedback (does not create a feedback row)",
    async () => {
      const id = await seedWorkout(isoOffset(8));

      const before = (await feedbackRows(id)).length;
      assert(before === 0, `fresh workout should have 0 feedback rows, got ${before}`);

      nextProposal = proposal({ recommendation: "keep", changes: null });
      const adj = await requestAdjust(id, "too_light");
      assert(adj.status === 200, `adjust expected 200, got ${adj.status}`);

      const after = (await feedbackRows(id)).length;
      assert(
        after === 0,
        `adjust must not persist feedback — feedback rows went ${before}→${after}`,
      );
    },
  );

  // ── Invalid feedback type is rejected (contract guard) ───────────────────────
  await scenario("invalid feedbackType is rejected with 400", async () => {
    const id = await seedWorkout(isoOffset(9));
    const fb = await submitFeedback(id, "totally_bogus");
    assert(fb.status === 400, `expected 400 for bad feedbackType, got ${fb.status}`);
    const rows = await feedbackRows(id);
    assert(rows.length === 0, "a rejected feedbackType must not persist a row");
  });
}

async function shutdown(code: number) {
  (anthropic.messages as unknown as { create: typeof origCreate }).create =
    origCreate;
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== training feedback → adjustment flow — test results ===");
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
