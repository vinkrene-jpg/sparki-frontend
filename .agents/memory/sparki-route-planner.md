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

## Smart AI Route Generator (ORS) — durable constraints
Generator extension of the route section: real map-backed route (loop or A→B) matched to
bike + training type, regenerate, save like a GPX route.
- **Honesty: every geometry/distance/elevation/surface value comes from OpenRouteService —
  never fabricated.** Loop = ORS `round_trip` (distance is *approximate*; it won't hit the
  exact target — that's honest, never "correct" it toward the request). A→B = directions
  geojson+elevation. Surface and quiet-road routing are only a *preference* ORS can express,
  NOT a guarantee — disclose this everywhere the route shows (candidate preview AND every
  saved generated card, not just inside AI rationale prose).
  **Why:** code review failed an earlier cut for showing only the candidate caveat.
- **Stats must be derived from FULL ORS geometry, before any downsampling.** Downsampling a
  polyline cuts corners and understates distance. Compute distance/elevation/profile/climbs
  from the full point list first; downsample only for transport/storage/render. The stored
  geometry cap must stay high enough that realistic routes keep full ORS resolution, so the
  server-side recompute on save equals what the candidate showed.
  **Why:** code review failed a cut that computed stats from a 400-pt downsample (2-5% off).
- **Stateless generate→save trust model:** save recomputes stats server-side from the
  client-supplied geometry (same trust as GPX upload) — never trust client-sent distance.
  This only stays honest if the geometry is stored near-full-resolution (see above).
- **bikeType→ORS profile**: race→cycling-road, mtb→cycling-mountain, gravel→cycling-regular.
- **Rationale** is AI-generated with a deterministic template fallback — a missing AI key or
  failure must still yield honest Dutch copy, never a fabricated claim.
- **Leaflet gotcha**: `circleMarker(...).addTo(polyline)` throws `map.addLayer is not a
  function` — a Polyline is not a LayerGroup. Wrap line+markers in `L.layerGroup([...])`.
- **JSX generic gotcha (replit-cartographer)**: explicit type-arg syntax `<Comp<T> .../>` on a
  JSX element breaks the babel metadata plugin ("Unexpected token"). Make the component take
  `string` props and cast at the call site instead.
