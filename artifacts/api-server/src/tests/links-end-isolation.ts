// End-from-your-side isolation — DB-backed route contract test for the coach's
// and parent's own "end link" endpoints.
//
// The athlete-side revoke lives in links-unlink-isolation. This is the mirror:
// a coach ends a link to an athlete, and a parent ends a link to a child, each
// from their OWN side via:
//   • DELETE /api/links/as-coach/:athleteClerkId
//   • DELETE /api/links/as-parent/:athleteClerkId
//
// Both routes scope the delete to the CALLER (coachClerkId = me / parentClerkId
// = me). That scoping is the ONLY thing standing between "a coach ends its own
// athlete link" and "a coach deletes an arbitrary link row belonging to another
// coach" — a cross-account mutation. A regression that dropped the caller filter
// on either DELETE would fail here.
//
// It boots the REAL Express app and seeds:
//   • coach   C  (roles include "coach") — the self-ender
//   • coach   C2 (roles include "coach") — an unrelated coach whose link must
//                 survive when C fires the DELETE
//   • parent  P  (roles include "parent") — the self-ender
//   • parent  P2 (roles include "parent") — an unrelated parent whose link must
//                 survive when P fires the DELETE
//   • athlete A — ACCEPTED links to C, C2, P and P2
//
// It proves:
//   1. Coach C ends its OWN link to A → the C–A row is gone and C is then denied
//      403 on A's coach surface (positive control: the end works).
//   2. C ending its link does NOT touch C2's link to A: C2's row survives and C2
//      keeps 200 access to A (the delete is scoped to the caller only).
//   3. Parent P ends its OWN link to A → the P–A row is gone and P is then denied
//      403 on A's parent surface.
//   4. P ending its link does NOT touch P2's link to A: P2's row survives and P2
//      keeps 200 access to A.
//
// Cleanup removes only rows this test created.
//
// Run: `pnpm --filter @workspace/api-server run test:links-end-isolation`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
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
const RUN = `test_endlink_${Date.now()}`;
const clerkCoach = `${RUN}_coach`; // C — ends its own link
const clerkCoach2 = `${RUN}_coach2`; // C2 — its link must survive
const clerkParent = `${RUN}_parent`; // P — ends its own link
const clerkParent2 = `${RUN}_parent2`; // P2 — its link must survive
const clerkAthlete = `${RUN}_athlete`; // A — linked to all four

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

async function coachLinkExists(
  coach: string,
  athlete: string,
): Promise<boolean> {
  const rows = await db
    .select({ status: coachAthleteLinksTable.status })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.coachClerkId, coach),
        eq(coachAthleteLinksTable.athleteClerkId, athlete),
      ),
    );
  return rows.length > 0;
}

async function parentLinkExists(
  parent: string,
  athlete: string,
): Promise<boolean> {
  const rows = await db
    .select({ status: parentAthleteLinksTable.status })
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, parent),
        eq(parentAthleteLinksTable.athleteClerkId, athlete),
      ),
    );
  return rows.length > 0;
}

async function cleanup() {
  for (const c of [clerkCoach, clerkCoach2]) {
    await db
      .delete(coachAthleteLinksTable)
      .where(eq(coachAthleteLinksTable.coachClerkId, c))
      .catch(() => {});
  }
  for (const p of [clerkParent, clerkParent2]) {
    await db
      .delete(parentAthleteLinksTable)
      .where(eq(parentAthleteLinksTable.parentClerkId, p))
      .catch(() => {});
  }
  for (const c of [
    clerkCoach,
    clerkCoach2,
    clerkParent,
    clerkParent2,
    clerkAthlete,
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
  await ensureAccount(clerkCoach, `${clerkCoach}@example.test`, "Coach C", silentLogger);
  await ensureAccount(clerkCoach2, `${clerkCoach2}@example.test`, "Coach C2", silentLogger);
  await ensureAccount(clerkParent, `${clerkParent}@example.test`, "Ouder P", silentLogger);
  await ensureAccount(clerkParent2, `${clerkParent2}@example.test`, "Ouder P2", silentLogger);
  await ensureAccount(clerkAthlete, `${clerkAthlete}@example.test`, "Atleet A", silentLogger);

  // Grant the coach/parent roles (ensureAccount defaults to ["athlete"]).
  for (const c of [clerkCoach, clerkCoach2]) {
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete", "coach"] })
      .where(eq(userProfilesTable.clerkId, c));
  }
  for (const p of [clerkParent, clerkParent2]) {
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete", "parent"] })
      .where(eq(userProfilesTable.clerkId, p));
  }

  // Accepted coach + parent links → athlete A from all four.
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: clerkCoach,
    athleteClerkId: clerkAthlete,
    status: "accepted",
  });
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: clerkCoach2,
    athleteClerkId: clerkAthlete,
    status: "accepted",
  });
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: clerkParent,
    athleteClerkId: clerkAthlete,
    status: "accepted",
  });
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: clerkParent2,
    athleteClerkId: clerkAthlete,
    status: "accepted",
  });

  // ── Precondition: dev bypass resolves users + everyone can reach A ───────────
  await scenario(
    "precondition: coaches C/C2 and parents P/P2 can all read athlete A",
    async () => {
      const cd = await req("GET", `/api/coach/athletes/${clerkAthlete}`, clerkCoach);
      assert(cd.status === 200, `coach C detail on A expected 200, got ${cd.status}`);
      assert(cd.text.includes("Atleet A"), "coach C detail on A missing display name");
      const cd2 = await req(
        "GET",
        `/api/coach/athletes/${clerkAthlete}`,
        clerkCoach2,
      );
      assert(cd2.status === 200, `coach C2 detail on A expected 200, got ${cd2.status}`);
      const pc = await req(
        "GET",
        `/api/parent/athletes/${clerkAthlete}/context`,
        clerkParent,
      );
      assert(pc.status === 200, `parent P context on A expected 200, got ${pc.status}`);
      const pc2 = await req(
        "GET",
        `/api/parent/athletes/${clerkAthlete}/context`,
        clerkParent2,
      );
      assert(pc2.status === 200, `parent P2 context on A expected 200, got ${pc2.status}`);
    },
  );

  // ── COACH ENDS ITS OWN LINK ──────────────────────────────────────────────────
  await scenario(
    "coach ends link: C removes its own link to A → row gone, C denied 403, C2 untouched",
    async () => {
      assert(
        await coachLinkExists(clerkCoach, clerkAthlete),
        "precondition: C's link to A should exist before end",
      );
      const del = await req(
        "DELETE",
        `/api/links/as-coach/${clerkAthlete}`,
        clerkCoach,
      );
      assert(del.status === 200, `coach end-link expected 200, got ${del.status}`);
      assert(
        !(await coachLinkExists(clerkCoach, clerkAthlete)),
        "C's link to A still present after C ended it",
      );
      // Coach C loses access to A immediately.
      const cd = await req("GET", `/api/coach/athletes/${clerkAthlete}`, clerkCoach);
      assert(
        cd.status === 403,
        `coach C detail on A after end must be 403, got ${cd.status}`,
      );
      assert(
        !cd.text.includes("Atleet A"),
        "coach C detail leaked A's data after end",
      );
      // The end must NOT have touched C2's link to A.
      assert(
        await coachLinkExists(clerkCoach2, clerkAthlete),
        "C's end wrongly removed C2's link to A",
      );
      const cd2 = await req(
        "GET",
        `/api/coach/athletes/${clerkAthlete}`,
        clerkCoach2,
      );
      assert(
        cd2.status === 200,
        `coach C2 detail on A after C's end must stay 200, got ${cd2.status}`,
      );
    },
  );

  // ── PARENT ENDS ITS OWN LINK ──────────────────────────────────────────────────
  await scenario(
    "parent ends link: P removes its own link to A → row gone, P denied 403, P2 untouched",
    async () => {
      assert(
        await parentLinkExists(clerkParent, clerkAthlete),
        "precondition: P's link to A should exist before end",
      );
      const del = await req(
        "DELETE",
        `/api/links/as-parent/${clerkAthlete}`,
        clerkParent,
      );
      assert(del.status === 200, `parent end-link expected 200, got ${del.status}`);
      assert(
        !(await parentLinkExists(clerkParent, clerkAthlete)),
        "P's link to A still present after P ended it",
      );
      const pc = await req(
        "GET",
        `/api/parent/athletes/${clerkAthlete}/context`,
        clerkParent,
      );
      assert(
        pc.status === 403,
        `parent P context on A after end must be 403, got ${pc.status}`,
      );
      // The end must NOT have touched P2's link to A.
      assert(
        await parentLinkExists(clerkParent2, clerkAthlete),
        "P's end wrongly removed P2's link to A",
      );
      const pc2 = await req(
        "GET",
        `/api/parent/athletes/${clerkAthlete}/context`,
        clerkParent2,
      );
      assert(
        pc2.status === 200,
        `parent P2 context on A after P's end must stay 200, got ${pc2.status}`,
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
    console.log("\n── End-link isolation ───────────────────────────────────────");
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
