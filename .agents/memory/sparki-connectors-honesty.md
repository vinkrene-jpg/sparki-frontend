---
name: Sparki connector honesty model
description: Rules for keeping the Connecties (sport/health app) flow honest — pending shells, readiness vs availability, and what "don't re-ask data" really means.
---

# Sparki connector honesty model

The Connecties flow lets athletes connect sport/health apps. Most platforms are
not wireable yet (no live API). The whole feature must stay honest under the
project's "never fabricate data" rule.

## Unavailable connectors are informational only (pending shell RETIRED in UI)
Decision: an unavailable connector now renders as a calm read-only "Binnenkort"
row — its `unavailableReason` + a Binnenkort badge, **no Koppel button**. The old
"Koppelen gestart — API nog niet actief" pending-shell UX was removed because
users read it as a half-broken connection. The reason text is split by restriction
class (all driven off `authType`): `oauth` = "platform gates external apps behind
an official approval process; auto-enables once Sparki is approved"; `native` =
on-device app; `replit-connector` = in voorbereiding.
**Why:** the user explicitly wanted Garmin/TrainingPeaks (and every same-restriction
platform) shown as honestly "binnenkort beschikbaar", not a confusing started state.
**How to apply:** keep the connect CTA gated on `connector.available`; never
reintroduce a pending-shell display for unavailable connectors. The legacy
`POST /:id/start` endpoint + `startConnector()` helper are now fully REMOVED, and
a boot self-heal (`cleanupStaleConnectorShells`) deletes leftover shells: all
`status='pending'` rows plus TOKENLESS rows of registry-unavailable providers.
Token-bearing rows are never deleted (protects real state if a provider is ever
temporarily flagged unavailable). Regression test: `test:connector-cleanup`.
Copy may only point to GPX file-import as a
fallback (FIT/TCX/CSV are stored as placeholders, not parsed — don't promise them).

## "Don't re-ask already-available data" applies only to REAL connections
Consent copy must NOT promise a pending shell will stop asking for data — there
is no data, so suppressing the manual input would create a dead-end (violates
the no-dead-end rule). The genuine "stop asking FTP/weight" behavior happens
automatically because a *connected* source's imports populate the canonical
profile/metric tables, which the missing-input/missing-data logic already reads.
**Why:** the only honest way to skip a manual prompt is when real data exists.
**How to apply:** keep missing-data checks reading real values; for pending
shells the copy says "we koppelen automatisch zodra beschikbaar; vul het tot
die tijd zelf in."

## Readiness badge must never contradict availability
A connector's user-facing `available`/`unavailableReason` is computed from the
*effective* availability (registry flag AND runtime config — e.g. Strava only
counts as available when its API credentials exist). The 4-state readiness badge
must be computed from that same effective value, not the static registry flag,
or Strava-without-creds shows `available:false` yet a "beschikbaar" badge.
**How to apply:** pass effective availability into `resolveReadiness(...)` at
every call site, not `def.available`.
