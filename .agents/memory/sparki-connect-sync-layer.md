---
name: Sparki Connect central sync layer
description: Merge-log, consentExpired status, scheduled all-users catch-up job — final Connect wave lessons.
---

- **Merge/conflict log** lives on `training_sessions.merge_log` (additive jsonb), written only in the ingest merge branch; bounded via `appendMergeLog(...).slice(-20)` — any future merge-path change must keep the log bounded and internal-only (never user-facing).
- **consentExpired** = connected + accessToken past expiry + NO refreshToken (with refreshToken adapters refresh silently — never flag). Derived in `deriveConnectState(row, { syncRunning?, now? })`; maps to `action_required` with specific Dutch copy "Toestemming verlopen — verbind opnieuw…". Passing `now` keeps it testable.
- **Scheduled all-users catch-up** (`job:sync`): reuse the SAME per-user `shouldCatchUp`/`computeCatchUpAfterEpochSec` rules, run sequentially, treat `HubError(busy)` as skip not failure. One failure never aborts the loop. Safety valve env `SYNC_JOB_MAX_CONNECTIONS`.
- **Honest job test without mocks**: seed connected-but-stale connection with an invalid token → real Strava call fails → assert sync_run trigger='scheduled' status='failed' and connection status='error'. Fresh + tokenless rows assert zero sync_runs. Assert summary counts relatively (>=) because real rows may co-run.
- `counts.received` (pre-dedupe intake) is set in runSync when the adapter delivered but not persisted externally — sync logbook honesty.
- **Broken-link alerting** (engines/data-hub/connection-health.ts): consentExpired of >24u geen geslaagde sync (isSyncStale, alleen auto-sync-providers) ⇒ één open melding per storing via resolutionKey `link:<provider>`; runSync lost hem op bij succes. Push alleen bij VERS aangemaakte rij (createNotification returnt nu boolean) — nooit per poging. Providerslijst lokaal berekend om importcyclus scheduled-sync→index te vermijden. Koppelingenpagina toont hetzelfde via `syncStale` op het connector-item.
- **Why:** webhooks are primary; the scheduled job is the safety net so missed webhooks/stale users still converge, without a second sync system.
