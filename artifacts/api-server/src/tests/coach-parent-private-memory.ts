// Coach/parent PER-ITEM context-memory privacy — DB-backed route contract test.
//
// The sibling test (test:coach-parent-sharing-levels) proves the GLOBAL sharing
// tier (none/summary/full for coach, none/safety_only/summary for parent) is
// honoured. But context memories carry a SECOND, per-item gate on top of that:
// `getAthleteContextForViewer` only surfaces rows where `visibility = "shared"`
// AND `enabled = true`. An athlete can keep a specific note PRIVATE (or disable
// it) even while their global sharing is fully permissive.
//
// There was no automated proof of that per-item filter. A regression that
// dropped it would leak a `visibility="private"` (or `enabled=false`) memory —
// the athlete's own words, in Sparki's neutral projection — to a legitimately
// linked coach/parent, while the global-tier test above still passes cleanly.
//
// This test boots the REAL Express app and seeds ONE athlete with an ACCEPTED
// coach link AND an ACCEPTED parent link, plus THREE context memories:
//   • a SHARED + enabled one  → MUST reach the coach/parent,
//   • a PRIVATE one           → MUST be withheld,
//   • a disabled (enabled=false) shared one → MUST be withheld.
// It sets the GLOBAL sharing to the most permissive tier that still surfaces
// context (coach=full, parent=summary) so the ONLY thing that can hide the
// private/disabled rows is the per-item filter under test.
//
// Each memory has a distinctive title marker so the assertions are string-level
// (the private/disabled titles must be ABSENT from the raw response text), not
// merely a count — a structural check alone could pass while the payload still
// carried the value under a different key.
//
// Covers BOTH the coach and the parent /context surfaces and asserts neither
// ever 500s. Cleanup removes only rows this test created; the seeded profiles
// are removed last (their owned rows cascade).
//
// Run: `pnpm --filter @workspace/api-server run test:coach-parent-private-memory`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
  privacySettingsTable,
  personalContextMemoriesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
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
const RUN = `test_cppriv_${Date.now()}`;
const clerkCoach = `${RUN}_coach`;
const clerkParent = `${RUN}_parent`;
const clerkAthlete = `${RUN}_athlete`;

// Distinctive title markers so a leak is detectable by string, not just by shape.
const MARK_SHARED = `MARK_SHARED_${RUN}`;
const MARK_PRIVATE = `MARK_PRIVATE_${RUN}`;
const MARK_DISABLED = `MARK_DISABLED_${RUN}`;

async function req(
  method: string,
  path: string,
  actor: string,
): Promise<{ status: number; text: string; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
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

type MemoryEntry = { title?: string };

function memoryTitles(json: unknown): string[] {
  const memories = (json as { memories?: MemoryEntry[] }).memories;
  if (!Array.isArray(memories)) return [];
  return memories.map((m) => String(m.title));
}

async function cleanup() {
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
  await ensureAccount(clerkAthlete, `${clerkAthlete}@example.test`, "Atleet P", silentLogger);

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

  // Most permissive tier that still surfaces context on BOTH surfaces
  // (coach=full, parent=summary). The ONLY thing that can then hide the
  // private/disabled rows is the per-item visibility/enabled filter under test.
  await db
    .insert(privacySettingsTable)
    .values({
      clerkId: clerkAthlete,
      dataSharingCoach: "full",
      dataSharingParent: "summary",
    })
    .onConflictDoUpdate({
      target: privacySettingsTable.clerkId,
      set: { dataSharingCoach: "full", dataSharingParent: "summary" },
    });

  // A SHARED + enabled memory → MUST reach the coach/parent.
  await db.insert(personalContextMemoriesTable).values({
    clerkId: clerkAthlete,
    kind: "general",
    statement: "gedeelde interne notitie",
    title: MARK_SHARED,
    detail: "Gedeelde context",
    followUpQuestion: "Hoe ging het?",
    visibility: "shared",
    enabled: true,
    status: "scheduled",
  });

  // A PRIVATE memory → athlete marked "deel niet" → MUST be withheld even at
  // the most permissive global tier.
  await db.insert(personalContextMemoriesTable).values({
    clerkId: clerkAthlete,
    kind: "general",
    statement: "privé notitie die niemand mag zien",
    title: MARK_PRIVATE,
    detail: "Privé context",
    followUpQuestion: "Hoe ging het?",
    visibility: "private",
    enabled: true,
    status: "scheduled",
  });

  // A DISABLED (enabled=false) but shared memory → the second half of the
  // per-item gate → MUST also be withheld.
  await db.insert(personalContextMemoriesTable).values({
    clerkId: clerkAthlete,
    kind: "general",
    statement: "uitgezette notitie",
    title: MARK_DISABLED,
    detail: "Uitgezette context",
    followUpQuestion: "Hoe ging het?",
    visibility: "shared",
    enabled: false,
    status: "scheduled",
  });

  // ── Precondition: dev bypass authorizes both roles ──────────────────────────
  await scenario("precondition: dev bypass authorizes coach + parent", async () => {
    const c = await req("GET", "/api/coach/athletes", clerkCoach);
    assert(c.status === 200, `coach roster expected 200, got ${c.status}`);
    const p = await req("GET", "/api/parent/athletes", clerkParent);
    assert(p.status === 200, `parent roster expected 200, got ${p.status}`);
  });

  // ══ COACH context: only the shared memory, private/disabled withheld ═════════
  await scenario(
    "coach context (full sharing): includes ONLY the shared memory; private + disabled withheld",
    async () => {
      const r = await req(
        "GET",
        `/api/coach/athletes/${clerkAthlete}/context`,
        clerkCoach,
      );
      assert(r.status === 200, `coach context expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; memories?: unknown[] };
      assert(
        body.sharing === "full",
        `expected sharing full (permissive), got ${body.sharing}`,
      );
      const titles = memoryTitles(r.json);
      assert(
        titles.includes(MARK_SHARED),
        "coach context must surface the shared memory (positive control)",
      );
      // String-level leak check on the raw response text — a private/disabled
      // note must never appear under ANY key.
      assert(
        !r.text.includes(MARK_PRIVATE),
        "coach context LEAKED a private (visibility=private) memory",
      );
      assert(
        !r.text.includes(MARK_DISABLED),
        "coach context LEAKED a disabled (enabled=false) memory",
      );
      assert(
        !titles.includes(MARK_PRIVATE) && !titles.includes(MARK_DISABLED),
        "coach context memories array included a withheld title",
      );
      assert(
        titles.length === 1,
        `coach context must return exactly the one shared memory, got ${titles.length}`,
      );
    },
  );

  // ══ PARENT context: only the shared memory, private/disabled withheld ════════
  await scenario(
    "parent context (summary sharing): includes ONLY the shared memory; private + disabled withheld",
    async () => {
      const r = await req(
        "GET",
        `/api/parent/athletes/${clerkAthlete}/context`,
        clerkParent,
      );
      assert(r.status === 200, `parent context expected 200, got ${r.status}`);
      const body = r.json as { sharing?: string; memories?: unknown[] };
      assert(
        body.sharing === "summary",
        `expected sharing summary (permissive), got ${body.sharing}`,
      );
      const titles = memoryTitles(r.json);
      assert(
        titles.includes(MARK_SHARED),
        "parent context must surface the shared memory (positive control)",
      );
      assert(
        !r.text.includes(MARK_PRIVATE),
        "parent context LEAKED a private (visibility=private) memory",
      );
      assert(
        !r.text.includes(MARK_DISABLED),
        "parent context LEAKED a disabled (enabled=false) memory",
      );
      assert(
        !titles.includes(MARK_PRIVATE) && !titles.includes(MARK_DISABLED),
        "parent context memories array included a withheld title",
      );
      assert(
        titles.length === 1,
        `parent context must return exactly the one shared memory, got ${titles.length}`,
      );
    },
  );
}

main()
  .catch((err) => {
    results.push({
      scenario: "fatal",
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await stopServer().catch(() => {});

    const failed = results.filter((r) => r.status === "fail");
    for (const r of results) {
      const tag = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(
      `\ncoach-parent-private-memory: ${results.length - failed.length}/${results.length} passed`,
    );
    process.exit(failed.length > 0 ? 1 : 0);
  });
