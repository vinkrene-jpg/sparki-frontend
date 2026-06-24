---
name: Sparki connector honesty model
description: Rules for keeping the Connecties (sport/health app) flow honest — pending shells, readiness vs availability, and what "don't re-ask data" really means.
---

# Sparki connector honesty model

The Connecties flow lets athletes connect sport/health apps. Most platforms are
not wireable yet (no live API). The whole feature must stay honest under the
project's "never fabricate data" rule.

## Pending shells must not import or imply data
A not-yet-wireable connector can record a **persisted consent** ("Koppelen
gestart", status `pending`) but imports zero data and never appears connected.
**Why:** users want to express intent and have it remembered, but a pending
shell has no real data behind it — claiming otherwise is fabrication.
**How to apply:** the start endpoint records `pending` only for connectors whose
*effective* availability is false; truly-available platforms (e.g. Strava once
configured) must go through the real authorize/sync path instead.

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
