import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, connectorConnectionsTable, syncRunsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  connectorRegistry,
  getConnectorDefinition,
  runSync,
  HubError,
  resolveReadiness,
  getHubProvider,
  loadAllowedDataTypes,
  ingestBatch,
  effectiveImportedDataTypes,
} from "../engines/integration";
import {
  buildStravaAuthorizeUrl,
  stravaRedirectUri,
  signStravaState,
  verifyStravaState,
  exchangeStravaCode,
  deauthorizeStrava,
  publicBaseUrl,
  allowedReturnHosts,
  isStravaConfigured,
} from "../lib/connectors/providers/strava-oauth";
import { decryptSecret, encryptSecret } from "../lib/token-crypto";
import {
  isDeviceProvider,
  isDeviceProviderConfigured,
  buildDeviceAuthorizeUrl,
} from "../lib/connectors/providers/device-sync";

const router = Router();

// Build a safe in-app return URL after the OAuth round-trip. Only same-site
// targets (our own domains) are honoured; everything else falls back to the app
// root. A `strava` status flag is appended so the UI can confirm the result.
function safeReturnUrl(returnTo: string, status: string): string {
  const fallback = `${publicBaseUrl()}/?strava=${status}`;
  if (!returnTo) return fallback;
  try {
    const u = new URL(returnTo);
    if (!allowedReturnHosts().includes(u.host)) return fallback;
    u.searchParams.set("strava", status);
    return u.toString();
  } catch {
    return fallback;
  }
}

// A platform is effectively wireable only when its server-side credentials are
// present. The registry says "Strava is an OAuth platform"; this says "and its
// API app is actually configured right now". Keeps the UI honest.
function effectiveAvailability(id: string): {
  available: boolean;
  unavailableReason: string | null;
} {
  const def = getConnectorDefinition(id);
  if (!def) return { available: false, unavailableReason: null };
  if (id === "strava" && !isStravaConfigured()) {
    return {
      available: false,
      unavailableReason: "Strava-koppeling wordt nog ingesteld.",
    };
  }
  // Garmin/Wahoo: beschikbaar zodra de fabrikant-sleutels in de omgeving staan
  // (registry berekent dit al bij het opstarten — hier expliciet herbevestigd
  // zodat de UI nooit een koppelknop toont zonder werkende credentials).
  if (isDeviceProvider(id) && !isDeviceProviderConfigured(id)) {
    return {
      available: false,
      unavailableReason:
        def.unavailableReason ??
        "Deze koppeling wacht nog op goedkeuring van de fabrikant.",
    };
  }
  return {
    available: def.available,
    unavailableReason: def.unavailableReason ?? null,
  };
}

// Build the public connector shape (registry definition + this user's live row +
// 4-state readiness). The Data Hub owns the actual sync pipeline (runSync).
async function buildConnectorItem(clerkId: string, id: string) {
  const def = getConnectorDefinition(id)!;
  const eff = effectiveAvailability(id);
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
    available: eff.available,
    authType: def.authType,
    provides: def.provides,
    unavailableReason: eff.unavailableReason,
    status: row?.status ?? "disconnected",
    lastSyncAt: row?.lastSyncAt ?? null,
    importedDataTypes: row?.importedDataTypes ?? [],
    errorStatus: row?.errorStatus ?? null,
    permissionRevoked: row?.permissionRevoked ?? false,
    connectedAt: row?.connectedAt ?? null,
    readiness: resolveReadiness(def, row?.status, eff.available),
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
      const eff = effectiveAvailability(def.id);
      return {
        id: def.id,
        displayName: def.displayName,
        category: def.category,
        available: eff.available,
        authType: def.authType,
        provides: def.provides,
        unavailableReason: eff.unavailableReason,
        status: row?.status ?? "disconnected",
        lastSyncAt: row?.lastSyncAt ?? null,
        importedDataTypes: row?.importedDataTypes ?? [],
        errorStatus: row?.errorStatus ?? null,
        permissionRevoked: row?.permissionRevoked ?? false,
        connectedAt: row?.connectedAt ?? null,
        readiness: resolveReadiness(def, row?.status, eff.available),
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
  const def = getConnectorDefinition(id);
  if (!def) {
    res.status(404).json({ error: "Unknown connector" });
    return;
  }
  // Gate on EFFECTIVE availability (registry + runtime config), not the static
  // registry flag — Strava is "available" in the registry but only wireable once
  // its API credentials exist. Otherwise sync would proceed and fail with a
  // confusing token error instead of the honest "wordt nog ingesteld".
  const eff = effectiveAvailability(id);
  if (!eff.available) {
    res.status(400).json({
      error: "unavailable",
      message:
        eff.unavailableReason ??
        def.unavailableReason ??
        "Deze koppeling is nog niet beschikbaar.",
    });
    return;
  }
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

// GET /api/connectors/:id/runs — recente synchronisatie-historie voor deze
// gebruiker+platform (sporter-syncbeheer: wat is er wanneer gelukt/mislukt).
router.get("/:id/runs", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  if (!getConnectorDefinition(id)) {
    res.status(404).json({ error: "Onbekende koppeling." });
    return;
  }
  try {
    const runs = await db
      .select({
        id: syncRunsTable.id,
        trigger: syncRunsTable.trigger,
        status: syncRunsTable.status,
        startedAt: syncRunsTable.startedAt,
        finishedAt: syncRunsTable.finishedAt,
        counts: syncRunsTable.counts,
        importedDataTypes: syncRunsTable.importedDataTypes,
        error: syncRunsTable.error,
      })
      .from(syncRunsTable)
      .where(
        and(
          eq(syncRunsTable.clerkId, clerkId),
          eq(syncRunsTable.provider, id),
        ),
      )
      .orderBy(desc(syncRunsTable.startedAt))
      .limit(20);
    res.json({ runs });
  } catch (err) {
    req.log.error({ err }, "connectors.runs failed");
    res.status(500).json({ error: "Kon de synchronisatie-historie niet laden." });
  }
});

// POST /api/connectors/:id/backfill — historische import: zelfde syncpad, maar
// de adapter haalt diepere historie op (trigger "backfill"). Dedupe/consent/
// provenance zijn identiek — bestaande en handmatig gecorrigeerde gegevens
// worden nooit overschreven.
router.post("/:id/backfill", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  const def = getConnectorDefinition(id);
  if (!def) {
    res.status(404).json({ error: "Onbekende koppeling." });
    return;
  }
  const eff = effectiveAvailability(id);
  if (!eff.available) {
    res.status(400).json({
      error: "unavailable",
      message:
        eff.unavailableReason ??
        def.unavailableReason ??
        "Deze koppeling is nog niet beschikbaar.",
    });
    return;
  }
  try {
    await runSync(clerkId, id, "backfill");
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
    req.log.error({ err }, "connectors.backfill failed");
    res.status(502).json({
      error: "backfill_failed",
      message: "Historische import mislukt.",
    });
  }
});

// NOTE: the old POST /:id/start endpoint (record a "koppelen gestart"
// status="pending" shell for not-yet-wired platforms) has been removed: it
// created connections that could never be completed or configured — a
// dead-end "In afwachting" in every dashboard. Not-yet-wired platforms are
// purely informational ("Binnenkort") until their real API is wired; leftover
// pending rows are cleaned up at boot (lib/connectors/cleanup.ts).

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
    // Best-effort: tell Strava to drop our access before we clear local tokens.
    if (id === "strava") {
      const [existing] = await db
        .select({ accessToken: connectorConnectionsTable.accessToken })
        .from(connectorConnectionsTable)
        .where(
          and(
            eq(connectorConnectionsTable.clerkId, clerkId),
            eq(connectorConnectionsTable.provider, id),
          ),
        );
      if (existing?.accessToken) {
        await deauthorizeStrava(decryptSecret(existing.accessToken)!);
      }
    }
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

// GET /api/connectors/:id/authorize — start a real per-user OAuth flow. Returns
// the provider consent URL as JSON so the frontend can redirect the browser to
// it. Only providers wired for direct OAuth (currently Strava) are supported.
router.get("/:id/authorize", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = String(req.params.id);
  const def = getConnectorDefinition(id);
  if (
    !def ||
    def.authType !== "oauth" ||
    (id !== "strava" && !isDeviceProvider(id))
  ) {
    res
      .status(400)
      .json({ error: "unsupported", message: "Deze koppeling kan niet zo gekoppeld worden." });
    return;
  }
  // Garmin/Wahoo delen de bestaande device-sync OAuth-flow (zelfde
  // connector_connections-rij) — geen tweede koppelpad.
  if (isDeviceProvider(id)) {
    if (!isDeviceProviderConfigured(id)) {
      res.status(503).json({
        error: "not_configured",
        message: "Deze koppeling wacht nog op goedkeuring van de fabrikant.",
      });
      return;
    }
    try {
      const returnTo =
        typeof req.query.returnTo === "string" ? req.query.returnTo : "";
      const url = buildDeviceAuthorizeUrl({ provider: id, clerkId, returnTo });
      res.json({ url });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Kon de koppeling niet starten.";
      req.log.error({ err }, "connectors.authorize device failed");
      res.status(400).json({ error: "authorize_failed", message });
    }
    return;
  }
  if (!isStravaConfigured()) {
    res.status(503).json({
      error: "not_configured",
      message: "Strava-koppeling wordt nog ingesteld.",
    });
    return;
  }
  try {
    const returnTo =
      typeof req.query.returnTo === "string" ? req.query.returnTo : "";
    const redirectUri = stravaRedirectUri();
    const state = signStravaState({ clerkId, returnTo });
    const url = buildStravaAuthorizeUrl({ redirectUri, state });
    res.json({ url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Kon de koppeling niet starten.";
    req.log.error({ err }, "connectors.authorize failed");
    res.status(400).json({ error: "authorize_failed", message });
  }
});

// GET /api/connectors/strava/callback — Strava redirects the browser here after
// consent. Identity comes from the signed `state` (HMAC, short-lived), so no
// session cookie is required for the cross-site redirect to succeed. Stores the
// per-user tokens, marks the connection connected, imports an initial snapshot
// best-effort, then redirects back into the app.
router.get("/strava/callback", async (req, res) => {
  if (typeof req.query.error === "string" && req.query.error) {
    res.redirect(safeReturnUrl("", "denied"));
    return;
  }
  let returnTo = "";
  try {
    const code = String(req.query.code ?? "");
    const stateRaw = String(req.query.state ?? "");
    if (!code) throw new Error("Geen autorisatiecode ontvangen van Strava.");
    const state = verifyStravaState(stateRaw);
    returnTo = state.returnTo;

    const tokens = await exchangeStravaCode({
      code,
      redirectUri: stravaRedirectUri(),
    });
    const now = new Date();
    // Persist the scopes Strava ACTUALLY granted. The athlete may untick boxes
    // on the consent screen, so the callback `scope` param is the source of
    // truth; fall back to the token response's scope when the param is absent.
    const grantedScopes =
      typeof req.query.scope === "string"
        ? req.query.scope.split(",").filter(Boolean)
        : [];
    const scopes =
      grantedScopes.length > 0
        ? grantedScopes
        : tokens.scope
          ? tokens.scope.split(",")
          : [];
    const externalUserId =
      tokens.athlete?.id != null ? String(tokens.athlete.id) : null;

    await db
      .insert(connectorConnectionsTable)
      .values({
        clerkId: state.clerkId,
        provider: "strava",
        status: "connected",
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
        externalUserId,
        scopes,
        connectedAt: now,
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
          accessToken: encryptSecret(tokens.access_token),
          refreshToken: encryptSecret(tokens.refresh_token),
          tokenExpiresAt: new Date(tokens.expires_at * 1000),
          externalUserId,
          scopes,
          connectedAt: now,
          permissionRevoked: false,
          errorStatus: null,
          updatedAt: now,
        },
      });

    // Best-effort initial import. A failed import must NOT flip a freshly
    // connected account to "error" — so we import via the hub provider directly
    // (not runSync, which records a connection error on failure) and only record
    // what actually imported. This brings in profile/weight/ftp AND activities
    // through the central ingest pipeline.
    try {
      const provider = getHubProvider("strava");
      if (provider?.fetchAndNormalize) {
        const allowed = await loadAllowedDataTypes(state.clerkId, "strava");
        const batch = await provider.fetchAndNormalize({ clerkId: state.clerkId });
        if (!batch.persistedExternally) {
          await ingestBatch(state.clerkId, "strava", batch, { allowed });
        }
        await db
          .update(connectorConnectionsTable)
          .set({
            // Report only what consent actually let us persist.
            importedDataTypes: effectiveImportedDataTypes(batch, allowed),
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(connectorConnectionsTable.clerkId, state.clerkId),
              eq(connectorConnectionsTable.provider, "strava"),
            ),
          );
      }
    } catch (importErr) {
      req.log.warn({ err: importErr }, "strava.callback initial import failed");
    }

    res.redirect(safeReturnUrl(returnTo, "connected"));
  } catch (err) {
    req.log.error({ err }, "connectors.strava.callback failed");
    res.redirect(safeReturnUrl(returnTo, "error"));
  }
});

export default router;
