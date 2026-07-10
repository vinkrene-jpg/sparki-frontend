// Coach/parent sharing-LEVEL enforcement — DB-backed route contract test.
//
// The sibling test (test:coach-parent-link-isolation) proves an UNLINKED or
// PENDING coach/parent is denied. But an ACCEPTED link is not a blank cheque:
// the athlete's own `dataSharingCoach` / `dataSharingParent` preference must
// still limit WHAT a legitimately-linked coach/parent can see. That test runs
// on the DEFAULT sharing (coach=summary, parent=safety_only), so a regression
// that ignores a stricter setting — e.g. the athlete chose `none`, or a coach
// on `summary` who should not see raw metrics — would leak detail the athlete
// explicitly chose not to share, and go completely unnoticed.
//
// This test boots the REAL Express app and seeds ONE athlete with an ACCEPTED
// coach link AND an ACCEPTED parent link, plus real, distinctively-marked data
// (daily metrics, a future planned workout, an advisory plan day, and a shared
// context memory). It then walks every meaningful production sharing tier by
// flipping the athlete's privacy_settings row and asserts, for each tier, that
// the coach/parent surfaces return the honest restricted shape — omitting the
// withheld data — while NEVER 500-ing.
//
// Coach tiers (dataSharingCoach): none | summary | full
//   • none    → roster entry is base-only (no discipline/readiness/metric);
//               detail/plan return the null "deelt geen data" shape;
//               context returns []; adopt is 403 with ZERO mutation.
//   • summary → roster has readiness but NO raw `latestMetric`; detail caps the
//               metric history (slice of 3), no raw latestMetric.
//   • full    → roster exposes the raw `latestMetric`; detail returns the wider
//               metric history (more than the summary cap).
//
// Parent tiers (dataSharingParent): none | safety_only | summary
//   • none        → roster entry base-only (no wellbeing / no schedule);
//                   context returns [].
//   • safety_only → roster has wellbeing signals but NO training schedule;
//                   never exposes power/performance data.
//   • summary     → roster adds the upcoming schedule on top of wellbeing.
//
// The withheld-data markers (a distinctive planned-workout title, plan-day
// focus and context-memory title) let each denial leg assert the string is
// ABSENT from the restricted response — a structural check alone could pass
// even if the payload still carried the value under a different key.
//
// Cleanup removes only rows this test created; the seeded profiles are removed
// last (their owned rows cascade).
//
// Run: `pnpm --filter @workspace/api-server run test:coach-parent-sharing-levels`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
  privacySettingsTable,
  athleteDailyMetricsTable,
  plannedWorkoutsTable,
  personalContextMemoriesTable,
  trainingPlansTable,
  planDaysTable,
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
const RUN = `test_cpshare_${Date.now()}`;
const clerkCoach = `${RUN}_coach`;
const clerkParent = `${RUN}_parent`;
const clerkAthlete = `${RUN}_athlete`;

// Distinctive markers so a leak is detectable by string, not just by shape.
const MARK_PLANNED = `MARK_PLANNED_${RUN}`;
const MARK_PLANDAY = `MARK_PLANDAY_${RUN}`;
const MARK_CTX = `MARK_CTX_${RUN}`;

const seeded = { planId: 0, adoptDayId: 0, adoptDayDate: "" };

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

// Set the athlete's sharing preference (upsert the single privacy_settings row).
async function setSharing(
  coach: "none" | "summary" | "full",
  parent: "none" | "safety_only" | "summary",
): Promise<void> {
  await db
    .insert(privacySettingsTable)
    .values({
      clerkId: clerkAthlete,
      dataSharingCoach: coach,
      dataSharingParent: parent,
    })
    .onConflictDoUpdate({
      target: privacySettingsTable.clerkId,
      set: { dataSharingCoach: coach, dataSharingParent: parent },
    });
}

// Coach-authored planned workouts for the athlete — the mutation guard for the
// adopt surface (a `none` athlete must never get a coach-sourced row written).
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

// The coach roster / detail entry for the seeded athlete.
function coachAthleteEntry(json: unknown): Record<string, unknown> | undefined {
  const athletes = (json as { athletes?: Array<Record<string, unknown>> })
    .athletes;
  return athletes?.find((a) => a.athleteClerkId === clerkAthlete);
}
function parentAthleteEntry(json: unknown): Record<string, unknown> | undefined {
  const athletes = (json as { athletes?: Array<Record<string, unknown>> })
    .athletes;
  return athletes?.find((a) => a.athleteClerkId === clerkAthlete);
}

async function cleanup() {
  await db
    .delete(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.clerkId, clerkAthlete))
    .catch(() => {});
  await db
    .delete(planDaysTable)
    .where(eq(planDaysTable.clerkId, clerkAthlete))
    .catch(() => {});
  await db
    .delete(trainingPlansTable)
    .where(eq(trainingPlansTable.clerkId, clerkAthlete))
    .catch(() => {});
  await db
    .delete(athleteDailyMetricsTable)
    .where(eq(athleteDailyMetricsTable.clerkId, clerkAthlete))
    .catch(() => {});
  await db
    .delete(personalContextMemoriesTable)
    .where(eq(personalContextMemoriesTable.clerkId, clerkAthlete))
    .catch(() => {});
  await db
    .delete(privacySettingsTable)
    .where(eq(privacySettingsTable.clerkId, clerkAthlete))
    .catch(() => {});
  await db
    .delete(coachAthleteLinksTable)
    .where(eq(coachAthleteLinksTable.coachClerkId, clerkCoach))
    .catch(() => {});
  await db
    .delete(parentAthleteLinksTable)
    .where(eq(parentAthleteLinksTable.parentClerkId, clerkParent))
    .catch(() => {});
  for (const c of [clerkCoach, clerkParent, clerkAthlete]) {
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

async function main() {
  await startServer();

  // Seed profiles.
  await ensureAccount(clerkCoach, `${clerkCoach}@example.test`, "Coach", silentLogger);
  await ensureAccount(clerkParent, `${clerkParent}@example.test`, "Ouder", silentLogger);
  await ensureAccount(clerkAthlete, `${clerkAthlete}@example.test`, "Atleet S", silentLogger);

  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "coach"] })
    .where(eq(userProfilesTable.clerkId, clerkCoach));
  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "parent"] })
    .where(eq(userProfilesTable.clerkId, clerkParent));

  // Accepted links (coach + parent) → the athlete.
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: clerkCoach,
    athleteClerkId: clerkAthlete,
    status: "accepted",
  });
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: clerkParent,
    athleteClerkId: clerkAthlete,
    status: "accepted",
  });

  // Real data so the positive-control tiers surface something and the withheld
  // tiers have real values to withhold. 5 daily metrics on distinct dates lets
  // us assert that summary caps the history while full returns more.
  for (let i = 0; i < 5; i++) {
    await db.insert(athleteDailyMetricsTable).values({
      clerkId: clerkAthlete,
      metricDate: isoOffset(-i),
      feelScore: 7,
      fatigueScore: 3,
      sleepHours: "7.50",
      sleepQuality: 8,
    });
  }

  // A future planned workout — surfaces as coach nextSession/schedule and as the
  // parent schedule ONLY at summary. Its distinctive title is the leak marker.
  await db.insert(plannedWorkoutsTable).values({
    clerkId: clerkAthlete,
    scheduledDate: isoOffset(1),
    type: "ride",
    title: MARK_PLANNED,
    status: "planned",
    source: "sparki",
  });

  // An advisory plan with one adoptable day — the coach plan surface + adopt.
  seeded.adoptDayDate = isoOffset(2);
  const [plan] = await db
    .insert(trainingPlansTable)
    .values({
      clerkId: clerkAthlete,
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
      clerkId: clerkAthlete,
      dayDate: seeded.adoptDayDate,
      weekIndex: 0,
      focus: MARK_PLANDAY,
      trainingType: "duur",
      intensityLabel: "Zone 2 · rustig",
      estDurationMin: 90,
      isRest: false,
      routeNeeded: false,
      rationale: "Rustige duurrit",
    })
    .returning({ id: planDaysTable.id });
  seeded.adoptDayId = adoptDay!.id;

  // A SHARED context memory — surfaces on coach/parent context at non-none.
  await db.insert(personalContextMemoriesTable).values({
    clerkId: clerkAthlete,
    kind: "general",
    statement: "interne notitie",
    title: MARK_CTX,
    detail: "Gedeelde context",
    followUpQuestion: "Hoe ging het?",
    visibility: "shared",
    enabled: true,
    status: "scheduled",
  });

  // ── Precondition: dev bypass authorizes both roles ──────────────────────────
  await scenario("precondition: dev bypass authorizes coach + parent", async () => {
    const c = await req("GET", "/api/coach/athletes", clerkCoach);
    assert(c.status === 200, `coach roster expected 200, got ${c.status}`);
    const p = await req("GET", "/api/parent/athletes", clerkParent);
    assert(p.status === 200, `parent roster expected 200, got ${p.status}`);
  });

  // ══ COACH: none ═════════════════════════════════════════════════════════════
  await scenario(
    "coach none: roster entry is base-only, no readiness/metric/discipline",
    async () => {
      await setSharing("none", "safety_only");
      const r = await req("GET", "/api/coach/athletes", clerkCoach);
      assert(r.status === 200, `roster expected 200, got ${r.status}`);
      const e = coachAthleteEntry(r.json);
      assert(e, "linked athlete missing from coach roster");
      assert(e!.sharing === "none", `expected sharing none, got ${e!.sharing}`);
      assert(!("latestMetric" in e!), "coach none roster leaked latestMetric");
      assert(!("readiness" in e!), "coach none roster leaked readiness");
      assert(!("discipline" in e!), "coach none roster leaked discipline");
      assert(!("nextSession" in e!), "coach none roster leaked nextSession");
      assert(!r.text.includes(MARK_PLANNED), "coach none roster leaked schedule");
    },
  );

  await scenario(
    "coach none: detail returns null shape, no metric/schedule leak, not 500",
    async () => {
      const r = await req("GET", `/api/coach/athletes/${clerkAthlete}`, clerkCoach);
      assert(r.status === 200, `detail expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; athlete?: unknown };
      assert(body.sharing === "none", `expected sharing none, got ${body.sharing}`);
      assert(body.athlete === null, "coach none detail must not expose athlete");
      assert(!r.text.includes(MARK_PLANNED), "coach none detail leaked schedule");
    },
  );

  await scenario(
    "coach none: plan returns empty null shape, no plan-day leak, not 500",
    async () => {
      const r = await req(
        "GET",
        `/api/coach/athletes/${clerkAthlete}/plan`,
        clerkCoach,
      );
      assert(r.status === 200, `plan expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; plan?: unknown; days?: unknown[] };
      assert(body.sharing === "none", `expected sharing none, got ${body.sharing}`);
      assert(body.plan === null, "coach none plan must be null");
      assert(
        Array.isArray(body.days) && body.days.length === 0,
        "coach none plan must return zero days",
      );
      assert(!r.text.includes(MARK_PLANDAY), "coach none plan leaked plan-day data");
    },
  );

  await scenario(
    "coach none: context returns empty, no memory leak, not 500",
    async () => {
      const r = await req(
        "GET",
        `/api/coach/athletes/${clerkAthlete}/context`,
        clerkCoach,
      );
      assert(r.status === 200, `context expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; memories?: unknown[] };
      assert(body.sharing === "none", `expected sharing none, got ${body.sharing}`);
      assert(
        Array.isArray(body.memories) && body.memories.length === 0,
        "coach none context must return zero memories",
      );
      assert(!r.text.includes(MARK_CTX), "coach none context leaked a memory");
    },
  );

  await scenario(
    "coach none: adopt is 403 with ZERO mutation on the athlete",
    async () => {
      const before = await coachWorkoutCount(clerkAthlete);
      const p = await req(
        "POST",
        `/api/coach/athletes/${clerkAthlete}/plan/adopt`,
        clerkCoach,
        { planDayIds: [seeded.adoptDayId] },
      );
      assert(p.status === 403, `coach none adopt must be 403, got ${p.status}`);
      const after = await coachWorkoutCount(clerkAthlete);
      assert(
        after === before,
        `coach none adopt mutated the plan (before ${before}, after ${after})`,
      );
    },
  );

  // ══ COACH: summary ══════════════════════════════════════════════════════════
  await scenario(
    "coach summary: roster has readiness but NO raw latestMetric",
    async () => {
      await setSharing("summary", "safety_only");
      const r = await req("GET", "/api/coach/athletes", clerkCoach);
      assert(r.status === 200, `roster expected 200, got ${r.status}`);
      const e = coachAthleteEntry(r.json);
      assert(e, "linked athlete missing from coach roster");
      assert(e!.sharing === "summary", `expected summary, got ${e!.sharing}`);
      assert("readiness" in e!, "coach summary roster missing readiness");
      assert(
        e!.latestMetric === undefined,
        "coach summary roster leaked raw latestMetric",
      );
    },
  );

  await scenario(
    "coach summary: detail caps metric history to the summary slice",
    async () => {
      const r = await req("GET", `/api/coach/athletes/${clerkAthlete}`, clerkCoach);
      assert(r.status === 200, `detail expected 200, got ${r.status}`);
      const body = r.json as {
        sharing?: string;
        athlete?: { metrics?: unknown[] } | null;
      };
      assert(body.sharing === "summary", `expected summary, got ${body.sharing}`);
      assert(body.athlete != null, "coach summary detail should expose the athlete");
      const metrics = body.athlete!.metrics;
      assert(Array.isArray(metrics), "coach summary detail missing metrics array");
      assert(
        metrics!.length <= 3,
        `coach summary detail must cap metrics at 3, got ${metrics!.length}`,
      );
    },
  );

  // ══ COACH: full ═════════════════════════════════════════════════════════════
  await scenario(
    "coach full: roster exposes raw latestMetric; detail widens the history",
    async () => {
      await setSharing("full", "safety_only");
      const r = await req("GET", "/api/coach/athletes", clerkCoach);
      assert(r.status === 200, `roster expected 200, got ${r.status}`);
      const e = coachAthleteEntry(r.json);
      assert(e, "linked athlete missing from coach roster");
      assert(e!.sharing === "full", `expected full, got ${e!.sharing}`);
      assert(
        e!.latestMetric !== undefined && e!.latestMetric !== null,
        "coach full roster should expose the raw latestMetric",
      );

      const d = await req("GET", `/api/coach/athletes/${clerkAthlete}`, clerkCoach);
      assert(d.status === 200, `detail expected 200, got ${d.status}`);
      const body = d.json as { athlete?: { metrics?: unknown[] } | null };
      const metrics = body.athlete!.metrics;
      assert(Array.isArray(metrics), "coach full detail missing metrics array");
      assert(
        metrics!.length > 3,
        `coach full detail should widen the history beyond the summary cap, got ${metrics!.length}`,
      );
    },
  );

  // ══ PARENT: none ════════════════════════════════════════════════════════════
  await scenario(
    "parent none: roster entry is base-only, no wellbeing/schedule",
    async () => {
      await setSharing("full", "none");
      const r = await req("GET", "/api/parent/athletes", clerkParent);
      assert(r.status === 200, `roster expected 200, got ${r.status}`);
      const e = parentAthleteEntry(r.json);
      assert(e, "linked athlete missing from parent roster");
      assert(e!.sharing === "none", `expected none, got ${e!.sharing}`);
      assert(!("wellbeing" in e!), "parent none roster leaked wellbeing");
      assert(!("schedule" in e!), "parent none roster leaked schedule");
      assert(!("healthStatus" in e!), "parent none roster leaked healthStatus");
      assert(!r.text.includes(MARK_PLANNED), "parent none roster leaked schedule");
    },
  );

  await scenario(
    "parent none: context returns empty, no memory leak, not 500",
    async () => {
      const r = await req(
        "GET",
        `/api/parent/athletes/${clerkAthlete}/context`,
        clerkParent,
      );
      assert(r.status === 200, `context expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; memories?: unknown[] };
      assert(body.sharing === "none", `expected none, got ${body.sharing}`);
      assert(
        Array.isArray(body.memories) && body.memories.length === 0,
        "parent none context must return zero memories",
      );
      assert(!r.text.includes(MARK_CTX), "parent none context leaked a memory");
    },
  );

  // ══ PARENT: safety_only ═════════════════════════════════════════════════════
  await scenario(
    "parent safety_only: roster has wellbeing but NO schedule",
    async () => {
      await setSharing("full", "safety_only");
      const r = await req("GET", "/api/parent/athletes", clerkParent);
      assert(r.status === 200, `roster expected 200, got ${r.status}`);
      const e = parentAthleteEntry(r.json);
      assert(e, "linked athlete missing from parent roster");
      assert(e!.sharing === "safety_only", `expected safety_only, got ${e!.sharing}`);
      assert("wellbeing" in e!, "parent safety_only roster missing wellbeing");
      assert(
        !("schedule" in e!),
        "parent safety_only roster leaked the training schedule",
      );
      assert(
        !r.text.includes(MARK_PLANNED),
        "parent safety_only roster leaked schedule data",
      );
    },
  );

  // ══ PARENT: summary ═════════════════════════════════════════════════════════
  await scenario(
    "parent summary: roster adds the upcoming schedule on top of wellbeing",
    async () => {
      await setSharing("full", "summary");
      const r = await req("GET", "/api/parent/athletes", clerkParent);
      assert(r.status === 200, `roster expected 200, got ${r.status}`);
      const e = parentAthleteEntry(r.json);
      assert(e, "linked athlete missing from parent roster");
      assert(e!.sharing === "summary", `expected summary, got ${e!.sharing}`);
      assert("wellbeing" in e!, "parent summary roster missing wellbeing");
      assert("schedule" in e!, "parent summary roster missing schedule");
      assert(
        r.text.includes(MARK_PLANNED),
        "parent summary roster should surface the upcoming session",
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
    console.log("\n── Coach/parent sharing levels ──────────────────────────────");
    for (const r of results) {
      const mark = r.status === "pass" ? "✓" : "✗";
      console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed.`,
    );

    try {
      const { pool } = await import("@workspace/db");
      await pool.end();
    } catch {
      /* ignore */
    }

    process.exit(failed.length > 0 ? 1 : 0);
  });
