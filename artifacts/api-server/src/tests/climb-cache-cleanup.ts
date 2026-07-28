// Climb-cache cleanup test: locks in cleanupClimbCacheDb behaviour so schema
// or import drift can't silently disable the periodieke opruimstap (boot +
// nightly job:health) and the tabel weer eindeloos groeit.
//
// Asserts:
// 1. Rows older than CLIMB_CACHE_MAX_AGE_MS are really deleted.
// 2. Fresh rows are kept.
// 3. A second run directly erna is idempotent (deletes 0 rows).
//
// Run: `pnpm --filter @workspace/api-server run test:climb-cache-cleanup`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import { db, pool, climbCacheTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  cleanupClimbCacheDb,
  CLIMB_CACHE_MAX_AGE_MS,
} from "../lib/climbs/cache";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => void | Promise<void>) {
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

async function keyExists(key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: climbCacheTable.id })
    .from(climbCacheTable)
    .where(eq(climbCacheTable.cacheKey, key));
  return Boolean(row);
}

async function main() {
  const RUN = `test_climb_cleanup_${Date.now()}`;
  const OLD_KEY = `${RUN}:old`;
  const FRESH_KEY = `${RUN}:fresh`;

  // Pin "now" so the test is deterministic and never depends on wall-clock
  // drift between seed and cleanup.
  const now = Date.now();
  const oldFetchedAt = new Date(now - CLIMB_CACHE_MAX_AGE_MS - 60 * 60 * 1000); // 1h over de grens
  const freshFetchedAt = new Date(now - 60 * 60 * 1000); // 1h oud, ruim binnen TTL

  try {
    await db.insert(climbCacheTable).values([
      { cacheKey: OLD_KEY, payload: { seeded: "old" }, fetchedAt: oldFetchedAt },
      {
        cacheKey: FRESH_KEY,
        payload: { seeded: "fresh" },
        fetchedAt: freshFetchedAt,
      },
    ]);

    let firstDeleted = -1;
    await scenario("expired row is deleted", async () => {
      const first = await cleanupClimbCacheDb(now);
      firstDeleted = first.deleted;
      assert(first.deleted >= 1, `expected ≥1 deletion, got ${first.deleted}`);
      assert(!(await keyExists(OLD_KEY)), "expired row must be gone");
    });

    await scenario("fresh row is kept", async () => {
      assert(await keyExists(FRESH_KEY), "fresh row must survive cleanup");
    });

    await scenario("second run is idempotent (deletes 0)", async () => {
      const second = await cleanupClimbCacheDb(now);
      assert(
        second.deleted === 0,
        `second run must delete 0 rows, got ${second.deleted}`,
      );
      assert(await keyExists(FRESH_KEY), "fresh row must still exist");
      assert(firstDeleted >= 1, "first run must have reported its deletions");
    });
  } finally {
    await db
      .delete(climbCacheTable)
      .where(inArray(climbCacheTable.cacheKey, [OLD_KEY, FRESH_KEY]));
    await pool.end();
  }

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
