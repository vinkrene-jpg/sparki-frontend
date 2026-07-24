// Sparki Connect — geplande achtergrondsynchronisatie (app-breed).
//
// Webhooks blijven het primaire kanaal; deze taak is het vangnet dat voor
// ÁLLE gebruikers met een echt gekoppeld platform controleert of de laatste
// sync verouderd of mislukt is, en dan een begrensde, incrementele inhaalsync
// draait (nooit een volledige her-import). Zelfde beslisregels en hetzelfde
// syncpad als de per-gebruiker inhaalsync: shouldCatchUp + runSync met
// afterEpochSec. Dedupe maakt herhaald draaien onschadelijk.

import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  syncRunsTable,
} from "@workspace/db";
import { runSync, HubError } from "./index";
import { getHubProvider } from "./providers";
import {
  shouldCatchUp,
  computeCatchUpAfterEpochSec,
} from "./strava-sync";
import { connectorRegistry } from "../../lib/connectors/registry";

export interface ScheduledSyncSummary {
  checked: number;
  synced: number;
  skipped: number;
  failed: number;
  busy: number;
}

/** Platforms waarvoor een echte live-ophaling bestaat (adapter met fetch). */
export function syncableProviders(): string[] {
  return connectorRegistry
    .filter((def) => def.available && Boolean(getHubProvider(def.id)?.fetchAndNormalize))
    .map((def) => def.id)
    .filter((id) => id !== "file");
}

/**
 * Draai de geplande inhaalsync voor alle gebruikers met een gekoppeld,
 * synchroniseerbaar platform. Sequentieel (rate-limit-vriendelijk) en per
 * gebruiker geïsoleerd: één fout stopt de rest nooit. `maxConnections` is een
 * veiligheidsklep voor grote populaties.
 */
export async function runScheduledConnectorSync(opts: {
  now?: Date;
  maxConnections?: number;
  log?: {
    info: (o: unknown, m: string) => void;
    warn: (o: unknown, m: string) => void;
  };
} = {}): Promise<ScheduledSyncSummary> {
  const now = opts.now ?? new Date();
  const providers = syncableProviders();
  const summary: ScheduledSyncSummary = {
    checked: 0,
    synced: 0,
    skipped: 0,
    failed: 0,
    busy: 0,
  };
  if (providers.length === 0) return summary;

  const rows = await db
    .select()
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.status, "connected"),
        inArray(connectorConnectionsTable.provider, providers),
      ),
    )
    .orderBy(connectorConnectionsTable.id);
  const limited =
    opts.maxConnections && opts.maxConnections > 0
      ? rows.slice(0, opts.maxConnections)
      : rows;

  for (const row of limited) {
    summary.checked++;
    try {
      const [lastRun] = await db
        .select({ status: syncRunsTable.status })
        .from(syncRunsTable)
        .where(
          and(
            eq(syncRunsTable.clerkId, row.clerkId),
            eq(syncRunsTable.provider, row.provider),
          ),
        )
        .orderBy(desc(syncRunsTable.startedAt))
        .limit(1);
      const decision = shouldCatchUp(row, lastRun?.status ?? null, now);
      if (!decision.catchUp) {
        summary.skipped++;
        continue;
      }
      const afterEpochSec = computeCatchUpAfterEpochSec(row.lastSyncAt, now);
      await runSync(row.clerkId, row.provider, "scheduled", { afterEpochSec });
      summary.synced++;
    } catch (err) {
      if (err instanceof HubError && err.code === "busy") {
        // Er loopt al een sync voor deze gebruiker — geen fout.
        summary.busy++;
        continue;
      }
      // Fout staat al eerlijk in de sync-run + verbindingsstatus (runSync).
      summary.failed++;
      opts.log?.warn(
        { err, clerkId: row.clerkId, provider: row.provider },
        "scheduled-sync: connection failed",
      );
    }
  }
  return summary;
}
