import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  routesTable,
  type RoutePathPoint,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { buildGpx } from "../engines/route";
import {
  deviceProviders,
  isDeviceProvider,
  isDeviceProviderConfigured,
  buildDeviceAuthorizeUrl,
  verifyDeviceState,
  exchangeDeviceCode,
  pushRouteToDevice,
  DEVICE_PROVIDER_LABEL,
  type DeviceProvider,
} from "../lib/connectors/providers/device-sync";
import {
  publicBaseUrl,
  allowedReturnHosts,
} from "../lib/connectors/providers/strava-oauth";
import { decryptSecret, encryptSecret } from "../lib/token-crypto";

// ── Fietscomputer-sync routes ────────────────────────────────────────────────
// Cloud-to-cloud route delivery to Garmin Connect / Wahoo (the Komoot model).
// Honest state machine per provider:
//   configured=false → the manufacturer hasn't approved our API access yet;
//                      the UI says so and offers the share-sheet fallback.
//   connected=false  → keys exist but this athlete hasn't linked their account.
//   connected=true   → "Zet op mijn Garmin/Wahoo" pushes for real.

const router = Router();

function safeReturnUrl(returnTo: string, provider: string, status: string): string {
  const fallback = `${publicBaseUrl()}/?${provider}=${status}`;
  if (!returnTo) return fallback;
  try {
    const u = new URL(returnTo);
    if (!allowedReturnHosts().includes(u.host)) return fallback;
    u.searchParams.set(provider, status);
    return u.toString();
  } catch {
    return fallback;
  }
}

// GET /api/device-sync/status — per provider: configured (app-level keys) and
// connected (this athlete's own link).
router.get("/status", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rows = await db
      .select()
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.clerkId, clerkId));
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    const providers = deviceProviders.map((p) => {
      const row = byProvider.get(p);
      return {
        provider: p,
        label: DEVICE_PROVIDER_LABEL[p],
        configured: isDeviceProviderConfigured(p),
        connected: row?.status === "connected" && Boolean(row.accessToken),
        connectedAt: row?.status === "connected" ? row.connectedAt : null,
      };
    });
    res.json({ providers });
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Status kon niet worden opgehaald",
    });
  }
});

// GET /api/device-sync/:provider/authorize — start the OAuth link.
router.get("/:provider/authorize", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const provider = String(req.params.provider);
  if (!isDeviceProvider(provider)) {
    res.status(400).json({ error: "Onbekende fietscomputer-koppeling" });
    return;
  }
  if (!isDeviceProviderConfigured(provider)) {
    res.status(503).json({
      error: `De ${DEVICE_PROVIDER_LABEL[provider]}-koppeling wacht nog op goedkeuring van de fabrikant.`,
    });
    return;
  }
  try {
    const returnTo =
      typeof req.query.returnTo === "string" ? req.query.returnTo : "";
    const url = buildDeviceAuthorizeUrl({ provider, clerkId, returnTo });
    res.json({ url });
  } catch (e) {
    res.status(500).json({
      error:
        e instanceof Error ? e.message : "Koppeling kon niet worden gestart",
    });
  }
});

// GET /api/device-sync/:provider/callback — OAuth redirect target.
router.get("/:provider/callback", async (req, res) => {
  const provider = String(req.params.provider);
  if (!isDeviceProvider(provider)) {
    res.status(400).send("Onbekende koppeling");
    return;
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  let returnTo = "";
  try {
    const payload = verifyDeviceState(provider, state);
    returnTo = payload.returnTo;
    if (!code) {
      // The user declined on the provider's consent screen.
      res.redirect(safeReturnUrl(returnTo, provider, "geweigerd"));
      return;
    }
    const token = await exchangeDeviceCode({
      provider,
      code,
      codeVerifier: payload.codeVerifier,
    });
    const now = new Date();
    await db
      .insert(connectorConnectionsTable)
      .values({
        clerkId: payload.clerkId,
        provider,
        status: "connected",
        accessToken: encryptSecret(token.access_token),
        refreshToken: encryptSecret(token.refresh_token ?? null),
        tokenExpiresAt: token.expires_in
          ? new Date(Date.now() + token.expires_in * 1000)
          : null,
        connectedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          connectorConnectionsTable.clerkId,
          connectorConnectionsTable.provider,
        ],
        set: {
          status: "connected",
          accessToken: encryptSecret(token.access_token),
          refreshToken: encryptSecret(token.refresh_token ?? null),
          tokenExpiresAt: token.expires_in
            ? new Date(Date.now() + token.expires_in * 1000)
            : null,
          permissionRevoked: false,
          errorStatus: null,
          connectedAt: now,
          updatedAt: now,
        },
      });
    res.redirect(safeReturnUrl(returnTo, provider, "gekoppeld"));
  } catch {
    res.redirect(safeReturnUrl(returnTo, provider, "mislukt"));
  }
});

// POST /api/device-sync/:provider/disconnect — drop this athlete's link.
router.post("/:provider/disconnect", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const provider = String(req.params.provider);
  if (!isDeviceProvider(provider)) {
    res.status(400).json({ error: "Onbekende fietscomputer-koppeling" });
    return;
  }
  try {
    await db
      .update(connectorConnectionsTable)
      .set({
        status: "disconnected",
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(connectorConnectionsTable.clerkId, clerkId),
          eq(connectorConnectionsTable.provider, provider),
        ),
      );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({
      error:
        e instanceof Error ? e.message : "Ontkoppelen is niet gelukt",
    });
  }
});

// POST /api/device-sync/send — push a saved route to the athlete's device
// cloud. Body: { routeId, provider }.
router.post("/send", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const provider = String(req.body?.provider ?? "");
  const routeId = Number(req.body?.routeId);
  if (!isDeviceProvider(provider) || !Number.isInteger(routeId)) {
    res.status(400).json({ error: "Ongeldige aanvraag" });
    return;
  }
  if (!isDeviceProviderConfigured(provider)) {
    res.status(503).json({
      error: `De ${DEVICE_PROVIDER_LABEL[provider]}-koppeling wacht nog op goedkeuring van de fabrikant.`,
    });
    return;
  }
  try {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, routeId), eq(routesTable.clerkId, clerkId)))
      .limit(1);
    if (!route) {
      res.status(404).json({ error: "Route niet gevonden" });
      return;
    }
    const geometry = (route.geometry as RoutePathPoint[] | null) ?? [];
    const profile = (route.profile as number[] | null) ?? null;
    const gpx = buildGpx({
      name: route.name,
      geometry,
      profile,
      nav:
        (route.nav as { km: number; dir: string; note: string }[] | null) ??
        null,
      climbs:
        (route.climbs as { name: string; summitKm: number }[] | null) ?? null,
    });
    if (!gpx || geometry.length < 2) {
      res.status(422).json({
        error:
          "Deze route heeft geen opgeslagen geometrie en kan niet worden verstuurd.",
      });
      return;
    }
    await pushRouteToDevice({
      clerkId,
      provider: provider as DeviceProvider,
      name: route.name,
      gpx,
      geometry: geometry.map(([lat, lon], i) => ({
        lat,
        lon,
        ele: profile?.[i] ?? null,
      })),
      distanceM: route.distanceKm ? Math.round(route.distanceKm * 1000) : null,
      externalId: `sparki-route-${route.id}`,
    });
    res.json({
      ok: true,
      message: `Route staat klaar in je ${DEVICE_PROVIDER_LABEL[provider as DeviceProvider]}-account en verschijnt automatisch op je fietscomputer.`,
    });
  } catch (e) {
    res.status(502).json({
      error:
        e instanceof Error
          ? e.message
          : "Versturen is niet gelukt — probeer het later opnieuw.",
    });
  }
});

export default router;
