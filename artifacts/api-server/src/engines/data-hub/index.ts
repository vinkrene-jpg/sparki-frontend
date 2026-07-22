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
import { ingestBatch, effectiveImportedDataTypes } from "./ingest";
import { ensureMaterialNudgeNotification } from "../material";
import { isKilled } from "../../lib/kill-switches";
import {
  createNotification,
  resolveNotifications,
} from "../../lib/notifications";
import { refreshDerivedLoadForAthlete } from "../../lib/derived-load-backfill";

export * from "./types";
export * from "./sports";
export * from "./dedupe";
export * from "./validation";
export * from "./readiness";
export * from "./providers";
export {
  ingestBatch,
  effectiveImportedDataTypes,
  activitiesIngestAllowed,
} from "./ingest";
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

// ── Transient-fout herkenning + retry ────────────────────────────────────────
// Netwerkstoringen en tijdelijke serverfouten (5xx / rate limit) zijn geen
// permanente fouten: één automatische herkansing met korte backoff lost ze
// meestal op. Permanente fouten (auth, 4xx, parsefouten) worden NIET herhaald —
// die moeten zichtbaar falen.
export function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number } | null)?.status;
  if (typeof status === "number")
    return status === 429 || (status >= 500 && status < 600);
  return /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network|timeout|429|50[0-4]/i.test(
    msg,
  );
}

const sleep = (msDelay: number) =>
  new Promise((resolve) => setTimeout(resolve, msDelay));

/** Run `fn`, retrying up to `retries` times ONLY on transient errors. */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isTransientError(err)) throw err;
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }
  throw lastErr;
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

  // Kill switches: imports/synchronisaties globaal, plus externe providers
  // apart (bestandsimport is geen externe provider). Bestaande data blijft
  // onaangetast — alleen NIEUWE verwerking stopt.
  if (await isKilled("imports_sync")) {
    throw new HubError(
      "unavailable",
      "Imports en synchronisaties zijn tijdelijk uitgeschakeld door de beheerder. Probeer het later opnieuw.",
    );
  }
  if (providerId !== "file" && (await isKilled("external_providers"))) {
    throw new HubError(
      "unavailable",
      "Externe koppelingen zijn tijdelijk uitgeschakeld door de beheerder. Probeer het later opnieuw.",
    );
  }

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
    // Tijdelijke netwerk-/serverfouten krijgen automatisch een herkansing;
    // permanente fouten falen direct en zichtbaar.
    const batch = await withTransientRetry(() =>
      provider.fetchAndNormalize!({ clerkId, backfill: trigger === "backfill" }),
    );

    const counts: SyncRunCounts = batch.persistedExternally
      ? {}
      : await ingestBatch(clerkId, providerId, batch, { allowed });

    // Report only what consent actually let us persist — never claim activity
    // import when the user revoked activities/training_history.
    const importedDataTypes = effectiveImportedDataTypes(batch, allowed);

    await upsertConnection(
      clerkId,
      providerId,
      importedDataTypes,
      batch.externalUserId,
      now,
    );

    // Eerlijk loggen: als individuele activiteiten faalden is de run "partial",
    // met de foutvoorbeelden erbij — nooit een stille "success" met dataverlies.
    const hadErrors = (counts.errors ?? 0) > 0;
    const [finished] = await db
      .update(syncRunsTable)
      .set({
        status: hadErrors ? "partial" : "success",
        finishedAt: new Date(),
        counts,
        importedDataTypes,
        error: hadErrors
          ? `${counts.errors} activiteit(en) niet verwerkt: ${(counts.errorSamples ?? []).join(" | ")}`.slice(0, 1000)
          : null,
      })
      .where(eq(syncRunsTable.id, runId))
      .returning();

    // Golf 24: een eerder gemelde synchronisatiefout voor deze koppeling is nu
    // hersteld — de melding verdwijnt (opgelost), zonder rijen te verwijderen.
    await resolveNotifications(clerkId, `sync:${providerId}`);

    // Fresh activity may push a wear part over its threshold — let Sparki notice
    // and (idempotently) raise a gentle Materiaalcoach nudge. Best-effort: never
    // let it break a successful sync.
    await ensureMaterialNudgeNotification(clerkId).catch(() => {});

    // Repair derived numbers over the athlete's full history: fill scores that
    // became derivable (e.g. FTP arrived after older rides) and re-derive an
    // ESTIMATED weekly target from real riding. Best-effort, never throws.
    await refreshDerivedLoadForAthlete(clerkId);

    return {
      run: finished!,
      counts,
      importedDataTypes,
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
    // Golf 24: één actieve synchronisatiefout-melding per koppeling (nooit een
    // stapel bij herhaalde mislukkingen); verdwijnt vanzelf zodra een volgende
    // sync slaagt (resolutionKey) of na 7 dagen (geldigheid).
    await createNotification({
      clerkId,
      type: "sync_error",
      title: `Synchronisatie met ${def.displayName} lukt niet`,
      body: "De laatste synchronisatie is mislukt. Controleer de koppeling in de Data Hub of probeer het later opnieuw.",
      priority: "normal",
      actionUrl: "/you?focus=connections",
      source: "data-hub",
      audience: "athlete",
      resolutionKey: `sync:${providerId}`,
      expiresAt: new Date(now.getTime() + 7 * 86_400_000),
    });
    throw new HubError("sync_failed", message);
  }
}
