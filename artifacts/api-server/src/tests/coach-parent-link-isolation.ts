// Coach/parent → athlete link isolation — DB-backed route contract test.
//
// The cross-account-isolation test (test:cross-account-isolation) pinned the
// ATHLETE-vs-ATHLETE leak (athlete B can't touch athlete A's :id records). The
// complementary risk lives on the coach/parent relationship surfaces: a coach or
// parent must only be able to read/act on athletes they have an ACCEPTED link
// with — never an arbitrary athlete by id, and never one whose link is merely
// pending. There was no automated "unlinked coach/parent is denied on this
// athlete" check, so a regression in the link filter on those routes would
// silently become a cross-account leak or a cross-account mutation.
//
// This test boots the REAL Express app and seeds:
//   • a coach   (roles include "coach")
//   • a parent  (roles include "parent")
//   • athlete L — ACCEPTED coach + parent link (the linked athlete)
//   • athlete U — NO link at all (the unlinked athlete)
//   • athlete P — PENDING coach + parent link (link row exists but not accepted)
//
// For every coach/parent-facing athlete-scoped route it proves:
//   1. the LINKED relationship succeeds  (positive control — so the test can
//      never falsely pass by everyone getting 403), and
//   2. the UNLINKED and PENDING relationships are DENIED (403) with ZERO read of
//      the athlete's data and ZERO mutation of the athlete's records.
//
// Covered surfaces (all resolve an athlete by :id / by link, gated by an
// accepted coach_athlete_links / parent_athlete_links row):
//   • coach roster   — GET /api/coach/athletes            (link-scoped list)
//   • coach detail   — GET /api/coach/athletes/:id
//   • coach plan     — GET /api/coach/athletes/:id/plan
//   • coach context  — GET /api/coach/athletes/:id/context
//   • coach adopt    — POST /api/coach/athletes/:id/plan/adopt   (MUTATION)
//   • parent roster  — GET /api/parent/athletes           (link-scoped list)
//   • parent context — GET /api/parent/athletes/:id/context
//
// The adopt surface is the only mutation: the linked coach adopts an advised day
// into L's plan (source "coach"), and the denial legs assert that neither the
// unlinked nor the pending coach ever wrote a coach-sourced workout to U/P.
//
// Cleanup removes only rows this test created; the seeded profiles are removed
// last (their owned rows cascade).
//
// Run: `pnpm --filter @workspace/api-server run test:coach-parent-link-isolation`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
  trainingPlansTable,
  planDaysTable,
  plannedWorkoutsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
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
const RUN = `test_cplink_${Date.now()}`;
const clerkCoach = `${RUN}_coach`;
const clerkParent = `${RUN}_parent`;
const clerkLinked = `${RUN}_athlete_linked`;
const clerkUnlinked = `${RUN}_athlete_unlinked`;
const clerkPending = `${RUN}_athlete_pending`;

const seeded = {
  planId: 0,
  // The one non-rest advised day the linked coach adopts (positive control).
  adoptDayId: 0,
  adoptDayDate: "",
};

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── HTTP helper acting as a seeded dev user via x-dev-clerk-id ────────────────
async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; text: string; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

// Count coach-authored planned workouts for an athlete — the mutation guard for
// the adopt surface (a leak would be a source="coach" row written to a
// non-linked athlete).
async function coachWorkoutCount(clerkId: string): Promise<number> {
  const rows = await db
    .select({ id: plannedWorkoutsTable.id })
    .from(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.clerkId, clerkId),
        eq(plannedWorkoutsTable.source, "coach"),
      ),
    );
  return rows.length;
}

async function cleanup() {
  // Adopted coach workouts + the seeded plan/days for L (also cascade on profile
  // delete, but remove explicitly so a failed cascade never leaks fixtures).
  for (const c of [clerkLinked, clerkUnlinked, clerkPending]) {
    await db
      .delete(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(planDaysTable)
      .where(eq(planDaysTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(trainingPlansTable)
      .where(eq(trainingPlansTable.clerkId, c))
      .catch(() => {});
  }
  // Link rows (cascade on profile delete, removed explicitly first).
  await db
    .delete(coachAthleteLinksTable)
    .where(eq(coachAthleteLinksTable.coachClerkId, clerkCoach))
    .catch(() => {});
  await db
    .delete(parentAthleteLinksTable)
    .where(eq(parentAthleteLinksTable.parentClerkId, clerkParent))
    .catch(() => {});
  for (const c of [
    clerkCoach,
    clerkParent,
    clerkLinked,
    clerkUnlinked,
    clerkPending,
  ]) {
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

async function main() {
  await startServer();

  // Seed the five profiles.
  await ensureAccount(clerkCoach, `${clerkCoach}@example.test`, "Coach", silentLogger);
  await ensureAccount(clerkParent, `${clerkParent}@example.test`, "Ouder", silentLogger);
  await ensureAccount(clerkLinked, `${clerkLinked}@example.test`, "Atleet L", silentLogger);
  await ensureAccount(clerkUnlinked, `${clerkUnlinked}@example.test`, "Atleet U", silentLogger);
  await ensureAccount(clerkPending, `${clerkPending}@example.test`, "Atleet P", silentLogger);

  // Grant the coach/parent roles (ensureAccount defaults to ["athlete"]).
  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "coach"] })
    .where(eq(userProfilesTable.clerkId, clerkCoach));
  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "parent"] })
    .where(eq(userProfilesTable.clerkId, clerkParent));

  // Accepted links → athlete L.
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: clerkCoach,
    athleteClerkId: clerkLinked,
    status: "accepted",
  });
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: clerkParent,
    athleteClerkId: clerkLinked,
    status: "accepted",
  });

  // Pending links → athlete P (row exists but is NOT accepted).
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: clerkCoach,
    athleteClerkId: clerkPending,
    status: "pending",
  });
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: clerkParent,
    athleteClerkId: clerkPending,
    status: "pending",
  });

  // athlete U — deliberately NO link row of any kind.

  // Seed an ADVISORY plan for L with one adoptable (non-rest) day so the coach
  // adopt positive control performs a real mutation.
  seeded.adoptDayDate = isoOffset(2);
  const [plan] = await db
    .insert(trainingPlansTable)
    .values({
      clerkId: clerkLinked,
      status: "active",
      mode: "advisory",
      weekStartDate: isoOffset(0),
      horizonEndDate: isoOffset(20),
    })
    .returning({ id: trainingPlansTable.id });
  seeded.planId = plan!.id;

  const [adoptDay] = await db
    .insert(planDaysTable)
    .values({
      planId: seeded.planId,
      clerkId: clerkLinked,
      dayDate: seeded.adoptDayDate,
      weekIndex: 0,
      focus: "Duurtraining",
      trainingType: "duur",
      intensityLabel: "Zone 2 · rustig",
      estDurationMin: 90,
      isRest: false,
      routeNeeded: false,
      rationale: "Rustige duurrit",
    })
    .returning({ id: planDaysTable.id });
  seeded.adoptDayId = adoptDay!.id;

  // ── Precondition: dev bypass authorizes the coach role ──────────────────────
  await scenario("precondition: dev bypass authorizes coach role", async () => {
    const r = await req("GET", "/api/coach/athletes", clerkCoach);
    assert(
      r.status === 200,
      `expected 200 for coach via dev bypass, got ${r.status} — ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
    );
  });

  // ── COACH ROSTER (link-scoped list) ─────────────────────────────────────────
  await scenario(
    "coach roster: lists the linked athlete, never the unlinked/pending ones",
    async () => {
      const r = await req("GET", "/api/coach/athletes", clerkCoach);
      assert(r.status === 200, `coach roster expected 200, got ${r.status}`);
      const athletes = (r.json as { athletes?: Array<{ athleteClerkId: string }> })
        .athletes;
      assert(Array.isArray(athletes), "coach roster missing athletes array");
      const ids = new Set(athletes!.map((a) => a.athleteClerkId));
      assert(ids.has(clerkLinked), "coach roster must include the linked athlete");
      assert(
        !ids.has(clerkUnlinked),
        "coach roster leaked an UNLINKED athlete",
      );
      assert(
        !ids.has(clerkPending),
        "coach roster leaked a PENDING (not accepted) athlete",
      );
    },
  );

  // ── COACH DETAIL ─────────────────────────────────────────────────────────────
  await scenario(
    "coach detail: linked → 200 (positive control); unlinked/pending → 403 no read",
    async () => {
      const ok = await req("GET", `/api/coach/athletes/${clerkLinked}`, clerkCoach);
      assert(ok.status === 200, `linked coach detail expected 200, got ${ok.status}`);
      assert(
        ok.text.includes("Atleet L"),
        "linked coach detail missing the athlete's display name",
      );

      for (const [label, target] of [
        ["unlinked", clerkUnlinked],
        ["pending", clerkPending],
      ] as const) {
        const g = await req("GET", `/api/coach/athletes/${target}`, clerkCoach);
        assert(g.status === 403, `${label} coach detail must be 403, got ${g.status}`);
        assert(
          !g.text.includes(`Atleet ${label === "unlinked" ? "U" : "P"}`),
          `${label} coach detail leaked the athlete's data`,
        );
      }
    },
  );

  // ── COACH PLAN (advisory read) ───────────────────────────────────────────────
  await scenario(
    "coach plan: linked → 200 (positive control); unlinked/pending → 403 no read",
    async () => {
      const ok = await req(
        "GET",
        `/api/coach/athletes/${clerkLinked}/plan`,
        clerkCoach,
      );
      assert(ok.status === 200, `linked coach plan expected 200, got ${ok.status}`);
      const days = (ok.json as { days?: unknown[] }).days;
      assert(
        Array.isArray(days) && days.length > 0,
        "linked coach plan should surface the advised days",
      );

      for (const [label, target] of [
        ["unlinked", clerkUnlinked],
        ["pending", clerkPending],
      ] as const) {
        const g = await req(
          "GET",
          `/api/coach/athletes/${target}/plan`,
          clerkCoach,
        );
        assert(g.status === 403, `${label} coach plan must be 403, got ${g.status}`);
        assert(
          !g.text.includes("Duurtraining"),
          `${label} coach plan leaked advised-day data`,
        );
      }
    },
  );

  // ── COACH CONTEXT ────────────────────────────────────────────────────────────
  await scenario(
    "coach context: linked → 200 (positive control); unlinked/pending → 403",
    async () => {
      const ok = await req(
        "GET",
        `/api/coach/athletes/${clerkLinked}/context`,
        clerkCoach,
      );
      assert(ok.status === 200, `linked coach context expected 200, got ${ok.status}`);

      for (const [label, target] of [
        ["unlinked", clerkUnlinked],
        ["pending", clerkPending],
      ] as const) {
        const g = await req(
          "GET",
          `/api/coach/athletes/${target}/context`,
          clerkCoach,
        );
        assert(
          g.status === 403,
          `${label} coach context must be 403, got ${g.status}`,
        );
      }
    },
  );

  // ── COACH PLAN ADOPT (mutation) ──────────────────────────────────────────────
  await scenario(
    "coach adopt: unlinked/pending → 403 with ZERO mutation on that athlete",
    async () => {
      for (const [label, target] of [
        ["unlinked", clerkUnlinked],
        ["pending", clerkPending],
      ] as const) {
        const before = await coachWorkoutCount(target);
        const p = await req(
          "POST",
          `/api/coach/athletes/${target}/plan/adopt`,
          clerkCoach,
          { planDayIds: [seeded.adoptDayId] },
        );
        assert(p.status === 403, `${label} coach adopt must be 403, got ${p.status}`);
        const after = await coachWorkoutCount(target);
        assert(
          after === before,
          `${label} coach adopt mutated the athlete's plan — isolation broken (before ${before}, after ${after})`,
        );
      }
    },
  );

  await scenario(
    "coach adopt: linked coach CAN adopt an advised day (positive control, real mutation)",
    async () => {
      const before = await coachWorkoutCount(clerkLinked);
      const p = await req(
        "POST",
        `/api/coach/athletes/${clerkLinked}/plan/adopt`,
        clerkCoach,
        { planDayIds: [seeded.adoptDayId] },
      );
      assert(p.status === 201, `linked coach adopt expected 201, got ${p.status}`);
      const adopted = (p.json as { adopted?: number[] }).adopted ?? [];
      assert(
        adopted.includes(seeded.adoptDayId),
        "linked coach adopt did not report the day as adopted",
      );
      const after = await coachWorkoutCount(clerkLinked);
      assert(
        after === before + 1,
        `linked coach adopt should have written exactly one coach workout (before ${before}, after ${after})`,
      );
      // The written row lands on the advised day's date, owned by the athlete.
      const [row] = await db
        .select({ scheduledDate: plannedWorkoutsTable.scheduledDate })
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, clerkLinked),
            eq(plannedWorkoutsTable.source, "coach"),
            eq(plannedWorkoutsTable.scheduledDate, seeded.adoptDayDate),
          ),
        )
        .limit(1);
      assert(row != null, "adopted coach workout not found on the advised date");
    },
  );

  // ── PARENT ROSTER (link-scoped list) ─────────────────────────────────────────
  await scenario(
    "parent roster: lists the linked athlete, never the unlinked/pending ones",
    async () => {
      const r = await req("GET", "/api/parent/athletes", clerkParent);
      assert(r.status === 200, `parent roster expected 200, got ${r.status}`);
      const athletes = (r.json as { athletes?: Array<{ athleteClerkId: string }> })
        .athletes;
      assert(Array.isArray(athletes), "parent roster missing athletes array");
      const ids = new Set(athletes!.map((a) => a.athleteClerkId));
      assert(ids.has(clerkLinked), "parent roster must include the linked athlete");
      assert(
        !ids.has(clerkUnlinked),
        "parent roster leaked an UNLINKED athlete",
      );
      assert(
        !ids.has(clerkPending),
        "parent roster leaked a PENDING (not accepted) athlete",
      );
    },
  );

  // ── PARENT CONTEXT ───────────────────────────────────────────────────────────
  await scenario(
    "parent context: linked → 200 (positive control); unlinked/pending → 403",
    async () => {
      const ok = await req(
        "GET",
        `/api/parent/athletes/${clerkLinked}/context`,
        clerkParent,
      );
      assert(
        ok.status === 200,
        `linked parent context expected 200, got ${ok.status}`,
      );

      for (const [label, target] of [
        ["unlinked", clerkUnlinked],
        ["pending", clerkPending],
      ] as const) {
        const g = await req(
          "GET",
          `/api/parent/athletes/${target}/context`,
          clerkParent,
        );
        assert(
          g.status === 403,
          `${label} parent context must be 403, got ${g.status}`,
        );
      }
    },
  );

  // ── Cross-role guard: a coach cannot use the parent surface and vice-versa ────
  await scenario(
    "cross-role: coach denied on parent surface; parent denied on coach surface",
    async () => {
      // The parent context route requires the parent role → coach gets 403.
      const coachOnParent = await req(
        "GET",
        `/api/parent/athletes/${clerkLinked}/context`,
        clerkCoach,
      );
      assert(
        coachOnParent.status === 403,
        `coach on parent surface must be 403, got ${coachOnParent.status}`,
      );
      // The coach detail route requires the coach role → parent gets 403.
      const parentOnCoach = await req(
        "GET",
        `/api/coach/athletes/${clerkLinked}`,
        clerkParent,
      );
      assert(
        parentOnCoach.status === 403,
        `parent on coach surface must be 403, got ${parentOnCoach.status}`,
      );
    },
  );
}

main()
  .catch((err) => {
    results.push({
      scenario: "fatal",
      status: "fail",
      note: err instanceof Error ? err.stack || err.message : String(err),
    });
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await stopServer().catch(() => {});

    const failed = results.filter((r) => r.status === "fail");
    console.log("\n── Coach/parent link isolation ──────────────────────────────");
    for (const r of results) {
      const mark = r.status === "pass" ? "✓" : "✗";
      console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed.`,
    );

    // Close the pool so the process can exit cleanly.
    try {
      const { pool } = await import("@workspace/db");
      await pool.end();
    } catch {
      /* ignore */
    }

    process.exit(failed.length > 0 ? 1 : 0);
  });
