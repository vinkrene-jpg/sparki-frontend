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
