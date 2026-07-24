// Sparki Connect — geplande achtergrondsynchronisatie (job:sync) test.
//
// Pint het beslisgedrag van runScheduledConnectorSync() op echte DB-rijen:
//  - alleen echt gekoppelde, synchroniseerbare platforms worden bekeken
//  - actuele koppelingen worden overgeslagen (geen onnodige API-druk)
//  - koppelingen zonder token worden overgeslagen (niets te halen)
//  - een verouderde koppeling met (ongeldig) token leidt tot een echte
//    sync-poging die eerlijk faalt: summary.failed + een 'scheduled' sync_run
//    met status failed + een verbindingsfout — nooit een stil succes
//  - maxConnections begrenst het aantal bekeken koppelingen
//
// Geen mocks: de faalroute raakt de echte Strava-API met een ongeldig token en
// moet dan ook echt falen. Run:
// `pnpm --filter @workspace/api-server run test:connect-sync`

import {
  db,
  pool,
  connectorConnectionsTable,
  syncRunsTable,
  notificationsTable,
  userProfilesTable,
} from "@workspace/db";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import {
  runScheduledConnectorSync,
  syncableProviders,
} from "../engines/data-hub/scheduled-sync";
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

const RUN = `test_connsync_${Date.now()}`;
const userFresh = `${RUN}_fresh`;
const userNoToken = `${RUN}_notoken`;
const userStale = `${RUN}_stale`;

const allUsers = [userFresh, userNoToken, userStale];

async function cleanup() {
  await db
    .delete(syncRunsTable)
    .where(inArray(syncRunsTable.clerkId, allUsers));
  await db
    .delete(connectorConnectionsTable)
    .where(inArray(connectorConnectionsTable.clerkId, allUsers));
  await db
    .delete(notificationsTable)
    .where(inArray(notificationsTable.clerkId, allUsers));
  await db
    .delete(userProfilesTable)
    .where(like(userProfilesTable.clerkId, `${RUN}%`));
}

async function main() {
  const now = new Date();

  await scenario("syncableProviders bevat strava en nooit 'file'", async () => {
    const providers = syncableProviders();
    assert(providers.includes("strava"), `strava ontbreekt: ${providers.join(",")}`);
    assert(!providers.includes("file"), "'file' mag nooit gepland gesynct worden");
  });

  for (const u of allUsers) {
    await ensureAccount(u, `${u}@example.test`, "Test", silentLogger);
  }

  // Actuele koppeling: gisteren gesynct binnen de veroudering-grens? Nee —
  // grens is uren; gebruik 30 min geleden zodat hij zeker actueel is.
  await db.insert(connectorConnectionsTable).values([
    {
      clerkId: userFresh,
      provider: "strava",
      status: "connected",
      accessToken: "test-token-fresh",
      lastSyncAt: new Date(now.getTime() - 30 * 60 * 1000),
      connectedAt: now,
    },
    {
      clerkId: userNoToken,
      provider: "strava",
      status: "connected",
      accessToken: null,
      lastSyncAt: null,
      connectedAt: now,
    },
    {
      clerkId: userStale,
      provider: "strava",
      status: "connected",
      accessToken: "test-token-invalid",
      lastSyncAt: new Date(now.getTime() - 7 * 24 * 3600 * 1000),
      connectedAt: now,
    },
  ]);

  await scenario(
    "actueel + zonder token → overgeslagen; verouderd → echte poging die eerlijk faalt",
    async () => {
      const summary = await runScheduledConnectorSync({ now });
      // Andere (echte) rijen kunnen meedraaien; assert daarom relatief via de
      // eigen sync_runs, en absoluut alleen dat onze drie rijen goed vielen.
      const [staleRun] = await db
        .select()
        .from(syncRunsTable)
        .where(
          and(
            eq(syncRunsTable.clerkId, userStale),
            eq(syncRunsTable.provider, "strava"),
          ),
        )
        .orderBy(desc(syncRunsTable.startedAt))
        .limit(1);
      assert(staleRun, "verouderde koppeling moet een sync_run-poging krijgen");
      assert(
        staleRun!.trigger === "scheduled",
        `trigger moet 'scheduled' zijn, kreeg ${staleRun!.trigger}`,
      );
      assert(
        staleRun!.status === "failed",
        `ongeldig token moet eerlijk falen, kreeg ${staleRun!.status}`,
      );
      const freshRuns = await db
        .select()
        .from(syncRunsTable)
        .where(eq(syncRunsTable.clerkId, userFresh));
      assert(freshRuns.length === 0, "actuele koppeling mag NIET gesynct worden");
      const noTokenRuns = await db
        .select()
        .from(syncRunsTable)
        .where(eq(syncRunsTable.clerkId, userNoToken));
      assert(noTokenRuns.length === 0, "koppeling zonder token mag NIET gesynct worden");
      assert(summary.checked >= 3, `minstens 3 gecontroleerd, kreeg ${summary.checked}`);
      assert(summary.failed >= 1, "de verouderde koppeling moet als mislukt tellen");
      assert(summary.skipped >= 2, "actueel + zonder token moeten als overgeslagen tellen");
    },
  );

  await scenario(
    "mislukte sync zet de verbinding eerlijk in fouttoestand",
    async () => {
      const [row] = await db
        .select()
        .from(connectorConnectionsTable)
        .where(
          and(
            eq(connectorConnectionsTable.clerkId, userStale),
            eq(connectorConnectionsTable.provider, "strava"),
          ),
        );
      assert(row, "verbindingsrij moet bestaan");
      assert(row!.status === "error", `verwacht status error, kreeg ${row!.status}`);
    },
  );

  await scenario("maxConnections begrenst het aantal bekeken koppelingen", async () => {
    const summary = await runScheduledConnectorSync({ now, maxConnections: 1 });
    assert(summary.checked === 1, `verwacht checked 1, kreeg ${summary.checked}`);
  });

  await cleanup();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(
      `${r.status === "pass" ? "✓" : "✗"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
    );
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  await pool.end();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  await cleanup().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
