---
name: Sparki Route Planner restoration
description: How the Smart Route Planner (first sparki-insights restoration task) was rebuilt — data-honesty rules, feature flag, and the FK-ownership trap.
---

# Sparki Route Planner (first restoration of the legacy "sparki-insights" feature set)

The route/navigation section that existed only as static mock UI in `.migration-backup/`
was rebuilt as a real, backend-connected, feature-flagged Train section.

## Durable decisions
- **Restoration pattern**: legacy "sparki-insights" features (route planner, group rides,
  clubs, etc.) were NEVER real — they were static mock UI driven by `lib/sparki-data.ts`.
  Restoring one means: new DB table + new API router + new hook + new gated component,
  modeled on the closest existing real feature. Never wire `sparki-data.ts` as live data.
- **Data honesty is the core constraint**: derive everything from real GPX track points.
  Distance/elevation/elevation-profile/climbs come from `<trkpt>/<ele>`. **Turn-by-turn nav
  is NOT derivable from a bare GPX track** — store it `null` and show "niet beschikbaar"
  rather than fabricating directions. A future routing-engine/Komoot/Strava import fills it.
- **Feature flags for these were pre-seeded long ago** in `lib/feature-flags/src/index.ts`
  (`route_planner`, `coach_portal`, `parent_portal`, `strava`, `garmin`). Don't add new flag
  keys for restorations — use the existing one. To show in dev: set `enabled_globally=true`
  on the `feature_flags` row (upsert via SQL).
- **Additive-only into Train**: insert a new flag-gated `<section>` between existing v0
  sections; never re-port the legacy `train/page.tsx` wholesale (it would overwrite the
  cinematic v0 layout the user wants preserved).

## The FK-ownership trap (architect caught this)
**Any client-supplied foreign-key id must be ownership-checked before insert.**
**Why:** `POST /api/routes` accepted `linkedActivityImportId` as a raw int and inserted it,
letting a user link another user's `activity_imports` row (IDOR / cross-tenant reference).
**How to apply:** when a create/update body carries a reference id, `SELECT ... WHERE id=? AND
clerk_id=?` first; reject (400) if not owned. Owner-scoping the table's own CRUD is not enough.
