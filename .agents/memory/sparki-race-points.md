---
name: Sparki wedstrijdpunten & wedstrijdmodus
description: Central race_points model, gids-extractie als voorstel, kaartcontrole, mobile race mode gotchas.
---

- One central `race_points` table for info+wedstrijd points; route shaping/nav stay in routes.waypoints/nav — never duplicated.
- **Honesty contract**: AI guide extraction only ever creates status "voorgesteld" with source file/page/confidence; only "bevestigd"/"aangepast" points are active (live view, race mode). Status may NEVER return to "voorgesteld" (`isAllowedStatusChange`).
- Manual points = immediately "bevestigd", confidence/source null (the rider asserts them). Map click without km snaps deterministically to the linked route (`snapToRouteKm`); no route ⇒ km stays null, never invented.
- `routes.usageType="wedstrijd"` makes GET /api/routes/:id attach a `race` block (next planned race + active points only) — mobile consumes this; mobile `RouteDetail.race` must be non-optional (`| null`) or typecheck breaks where components require it.
- Mobile race mode (`lib/race-mode.ts`): lap counting via progress wrap detection (≥60% → ≤25%), lap capped at localLaps, finish cue/arrive nav step filtered out until final lap, POIs/traffic-light pills suppressed during race.
- **Why**: proposals leaking into live guidance would put unverified AI locations in front of a racing rider.
- Test gotcha: run-tsx-test.mjs crashed repeatedly under esbuild pressure for mobile tests; `node --import tsx/loader --test` directly works.
