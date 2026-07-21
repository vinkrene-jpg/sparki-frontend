---
name: Sparki route POIs & coffee break
description: POIs along a route via Overpass + reroute-via-place + hourly coffee popup — query shape, honesty and UI gotchas
---

- **Overpass query shape matters**: expanding `node[...] + way[...]` clauses per tag times out (504) on city-sized bboxes; the compact `nwr[...]` union with `[timeout:25]` returns in seconds. Overpass main instance also has per-IP slot contention — a request can transiently fail right after a heavy one; the honest 502 path covers this, a retry usually succeeds.
- **Behind-rider guard is server-side**: `detour-via` rejects targets at/behind the rider's routeKm with 422 so "coffee ahead" can never route backward, regardless of what the client sends.
- Provider distance/duration are nullable — fall back to haversine path length for cue-km offsets, keep duration honestly null; never invent totals.
- Coffee prompt: keyed to full RIDING hours (rideSeconds, not wall clock), 15s auto-dismiss, repeats hourly while ignored (handled-hour ref), suppressed when <5 km remaining, picks a horeca POI ahead of current progress.
- XSS rule held: emoji-only divIcon html; OSM names markup-stripped server-side and rendered only through React.

**Why:** Overpass behavior (504 on verbose queries, transient slot 502s) is not discoverable from code and cost a debug round.
**How to apply:** any future Overpass feature — use nwr unions, keep honest-null on failure, expect transient failures.
