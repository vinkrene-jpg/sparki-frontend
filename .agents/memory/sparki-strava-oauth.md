---
name: Sparki Strava per-user OAuth
description: How Strava connects in Sparki — real per-user OAuth into connector_connections, not the Replit connector proxy.
---

# Sparki Strava connection = per-user direct OAuth

Strava is wired as `authType: "oauth"` (registry), NOT `replit-connector`. Each
athlete authorizes their own Strava account; tokens live per-user in
`connector_connections` (accessToken/refreshToken/tokenExpiresAt/externalUserId/
scopes). The provider sync reads/refreshes via `getValidStravaAccessToken(clerkId)`.

**Why:** The old code read a single account-level token from the Replit connector
proxy (`REPLIT_CONNECTORS_HOSTNAME` / `strava-web`), which was never configured →
every connect threw "Kon de Strava-koppeling niet ophalen" and persisted
`status=error`. The schema was already built for per-user tokens; the design
comment said per-user OAuth — the implementation just hadn't caught up.

**How to apply:**
- Connect flow: frontend `Koppel` (for `authType==="oauth"`) → `GET
  /api/connectors/:id/authorize?returnTo=...` returns `{url}` → browser redirects
  to Strava consent → Strava calls `GET /api/connectors/strava/callback` →
  exchange code, store tokens, status=connected, best-effort initial `syncStrava`
  (direct, NOT runSync, so a failed import never flips a fresh connect to error)
  → 302 back to `returnTo` with `?strava=connected|denied|error`.
- The callback has NO `requireAuth`: identity comes from an HMAC-signed `state`
  (signed with `STRAVA_CLIENT_SECRET`, carries clerkId+returnTo+nonce+exp,
  ~10min). This survives the cross-site redirect without depending on the session
  cookie. Verify signature with `timingSafeEqual` + expiry.
- `redirect_uri` / return host MUST derive from `REPLIT_DOMAINS` (prod) /
  `REPLIT_DEV_DOMAIN` (dev), NEVER `req.host` — the Vite proxy's `changeOrigin`
  rewrites host to localhost:8080. `safeReturnUrl` allowlists owned domains only
  (open-redirect guard).
- Secrets required: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` (app-level). Access/
  refresh tokens are per-user in the DB, never secrets/env.
- The Strava app's "Authorization Callback Domain" must equal the bare domain of
  `publicBaseUrl()`. Strava allows only ONE callback domain, so dev and prod
  domains can't both be whitelisted at once.

## The configured client-id MUST match the app whose callback domain is registered

`STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET` are stored as **global secrets** (same
value in dev and prod — confirmed via viewEnvVars: both live under `secrets`, not
env-scoped). So whatever client-id is set is what BOTH the workspace and the
published deployment use.

**Symptom of a mismatch:** Strava `/oauth/authorize` returns HTTP 400
`{"errors":[{"resource":"Application","field":"redirect_uri","code":"invalid"}]}`
*even though* the user swears the callback domain is set correctly. The trap: the
configured client-id is a DIFFERENT Strava app than the one the user edited (in one
real case `257989` was configured but the user's real app — with the correct
callback domain — was `257987`, a one-digit difference).

**How to diagnose without touching code:** the client-id is public, so curl
`https://www.strava.com/oauth/authorize?client_id=<ID>&response_type=code&redirect_uri=<urlencoded prod callback>&scope=read&state=x`
for each candidate id. `HTTP 302` = that app accepts the redirect_uri (correct app);
`HTTP 400 redirect_uri invalid` = wrong app or callback domain not saved on that app.
Compare the configured id against the id shown on the user's Strava API page
(it's on the main "My API Application" page, NOT inside the "Edit Application"
popup — users repeatedly send the edit popup which hides the id).

**Fix:** request the correct `STRAVA_CLIENT_ID` + `STRAVA_CLIENT_SECRET` via
`requestEnvVar` (secrets can't be set directly). Because they're global secrets,
the running **production deployment must be redeployed** to pick up the new values
— restarting dev workflows is not enough for the live app.

## A health probe must measure a feature's REAL mechanism, or it lies

Rule: when a feature's wiring changes (e.g. Replit proxy → per-user OAuth), its
Gezondheidscheck probe must change in lockstep — a probe that measures the old/
wrong mechanism produces a permanent false status and silently breaks the health
engine's honesty contract (its whole selling point).

**Why:** the Strava probe kept hitting the Replit connector-proxy (`strava-web`)
and getting 401 → permanent false ORANGE, while real Strava is per-user OAuth
(see above). The symptom of this class of bug is a check stuck on one status that
contradicts how the feature actually works.

**How to apply (Strava-shaped features):** GREY only when truly not configured;
GREEN when the capability is wired even if no user is connected yet (nothing is
broken — you just can't import-test); reserve ORANGE/RED for a real failure of an
actual live connection. Prefer validating via the same token-refresh helper the
feature itself uses (cheap: refreshes only near expiry).
