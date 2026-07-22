---
name: Device sync webhooks + per-field provenance
description: Garmin/Wahoo automatic sync — verified webhooks, idempotency, fieldSources/manualFields merge rules, honest status vocab.
---

# Verified webhooks (Data Hub)

- Every inbound push is FIRST recorded idempotently in `webhook_events` (unique provider+eventId, `onConflictDoNothing` + `.returning()` — no row back ⇒ duplicate). Processing = a regular `runSync` with trigger "webhook", so consent/dedupe/provenance are identical to any other sync.
- **Verification must be fail-closed per provider.** Garmin's Health push model carries no per-event signature — compensate with a secret in the registered URL itself (`?token=GARMIN_WEBHOOK_TOKEN`); missing env or mismatch ⇒ 403, nothing recorded. Wahoo sends `webhook_token` in the body; Strava only verifies the GET subscription handshake. A public webhook endpoint without ANY secret lets anyone trigger server-side syncs (idempotency does not stop spam with fresh event ids).
- Unknown external user ⇒ honest `skipped` with a reason (never `failed`, never a non-200 back to the platform or it retries forever). `failed` must always carry `lastError`; `attempts` counts every try.

# Per-field provenance + manual corrections

- `buildMergePatch(existing, incoming, manualFields)` only fills empty fields AND skips manual fields — even when the athlete deliberately emptied one. `updateFieldSources` is first-source-wins and ignores null writes.
- A user PUT on a session must mark touched fields in `manualFields` with source "handmatig", or the next sync silently reverts corrections.

# Status vocabulary traps

- `sync_runs.status` values are `success`/`partial`/`failed` — an admin aggregate filtering on `status='error'` reports 0 failures forever. Verify status strings against the write path, not assumptions.
- `SyncRunCounts` uses `activities` (not `created`); frontend run history reading a nonexistent counts key shows "0 nieuw" while data did arrive. `partial` runs still imported data — UI must not render them as plain "mislukt".
