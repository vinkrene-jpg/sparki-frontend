import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, connectorConnectionsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  connectorRegistry,
  getConnectorDefinition,
  syncStrava,
  type ProviderSyncResult,
} from "../engines/integration";

const router = Router();

// Map of provider-id → real import function. Adding a wired platform = one entry
// here plus its registry definition + provider module. Platforms absent from
// this map are honestly "binnenkort beschikbaar" and cannot be synced.
const SYNC_PROVIDERS: Record<
  string,
  (clerkId: string) => Promise<ProviderSyncResult>
> = {
  strava: syncStrava,
};

// Build the public connector shape (registry definition + this user's live row).
async function buildConnectorItem(clerkId: string, id: string) {
  const def = getConnectorDefinition(id)!;
  const [row] = await db
    .select()
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.provider, id),
      ),
    );
  return {
    id: def.id,
    displayName: def.displayName,
    category: def.category,
    available: def.available,
    authType: def.authType,
    provides: def.provides,
    unavailableReason: def.unavailableReason ?? null,
    status: row?.status ?? "disconnected",
    lastSyncAt: row?.lastSyncAt ?? null,
    importedDataTypes: row?.importedDataTypes ?? [],
    errorStatus: row?.errorStatus ?? null,
    permissionRevoked: row?.permissionRevoked ?? false,
    connectedAt: row?.connectedAt ?? null,
  };
}

// GET /api/connectors — modular registry merged with this user's connection
// state. Platforms that aren't wireable yet are returned honestly with
// available=false and a Dutch reason; they can never appear "connected".
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rows = await db
      .select()
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.clerkId, clerkId));
    const byProvider = new Map(rows.map((r) => [r.provider, r]));

    const connectors = connectorRegistry.map((def) => {
      const row = byProvider.get(def.id);
      return {
        id: def.id,
        displayName: def.displayName,
        category: def.category,
        available: def.available,
        authType: def.authType,
        provides: def.provides,
        unavailableReason: def.unavailableReason ?? null,
        status: row?.status ?? "disconnected",
        lastSyncAt: row?.lastSyncAt ?? null,
        importedDataTypes: row?.importedDataTypes ?? [],
        errorStatus: row?.errorStatus ?? null,
        permissionRevoked: row?.permissionRevoked ?? false,
        connectedAt: row?.connectedAt ?? null,
      };
    });

    res.json({ connectors });
  } catch (err) {
    req.log.error({ err }, "connectors.list failed");
    res.status(500).json({ error: "Failed to load connectors" });
  }
});

// POST /api/connectors/:id/sync — run a real import for a wireable platform and
// persist the connection state. Non-wired platforms return an honest 400/501.
router.post("/:id/sync", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  const def = getConnectorDefinition(id);
  if (!def) {
    res.status(404).json({ error: "Unknown connector" });
    return;
  }
  if (!def.available) {
    res.status(400).json({
      error: "unavailable",
      message: def.unavailableReason ?? "Deze koppeling is nog niet beschikbaar.",
    });
    return;
  }
  const provider = SYNC_PROVIDERS[id];
  if (!provider) {
    res.status(501).json({ error: "Koppeling nog niet ondersteund." });
    return;
  }

  const now = new Date();
  try {
    const result = await provider(clerkId);
    await db
      .insert(connectorConnectionsTable)
      .values({
        clerkId,
        provider: id,
        status: "connected",
        lastSyncAt: now,
        connectedAt: now,
        importedDataTypes: result.importedDataTypes,
        externalUserId: result.externalUserId,
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
          importedDataTypes: result.importedDataTypes,
          externalUserId: result.externalUserId,
          permissionRevoked: false,
          errorStatus: null,
          updatedAt: now,
        },
      });

    res.json({ connector: await buildConnectorItem(clerkId, def.id) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Synchroniseren mislukt.";
    req.log.error({ err }, "connectors.sync failed");
    // Record the failure honestly so the UI can surface it (no silent success).
    await db
      .insert(connectorConnectionsTable)
      .values({ clerkId, provider: id, status: "error", errorStatus: message })
      .onConflictDoUpdate({
        target: [
          connectorConnectionsTable.clerkId,
          connectorConnectionsTable.provider,
        ],
        set: { status: "error", errorStatus: message, updatedAt: now },
      })
      .catch(() => {});
    res.status(502).json({ error: "sync_failed", message });
  }
});

// POST /api/connectors/:id/disconnect — drop the local connection + tokens.
router.post("/:id/disconnect", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  if (!getConnectorDefinition(id)) {
    res.status(404).json({ error: "Unknown connector" });
    return;
  }
  const now = new Date();
  try {
    await db
      .insert(connectorConnectionsTable)
      .values({ clerkId, provider: id, status: "disconnected" })
      .onConflictDoUpdate({
        target: [
          connectorConnectionsTable.clerkId,
          connectorConnectionsTable.provider,
        ],
        set: {
          status: "disconnected",
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          connectedAt: null,
          errorStatus: null,
          updatedAt: now,
        },
      });
    res.json({ connector: await buildConnectorItem(clerkId, id) });
  } catch (err) {
    req.log.error({ err }, "connectors.disconnect failed");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// POST /api/connectors/:id/revoke — mark provider-side access as revoked.
router.post("/:id/revoke", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  if (!getConnectorDefinition(id)) {
    res.status(404).json({ error: "Unknown connector" });
    return;
  }
  const now = new Date();
  try {
    await db
      .insert(connectorConnectionsTable)
      .values({
        clerkId,
        provider: id,
        status: "revoked",
        permissionRevoked: true,
      })
      .onConflictDoUpdate({
        target: [
          connectorConnectionsTable.clerkId,
          connectorConnectionsTable.provider,
        ],
        set: {
          status: "revoked",
          permissionRevoked: true,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          connectedAt: null,
          updatedAt: now,
        },
      });
    res.json({ connector: await buildConnectorItem(clerkId, id) });
  } catch (err) {
    req.log.error({ err }, "connectors.revoke failed");
    res.status(500).json({ error: "Failed to revoke" });
  }
});

export default router;
