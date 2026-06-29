// Unread badge ↔ bell agreement — DB-backed contract test.
//
// The in-app bell folds notifications into at-most-one entry per Amsterdam
// calendar day (`groupNotificationsByDay`, a pure JS function), while the unread
// badge counts *days* via a SEPARATE SQL query (`getUnreadDayCount`, using a
// `count(distinct (created_at at time zone 'Europe/Amsterdam')::date)` cast).
// These are two different code paths that must always agree: if the SQL timezone
// cast or the distinct-day logic ever drifts from the JS fold, the badge number
// would silently stop matching the number of folded day-groups the user sees.
//
// This test seeds REAL unread rows (spanning multiple Amsterdam days, several on
// the same day, plus rows straddling local midnight and some read rows) against
// the dev DB, then asserts the SQL `getUnreadDayCount` equals the number of
// folded day-groups `groupNotificationsByDay` produces for the same unread set.
//
// Run: `pnpm --filter @workspace/api-server run test:notification-day-count`
// Requires: DATABASE_URL. Exits non-zero on any failure. Each run uses a unique
// clerkId and cleans up its seeded rows, so it is safe against a shared DB.

import {
  db,
  pool,
  notificationsTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  getUnreadDayCount,
  groupNotificationsByDay,
} from "../lib/notifications";

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

const RUN = `test_notifdaycount_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}

type SeedRow = { createdAt: Date; readAt?: Date | null };

async function seed(clerkId: string, rows: SeedRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(notificationsTable).values(
    rows.map((r) => ({
      clerkId,
      type: "system",
      title: "Melding",
      priority: "normal",
      createdAt: r.createdAt,
      readAt: r.readAt ?? null,
    })),
  );
}

// Fetch the UNREAD rows the badge counts, and fold them exactly as the bell
// does. The number of folded groups == number of distinct unread Amsterdam days,
// which is what the SQL `getUnreadDayCount` must independently arrive at.
async function unreadGroupCount(clerkId: string): Promise<number> {
  const unread = await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, clerkId),
        isNull(notificationsTable.readAt),
      ),
    );
  return groupNotificationsByDay(unread).length;
}

async function cleanup() {
  if (ids.length === 0) return;
  await db
    .delete(notificationsTable)
    .where(inArray(notificationsTable.clerkId, ids));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  // 1. Multiple distinct Amsterdam days, several rows on the same day: the SQL
  //    day-count must equal the folded group count (one group per distinct day).
  await scenario(
    "meerdere dagen + meerdere op dezelfde dag → SQL telling == aantal gevouwen groepen",
    async () => {
      const id = newId("multi");
      await ensureAccount(id, `${id}@example.test`, "Multi", silentLogger);
      // Day A (2026-06-28): 3 rows. Day B (2026-06-27): 2 rows. Day C
      // (2026-06-25): 1 row. → 3 distinct Amsterdam days.
      await seed(id, [
        { createdAt: new Date("2026-06-28T07:00:00Z") },
        { createdAt: new Date("2026-06-28T08:00:00Z") },
        { createdAt: new Date("2026-06-28T09:00:00Z") },
        { createdAt: new Date("2026-06-27T07:00:00Z") },
        { createdAt: new Date("2026-06-27T08:00:00Z") },
        { createdAt: new Date("2026-06-25T07:00:00Z") },
      ]);

      const sqlCount = await getUnreadDayCount(id);
      const groupCount = await unreadGroupCount(id);
      assert(
        sqlCount === 3,
        `expected 3 distinct unread days, SQL gave ${sqlCount}`,
      );
      assert(
        sqlCount === groupCount,
        `badge (${sqlCount}) must equal folded group count (${groupCount})`,
      );
    },
  );

  // 2. Read rows must NOT be counted by either path.
  await scenario("gelezen meldingen worden uitgesloten", async () => {
    const id = newId("readexcl");
    await ensureAccount(id, `${id}@example.test`, "Read", silentLogger);
    // 1 unread day (2026-06-28) + an entire separate day (2026-06-20) that is
    // fully READ. The read day must contribute zero to both counts.
    await seed(id, [
      { createdAt: new Date("2026-06-28T07:00:00Z") },
      {
        createdAt: new Date("2026-06-20T07:00:00Z"),
        readAt: new Date("2026-06-20T08:00:00Z"),
      },
      {
        createdAt: new Date("2026-06-20T09:00:00Z"),
        readAt: new Date("2026-06-20T10:00:00Z"),
      },
    ]);

    const sqlCount = await getUnreadDayCount(id);
    const groupCount = await unreadGroupCount(id);
    assert(
      sqlCount === 1,
      `read day must be excluded; expected 1, SQL gave ${sqlCount}`,
    );
    assert(
      sqlCount === groupCount,
      `badge (${sqlCount}) must equal folded group count (${groupCount})`,
    );
  });

  // 3. Day boundary near local midnight in SUMMER (Ams = UTC+2): local midnight
  //    is 22:00Z. Two unread rows straddling it must land on DIFFERENT Amsterdam
  //    days in BOTH the SQL cast and the JS fold (not lumped by UTC date).
  await scenario(
    "dag-grens rond middernacht (zomertijd, UTC+2) — SQL en vouw eens",
    async () => {
      const id = newId("summer");
      await ensureAccount(id, `${id}@example.test`, "Summer", silentLogger);
      await seed(id, [
        // 23:59 Amsterdam on 2026-06-27.
        { createdAt: new Date("2026-06-27T21:59:00Z") },
        // 00:01 Amsterdam on 2026-06-28.
        { createdAt: new Date("2026-06-27T22:01:00Z") },
      ]);

      const sqlCount = await getUnreadDayCount(id);
      const groupCount = await unreadGroupCount(id);
      assert(
        sqlCount === 2,
        `straddling rows must be 2 Ams days; SQL gave ${sqlCount} ` +
          `(a UTC cast would wrongly give 1)`,
      );
      assert(
        sqlCount === groupCount,
        `badge (${sqlCount}) must equal folded group count (${groupCount})`,
      );
    },
  );

  // 4. Day boundary near local midnight in WINTER (Ams = UTC+1): local midnight
  //    is 23:00Z. Confirms the SQL cast tracks DST (not a fixed offset) and still
  //    agrees with the JS fold.
  await scenario(
    "dag-grens rond middernacht (wintertijd, UTC+1) — SQL en vouw eens",
    async () => {
      const id = newId("winter");
      await ensureAccount(id, `${id}@example.test`, "Winter", silentLogger);
      await seed(id, [
        // 23:59 Amsterdam on 2026-01-14.
        { createdAt: new Date("2026-01-14T22:59:00Z") },
        // 00:01 Amsterdam on 2026-01-15.
        { createdAt: new Date("2026-01-14T23:01:00Z") },
      ]);

      const sqlCount = await getUnreadDayCount(id);
      const groupCount = await unreadGroupCount(id);
      assert(
        sqlCount === 2,
        `winter straddling rows must be 2 Ams days; SQL gave ${sqlCount}`,
      );
      assert(
        sqlCount === groupCount,
        `badge (${sqlCount}) must equal folded group count (${groupCount})`,
      );
    },
  );

  // 5. No unread rows → both paths report zero (no phantom badge).
  await scenario("geen ongelezen meldingen → telling is 0", async () => {
    const id = newId("none");
    await ensureAccount(id, `${id}@example.test`, "None", silentLogger);
    await seed(id, [
      {
        createdAt: new Date("2026-06-28T07:00:00Z"),
        readAt: new Date("2026-06-28T08:00:00Z"),
      },
    ]);

    const sqlCount = await getUnreadDayCount(id);
    const groupCount = await unreadGroupCount(id);
    assert(sqlCount === 0, `expected 0 unread days, SQL gave ${sqlCount}`);
    assert(
      sqlCount === groupCount,
      `badge (${sqlCount}) must equal folded group count (${groupCount})`,
    );
  });
}

async function shutdown(code: number) {
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup();
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== unread badge ↔ bell agreement — test results ===");
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
