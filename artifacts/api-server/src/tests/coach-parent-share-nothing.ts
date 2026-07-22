// Athlete "shares nothing" privacy guarantee — DB-backed route contract test.
//
// The sibling tests already pin two privacy dimensions:
//   • test:coach-parent-link-isolation  — an UNLINKED/PENDING/REVOKED coach or
//     parent is denied entirely.
//   • test:coach-parent-sharing-levels  — an ACCEPTED coach/parent sees a
//     LEVEL-appropriate slice as the athlete walks each sharing tier.
//
// This test pins a third, distinct scenario the others never assert in one
// narrative: an athlete who is LEGITIMATELY LINKED to BOTH a coach and a parent
// but has set their sharing to "none" for EVERYONE at once. An accepted link is
// not consent to read data — the athlete's "share nothing" choice must withhold
// ALL real data from BOTH linked viewers simultaneously. The route branches on
// `coachSharingLevel === "none"` / `parentSharingLevel === "none"` and return
// empty/null payloads instead of data; a regression in either branch would
// silently leak a linked athlete's plan/context/readiness despite their explicit
// choice. Nothing here would be caught by the link-isolation test (the links ARE
// accepted) nor by the tiered test (which never sets coach=none AND parent=none
// together, and never proves a single none→restore round-trip on the same links).
//
// It boots the REAL Express app and seeds ONE athlete with an ACCEPTED coach
// link AND an ACCEPTED parent link, plus real, distinctively-marked data (daily
// metrics, a future planned workout, an advisory plan day, a shared context
// memory). Then, with sharing = { coach: none, parent: none }, it sweeps every
// coach + parent surface and asserts each returns 200 with the withheld shape
// and NONE of the leak markers — then adopt is 403 with ZERO mutation.
//
// Positive control (the guard against a false pass): it flips sharing back to
// { coach: full, parent: summary } on the SAME athlete/SAME links and proves the
// real data reappears across the same surfaces. If the "none" legs passed only
// because the seed produced no data, this leg would fail.
//
// Covered surfaces:
//   • coach roster   — GET /api/coach/athletes
//   • coach detail   — GET /api/coach/athletes/:id
//   • coach plan     — GET /api/coach/athletes/:id/plan
//   • coach context  — GET /api/coach/athletes/:id/context
//   • coach adopt    — POST /api/coach/athletes/:id/plan/adopt   (MUTATION)
//   • parent roster  — GET /api/parent/athletes
//   • parent context — GET /api/parent/athletes/:id/context
//
// Cleanup removes only rows this test created; the seeded profiles are removed
// last (their owned rows cascade).
//
// Run: `pnpm --filter @workspace/api-server run test:coach-parent-share-nothing`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
  privacySettingsTable,
  athleteProfilesTable,
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
const RUN = `test_cpnothing_${Date.now()}`;
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
// adopt surface (a "none" athlete must never get a coach-sourced row written).
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
  await ensureAccount(clerkAthlete, `${clerkAthlete}@example.test`, "Atleet N", silentLogger);

  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "coach"] })
    .where(eq(userProfilesTable.clerkId, clerkCoach));
  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "parent"] })
    .where(eq(userProfilesTable.clerkId, clerkParent));

  // ACCEPTED links (coach + parent) → the athlete. These stay accepted for the
  // whole run — the ONLY thing that changes is the athlete's sharing preference.
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

  // Real data so "none" has real values to withhold and the positive control has
  // something to surface. Several distinct metric dates so the coach full detail
  // widens the history in the positive control.
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

  await db.insert(plannedWorkoutsTable).values({
    clerkId: clerkAthlete,
    scheduledDate: isoOffset(1),
    type: "ride",
    title: MARK_PLANNED,
    status: "planned",
    source: "sparki",
  });

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

  // ══ SHARE NOTHING: coach=none AND parent=none simultaneously ════════════════
  await setSharing("none", "none");

  await scenario(
    "precondition: both linked viewers are authorized (dev bypass roles)",
    async () => {
      const c = await req("GET", "/api/coach/athletes", clerkCoach);
      assert(c.status === 200, `coach roster expected 200, got ${c.status}`);
      const p = await req("GET", "/api/parent/athletes", clerkParent);
      assert(p.status === 200, `parent roster expected 200, got ${p.status}`);
    },
  );

  await scenario(
    "share-nothing coach roster: athlete present but base-only, no real data",
    async () => {
      const r = await req("GET", "/api/coach/athletes", clerkCoach);
      assert(r.status === 200, `coach roster expected 200, got ${r.status}`);
      const e = coachAthleteEntry(r.json);
      assert(e, "linked athlete missing from coach roster");
      assert(e!.sharing === "none", `expected sharing none, got ${e!.sharing}`);
      assert(!("readiness" in e!), "coach share-nothing roster leaked readiness");
      assert(!("latestMetric" in e!), "coach share-nothing roster leaked latestMetric");
      assert(!("discipline" in e!), "coach share-nothing roster leaked discipline");
      assert(!("nextSession" in e!), "coach share-nothing roster leaked nextSession");
      assert(!r.text.includes(MARK_PLANNED), "coach share-nothing roster leaked schedule");
    },
  );

  await scenario(
    "share-nothing coach detail: null athlete, no metric/schedule leak, not 500",
    async () => {
      const r = await req("GET", `/api/coach/athletes/${clerkAthlete}`, clerkCoach);
      assert(r.status === 200, `coach detail expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; athlete?: unknown };
      assert(body.sharing === "none", `expected sharing none, got ${body.sharing}`);
      assert(body.athlete === null, "coach share-nothing detail must not expose athlete");
      assert(!r.text.includes(MARK_PLANNED), "coach share-nothing detail leaked schedule");
    },
  );

  await scenario(
    "share-nothing coach plan: null plan, zero days, no plan-day leak, not 500",
    async () => {
      const r = await req(
        "GET",
        `/api/coach/athletes/${clerkAthlete}/plan`,
        clerkCoach,
      );
      assert(r.status === 200, `coach plan expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; plan?: unknown; days?: unknown[] };
      assert(body.sharing === "none", `expected sharing none, got ${body.sharing}`);
      assert(body.plan === null, "coach share-nothing plan must be null");
      assert(
        Array.isArray(body.days) && body.days.length === 0,
        "coach share-nothing plan must return zero days",
      );
      assert(!r.text.includes(MARK_PLANDAY), "coach share-nothing plan leaked plan-day data");
    },
  );

  await scenario(
    "share-nothing coach context: zero memories, no memory leak, not 500",
    async () => {
      const r = await req(
        "GET",
        `/api/coach/athletes/${clerkAthlete}/context`,
        clerkCoach,
      );
      assert(r.status === 200, `coach context expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; memories?: unknown[] };
      assert(body.sharing === "none", `expected sharing none, got ${body.sharing}`);
      assert(
        Array.isArray(body.memories) && body.memories.length === 0,
        "coach share-nothing context must return zero memories",
      );
      assert(!r.text.includes(MARK_CTX), "coach share-nothing context leaked a memory");
    },
  );

  await scenario(
    "share-nothing coach adopt: 403 with ZERO mutation on the athlete",
    async () => {
      const before = await coachWorkoutCount(clerkAthlete);
      const p = await req(
        "POST",
        `/api/coach/athletes/${clerkAthlete}/plan/adopt`,
        clerkCoach,
        { planDayIds: [seeded.adoptDayId] },
      );
      assert(p.status === 403, `coach share-nothing adopt must be 403, got ${p.status}`);
      const after = await coachWorkoutCount(clerkAthlete);
      assert(
        after === before,
        `coach share-nothing adopt mutated the plan (before ${before}, after ${after})`,
      );
    },
  );

  await scenario(
    "share-nothing parent roster: athlete present but base-only, no wellbeing/schedule",
    async () => {
      const r = await req("GET", "/api/parent/athletes", clerkParent);
      assert(r.status === 200, `parent roster expected 200, got ${r.status}`);
      const e = parentAthleteEntry(r.json);
      assert(e, "linked athlete missing from parent roster");
      assert(e!.sharing === "none", `expected sharing none, got ${e!.sharing}`);
      assert(!("wellbeing" in e!), "parent share-nothing roster leaked wellbeing");
      assert(!("schedule" in e!), "parent share-nothing roster leaked schedule");
      assert(!("healthStatus" in e!), "parent share-nothing roster leaked healthStatus");
      assert(!r.text.includes(MARK_PLANNED), "parent share-nothing roster leaked schedule");
    },
  );

  await scenario(
    "share-nothing parent context: zero memories, no memory leak, not 500",
    async () => {
      const r = await req(
        "GET",
        `/api/parent/athletes/${clerkAthlete}/context`,
        clerkParent,
      );
      assert(r.status === 200, `parent context expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; memories?: unknown[] };
      assert(body.sharing === "none", `expected sharing none, got ${body.sharing}`);
      assert(
        Array.isArray(body.memories) && body.memories.length === 0,
        "parent share-nothing context must return zero memories",
      );
      assert(!r.text.includes(MARK_CTX), "parent share-nothing context leaked a memory");
    },
  );

  // ══ POSITIVE CONTROL: restore sharing → the SAME data reappears ═════════════
  // Proves the "none" legs above withheld REAL data, not that the seed was empty.
  // The links never changed; only the athlete's preference flipped back.
  await setSharing("full", "summary");
  // Golf 12: onbevestigde rechten blijven op het veiligheidsminimum en
  // onbekende leeftijd is fail-closed. Geef de sporter een volwassen
  // geboortedatum en bevestig de summary-rechten expliciet, zoals de sporter
  // dat via PUT /api/links/parent/:id/permissions zou doen.
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: "1990-01-01", birthYear: 1990 })
    .where(eq(athleteProfilesTable.clerkId, clerkAthlete));
  await db
    .update(parentAthleteLinksTable)
    .set({ consentConfirmedAt: new Date(), ageTierAtConsent: "adult" })
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, clerkParent),
        eq(parentAthleteLinksTable.athleteClerkId, clerkAthlete),
      ),
    );

  await scenario(
    "restore coach roster: full sharing surfaces readiness + raw latestMetric",
    async () => {
      const r = await req("GET", "/api/coach/athletes", clerkCoach);
      assert(r.status === 200, `coach roster expected 200, got ${r.status}`);
      const e = coachAthleteEntry(r.json);
      assert(e, "linked athlete missing from coach roster after restore");
      assert(e!.sharing === "full", `expected sharing full, got ${e!.sharing}`);
      assert("readiness" in e!, "coach full roster missing readiness after restore");
      assert(
        e!.latestMetric !== undefined && e!.latestMetric !== null,
        "coach full roster should expose the raw latestMetric after restore",
      );
    },
  );

  await scenario(
    "restore coach detail: exposes the athlete + metric history",
    async () => {
      const r = await req("GET", `/api/coach/athletes/${clerkAthlete}`, clerkCoach);
      assert(r.status === 200, `coach detail expected 200, got ${r.status}`);
      const body = r.json as {
        sharing?: string;
        athlete?: { metrics?: unknown[] } | null;
      };
      assert(body.sharing === "full", `expected sharing full, got ${body.sharing}`);
      assert(body.athlete != null, "coach full detail should expose the athlete after restore");
      assert(
        Array.isArray(body.athlete!.metrics) && body.athlete!.metrics.length > 0,
        "coach full detail should surface metric history after restore",
      );
    },
  );

  await scenario(
    "restore coach plan: advisory day reappears (marker present)",
    async () => {
      const r = await req(
        "GET",
        `/api/coach/athletes/${clerkAthlete}/plan`,
        clerkCoach,
      );
      assert(r.status === 200, `coach plan expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; plan?: unknown; days?: unknown[] };
      assert(body.sharing === "full", `expected sharing full, got ${body.sharing}`);
      assert(body.plan != null, "coach full plan must expose the advisory plan after restore");
      assert(
        Array.isArray(body.days) && body.days.length > 0,
        "coach full plan should surface the advised days after restore",
      );
      assert(r.text.includes(MARK_PLANDAY), "coach full plan should surface the plan-day after restore");
    },
  );

  await scenario(
    "restore coach context: the shared memory reappears (marker present)",
    async () => {
      const r = await req(
        "GET",
        `/api/coach/athletes/${clerkAthlete}/context`,
        clerkCoach,
      );
      assert(r.status === 200, `coach context expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; memories?: unknown[] };
      assert(body.sharing === "full", `expected sharing full, got ${body.sharing}`);
      assert(
        Array.isArray(body.memories) && body.memories.length > 0,
        "coach full context should surface the shared memory after restore",
      );
      assert(r.text.includes(MARK_CTX), "coach full context should surface the memory after restore");
    },
  );

  await scenario(
    "restore coach adopt: the linked coach CAN now adopt (real mutation)",
    async () => {
      const before = await coachWorkoutCount(clerkAthlete);
      const p = await req(
        "POST",
        `/api/coach/athletes/${clerkAthlete}/plan/adopt`,
        clerkCoach,
        { planDayIds: [seeded.adoptDayId] },
      );
      assert(p.status === 201, `coach adopt expected 201 after restore, got ${p.status}`);
      const adopted = (p.json as { adopted?: number[] }).adopted ?? [];
      assert(
        adopted.includes(seeded.adoptDayId),
        "coach adopt did not report the day as adopted after restore",
      );
      const after = await coachWorkoutCount(clerkAthlete);
      assert(
        after === before + 1,
        `coach adopt should write exactly one coach workout after restore (before ${before}, after ${after})`,
      );
    },
  );

  await scenario(
    "restore parent roster: summary surfaces wellbeing + schedule",
    async () => {
      const r = await req("GET", "/api/parent/athletes", clerkParent);
      assert(r.status === 200, `parent roster expected 200, got ${r.status}`);
      const e = parentAthleteEntry(r.json);
      assert(e, "linked athlete missing from parent roster after restore");
      assert(e!.sharing === "summary", `expected sharing summary, got ${e!.sharing}`);
      assert("wellbeing" in e!, "parent summary roster missing wellbeing after restore");
      assert("schedule" in e!, "parent summary roster missing schedule after restore");
      assert(
        r.text.includes(MARK_PLANNED),
        "parent summary roster should surface the upcoming session after restore",
      );
    },
  );

  await scenario(
    "restore parent context: the shared memory reappears (marker present)",
    async () => {
      const r = await req(
        "GET",
        `/api/parent/athletes/${clerkAthlete}/context`,
        clerkParent,
      );
      assert(r.status === 200, `parent context expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; memories?: unknown[] };
      assert(body.sharing === "summary", `expected sharing summary, got ${body.sharing}`);
      assert(
        Array.isArray(body.memories) && body.memories.length > 0,
        "parent summary context should surface the shared memory after restore",
      );
      assert(r.text.includes(MARK_CTX), "parent summary context should surface the memory after restore");
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
    console.log("\n── Athlete shares nothing: privacy guarantee ────────────────");
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
