---
name: Sparki Web Push + profile nudges
description: Web Push channel and profile-gap nudges — SSRF guard, honest states, freshly-created-only push.
---

# Sparki Web Push (profile nudges)

Profile-gap nudges (FTP/gewicht/lengte/geboortejaar/doel/thuislocatie) deliver via the
existing in-app bell + email AND a Web Push channel (phone lock screen / watch). Tapping a
push opens ONE focused field at `/you?focus=<token>` (home gap → `/train?focus=homeLocation`).

## SSRF: push endpoints are server-fetched URLs
A push subscription `endpoint` is an attacker-supplied URL the server later fetches via
`webpush.sendNotification`. **Always validate it against an allowlist of real push-service
hosts (HTTPS only) at BOTH subscribe time and send time** (`isValidPushEndpoint` in
`lib/push.ts`). Without this, any authenticated user can register an internal URL
(e.g. 169.254.169.254) and turn reminder delivery into an SSRF primitive.
**Why:** caught in code review as a blocking finding. Allowlisted hosts: fcm.googleapis.com,
*.push.services.mozilla.com, web.push.apple.com, *.notify.windows.com, *.push.microsoft.com.

## Honesty / delivery rules
- `pushChannelStatus()` is "ready" only when both VAPID keys exist; otherwise honest-limited
  (mirrors email). VAPID keys are auto-generated and stored as shared env vars
  (VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT) — generate to a temp file, `setEnvVars` without
  printing the private value, then delete the file.
- Push is sent ONLY for freshly-inserted notification rows (insert `.returning({id})` →
  detect new) so re-runs don't re-push already-seen nudges. Dead subs (404/410, or
  non-allowlisted) are pruned.
- Reminder dedupe must use the engine's passed `now` (`isoWeek(now)`), never `new Date()`,
  or backfilled/tested runs become non-deterministic.
- One profile nudge per run = the single most valuable missing field (doctrine: one
  targeted question), weekly dedupe per field so it persists until filled.

## Frontend
- Service worker `public/sw.js`: resolve click URLs scope-aware via
  `new URL(path.replace(/^\//,''), self.registration.scope)` so deep links survive a
  base-path prefix. Register in `main.tsx` with `{ scope: import.meta.env.BASE_URL }`.
- `usePush` is an honest state machine: unsupported / ios_needs_install (iOS needs installed
  PWA) / not_configured / blocked / off / on — never claims push works when it can't.
- `applicationServerKey` needs `as BufferSource` cast (Uint8Array<ArrayBufferLike> vs DOM type).
