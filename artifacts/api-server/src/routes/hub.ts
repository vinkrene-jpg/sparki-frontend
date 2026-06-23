import { Router } from "express";
import { eq, and, desc, count, sql } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  connectorConsentsTable,
  consentAuditLogTable,
  syncRunsTable,
  connectorActivitiesTable,
  equipmentTable,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  connectorDataTypes,
  equipmentKinds,
  type ConnectorDataType,
  type EquipmentKind,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  connectorRegistry,
  getConnectorDefinition,
  runSync,
  HubError,
  resolveReadiness,
  HUB_SPORTS,
  HUB_SPORT_LABELS,
  normalizeSport,
  type HubSport,
} from "../engines/integration";

const router = Router();

const DATA_TYPE_SET = new Set<string>(connectorDataTypes);
const EQUIPMENT_KIND_SET = new Set<string>(equipmentKinds);

// Map a HubError to its HTTP status.
function hubErrorStatus(code: HubError["code"]): number {
  switch (code) {
    case "not_found":
      return 404;
    case "unavailable":
      return 400;
    case "unsupported":
      return 501;
    default:
      return 502;
  }
}

// ── GET /api/hub/overview ────────────────────────────────────────────────────
// The single dashboard payload: every platform with its 4-state readiness + this
// user's live connection state, plus real canonical-data totals. All real data.
router.get("/overview", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const connections = await db
      .select()
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.clerkId, clerkId));
    const byProvider = new Map(connections.map((r) => [r.provider, r]));

    // Raw activity counts per provider (provenance).
    const perProvider = await db
      .select({
        provider: connectorActivitiesTable.provider,
        n: count(),
      })
      .from(connectorActivitiesTable)
      .where(eq(connectorActivitiesTable.clerkId, clerkId))
      .groupBy(connectorActivitiesTable.provider);
    const activityCount = new Map(perProvider.map((r) => [r.provider, r.n]));

    const sources = connectorRegistry.map((def) => {
      const row = byProvider.get(def.id);
      return {
        id: def.id,
        displayName: def.displayName,
        category: def.category,
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
        activityCount: activityCount.get(def.id) ?? 0,
      };
    });

    // Canonical-data totals (real counts).
    const [sessions] = await db
      .select({ n: count() })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId));
    const [metrics] = await db
      .select({ n: count() })
      .from(athleteDailyMetricsTable)
      .where(eq(athleteDailyMetricsTable.clerkId, clerkId));
    const [equip] = await db
      .select({ n: count() })
      .from(equipmentTable)
      .where(eq(equipmentTable.clerkId, clerkId));

    const merged = await db.execute(sql`
      SELECT count(*)::int AS n
      FROM ${trainingSessionsTable}
      WHERE ${trainingSessionsTable.clerkId} = ${clerkId}
        AND coalesce(jsonb_array_length(${trainingSessionsTable.sources}), 0) > 1
    `);
    const mergedCount = Number(
      (merged.rows[0] as { n?: number } | undefined)?.n ?? 0,
    );

    const bySportRows = await db
      .select({ sport: trainingSessionsTable.sport, n: count() })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId))
      .groupBy(trainingSessionsTable.sport);

    res.json({
      sources,
      totals: {
        sessions: sessions?.n ?? 0,
        mergedSessions: mergedCount,
        dailyMetrics: metrics?.n ?? 0,
        equipment: equip?.n ?? 0,
        bySport: bySportRows.map((r) => ({
          sport: r.sport,
          label: HUB_SPORT_LABELS[r.sport as HubSport] ?? r.sport,
          count: r.n,
        })),
      },
      sports: HUB_SPORTS.map((s) => ({ value: s, label: HUB_SPORT_LABELS[s] })),
    });
  } catch (err) {
    req.log.error({ err }, "hub.overview failed");
    res.status(500).json({ error: "Kon het overzicht niet laden." });
  }
});

// ── GET /api/hub/sources ─────────────────────────────────────────────────────
// Full catalog with readiness — the platform-status matrix.
router.get("/sources", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const connections = await db
      .select()
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.clerkId, clerkId));
    const byProvider = new Map(connections.map((r) => [r.provider, r]));
    const sources = connectorRegistry.map((def) => ({
      id: def.id,
      displayName: def.displayName,
      category: def.category,
      authType: def.authType,
      provides: def.provides,
      unavailableReason: def.unavailableReason ?? null,
      readiness: resolveReadiness(def, byProvider.get(def.id)?.status),
    }));
    res.json({ sources });
  } catch (err) {
    req.log.error({ err }, "hub.sources failed");
    res.status(500).json({ error: "Kon de bronnen niet laden." });
  }
});

// ── GET /api/hub/consents ────────────────────────────────────────────────────
router.get("/consents", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rows = await db
      .select()
      .from(connectorConsentsTable)
      .where(eq(connectorConsentsTable.clerkId, clerkId));
    res.json({
      // Effective grant is "true unless an explicit granted=false row exists".
      consents: rows.map((r) => ({
        provider: r.provider,
        dataType: r.dataType,
        granted: r.granted,
      })),
      dataTypes: connectorDataTypes,
    });
  } catch (err) {
    req.log.error({ err }, "hub.consents.list failed");
    res.status(500).json({ error: "Kon toestemmingen niet laden." });
  }
});

// ── PUT /api/hub/consents/:provider ──────────────────────────────────────────
// Body: { dataType, granted }. Upserts the per-source per-type grant + audit log.
router.put("/consents/:provider", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const provider = String(req.params.provider);
  if (!getConnectorDefinition(provider)) {
    res.status(404).json({ error: "Onbekende koppeling." });
    return;
  }
  const body = (req.body ?? {}) as { dataType?: unknown; granted?: unknown };
  const dataType = String(body.dataType ?? "");
  if (!DATA_TYPE_SET.has(dataType)) {
    res.status(400).json({ error: "Onbekend gegevenstype." });
    return;
  }
  if (typeof body.granted !== "boolean") {
    res.status(400).json({ error: "Veld 'granted' moet true of false zijn." });
    return;
  }
  const granted = body.granted;
  const now = new Date();
  try {
    const [existing] = await db
      .select()
      .from(connectorConsentsTable)
      .where(
        and(
          eq(connectorConsentsTable.clerkId, clerkId),
          eq(connectorConsentsTable.provider, provider),
          eq(connectorConsentsTable.dataType, dataType as ConnectorDataType),
        ),
      );
    await db
      .insert(connectorConsentsTable)
      .values({
        clerkId,
        provider,
        dataType: dataType as ConnectorDataType,
        granted,
      })
      .onConflictDoUpdate({
        target: [
          connectorConsentsTable.clerkId,
          connectorConsentsTable.provider,
          connectorConsentsTable.dataType,
        ],
        set: { granted, updatedAt: now },
      });
    await db.insert(consentAuditLogTable).values({
      clerkId,
      field: `connector_consent:${provider}:${dataType}`,
      oldValue: existing ? String(existing.granted) : "true",
      newValue: String(granted),
      changedBy: clerkId,
    });
    res.json({ provider, dataType, granted });
  } catch (err) {
    req.log.error({ err }, "hub.consents.update failed");
    res.status(500).json({ error: "Kon toestemming niet opslaan." });
  }
});

// ── GET /api/hub/logs ────────────────────────────────────────────────────────
router.get("/logs", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rows = await db
      .select()
      .from(syncRunsTable)
      .where(eq(syncRunsTable.clerkId, clerkId))
      .orderBy(desc(syncRunsTable.startedAt))
      .limit(50);
    res.json({ logs: rows });
  } catch (err) {
    req.log.error({ err }, "hub.logs failed");
    res.status(500).json({ error: "Kon de synchronisatielogs niet laden." });
  }
});

// ── Equipment (materiaal) CRUD — live, manual source, testable today ─────────
router.get("/equipment", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rows = await db
      .select()
      .from(equipmentTable)
      .where(eq(equipmentTable.clerkId, clerkId))
      .orderBy(desc(equipmentTable.createdAt));
    res.json({ equipment: rows });
  } catch (err) {
    req.log.error({ err }, "hub.equipment.list failed");
    res.status(500).json({ error: "Kon materiaal niet laden." });
  }
});

router.post("/equipment", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const kind = String(body.kind ?? "other");
  const name = String(body.name ?? "").trim();
  if (!EQUIPMENT_KIND_SET.has(kind)) {
    res.status(400).json({ error: "Onbekend type materiaal." });
    return;
  }
  if (!name) {
    res.status(400).json({ error: "Naam is verplicht." });
    return;
  }
  try {
    const [row] = await db
      .insert(equipmentTable)
      .values({
        clerkId,
        kind: kind as EquipmentKind,
        name,
        brand: body.brand != null ? String(body.brand) : null,
        model: body.model != null ? String(body.model) : null,
        distanceKm:
          body.distanceKm != null && body.distanceKm !== ""
            ? String(body.distanceKm)
            : null,
        source: "manual",
      })
      .returning();
    res.status(201).json({ equipment: row });
  } catch (err) {
    req.log.error({ err }, "hub.equipment.create failed");
    res.status(500).json({ error: "Kon materiaal niet opslaan." });
  }
});

router.patch("/equipment/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id." });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.kind != null) {
    const kind = String(body.kind);
    if (!EQUIPMENT_KIND_SET.has(kind)) {
      res.status(400).json({ error: "Onbekend type materiaal." });
      return;
    }
    patch.kind = kind;
  }
  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) {
      res.status(400).json({ error: "Naam mag niet leeg zijn." });
      return;
    }
    patch.name = name;
  }
  if (body.brand !== undefined)
    patch.brand = body.brand != null ? String(body.brand) : null;
  if (body.model !== undefined)
    patch.model = body.model != null ? String(body.model) : null;
  if (body.distanceKm !== undefined)
    patch.distanceKm =
      body.distanceKm != null && body.distanceKm !== ""
        ? String(body.distanceKm)
        : null;
  if (typeof body.active === "boolean") patch.active = body.active;
  try {
    const [row] = await db
      .update(equipmentTable)
      .set(patch)
      .where(
        and(eq(equipmentTable.id, id), eq(equipmentTable.clerkId, clerkId)),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Materiaal niet gevonden." });
      return;
    }
    res.json({ equipment: row });
  } catch (err) {
    req.log.error({ err }, "hub.equipment.update failed");
    res.status(500).json({ error: "Kon materiaal niet bijwerken." });
  }
});

router.delete("/equipment/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldig id." });
    return;
  }
  try {
    const [row] = await db
      .delete(equipmentTable)
      .where(
        and(eq(equipmentTable.id, id), eq(equipmentTable.clerkId, clerkId)),
      )
      .returning({ id: equipmentTable.id });
    if (!row) {
      res.status(404).json({ error: "Materiaal niet gevonden." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "hub.equipment.delete failed");
    res.status(500).json({ error: "Kon materiaal niet verwijderen." });
  }
});

// ── POST /api/hub/sync/:id ───────────────────────────────────────────────────
// Run a real sync for one platform through the central hub pipeline.
router.post("/sync/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  try {
    const result = await runSync(clerkId, id, "manual");
    res.json({
      provider: id,
      counts: result.counts,
      importedDataTypes: result.importedDataTypes,
    });
  } catch (err) {
    if (err instanceof HubError) {
      res
        .status(hubErrorStatus(err.code))
        .json({ error: err.code, message: err.message });
      return;
    }
    req.log.error({ err }, "hub.sync failed");
    res.status(500).json({ error: "Synchroniseren mislukt." });
  }
});

// ── POST /api/hub/sync ───────────────────────────────────────────────────────
// Sync every connected platform at once. Reports per-platform success/failure
// honestly — one failing source never fails the others.
router.post("/sync", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const connections = await db
      .select()
      .from(connectorConnectionsTable)
      .where(
        and(
          eq(connectorConnectionsTable.clerkId, clerkId),
          eq(connectorConnectionsTable.status, "connected"),
        ),
      );
    const results: Array<{
      provider: string;
      ok: boolean;
      counts?: unknown;
      error?: string;
    }> = [];
    for (const conn of connections) {
      try {
        const r = await runSync(clerkId, conn.provider, "manual");
        results.push({ provider: conn.provider, ok: true, counts: r.counts });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Synchroniseren mislukt.";
        results.push({ provider: conn.provider, ok: false, error: message });
      }
    }
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "hub.sync.all failed");
    res.status(500).json({ error: "Synchroniseren mislukt." });
  }
});

export default router;
