---
name: Strava webhook-first sync
description: Lessons from the webhook-first Strava sync wave (targeted fetch, catch-up, busy gating)
---

- **Partial syncs must never null identity fields.** A targeted webhook sync returns no `externalUserId`; a naive upsert `set { externalUserId: value ?? null }` wipes the stored id, silently breaking resolution of ALL later webhooks. Use `COALESCE(EXCLUDED.col, table.col)` in `onConflictDoUpdate` for any field a partial sync may omit.
  **Why:** tests 21/22/24 went "skipped" (unresolvable user) only after the first successful webhook sync — a self-inflicted break invisible in single-event testing.
- **Busy gating must be atomic.** check-then-insert of a `running` sync_runs row races; wrap check+insert in one `db.transaction` with `pg_advisory_xact_lock(hashtext(clerkId:provider:sync))` (transaction = single client, per earlier advisory-lock lesson). Test with `Promise.allSettled` of two concurrent runSyncs: exactly one ok, one `busy`.
- Stale boundary is inclusive: exactly 24h old = still fresh; catch-up window = lastSync−48h overlap (dedupe absorbs), else now−30d, clamped ≥0.
- In-process API tests can stub `globalThis.fetch` for only `www.strava.com` URLs (pass everything else to the real fetch) and record called URLs to assert "targeted fetch only, no list/profile call".
- `recordWebhookEvent` resolves clerkId from `externalUserId` at record time and only matches status "connected" — disconnect makes later webhooks honestly skip.
