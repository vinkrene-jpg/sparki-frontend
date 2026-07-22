---
name: Sparki Data Hub
description: Central multi-platform data architecture — dedupe design, consent gating, readiness model, single sync path. Read before changing data-hub ingest/dedupe/consent.
---

# Sparki Data Hub

One central engine normalizes many sport/health platforms into Sparki's canonical
tables. Lives in `artifacts/api-server/src/engines/data-hub/` (index=runSync
orchestrator → sync_runs, ingest, dedupe, providers, readiness, sports, validation).
API at `routes/hub.ts`; `routes/connectors.ts` `/:id/sync` delegates to `runSync`
(single sync path). Adding a platform = registry `available` flag + provider adapter;
routing/ingest/dedup/consent/readiness/logging are platform-agnostic.

## Cross-source dedupe — grid rounding shatters real duplicates
**Rule:** the activity dedupe key is `sport | floor(start/5min)` ONLY. Do NOT put
duration/distance in the key. Match against neighbour buckets (`candidateDedupeKeys`
= prev/current/next) plus a distance/duration **tolerance guard**
(`activitiesPlausiblyEqual`, ~20%).
**Why:** the same ride from Garmin vs Strava drifts (e.g. 92 vs 93 min, 48.2 vs
48.4 km, start 2 min apart). The original `round()`-bucket key on all three fields
produced different keys for the same ride → it never merged, defeating the whole
hub. A real-DB test (`tests/data-hub.ts`, `test:data-hub`) proves two sources
collapse to one session carrying both `sources[]`.
**How to apply:** when touching dedupe, keep the key coarse + agree-only; do
disambiguation via the tolerance guard, never by hard-rounding into the key.
Provenance rows (`connector_activities`) store the *canonical session's* dedupeKey
so all sources for one activity share one key.

## Consent gating for activities — AND, not OR
**Rule:** activity ingestion requires `allowed.has("activities") && allowed.has("training_history")`.
**Why:** both consent types map to the SAME single activity-ingest path. With OR,
revoking one is bypassed by the other still being granted (default-grant). AND =
revoking EITHER blocks ingestion; fails safe toward more privacy. Consent is
default-grant: a type is allowed unless an explicit `granted=false` row exists.

## Readiness — 4-state, honest
`resolveReadiness(def, status)` → actief (this user connected) > beschikbaar
(`def.available`, only Strava today) > testbaar (live provider OR provides ∩
INGESTABLE_TYPES) > voorbereid (default). Never fake "connected". Unwired platform
sync → HubError `unavailable` (400); wired-but-no-creds → `sync_failed` (502).

## Pre-deploy debt
Prod DB schema NOT pushed: new tables (`connector_activities`, `equipment`,
`connector_consents`, `sync_runs`) + extended `training_sessions`
(sport/avgCadence/avgSpeedKph/maxHR/externalRef/dedupeKey/sources[]) and `races`
(raceType/result jsonb). Push before deploy.

## Dag-niveau dedupe voor handmatige sessies (Afbouwgolf 1)
Handmatige sessies hebben geen starttijd ⇒ geen dedupeKey; dedupe gebeurt op dag+type+plausibiliteit. **Regel:** merge NOOIT zonder minstens één sterke vergelijker (duur of afstand aan BEIDE kanten aanwezig en geldig) — `activitiesPlausiblyEqual` geeft effectief true bij ontbrekende velden, wat anders stille dataloss (over-merge) veroorzaakt. Valideer numerieke route-invoer hard (400 bij NaN) zodat NaN nooit de dedupe-beslissing in gaat. Zelfde guard geldt in de hub-import wanneer manual rows als merge-kandidaat meegaan.
