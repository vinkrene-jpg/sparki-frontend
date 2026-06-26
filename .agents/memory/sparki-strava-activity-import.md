---
name: Strava activity import via Data Hub
description: Why connecting Strava must import activities through the hub ingest pipeline, and the consent-honesty rule for importedDataTypes.
---

# Strava activity import (Data Hub)

A connector that only persists profile data "externally" (weight/FTP via the
provider's own sync) and sets `persistedExternally: true` will leave the central
ingest pipeline empty — so `training_sessions` stays empty and the athlete "ziet
geen activiteiten" even though the connection looks healthy.

**Rule:** any provider that has activities MUST return them as canonical
`activities` in its hub batch with `persistedExternally: false`, so `ingestBatch`
runs and writes into the canonical activity/session tables. Profile-only external
persistence is fine for weight/FTP, but it must NOT swallow activities.

## Consent-honest importedDataTypes
**Why:** an adapter may include `activities`/`training_history` in
`importedDataTypes` because it *fetched* activities, but the user may have revoked
consent (ingest is correctly skipped) — so the stored connection would falsely
claim data it never persisted. That breaks the honesty contract.

**How to apply:** `effectiveImportedDataTypes(batch, allowed)` (in
`engines/data-hub/ingest.ts`) is the SSOT that strips `activities` +
`training_history` unless the batch actually carried activities AND consent
permits ingesting them. The activity gate itself is `activitiesIngestAllowed`
(AND of `activities` + `training_history`, fails safe toward privacy) and is used
both inside `ingestBatch` and by the filter.

Every place that writes or returns `importedDataTypes` for a synced connection
must use the filtered value, never raw `batch.importedDataTypes`:
- `runSync` — `connector_connections`, `sync_runs`, AND the returned payload.
- OAuth callback initial import — `connector_connections`.

The OAuth callback's first import should route through
`getHubProvider().fetchAndNormalize` + `ingestBatch` (not the provider's direct
profile sync) so activities land immediately on connect; keep it best-effort
(warn-only, no error-flip on a freshly connected account).
