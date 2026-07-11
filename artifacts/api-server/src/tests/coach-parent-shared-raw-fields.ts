// Coach/parent SHARED-item raw-field privacy — DB-backed route contract test.
//
// The sibling tests prove two OTHER gates: the GLOBAL sharing tier
// (test:coach-parent-sharing-levels) and the PER-ITEM visibility/enabled filter
// that withholds private/disabled memories (test:coach-parent-private-memory).
//
// This test covers the THIRD, independent guarantee: even for a memory the
// athlete DID choose to share (visibility="shared", enabled=true) and that a
// legitimately-linked coach/parent is therefore allowed to see, the projection
// (`getAthleteContextForViewer` → `SharedContextMemory`) must expose ONLY
// Sparki's neutral fields (id/kind/title/detail/status/followUpAt/createdAt) and
// NEVER the athlete's raw `statement` or their personal `response`.
//
// There was no automated proof of that. A regression that added `statement` or
// `response` to the projection would leak the athlete's exact private words to a
// coach/parent — and every existing test (which only checks WHICH items appear,
// not WHICH fields) would still pass cleanly.
//
// This test boots the REAL Express app and seeds ONE athlete with an ACCEPTED
// coach link AND an ACCEPTED parent link, plus ONE context memory that is
// SHARED + enabled and carries a distinctive raw `statement` marker AND a
// distinctive `response` marker. It sets the GLOBAL sharing to the most
// permissive tier that still surfaces context (coach=full, parent=summary) so
// the memory genuinely reaches both viewers — the ONLY thing under test is
// whether the raw fields ride along.
//
// Assertions (per surface): the memory DOES appear (positive control via its
// title), the raw statement/response markers are ABSENT from the raw response
// text (string-level — a leak under ANY key is caught), and the memory object
// exposes EXACTLY the safe key set and no more.
//
// Covers BOTH the coach and the parent /context surfaces and asserts neither
// ever 500s. Cleanup removes only rows this test created; the seeded profiles
// are removed last (their owned rows cascade).
//
// Run: `pnpm --filter @workspace/api-server run test:coach-parent-shared-raw-fields`
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
const RUN = `test_cpraw_${Date.now()}`;
const clerkCoach = `${RUN}_coach`;
const clerkParent = `${RUN}_parent`;
const clerkAthlete = `${RUN}_athlete`;

// A distinctive title marker (safe field → MUST appear) plus distinctive raw
// markers for statement + response (MUST NOT appear) so a leak is detectable by
// string, not just by shape.
const MARK_TITLE = `MARK_TITLE_${RUN}`;
const MARK_STATEMENT = `MARK_RAW_STATEMENT_${RUN}`;
const MARK_RESPONSE = `MARK_RAW_RESPONSE_${RUN}`;

// The exact safe key set the projection is allowed to expose.
const SAFE_KEYS = [
  "id",
  "kind",
  "title",
  "detail",
  "status",
  "followUpAt",
  "createdAt",
].sort();

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

function memories(json: unknown): Record<string, unknown>[] {
  const mems = (json as { memories?: unknown[] }).memories;
  if (!Array.isArray(mems)) return [];
  return mems as Record<string, unknown>[];
}

function memoryTitles(json: unknown): string[] {
  return memories(json).map((m) => String((m as MemoryEntry).title));
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
  await ensureAccount(clerkAthlete, `${clerkAthlete}@example.test`, "Atleet R", silentLogger);

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
  // (coach=full, parent=summary). The shared memory below genuinely reaches
  // both viewers — the only thing under test is whether raw fields ride along.
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

  // A SHARED + enabled memory that the athlete DID answer, so BOTH raw fields
  // (statement + response) are populated. It MUST reach the coach/parent, but
  // its raw words MUST NOT be in the projection.
  await db.insert(personalContextMemoriesTable).values({
    clerkId: clerkAthlete,
    kind: "general",
    statement: MARK_STATEMENT,
    title: MARK_TITLE,
    detail: "Gedeelde context",
    followUpQuestion: "Hoe ging het?",
    response: MARK_RESPONSE,
    visibility: "shared",
    enabled: true,
    status: "followed_up",
    followUpDone: true,
  });

  // ── Precondition: dev bypass authorizes both roles ──────────────────────────
  await scenario("precondition: dev bypass authorizes coach + parent", async () => {
    const c = await req("GET", "/api/coach/athletes", clerkCoach);
    assert(c.status === 200, `coach roster expected 200, got ${c.status}`);
    const p = await req("GET", "/api/parent/athletes", clerkParent);
    assert(p.status === 200, `parent roster expected 200, got ${p.status}`);
  });

  // ══ COACH context: shared memory present, raw fields absent ══════════════════
  await scenario(
    "coach context (full sharing): shared memory present but raw statement/response absent + only safe keys",
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
        titles.includes(MARK_TITLE),
        "coach context must surface the shared memory (positive control)",
      );
      // String-level leak check on the raw response text — the athlete's raw
      // words must never appear under ANY key.
      assert(
        !r.text.includes(MARK_STATEMENT),
        "coach context LEAKED the athlete's raw statement",
      );
      assert(
        !r.text.includes(MARK_RESPONSE),
        "coach context LEAKED the athlete's raw response",
      );
      // Structural check: the memory object exposes EXACTLY the safe key set.
      const mem = memories(r.json).find(
        (m) => String((m as MemoryEntry).title) === MARK_TITLE,
      );
      assert(mem, "coach context: shared memory object not found");
      const keys = Object.keys(mem!).sort();
      assert(
        JSON.stringify(keys) === JSON.stringify(SAFE_KEYS),
        `coach memory exposed unexpected keys: ${keys.join(",")} (expected ${SAFE_KEYS.join(",")})`,
      );
    },
  );

  // ══ PARENT context: shared memory present, raw fields absent ═════════════════
  await scenario(
    "parent context (summary sharing): shared memory present but raw statement/response absent + only safe keys",
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
        titles.includes(MARK_TITLE),
        "parent context must surface the shared memory (positive control)",
      );
      assert(
        !r.text.includes(MARK_STATEMENT),
        "parent context LEAKED the athlete's raw statement",
      );
      assert(
        !r.text.includes(MARK_RESPONSE),
        "parent context LEAKED the athlete's raw response",
      );
      const mem = memories(r.json).find(
        (m) => String((m as MemoryEntry).title) === MARK_TITLE,
      );
      assert(mem, "parent context: shared memory object not found");
      const keys = Object.keys(mem!).sort();
      assert(
        JSON.stringify(keys) === JSON.stringify(SAFE_KEYS),
        `parent memory exposed unexpected keys: ${keys.join(",")} (expected ${SAFE_KEYS.join(",")})`,
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
      `\ncoach-parent-shared-raw-fields: ${results.length - failed.length}/${results.length} passed`,
    );
    process.exit(failed.length > 0 ? 1 : 0);
  });
