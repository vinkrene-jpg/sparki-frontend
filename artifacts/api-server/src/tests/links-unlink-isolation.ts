// Unlink-button isolation — DB-backed route contract test for the athlete's own
// coach/parent revoke endpoints.
//
// Athletes revoke a coach/parent from their You screen via:
//   • DELETE /api/links/coach/:coachClerkId
//   • DELETE /api/links/parent/:parentClerkId
//
// Both routes scope the delete to `athleteClerkId = me` (the authenticated
// caller). That scoping is the ONLY thing standing between "an athlete unlinks
// their own coach" and "an athlete deletes an arbitrary link row belonging to
// someone else" — a cross-account mutation. The sibling
// coach-parent-link-isolation test proves the READ/adopt surfaces are
// link-scoped, but it revokes by flipping the DB directly; it never drives the
// real DELETE /api/links routes. This test does, so a regression that dropped
// the `athleteClerkId = me` filter on either DELETE would fail here.
//
// It boots the REAL Express app and seeds:
//   • coach   C (roles include "coach")
//   • parent  P (roles include "parent")
//   • athlete A — ACCEPTED coach C + parent P links (the self-unlinker)
//   • athlete V — ACCEPTED coach C + parent P links (the "victim" whose links
//                 must survive when a DIFFERENT athlete fires the same DELETE)
//   • athlete B — the attacker, with NO links of its own
//
// It proves:
//   1. A unlinks its OWN coach → its A–C link row is gone and coach C is then
//      denied 403 on A's coach surface (positive control: the unlink works).
//   2. A unlinks its OWN parent → its A–P link row is gone and parent P is then
//      denied 403 on A's parent surface.
//   3. A DIFFERENT athlete B firing DELETE /api/links/coach/C and
//      /api/links/parent/P does NOT remove V's links: V's A–C/A–P rows survive
//      and coach C / parent P keep their 200 access to V (the delete is scoped
//      to the caller only).
//
// Cleanup removes only rows this test created.
//
// Run: `pnpm --filter @workspace/api-server run test:links-unlink-isolation`
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
const RUN = `test_unlink_${Date.now()}`;
const clerkCoach = `${RUN}_coach`;
const clerkParent = `${RUN}_parent`;
const clerkSelf = `${RUN}_athlete_self`; // A — unlinks its own links
const clerkVictim = `${RUN}_athlete_victim`; // V — its links must survive
const clerkAttacker = `${RUN}_athlete_attacker`; // B — fires the DELETE at C/P

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
    clerkSelf,
    clerkVictim,
    clerkAttacker,
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
  await ensureAccount(clerkSelf, `${clerkSelf}@example.test`, "Atleet A", silentLogger);
  await ensureAccount(clerkVictim, `${clerkVictim}@example.test`, "Atleet V", silentLogger);
  await ensureAccount(clerkAttacker, `${clerkAttacker}@example.test`, "Atleet B", silentLogger);

  // Grant the coach/parent roles (ensureAccount defaults to ["athlete"]).
  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "coach"] })
    .where(eq(userProfilesTable.clerkId, clerkCoach));
  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "parent"] })
    .where(eq(userProfilesTable.clerkId, clerkParent));

  // Accepted coach + parent links → athlete A (the self-unlinker).
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: clerkCoach,
    athleteClerkId: clerkSelf,
    status: "accepted",
  });
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: clerkParent,
    athleteClerkId: clerkSelf,
    status: "accepted",
  });

  // Accepted coach + parent links → athlete V (the protected victim).
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: clerkCoach,
    athleteClerkId: clerkVictim,
    status: "accepted",
  });
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: clerkParent,
    athleteClerkId: clerkVictim,
    status: "accepted",
  });

  // athlete B — deliberately NO link row of any kind.

  // ── Precondition: dev bypass resolves the athlete + coach can reach A ────────
  await scenario(
    "precondition: coach C can read athlete A (accepted link, positive control)",
    async () => {
      const me = await req("GET", "/api/links", clerkSelf);
      assert(
        me.status === 200,
        `expected 200 on /api/links for A via dev bypass, got ${me.status} — ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
      );
      const cd = await req("GET", `/api/coach/athletes/${clerkSelf}`, clerkCoach);
      assert(cd.status === 200, `coach detail on A expected 200, got ${cd.status}`);
      assert(cd.text.includes("Atleet A"), "coach detail on A missing display name");
      const pc = await req(
        "GET",
        `/api/parent/athletes/${clerkSelf}/context`,
        clerkParent,
      );
      assert(pc.status === 200, `parent context on A expected 200, got ${pc.status}`);
    },
  );

  // ── SELF UNLINK: coach ───────────────────────────────────────────────────────
  await scenario(
    "self-unlink coach: A removes its own coach link → row gone, coach denied 403",
    async () => {
      assert(
        await coachLinkExists(clerkCoach, clerkSelf),
        "precondition: A's coach link should exist before unlink",
      );
      const del = await req(
        "DELETE",
        `/api/links/coach/${clerkCoach}`,
        clerkSelf,
      );
      assert(del.status === 200, `self coach unlink expected 200, got ${del.status}`);
      assert(
        !(await coachLinkExists(clerkCoach, clerkSelf)),
        "A's coach link row still present after A unlinked it",
      );
      // Coach C loses access to A immediately.
      const cd = await req("GET", `/api/coach/athletes/${clerkSelf}`, clerkCoach);
      assert(
        cd.status === 403,
        `coach detail on A after unlink must be 403, got ${cd.status}`,
      );
      assert(
        !cd.text.includes("Atleet A"),
        "coach detail leaked A's data after unlink",
      );
      // The unlink must NOT have touched V's coach link.
      assert(
        await coachLinkExists(clerkCoach, clerkVictim),
        "A's coach unlink wrongly removed V's coach link",
      );
    },
  );

  // ── SELF UNLINK: parent ──────────────────────────────────────────────────────
  await scenario(
    "self-unlink parent: A removes its own parent link → row gone, parent denied 403",
    async () => {
      assert(
        await parentLinkExists(clerkParent, clerkSelf),
        "precondition: A's parent link should exist before unlink",
      );
      const del = await req(
        "DELETE",
        `/api/links/parent/${clerkParent}`,
        clerkSelf,
      );
      assert(del.status === 200, `self parent unlink expected 200, got ${del.status}`);
      assert(
        !(await parentLinkExists(clerkParent, clerkSelf)),
        "A's parent link row still present after A unlinked it",
      );
      const pc = await req(
        "GET",
        `/api/parent/athletes/${clerkSelf}/context`,
        clerkParent,
      );
      assert(
        pc.status === 403,
        `parent context on A after unlink must be 403, got ${pc.status}`,
      );
      // The unlink must NOT have touched V's parent link.
      assert(
        await parentLinkExists(clerkParent, clerkVictim),
        "A's parent unlink wrongly removed V's parent link",
      );
    },
  );

  // ── CROSS-ACCOUNT: attacker B cannot delete V's coach link ───────────────────
  await scenario(
    "cross-account coach: B firing DELETE /api/links/coach/C does NOT remove V's link",
    async () => {
      assert(
        await coachLinkExists(clerkCoach, clerkVictim),
        "precondition: V's coach link should exist before B's attack",
      );
      const del = await req(
        "DELETE",
        `/api/links/coach/${clerkCoach}`,
        clerkAttacker,
      );
      // The route scopes to athleteClerkId = B (no such row) → a no-op success.
      assert(
        del.status === 200,
        `attacker coach unlink expected 200 no-op, got ${del.status}`,
      );
      assert(
        await coachLinkExists(clerkCoach, clerkVictim),
        "B's DELETE removed V's coach link — unlink is NOT scoped to the caller",
      );
      // Coach C still reaches V.
      const cd = await req(
        "GET",
        `/api/coach/athletes/${clerkVictim}`,
        clerkCoach,
      );
      assert(
        cd.status === 200,
        `coach detail on V after B's attack must stay 200, got ${cd.status}`,
      );
    },
  );

  // ── CROSS-ACCOUNT: attacker B cannot delete V's parent link ──────────────────
  await scenario(
    "cross-account parent: B firing DELETE /api/links/parent/P does NOT remove V's link",
    async () => {
      assert(
        await parentLinkExists(clerkParent, clerkVictim),
        "precondition: V's parent link should exist before B's attack",
      );
      const del = await req(
        "DELETE",
        `/api/links/parent/${clerkParent}`,
        clerkAttacker,
      );
      assert(
        del.status === 200,
        `attacker parent unlink expected 200 no-op, got ${del.status}`,
      );
      assert(
        await parentLinkExists(clerkParent, clerkVictim),
        "B's DELETE removed V's parent link — unlink is NOT scoped to the caller",
      );
      const pc = await req(
        "GET",
        `/api/parent/athletes/${clerkVictim}/context`,
        clerkParent,
      );
      assert(
        pc.status === 200,
        `parent context on V after B's attack must stay 200, got ${pc.status}`,
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
    console.log("\n── Unlink-button isolation ──────────────────────────────────");
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
