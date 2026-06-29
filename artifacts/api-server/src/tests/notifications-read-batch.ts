// Mark-a-day-read (batch) — DB-backed contract test.
//
// The bell folds many notification rows into ONE visible entry per Amsterdam
// calendar day. Reading that folded entry marks the *whole day* read in one tap
// via `POST /api/notifications/read-batch`, which the client calls with every
// member id of that day's fold. The two pieces that decide WHICH rows belong to
// a day live in `groupNotificationsByDay` (the Amsterdam day boundary) and the
// batch endpoint (the ownership/unread-scoped update). A silent regression in
// either — a wrong day-range filter or a UTC-instead-of-Amsterdam boundary —
// would leave rows unread (the badge keeps counting a cleared day) or sweep a
// neighbouring day's rows by mistake. This test pins that flow down end-to-end.
//
// It boots the REAL Express app and acts as a disposable seeded user via the
// dev-auth bypass (`x-dev-clerk-id`), so requireAuth → handler → DB is covered.
// Notifications are inserted straight into the DB at fixed UTC instants that
// straddle an Amsterdam local midnight, then the day's member ids are taken from
// the same fold the bell uses (GET /api/notifications) before the batch read.
//
// Run: `pnpm --filter @workspace/api-server run test:notifications-read-batch`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  notificationsTable,
  userProfilesTable,
  type Notification,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>) {
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

const RUN = `test_notifbatch_${Date.now()}`;
const userIds: string[] = [];
function newUserId(tag: string): string {
  const id = `${RUN}_${tag}`;
  userIds.push(id);
  return id;
}

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

// ── HTTP helpers acting as a dev user via the x-dev-clerk-id header. ──────────
type NotificationGroupResponse =
  | { kind: "single"; notification: Notification }
  | {
      kind: "day";
      dayKey: string;
      members: Notification[];
      [k: string]: unknown;
    };

async function listNotifications(clerkId: string): Promise<{
  status: number;
  groups: NotificationGroupResponse[];
  unreadCount: number;
}> {
  const res = await fetch(`${baseUrl}/api/notifications?limit=100`, {
    headers: { "x-dev-clerk-id": clerkId },
  });
  const json = (await res.json()) as {
    groups?: NotificationGroupResponse[];
    unreadCount?: number;
  };
  return {
    status: res.status,
    groups: json.groups ?? [],
    unreadCount: json.unreadCount ?? 0,
  };
}

async function readBatch(
  clerkId: string,
  ids: number[],
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/api/notifications/read-batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
    },
    body: JSON.stringify({ ids }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

// ── DB helpers ───────────────────────────────────────────────────────────────
async function insertNotif(
  clerkId: string,
  createdAt: Date,
): Promise<number> {
  const [row] = await db
    .insert(notificationsTable)
    .values({
      clerkId,
      type: "system",
      title: "Melding",
      priority: "normal",
      createdAt,
    })
    .returning({ id: notificationsTable.id });
  return row!.id;
}

async function isRead(id: number): Promise<boolean> {
  const [row] = await db
    .select({ readAt: notificationsTable.readAt })
    .from(notificationsTable)
    .where(eq(notificationsTable.id, id));
  return row?.readAt != null;
}

async function cleanup() {
  if (userIds.length === 0) return;
  await db
    .delete(notificationsTable)
    .where(inArray(notificationsTable.clerkId, userIds));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, userIds));
}

// Pull the folded "day" group for a given Amsterdam day key out of the bell's
// own GET response — exactly the member-id set the client passes to read-batch.
function dayMemberIds(
  groups: NotificationGroupResponse[],
  dayKey: string,
): number[] {
  const g = groups.find((x) => x.kind === "day" && x.dayKey === dayKey);
  assert(g, `expected a folded "day" group for ${dayKey}`);
  return (g as Extract<NotificationGroupResponse, { kind: "day" }>).members.map(
    (m) => m.id,
  );
}

async function main() {
  await startServer();

  // Sanity: the dev-auth bypass must be active, otherwise every request is a
  // 401 and the assertions below would be meaningless.
  await scenario("dev-auth bypass is active (precondition)", async () => {
    const id = newUserId("precond");
    await ensureAccount(id, `${id}@example.test`, "Pre", silentLogger);
    const { status } = await listNotifications(id);
    assert(
      status === 200,
      `expected GET to authorize via dev bypass (200), got ${status} — ` +
        `ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
    );
  });

  // Core flow: seed two Amsterdam days, mark one day read, assert the WHOLE day
  // flips while the other day stays untouched — and the Amsterdam boundary is
  // honoured (a row at 00:01 local belongs to the NEXT day, not the previous).
  await scenario(
    "een dag lezen markeert alleen die hele dag (Ams-grens gerespecteerd)",
    async () => {
      const id = newUserId("twoday");
      await ensureAccount(id, `${id}@example.test`, "TwoDay", silentLogger);

      // Day A = 2026-06-26 (Amsterdam, CEST = UTC+2).
      //  - 10:00 & 12:00 local (plainly inside the day)
      //  - 00:30 local (just AFTER midnight → still day A, must be swept)
      const a1 = await insertNotif(id, new Date("2026-06-26T08:00:00Z")); // 10:00 Ams 06-26
      const a2 = await insertNotif(id, new Date("2026-06-26T10:00:00Z")); // 12:00 Ams 06-26
      const a3 = await insertNotif(id, new Date("2026-06-25T22:30:00Z")); // 00:30 Ams 06-26
      const dayAIds = [a1, a2, a3];

      // Day B = 2026-06-27 (Amsterdam).
      //  - bBoundary: 2026-06-26T22:01Z = 00:01 Ams on 06-27. Its UTC date is
      //    06-26 (same as day A's rows!), so a UTC boundary would WRONGLY fold
      //    it into day A. Correct Amsterdam handling keeps it in day B.
      //  - b2: 11:00 Ams 06-27 (plainly day B)
      const bBoundary = await insertNotif(id, new Date("2026-06-26T22:01:00Z"));
      const b2 = await insertNotif(id, new Date("2026-06-27T09:00:00Z"));
      const dayBIds = [bBoundary, b2];

      // Before: two unread Amsterdam days → unread day-count is 2.
      const before = await listNotifications(id);
      assert(
        before.unreadCount === 2,
        `precondition: expected 2 unread days, got ${before.unreadCount}`,
      );

      // The bell's fold is the source of truth for "which ids are this day".
      const foldedAIds = dayMemberIds(before.groups, "2026-06-26");
      // Boundary guard: the 00:01-Ams row must NOT be folded into day A.
      assert(
        !foldedAIds.includes(bBoundary),
        "Amsterdam boundary breach: 00:01 local row was folded into the previous day",
      );
      assert(
        foldedAIds.slice().sort().join(",") === dayAIds.slice().sort().join(","),
        `day A fold should contain exactly its 3 rows, got [${foldedAIds.join(",")}]`,
      );

      // Mark the whole of day A read via the batch endpoint.
      const res = await readBatch(id, foldedAIds);
      assert(res.status === 200, `read-batch should succeed, got ${res.status}`);

      // Every day-A row is now read.
      for (const rid of dayAIds) {
        assert(await isRead(rid), `day A row ${rid} should be read`);
      }
      // Every day-B row — including the boundary row — stays unread.
      for (const rid of dayBIds) {
        assert(
          !(await isRead(rid)),
          `day B row ${rid} must stay unread after marking day A read`,
        );
      }

      // The unread day-count drops from 2 → 1 (only day B remains).
      const after = await listNotifications(id);
      assert(
        after.unreadCount === 1,
        `expected unread day-count to drop to 1, got ${after.unreadCount}`,
      );
    },
  );

  // The batch update is scoped to the caller: a member id belonging to ANOTHER
  // user must never be flipped, even if it is passed in the ids array.
  await scenario("read-batch raakt nooit meldingen van een andere gebruiker", async () => {
    const me = newUserId("owner");
    const other = newUserId("intruder");
    await ensureAccount(me, `${me}@example.test`, "Owner", silentLogger);
    await ensureAccount(other, `${other}@example.test`, "Intruder", silentLogger);

    const mine1 = await insertNotif(me, new Date("2026-06-20T08:00:00Z"));
    const mine2 = await insertNotif(me, new Date("2026-06-20T09:00:00Z"));
    const theirs = await insertNotif(other, new Date("2026-06-20T08:30:00Z"));

    // Pass the other user's id alongside mine — it must be ignored.
    const res = await readBatch(me, [mine1, mine2, theirs]);
    assert(res.status === 200, `read-batch should succeed, got ${res.status}`);

    assert(await isRead(mine1), "my row 1 should be read");
    assert(await isRead(mine2), "my row 2 should be read");
    assert(
      !(await isRead(theirs)),
      "another user's row must never be marked read by my batch",
    );
  });

  // An empty / no-id payload is rejected (400) and changes nothing.
  await scenario("lege id-lijst wordt geweigerd (400)", async () => {
    const id = newUserId("empty");
    await ensureAccount(id, `${id}@example.test`, "Empty", silentLogger);
    const n = await insertNotif(id, new Date("2026-06-21T08:00:00Z"));

    const res = await readBatch(id, []);
    assert(res.status === 400, `empty ids should be rejected, got ${res.status}`);
    assert(
      !(await isRead(n)),
      "no row may be marked read when the batch is rejected",
    );
  });

  // Already-read rows are left exactly as they were: the update is scoped to
  // unread rows, so a second batch call is idempotent and does not reset state.
  await scenario("reeds gelezen rijen blijven ongemoeid (idempotent)", async () => {
    const id = newUserId("idem");
    await ensureAccount(id, `${id}@example.test`, "Idem", silentLogger);

    const x = await insertNotif(id, new Date("2026-06-22T08:00:00Z"));
    const y = await insertNotif(id, new Date("2026-06-22T09:00:00Z"));

    await readBatch(id, [x, y]);
    const [firstRead] = await db
      .select({ readAt: notificationsTable.readAt })
      .from(notificationsTable)
      .where(eq(notificationsTable.id, x));
    const firstTimestamp = firstRead?.readAt?.getTime() ?? 0;
    assert(firstTimestamp > 0, "row x should be read after the first batch");

    // A second batch must not throw and must not move the readAt timestamp.
    const res = await readBatch(id, [x, y]);
    assert(res.status === 200, `second batch should succeed, got ${res.status}`);
    const [secondRead] = await db
      .select({ readAt: notificationsTable.readAt })
      .from(notificationsTable)
      .where(eq(notificationsTable.id, x));
    assert(
      (secondRead?.readAt?.getTime() ?? 0) === firstTimestamp,
      "a re-run must not reset the original readAt timestamp",
    );

    // Sanity: no unread rows remain for this user.
    const [{ remaining } = { remaining: 0 }] = await db
      .select({ remaining: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, id),
          isNull(notificationsTable.readAt),
        ),
      );
    assert(remaining === 0, "no unread rows should remain for this user");
  });
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup();
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== mark-a-day-read (batch) contract — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} passed.\n`,
    );
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
