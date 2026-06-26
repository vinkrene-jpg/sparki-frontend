---
name: Sparki connector data ownership
description: Why per-user third-party data sync must NOT use Replit account-level connectors in a multi-tenant app.
---

# Connector data ownership (Strava et al.)

Replit integration **connectors are bound at the Replit account/workspace level**,
not per end-user. The credential proxy
(`https://${REPLIT_CONNECTORS_HOSTNAME}/api/v2/connection?...&connector_names=…`)
returns the *developer's* connected account, authenticated only by env identity
(`REPL_IDENTITY` / `WEB_REPL_RENEWAL`).

**Rule:** In Sparki (multi-tenant: each athlete has their own Clerk account), a
per-user import path (`POST /api/connectors/:id/sync` writing to the caller's
`clerkId`) must NEVER source its token from the account-level connector proxy.
Doing so imports one bound account's data into *any* authenticated user → cross-user
data contamination.

**Why:** Strava/Garmin/etc. are per-athlete data. The `connector_connections`
table already has per-user `accessToken`/`refreshToken`/`tokenExpiresAt`/
`externalUserId` columns — the schema was designed for **per-user OAuth**, not the
Replit connector proxy.

**How to apply:** For real per-user third-party data, implement a standard per-user
OAuth flow (app-level client id/secret as secrets; each user authorizes; store
tokens per `clerkId` in `connector_connections`; refresh from the stored
refresh_token). Add an ownership guard so `/sync` only runs when a connected row
with tokens exists for the requesting `clerkId`. The Replit account-level connector
is only appropriate for single-tenant/admin-level data, never per-end-user data.

## OAuth wiring pitfalls (learned wiring Strava end-to-end)

- **The Connect button must START the OAuth flow, not call `/sync`.** For an
  `authType==="oauth"` connector the frontend has to navigate the browser to the
  consent URL (`GET /api/connectors/:id/authorize` → `window.location.assign`).
  Calling `/sync` first fails with "geen actieve koppeling" because no per-user
  token exists yet. This is the single most likely reason a freshly-wired OAuth
  connector "can never connect".
- **`redirect_uri` must be built from the proxy's forwarded host**
  (`x-forwarded-proto`/`x-forwarded-host`), and that domain must match the
  provider's registered callback domain (Strava: "Authorization Callback Domain").
  The dev domain ≠ the deployed domain, so the callback domain must be re-set in
  the provider after publishing. Allow an env override (`STRAVA_REDIRECT_URI`).
- **Gate `/sync` on EFFECTIVE availability** (registry flag AND runtime config
  like `isStravaConfigured()`), not the static registry `available` flag — else
  an unconfigured provider proceeds and dies with a confusing token error instead
  of the honest "wordt nog ingesteld".
- **Persist the scopes the provider ACTUALLY granted** (from the callback `scope`
  query param), not the requested set — the user can untick boxes on consent.
- **OAuth callback redirect target**: send the athlete back to the page that hosts
  the connections UI (Sparki: `/you`), not the app root, so they see the result.
- **The live consent step cannot be automated** — it requires a human logging into
  the real provider account. Everything else (authorize URL shape, redirect_uri,
  error paths, disconnect) is testable without it.

## Per-platform availability reality (which connectors can actually be wired)

**Why:** users ask "make the other koppelingen work too"; the blocker is almost
always external credentials, not our code — don't fabricate an untestable OAuth.

- **Replit managed connectors EXIST for:** Fitbit, Oura, Whoop, Coros, Strava
  (search via `searchIntegrations`). But they're account-level (see top of file),
  so for per-athlete data still do direct per-user OAuth, not the proxy.
- **NO Replit connector for Garmin Connect or TrainingPeaks.** Both require the
  platform's own partner/developer approval before any credentials exist:
  Garmin = Garmin Connect Developer Program (Health/Activity API; delivers data via
  push/webhook, not a simple pull like Strava); TrainingPeaks = partner API access.
  Cannot be built+tested until the user obtains an approved Client ID + Secret.
- **Self-serve (credentials issued immediately, OAuth2, Strava-like) :** Fitbit,
  Oura, Whoop — the fastest real wins if the user is flexible on platform.
- **Google Health Connect is impossible in the web app** — it's on-device Android
  data, readable only by a native mobile app; there is no server-side web OAuth.
- **Decision:** never blind-build a gated connector. Request its Client ID/Secret
  as secrets, then wire + test on the Strava per-user-OAuth template the same day.
