// Self-heal for stale connector rows left behind by the retired "koppelen
// gestart" flow. Platforms whose API is not wired (registry available=false)
// could once record a status="pending" shell after the consent screen — an
// honest intent marker, but a dead-end in every dashboard: the connection can
// never be completed, configured, or synced. The flow has been removed from
// the UI and API; this pass deletes the leftover rows so no surface shows an
// unfinishable "In afwachting" state.
//
// Scope (deliberately narrow — a real connection is NEVER deleted):
// - status="pending" rows: nothing creates these anymore (only the removed
//   /start endpoint ever wrote them), so ALL of them are stale.
// - TOKENLESS rows for registry-unavailable providers: a real connection
//   always carries OAuth tokens; a row without any token for a platform whose
//   API is not wired (e.g. a fake "connected" garmin from old test data) can
//   only be a leftover shell. Rows WITH tokens are always preserved — even if
//   a provider were temporarily flagged unavailable, real state survives.
import { inArray, or, and, eq, isNull } from "drizzle-orm";
import { db, connectorConnectionsTable } from "@workspace/db";
import { connectorRegistry } from "./registry";

export async function cleanupStaleConnectorShells(opts?: {
  log?: (msg: string) => void;
}): Promise<{ deleted: number }> {
  const log = opts?.log ?? (() => {});
  const unavailableProviders = connectorRegistry
    .filter((def) => !def.available)
    .map((def) => def.id);

  const deleted = await db
    .delete(connectorConnectionsTable)
    .where(
      or(
        eq(connectorConnectionsTable.status, "pending"),
        unavailableProviders.length > 0
          ? and(
              inArray(
                connectorConnectionsTable.provider,
                unavailableProviders,
              ),
              isNull(connectorConnectionsTable.accessToken),
              isNull(connectorConnectionsTable.refreshToken),
            )
          : undefined,
      ),
    )
    .returning({ provider: connectorConnectionsTable.provider });

  if (deleted.length > 0) {
    const counts = new Map<string, number>();
    for (const row of deleted)
      counts.set(row.provider, (counts.get(row.provider) ?? 0) + 1);
    log(
      `Stale connector shells removed: ${[...counts.entries()]
        .map(([p, n]) => `${p}×${n}`)
        .join(", ")}`,
    );
  }
  return { deleted: deleted.length };
}
