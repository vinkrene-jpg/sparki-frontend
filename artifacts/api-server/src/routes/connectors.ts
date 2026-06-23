import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, connectorConnectionsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  connectorRegistry,
  getConnectorDefinition,
  runSync,
  HubError,
  resolveReadiness,
} from "../engines/integration";

const router = Router();

// Build the public connector shape (registry definition + this user's live row +
// 4-state readiness). The Data Hub owns the actual sync pipeline (runSync).
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
    readiness: resolveReadiness(def, row?.status),
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
        readiness: resolveReadiness(def, row?.status),
      };
    });

    res.json({ connectors });
  } catch (err) {
    req.log.error({ err }, "connectors.list failed");
    res.status(500).json({ error: "Kon koppelingen niet laden." });
  }
});

// POST /api/connectors/:id/sync — run a real import for a wireable platform and
// persist the connection state. Non-wired platforms return an honest 400/501.
router.post("/:id/sync", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  try {
    // Single sync path: the Data Hub owns fetch → normalize → dedup → consent →
    // persist → log. This route just surfaces the result/connection shape.
    await runSync(clerkId, id, "manual");
    res.json({ connector: await buildConnectorItem(clerkId, id) });
  } catch (err) {
    if (err instanceof HubError) {
      const status =
        err.code === "not_found"
          ? 404
          : err.code === "unavailable"
            ? 400
            : err.code === "unsupported"
              ? 501
              : 502;
      res.status(status).json({ error: err.code, message: err.message });
      return;
    }
    req.log.error({ err }, "connectors.sync failed");
    res.status(502).json({ error: "sync_failed", message: "Synchroniseren mislukt." });
  }
});

// POST /api/connectors/:id/disconnect — drop the local connection + tokens.
router.post("/:id/disconnect", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  if (!getConnectorDefinition(id)) {
    res.status(404).json({ error: "Onbekende koppeling." });
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
    res.status(500).json({ error: "Verbreken mislukt." });
  }
});

// POST /api/connectors/:id/revoke — mark provider-side access as revoked.
router.post("/:id/revoke", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  if (!getConnectorDefinition(id)) {
    res.status(404).json({ error: "Onbekende koppeling." });
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
    res.status(500).json({ error: "Intrekken mislukt." });
  }
});

export default router;
