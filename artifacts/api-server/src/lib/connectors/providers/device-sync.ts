import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, connectorConnectionsTable } from "@workspace/db";
import { publicBaseUrl } from "./strava-oauth";
import { decryptSecret, encryptSecret } from "../../token-crypto";

// ── Fietscomputer-sync (Garmin / Wahoo) ──────────────────────────────────────
// Cloud-to-cloud route sync, the way Komoot does it: the athlete links their
// Garmin Connect or Wahoo account ONCE, after which Sparki's server pushes a
// route directly to the manufacturer's cloud and it appears on the device.
//
// Honesty contract: both platforms only grant this server access to approved
// developer applications. Until the app-level credentials (client id + secret)
// exist as secrets, these providers report `configured: false` and the UI says
// so plainly — nothing is faked. Once the secrets are set, the flow below is
// live without further code changes.
//
// Required secrets:
//   Garmin  — GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET  (Garmin Connect Developer
//             Program, Courses/Training API; OAuth2 + PKCE)
//   Wahoo   — WAHOO_CLIENT_ID, WAHOO_CLIENT_SECRET    (Wahoo Cloud API; OAuth2)

export const deviceProviders = ["garmin", "wahoo"] as const;
export type DeviceProvider = (typeof deviceProviders)[number];

export function isDeviceProvider(v: string): v is DeviceProvider {
  return (deviceProviders as readonly string[]).includes(v);
}

export const DEVICE_PROVIDER_LABEL: Record<DeviceProvider, string> = {
  garmin: "Garmin",
  wahoo: "Wahoo",
};

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
}

function envConfig(provider: DeviceProvider): OAuthConfig | null {
  const prefix = provider === "garmin" ? "GARMIN" : "WAHOO";
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isDeviceProviderConfigured(provider: DeviceProvider): boolean {
  return envConfig(provider) !== null;
}

function getConfig(provider: DeviceProvider): OAuthConfig {
  const cfg = envConfig(provider);
  if (!cfg) {
    throw new Error(
      `De ${DEVICE_PROVIDER_LABEL[provider]}-koppeling wacht nog op goedkeuring van de fabrikant (API-sleutels ontbreken).`,
    );
  }
  return cfg;
}

export function deviceRedirectUri(provider: DeviceProvider): string {
  return `${publicBaseUrl()}/api/device-sync/${provider}/callback`;
}

// ── Signed OAuth state (stateless CSRF + identity binding) ───────────────────
// Same pattern as the Strava per-user OAuth: HMAC-signed with the provider's
// client secret, short-lived. For Garmin the PKCE code_verifier travels inside
// the signed state so the callback stays stateless.

export interface DeviceOAuthState {
  provider: DeviceProvider;
  clerkId: string;
  returnTo: string;
  nonce: string;
  exp: number;
  codeVerifier?: string;
}

function signState(payload: DeviceOAuthState): string {
  const secret = getConfig(payload.provider).clientSecret;
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyDeviceState(
  provider: DeviceProvider,
  state: string,
): DeviceOAuthState {
  const secret = getConfig(provider).clientSecret;
  const parts = state.split(".");
  if (parts.length !== 2) throw new Error("Ongeldige koppelstatus.");
  const [data, sig] = parts as [string, string];
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Koppelstatus kon niet worden geverifieerd.");
  }
  const payload = JSON.parse(
    Buffer.from(data, "base64url").toString("utf8"),
  ) as DeviceOAuthState;
  if (
    payload.provider !== provider ||
    !payload.clerkId ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("Ongeldige koppelstatus.");
  }
  if (Date.now() > payload.exp) {
    throw new Error("De koppeling is verlopen. Probeer het opnieuw.");
  }
  return payload;
}

// ── Authorize URLs ───────────────────────────────────────────────────────────

const GARMIN_AUTHORIZE_URL = "https://connect.garmin.com/oauth2Confirm";
const GARMIN_TOKEN_URL =
  "https://diauth.garmin.com/di-oauth2-service/oauth/token";
// Garmin Training API — courses endpoint (push a course to the athlete's
// Garmin Connect account; it then syncs to their device automatically).
const GARMIN_COURSES_URL = "https://apis.garmin.com/training-api/courses/v1/course";

const WAHOO_AUTHORIZE_URL = "https://api.wahooligan.com/oauth/authorize";
const WAHOO_TOKEN_URL = "https://api.wahooligan.com/oauth/token";
const WAHOO_ROUTES_URL = "https://api.wahooligan.com/v1/routes";
const WAHOO_SCOPES = "user_read routes_write";

export function buildDeviceAuthorizeUrl(opts: {
  provider: DeviceProvider;
  clerkId: string;
  returnTo: string;
}): string {
  const { clientId } = getConfig(opts.provider);
  const redirectUri = deviceRedirectUri(opts.provider);
  const base: Omit<DeviceOAuthState, "codeVerifier"> = {
    provider: opts.provider,
    clerkId: opts.clerkId,
    returnTo: opts.returnTo,
    nonce: randomBytes(12).toString("base64url"),
    exp: Date.now() + 10 * 60 * 1000,
  };

  if (opts.provider === "garmin") {
    // Garmin requires OAuth2 + PKCE.
    const codeVerifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const state = signState({ ...base, codeVerifier });
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });
    return `${GARMIN_AUTHORIZE_URL}?${params.toString()}`;
  }

  const state = signState({ ...base });
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: WAHOO_SCOPES,
    state,
  });
  return `${WAHOO_AUTHORIZE_URL}?${params.toString()}`;
}

// ── Token exchange / refresh ─────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // seconds
}

async function requestToken(
  provider: DeviceProvider,
  body: URLSearchParams,
): Promise<TokenResponse> {
  const url = provider === "garmin" ? GARMIN_TOKEN_URL : WAHOO_TOKEN_URL;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `Kon de ${DEVICE_PROVIDER_LABEL[provider]}-toegang niet voltooien. Probeer het opnieuw.`,
    );
  }
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) {
    throw new Error(
      `${DEVICE_PROVIDER_LABEL[provider]} gaf geen geldige toegang terug.`,
    );
  }
  return data;
}

export async function exchangeDeviceCode(opts: {
  provider: DeviceProvider;
  code: string;
  codeVerifier?: string;
}): Promise<TokenResponse> {
  const { clientId, clientSecret } = getConfig(opts.provider);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: opts.code,
    grant_type: "authorization_code",
    redirect_uri: deviceRedirectUri(opts.provider),
  });
  if (opts.provider === "garmin" && opts.codeVerifier) {
    body.set("code_verifier", opts.codeVerifier);
  }
  return requestToken(opts.provider, body);
}

async function refreshDeviceToken(
  provider: DeviceProvider,
  refreshToken: string,
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getConfig(provider);
  return requestToken(
    provider,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  );
}

/**
 * Valid access token for this user's device-provider connection, refreshing
 * and persisting when (nearly) expired. Clear Dutch error when not linked.
 */
export async function getValidDeviceAccessToken(
  clerkId: string,
  provider: DeviceProvider,
): Promise<string> {
  const [row] = await db
    .select()
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.provider, provider),
      ),
    );
  if (!row?.accessToken || row.status !== "connected") {
    throw new Error(
      `Geen actieve ${DEVICE_PROVIDER_LABEL[provider]}-koppeling gevonden.`,
    );
  }
  const expMs = row.tokenExpiresAt ? new Date(row.tokenExpiresAt).getTime() : 0;
  if (expMs - Date.now() > 60_000) {
    return decryptSecret(row.accessToken)!;
  }
  if (!row.refreshToken) {
    throw new Error(
      `${DEVICE_PROVIDER_LABEL[provider]}-toegang is verlopen. Koppel opnieuw.`,
    );
  }
  const refreshed = await refreshDeviceToken(provider, decryptSecret(row.refreshToken)!);
  await db
    .update(connectorConnectionsTable)
    .set({
      accessToken: encryptSecret(refreshed.access_token),
      refreshToken: encryptSecret(refreshed.refresh_token ?? decryptSecret(row.refreshToken)),
      tokenExpiresAt: refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.provider, provider),
      ),
    );
  return refreshed.access_token;
}

// ── Route push ───────────────────────────────────────────────────────────────

/**
 * Push a route to the athlete's Wahoo cloud account (multipart GPX upload).
 * The Wahoo app/ELEMNT then syncs it to the device.
 */
async function pushRouteToWahoo(opts: {
  accessToken: string;
  name: string;
  gpx: string;
  externalId: string;
}): Promise<void> {
  const form = new FormData();
  form.set("route[name]", opts.name);
  form.set("route[external_id]", opts.externalId);
  form.set(
    "route[file]",
    new Blob([opts.gpx], { type: "application/gpx+xml" }),
    `${opts.externalId}.gpx`,
  );
  const res = await fetch(WAHOO_ROUTES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Wahoo accepteerde de route niet (status ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}).`,
    );
  }
}

/**
 * Push a route as a course to the athlete's Garmin Connect account
 * (Training API). Garmin Connect then syncs it to the device.
 */
async function pushRouteToGarmin(opts: {
  accessToken: string;
  name: string;
  geometry: { lat: number; lon: number; ele?: number | null }[];
  distanceM: number | null;
}): Promise<void> {
  const body = {
    courseName: opts.name,
    activityType: "ROAD_CYCLING",
    distance: opts.distanceM ?? undefined,
    coordinateSystem: "WGS84",
    geoPoints: opts.geometry.map((p) => ({
      latitude: p.lat,
      longitude: p.lon,
      elevation: typeof p.ele === "number" ? p.ele : undefined,
    })),
  };
  const res = await fetch(GARMIN_COURSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Garmin accepteerde de route niet (status ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}).`,
    );
  }
}

export async function pushRouteToDevice(opts: {
  clerkId: string;
  provider: DeviceProvider;
  name: string;
  gpx: string;
  geometry: { lat: number; lon: number; ele?: number | null }[];
  distanceM: number | null;
  externalId: string;
}): Promise<void> {
  const accessToken = await getValidDeviceAccessToken(
    opts.clerkId,
    opts.provider,
  );
  if (opts.provider === "wahoo") {
    await pushRouteToWahoo({
      accessToken,
      name: opts.name,
      gpx: opts.gpx,
      externalId: opts.externalId,
    });
  } else {
    await pushRouteToGarmin({
      accessToken,
      name: opts.name,
      geometry: opts.geometry,
      distanceM: opts.distanceM,
    });
  }
}
