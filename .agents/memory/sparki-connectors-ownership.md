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
