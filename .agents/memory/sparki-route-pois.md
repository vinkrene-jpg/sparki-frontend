---
name: Sparki route POIs & coffee break
description: POIs along a route via Overpass + reroute-via-place + hourly coffee popup — query shape, honesty and UI gotchas
---

- **Overpass query shape matters**: expanding `node[...] + way[...]` clauses per tag times out (504) on city-sized bboxes; the compact `nwr[...]` union with `[timeout:25]` returns in seconds. Overpass main instance also has per-IP slot contention — a request can transiently fail right after a heavy one; the honest 502 path covers this, a retry usually succeeds.
- **Behind-rider guard is server-side**: `detour-via` rejects targets at/behind the rider's routeKm with 422 so "coffee ahead" can never route backward, regardless of what the client sends.
- Provider distance/duration are nullable — fall back to haversine path length for cue-km offsets, keep duration honestly null; never invent totals.
- Coffee prompt: keyed to full RIDING hours (rideSeconds, not wall clock), 15s auto-dismiss, repeats hourly while ignored (handled-hour ref), suppressed when <5 km remaining, picks a horeca POI ahead of current progress.
- XSS rule held: emoji-only divIcon html; OSM names markup-stripped server-side and rendered only through React.
- **Bike shops (pech)**: `shop=bicycle` is a third "service" category (🔧). Opening hours honesty: hand-rolled evaluator for common OSM `opening_hours` patterns only — anything unparseable/PH-uncertain is "unknown", NEVER a claimed open/closed. Provably-closed shops are dropped; unknown shown with "bel of check vooraf". Cache stores the raw hours string and openState is recomputed on every read so a 6h cache can't claim a stale "open". Gotchas caught in review: overnight spans (`Fr 22:00-02:00`) must also check yesterday's rule at minutes+1440, and skipped PH/SH rules must downgrade "closed" to unknown (holiday could be an exception).

**Why:** Overpass behavior (504 on verbose queries, transient slot 502s) is not discoverable from code and cost a debug round.
**How to apply:** any future Overpass feature — use nwr unions, keep honest-null on failure, expect transient failures.

## Onderweg-velden op corpus-lijsten — eerlijkheidsles
- Verrijk corpus-lijsten met POI-feiten via één gebiedsvraag, nooit per rij (bursts). "Nee" mag alleen bij bewijsbaar volledige dekking; alles anders is null.
- **Why:** drie beoordelaar-gevonden leugen-paden: dekking claimen die nooit bevraagd is (sleutel/grens ≠ query-grens), een 200-antwoord met Overpass-`remark` (onvolledige uitvoering) als volledig behandelen, en "afstand tot de lijn" meten tot hoekpunten i.p.v. segmenten.
- **How to apply:** één canonieke bbox (naar buiten afgerond) gedeeld door query, cache en dekkingstoets; remark ⇒ mirror/null; segment-bewuste afstand.

