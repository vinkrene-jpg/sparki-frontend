// Geplande taken (/admin) overview — DB-backed route contract test.
//
// The pure classification is unit-tested in `scheduled-tasks.ts`. This test
// pins the OTHER half the feature depends on: the real SQL queries inside
// GET /api/admin/scheduled-tasks that turn live data traces into a last-run
// status. Those queries are exactly where a silent regression hides — a
// renamed column, a drifted dedupeKey prefix ('reminder:%'), or a changed
// table/condition would make a job read stale-green or grey without anyone
// noticing. This test seeds ONE fresh, newest trace per job straight into the
// DB, boots the REAL Express app, calls the endpoint as a dev admin, and
// asserts each job's status echoes that fresh trace (green + matching
// lastRunAt). If any query drifts off its column/table/prefix, the freshly
// seeded row won't be found and the assertion fails loudly.
//
// It does NOT wipe global tables (they hold real data): every job here is a
// `max(...)`/newest-first query, so a row inserted at "now" is guaranteed to be
// the newest and win regardless of pre-existing rows. Cleanup removes only the
// rows this test created.
//
// Run: `pnpm --filter @workspace/api-server run test:scheduled-tasks-route`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  healthCheckBatchesTable,
  goalProposalsTable,
  notificationsTable,
  knowledgeItemsTable,
  userProfilesTable,
  syncRunsTable,
  connectorConnectionsTable,
  routeLibraryTable,
  athleteProfilesTable,
  aiMemoryEventsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
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

const RUN = `test_schedtasks_${Date.now()}`;
const adminId = `${RUN}_admin`;

// WP-S1 (31-07-2026): isAdmin heeft geen dev-bypass meer — admin is altijd
// strikt via SPARKI_ADMIN_IDS. De testadmin moet dus expliciet in de lijst
// staan (zelfde patroon als data-origin.ts); isAdmin leest de env per call.
process.env["SPARKI_ADMIN_IDS"] = `${process.env["SPARKI_ADMIN_IDS"] ?? ""},${adminId}`;

// Track what we insert so cleanup removes only our rows.
const seeded = {
  batchIds: [] as number[],
  proposalIds: [] as number[],
  notifIds: [] as number[],
  knowledgeIds: [] as number[],
  syncRunIds: [] as number[],
  connectionIds: [] as number[],
  libraryRouteIds: [] as number[],
  memoryEventIds: [] as number[],
};

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

interface ScheduledTask {
  key: string;
  statusColor: "green" | "orange" | "grey";
  lastRunAt: string | null;
  title: string;
  message: string;
  runCommand: string;
  schedule: string;
}

async function fetchScheduledTasks(
  clerkId: string,
): Promise<{ status: number; tasks: ScheduledTask[]; missing: number }> {
  const res = await fetch(`${baseUrl}/api/admin/scheduled-tasks`, {
    headers: { "x-dev-clerk-id": clerkId },
  });
  const json = (await res.json()) as {
    tasks?: ScheduledTask[];
    missing?: number;
  };
  return {
    status: res.status,
    tasks: json.tasks ?? [],
    missing: json.missing ?? 0,
  };
}

// Treat two ISO instants as equal within a small tolerance (timestamptz round-
// trip can differ by sub-ms; we insert exact JS Dates so this is generous).
function sameInstant(iso: string | null, at: Date): boolean {
  if (!iso) return false;
  return Math.abs(new Date(iso).getTime() - at.getTime()) < 2000;
}

async function seedFreshTraces(at: Date): Promise<void> {
  // job:health — a scheduler-triggered batch is the trace the query reads.
  const [batch] = await db
    .insert(healthCheckBatchesTable)
    .values({
      runMode: "daily",
      overallStatus: "green",
      triggeredBy: "scheduler",
      startedAt: at,
      finishedAt: at,
    })
    .returning({ id: healthCheckBatchesTable.id });
  seeded.batchIds.push(batch!.id);

  // job:goal-review — a goal proposal (max(created_at) is the trace).
  const [proposal] = await db
    .insert(goalProposalsTable)
    .values({
      clerkId: adminId,
      kind: "goal_review",
      title: "Testvoorstel",
      reasoning: "Testreden",
      dedupeKey: `${RUN}:proposal`,
      createdAt: at,
    })
    .returning({ id: goalProposalsTable.id });
  seeded.proposalIds.push(proposal!.id);

  // job:reminders — a notification whose dedupeKey starts with 'reminder:'.
  // This is the drift-catcher for the LIKE 'reminder:%' condition.
  const [notif] = await db
    .insert(notificationsTable)
    .values({
      clerkId: adminId,
      type: "checkin_reminder",
      title: "Testherinnering",
      dedupeKey: `reminder:${RUN}:checkin`,
      createdAt: at,
    })
    .returning({ id: notificationsTable.id });
  seeded.notifIds.push(notif!.id);

  // knowledge-scan — a knowledge item (max(coalesce(fetched_at, created_at))).
  const [item] = await db
    .insert(knowledgeItemsTable)
    .values({
      dedupeKey: `${RUN}:knowledge`,
      provider: "test",
      title: "Testkennis",
      url: "https://example.test/paper",
      fetchedAt: at,
      createdAt: at,
    })
    .returning({ id: knowledgeItemsTable.id });
  seeded.knowledgeIds.push(item!.id);

  // job:sync — a SCHEDULED sync run (max(started_at) where trigger='scheduled')
  // plus a connected connection (drives the honest-grey branch when absent).
  const [syncRun] = await db
    .insert(syncRunsTable)
    .values({
      clerkId: adminId,
      provider: "strava",
      trigger: "scheduled",
      status: "success",
      startedAt: at,
      finishedAt: at,
    })
    .returning({ id: syncRunsTable.id });
  seeded.syncRunIds.push(syncRun!.id);
  const [conn] = await db
    .insert(connectorConnectionsTable)
    .values({
      clerkId: adminId,
      provider: "strava",
      status: "connected",
      connectedAt: at,
    })
    .returning({ id: connectorConnectionsTable.id });
  seeded.connectionIds.push(conn!.id);

  // job:library-backfill — a freshly generated library route (max(created_at))
  // plus a known home location on the admin profile (drives the honest-grey
  // "no homes" branch when absent).
  await db
    .insert(athleteProfilesTable)
    .values({ clerkId: adminId, homeLat: "51.9", homeLon: "4.5" })
    .onConflictDoUpdate({
      target: athleteProfilesTable.clerkId,
      set: { homeLat: "51.9", homeLon: "4.5" },
    });
  const [libRoute] = await db
    .insert(routeLibraryTable)
    .values({
      cellKey: `test:${RUN}`,
      name: "Testlus",
      bikeType: "racefiets",
      targetKm: 40,
      startLat: 51.9,
      startLon: 4.5,
      geometry: [
        [51.9, 4.5],
        [51.91, 4.51],
      ],
      source: "sparki_auto",
      createdAt: at,
    })
    .returning({ id: routeLibraryTable.id });
  seeded.libraryRouteIds.push(libRoute!.id);

  // observatie-opschoning — an observation_cleanup event in ai_memory_events
  // (max(created_at) where event_type='observation_cleanup') is the trace.
  const [memEvent] = await db
    .insert(aiMemoryEventsTable)
    .values({
      clerkId: adminId,
      eventType: "observation_cleanup",
      metadata: { trigger: "test", flagged: 1 },
      createdAt: at,
    })
    .returning({ id: aiMemoryEventsTable.id });
  seeded.memoryEventIds.push(memEvent!.id);
}

async function cleanup() {
  if (seeded.batchIds.length)
    await db
      .delete(healthCheckBatchesTable)
      .where(inArray(healthCheckBatchesTable.id, seeded.batchIds));
  if (seeded.proposalIds.length)
    await db
      .delete(goalProposalsTable)
      .where(inArray(goalProposalsTable.id, seeded.proposalIds));
  if (seeded.notifIds.length)
    await db
      .delete(notificationsTable)
      .where(inArray(notificationsTable.id, seeded.notifIds));
  if (seeded.knowledgeIds.length)
    await db
      .delete(knowledgeItemsTable)
      .where(inArray(knowledgeItemsTable.id, seeded.knowledgeIds));
  if (seeded.syncRunIds.length)
    await db
      .delete(syncRunsTable)
      .where(inArray(syncRunsTable.id, seeded.syncRunIds));
  if (seeded.connectionIds.length)
    await db
      .delete(connectorConnectionsTable)
      .where(inArray(connectorConnectionsTable.id, seeded.connectionIds));
  if (seeded.libraryRouteIds.length)
    await db
      .delete(routeLibraryTable)
      .where(inArray(routeLibraryTable.id, seeded.libraryRouteIds));
  if (seeded.memoryEventIds.length)
    await db
      .delete(aiMemoryEventsTable)
      .where(inArray(aiMemoryEventsTable.id, seeded.memoryEventIds));
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, adminId));
}

async function main() {
  await startServer();

  // Precondition: the dev-auth bypass must authorize the admin, otherwise every
  // request is a 401/403 and the assertions below would be meaningless.
  await scenario("dev-admin can reach the endpoint (precondition)", async () => {
    await ensureAccount(adminId, `${adminId}@example.test`, "Admin", silentLogger);
    const { status } = await fetchScheduledTasks(adminId);
    assert(
      status === 200,
      `expected 200 via dev bypass, got ${status} — ensure NODE_ENV!=production ` +
        `and DEV_AUTH_BYPASS=true`,
    );
  });

  // Core: seed one fresh trace per job, then assert the endpoint reports all
  // four jobs, each with a valid statusColor, each detected green off our fresh
  // trace, and each lastRunAt echoing the exact instant we inserted (proving
  // the underlying query found OUR row — the drift guard).
  await scenario(
    "all 7 jobs present, valid statusColor, and each fresh trace is detected green",
    async () => {
      const at = new Date();
      await seedFreshTraces(at);

      const { tasks } = await fetchScheduledTasks(adminId);
      const byKey = new Map(tasks.map((t) => [t.key, t]));

      for (const key of [
        "health",
        "goal_review",
        "reminders",
        "knowledge_scan",
        "connector_sync",
        "library_backfill",
        "observation_cleanup",
      ] as const) {
        const t = byKey.get(key);
        assert(t, `job ${key} missing from response`);
        assert(
          ["green", "orange", "grey"].includes(t!.statusColor),
          `job ${key} has invalid statusColor ${t!.statusColor}`,
        );
        assert(
          t!.statusColor === "green",
          `job ${key} should be green off its fresh trace, got ${t!.statusColor} ` +
            `(query drift?)`,
        );
        assert(
          sameInstant(t!.lastRunAt, at),
          `job ${key} lastRunAt (${t!.lastRunAt}) should echo the seeded instant ` +
            `${at.toISOString()} — the query is not reading our fresh row`,
        );
      }
    },
  );

  // Focused drift guard: prove the reminder status specifically depends on the
  // 'reminder:%' dedupeKey prefix. A notification WITHOUT that prefix must NOT
  // count as a reminder trace — if it did, a prefix drift would go unnoticed.
  await scenario(
    "reminders ignores notifications that don't use the 'reminder:' dedupeKey prefix",
    async () => {
      // A dedicated user with no seeded traces of its own; we only insert a
      // non-reminder notification and confirm the reminder status does not echo
      // it. (Global newest-reminder may still be green from other data, so we
      // assert on the identity of the trace, not merely the colour.)
      const at = new Date();
      const [notif] = await db
        .insert(notificationsTable)
        .values({
          clerkId: adminId,
          type: "system",
          title: "Niet-herinnering",
          dedupeKey: `${RUN}:not-a-reminder`,
          createdAt: new Date(at.getTime() + 60_000), // newer than everything
        })
        .returning({ id: notificationsTable.id });
      seeded.notifIds.push(notif!.id);

      const { tasks } = await fetchScheduledTasks(adminId);
      const reminders = tasks.find((t) => t.key === "reminders")!;
      assert(
        !sameInstant(reminders.lastRunAt, new Date(at.getTime() + 60_000)),
        "a non-'reminder:' notification must never be read as a reminder trace",
      );
    },
  );
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== geplande taken route contract — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
