import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, connectorConnectionsTable } from "@workspace/db";

// ── Per-user Strava OAuth ────────────────────────────────────────────────────
// Each athlete authorizes their OWN Strava account; tokens are stored per user
// in connector_connections (NOT the account-level Replit connector proxy, which
// would share one bound account across every user). Requires the app-level
// Strava API credentials (client id + secret) as secrets.

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize";

// Scopes Sparki needs: read the athlete's profile (weight/FTP) and their
// activities. `read` is the baseline scope.
export const STRAVA_SCOPES = "read,activity:read_all,profile:read_all";

interface StravaConfig {
  clientId: string;
  clientSecret: string;
}

/** True only when the platform API app credentials are configured server-side. */
export function isStravaConfigured(): boolean {
  return Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() &&
      process.env.STRAVA_CLIENT_SECRET?.trim(),
  );
}

export function getStravaConfig(): StravaConfig {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Strava-koppeling is nog niet ingesteld door de beheerder (API-sleutels ontbreken).",
    );
  }
  return { clientId, clientSecret };
}

// The public base URL of this deployment, used to build the OAuth redirect URI
// and safe return targets. REPLIT_DOMAINS holds the live domain(s); the first is
// canonical. Falls back to REPLIT_DEV_DOMAIN in development.
export function publicBaseUrl(): string {
  const raw = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "";
  const domain = raw.split(",")[0]?.trim();
  if (!domain) {
    throw new Error("Kon het publieke domein niet bepalen voor de koppeling.");
  }
  return `https://${domain}`;
}

export function allowedReturnHosts(): string[] {
  const raw = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "";
  return raw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

// The redirect URI Strava calls back. Its DOMAIN must be whitelisted as the
// "Authorization Callback Domain" in the Strava API application settings.
export function stravaRedirectUri(): string {
  return `${publicBaseUrl()}/api/connectors/strava/callback`;
}

// ── Signed OAuth state (stateless CSRF + identity binding) ────────────────────
// The state is HMAC-signed with the Strava client secret so the callback can
// trust the originating user without a server-side session lookup. Short-lived.

export interface StravaOAuthState {
  clerkId: string;
  returnTo: string;
  nonce: string;
  exp: number;
}

function stateSecret(): string {
  return getStravaConfig().clientSecret;
}

export function signStravaState(
  input: Omit<StravaOAuthState, "nonce" | "exp"> & {
    nonce?: string;
    exp?: number;
  },
): string {
  const payload: StravaOAuthState = {
    clerkId: input.clerkId,
    returnTo: input.returnTo,
    nonce: input.nonce ?? randomBytes(12).toString("base64url"),
    exp: input.exp ?? Date.now() + 10 * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyStravaState(state: string): StravaOAuthState {
  const parts = state.split(".");
  if (parts.length !== 2) throw new Error("Ongeldige Strava-status.");
  const [data, sig] = parts as [string, string];
  const expected = createHmac("sha256", stateSecret())
    .update(data)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Strava-status kon niet worden geverifieerd.");
  }
  const payload = JSON.parse(
    Buffer.from(data, "base64url").toString("utf8"),
  ) as StravaOAuthState;
  if (!payload.clerkId || typeof payload.exp !== "number") {
    throw new Error("Ongeldige Strava-status.");
  }
  if (Date.now() > payload.exp) {
    throw new Error("De Strava-koppeling is verlopen. Probeer het opnieuw.");
  }
  return payload;
}

export function buildStravaAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
}): string {
  const { clientId } = getStravaConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: opts.redirectUri,
    approval_prompt: "auto",
    scope: STRAVA_SCOPES,
    state: opts.state,
  });
  return `${STRAVA_AUTHORIZE_URL}?${params.toString()}`;
}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  expires_in?: number;
  token_type?: string;
  scope?: string;
  athlete?: { id?: number };
}

export async function exchangeStravaCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = getStravaConfig();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: opts.code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error("Kon de Strava-toegang niet voltooien. Probeer het opnieuw.");
  }
  const data = (await res.json()) as StravaTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Strava gaf geen geldige toegang terug.");
  }
  return data;
}

async function refreshStravaToken(
  refreshToken: string,
): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = getStravaConfig();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error("Strava-toegang is verlopen. Koppel opnieuw.");
  }
  const data = (await res.json()) as StravaTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Strava-toegang is verlopen. Koppel opnieuw.");
  }
  return data;
}

/**
 * Return a valid access token for this user, refreshing + persisting it when the
 * stored one is expired (or within 60s of expiry). Throws a clear Dutch error
 * when the user has no Strava connection yet.
 */
export async function getValidStravaAccessToken(clerkId: string): Promise<string> {
  const [row] = await db
    .select()
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.provider, "strava"),
      ),
    );
  if (!row?.accessToken || !row?.refreshToken) {
    throw new Error("Geen actieve Strava-koppeling gevonden.");
  }
  const expMs = row.tokenExpiresAt ? new Date(row.tokenExpiresAt).getTime() : 0;
  if (expMs - Date.now() > 60_000) {
    return row.accessToken;
  }
  const refreshed = await refreshStravaToken(row.refreshToken);
  await db
    .update(connectorConnectionsTable)
    .set({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      tokenExpiresAt: new Date(refreshed.expires_at * 1000),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.provider, "strava"),
      ),
    );
  return refreshed.access_token;
}

/** Best-effort: tell Strava to revoke our access. Never throws. */
export async function deauthorizeStrava(accessToken: string): Promise<void> {
  try {
    await fetch(STRAVA_DEAUTHORIZE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // ignore — local disconnect still proceeds
  }
}
