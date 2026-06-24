// Sparki Data Hub — central engine.
//
// One pipeline for every sport/health platform: fetch (per-provider adapter) →
// normalize (canonical records) → validate → dedup/merge across sources → apply
// per-data-type consent → persist into Sparki's canonical tables → log the run.
//
// Adding a platform = implement its adapter in `providers.ts` and flip its
// registry `available` flag. Routing, ingest, dedup, consent, readiness and
// logging are all platform-agnostic and handled here.

import { and, eq } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  connectorConsentsTable,
  syncRunsTable,
  connectorDataTypes,
  type ConnectorDataType,
  type SyncRunTrigger,
  type SyncRunCounts,
  type SyncRun,
} from "@workspace/db";
import {
  getConnectorDefinition,
  type ConnectorDefinition,
} from "../../lib/connectors/registry";
import { getHubProvider } from "./providers";
import { ingestBatch } from "./ingest";
import { ensureMaterialNudgeNotification } from "../material";

export * from "./types";
export * from "./sports";
export * from "./dedupe";
export * from "./validation";
export * from "./readiness";
export * from "./providers";
export { ingestBatch } from "./ingest";
export type { IngestOptions } from "./ingest";

// Honest, typed failure so the API can map it to the right status code.
export type HubErrorCode = "not_found" | "unavailable" | "unsupported" | "sync_failed";

export class HubError extends Error {
  code: HubErrorCode;
  constructor(code: HubErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "HubError";
  }
}

/**
 * Data types NOT revoked by the user for this provider. Consent is default-grant:
 * any type without an explicit `granted=false` row is allowed.
 */
export async function loadAllowedDataTypes(
  clerkId: string,
  provider: string,
): Promise<Set<ConnectorDataType>> {
  const rows = await db
    .select()
    .from(connectorConsentsTable)
    .where(
      and(
        eq(connectorConsentsTable.clerkId, clerkId),
        eq(connectorConsentsTable.provider, provider),
      ),
    );
  const denied = new Set(
    rows.filter((r) => !r.granted).map((r) => r.dataType),
  );
  return new Set(
    connectorDataTypes.filter((t) => !denied.has(t)),
  ) as Set<ConnectorDataType>;
}

async function upsertConnection(
  clerkId: string,
  provider: string,
  importedDataTypes: ConnectorDataType[],
  externalUserId: string | null | undefined,
  now: Date,
): Promise<void> {
  await db
    .insert(connectorConnectionsTable)
    .values({
      clerkId,
      provider,
      status: "connected",
      lastSyncAt: now,
      connectedAt: now,
      importedDataTypes,
      externalUserId: externalUserId ?? null,
      permissionRevoked: false,
      errorStatus: null,
    })
    .onConflictDoUpdate({
      target: [
        connectorConnectionsTable.clerkId,
        connectorConnectionsTable.provider,
      ],
      set: {
        status: "connected",
        lastSyncAt: now,
        connectedAt: now,
        importedDataTypes,
        externalUserId: externalUserId ?? null,
        permissionRevoked: false,
        errorStatus: null,
        updatedAt: now,
      },
    });
}

async function recordConnectionError(
  clerkId: string,
  provider: string,
  message: string,
  now: Date,
): Promise<void> {
  await db
    .insert(connectorConnectionsTable)
    .values({ clerkId, provider, status: "error", errorStatus: message })
    .onConflictDoUpdate({
      target: [
        connectorConnectionsTable.clerkId,
        connectorConnectionsTable.provider,
      ],
      set: { status: "error", errorStatus: message, updatedAt: now },
    })
    .catch(() => {});
}

export interface RunSyncResult {
  run: SyncRun;
  counts: SyncRunCounts;
  importedDataTypes: ConnectorDataType[];
}

/**
 * Run a real sync for one platform: log it, fetch+normalize, ingest, update the
 * connection. Throws a typed HubError for platforms that can't fetch live data
 * yet (so they surface honestly, never a fake success).
 */
export async function runSync(
  clerkId: string,
  providerId: string,
  trigger: SyncRunTrigger = "manual",
): Promise<RunSyncResult> {
  const def: ConnectorDefinition | undefined = getConnectorDefinition(providerId);
  if (!def) throw new HubError("not_found", "Onbekende koppeling.");

  if (!def.available) {
    throw new HubError(
      "unavailable",
      def.unavailableReason ?? "Deze koppeling is nog niet beschikbaar.",
    );
  }
  const provider = getHubProvider(providerId);
  if (!provider?.fetchAndNormalize) {
    throw new HubError("unsupported", "Koppeling nog niet ondersteund.");
  }

  const [run] = await db
    .insert(syncRunsTable)
    .values({ clerkId, provider: providerId, trigger, status: "running" })
    .returning();
  const runId = run!.id;
  const now = new Date();

  try {
    const allowed = await loadAllowedDataTypes(clerkId, providerId);
    const batch = await provider.fetchAndNormalize({ clerkId });

    const counts: SyncRunCounts = batch.persistedExternally
      ? {}
      : await ingestBatch(clerkId, providerId, batch, { allowed });

    await upsertConnection(
      clerkId,
      providerId,
      batch.importedDataTypes,
      batch.externalUserId,
      now,
    );

    const [finished] = await db
      .update(syncRunsTable)
      .set({
        status: "success",
        finishedAt: new Date(),
        counts,
        importedDataTypes: batch.importedDataTypes,
      })
      .where(eq(syncRunsTable.id, runId))
      .returning();

    // Fresh activity may push a wear part over its threshold — let Sparki notice
    // and (idempotently) raise a gentle Materiaalcoach nudge. Best-effort: never
    // let it break a successful sync.
    await ensureMaterialNudgeNotification(clerkId).catch(() => {});

    return {
      run: finished!,
      counts,
      importedDataTypes: batch.importedDataTypes,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Synchroniseren mislukt.";
    await db
      .update(syncRunsTable)
      .set({ status: "failed", finishedAt: new Date(), error: message })
      .where(eq(syncRunsTable.id, runId))
      .catch(() => {});
    await recordConnectionError(clerkId, providerId, message, now);
    throw new HubError("sync_failed", message);
  }
}
