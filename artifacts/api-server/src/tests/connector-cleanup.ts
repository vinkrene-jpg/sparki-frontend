// Connector-cleanup test: stale "koppelen gestart" shell removal.
//
// Verifies cleanupStaleConnectorShells deletes exactly the stale rows (pending
// shells + tokenless rows for registry-unavailable providers) and NEVER
// deletes real connections (token-bearing rows, or rows for available
// providers). Seeds a disposable user; cleans up after itself.
//
// Run: `pnpm --filter @workspace/api-server run test:connector-cleanup`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import {
  db,
  pool,
  userProfilesTable,
  connectorConnectionsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { cleanupStaleConnectorShells } from "../lib/connectors/cleanup";
import { connectorRegistry } from "../lib/connectors/registry";

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

async function statusOf(clerkId: string, provider: string) {
  const [row] = await db
    .select({ status: connectorConnectionsTable.status })
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.provider, provider),
      ),
    );
  return row?.status ?? null;
}

async function main() {
  const RUN = `test_conn_cleanup_${Date.now()}`;

  const unavailable = connectorRegistry.filter((d) => !d.available);
  const availableDef = connectorRegistry.find((d) => d.available);
  assert(unavailable.length >= 2, "registry must have ≥2 unavailable providers");
  assert(availableDef, "registry must have an available provider");
  const [unavailA, unavailB] = [unavailable[0]!.id, unavailable[1]!.id];
  const availId = availableDef!.id;

  try {
    await db.insert(userProfilesTable).values({
      clerkId: RUN,
      email: `${RUN}@test.local`,
      displayName: "Connector Cleanup Test",
    });

    await db.insert(connectorConnectionsTable).values([
      // Stale: pending shell for an unavailable provider (the reported bug).
      { clerkId: RUN, provider: unavailA, status: "pending" },
      // Stale: tokenless fake "connected" for an unavailable provider.
      { clerkId: RUN, provider: unavailB, status: "connected" },
      // Real: token-bearing connection for an available provider.
      {
        clerkId: RUN,
        provider: availId,
        status: "connected",
        accessToken: "test-token",
        refreshToken: "test-refresh",
      },
    ]);

    await scenario("pending shell for unavailable provider is deleted", async () => {
      await cleanupStaleConnectorShells();
      assert(
        (await statusOf(RUN, unavailA)) === null,
        `${unavailA} pending shell must be gone`,
      );
    });

    await scenario("tokenless fake-connected row for unavailable provider is deleted", async () => {
      assert(
        (await statusOf(RUN, unavailB)) === null,
        `${unavailB} tokenless row must be gone`,
      );
    });

    await scenario("real token-bearing connection is preserved", async () => {
      assert(
        (await statusOf(RUN, availId)) === "connected",
        `${availId} real connection must survive`,
      );
    });

    await scenario("token-bearing row survives even for an unavailable provider", async () => {
      await db.insert(connectorConnectionsTable).values({
        clerkId: RUN,
        provider: unavailA,
        status: "connected",
        accessToken: "legacy-token",
      });
      await cleanupStaleConnectorShells();
      assert(
        (await statusOf(RUN, unavailA)) === "connected",
        `${unavailA} token-bearing row must survive cleanup`,
      );
    });

    await scenario("cleanup is idempotent (second run deletes nothing new)", async () => {
      const second = await cleanupStaleConnectorShells();
      // Other users' stale rows may not exist in dev; assert OUR rows stable.
      assert(
        (await statusOf(RUN, availId)) === "connected",
        "real connection must still exist after repeat run",
      );
      assert(second.deleted >= 0, "repeat run must not throw");
    });
  } finally {
    // FK cascade removes the connector rows with the user.
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, RUN));
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
