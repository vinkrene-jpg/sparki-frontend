---
name: Route generation free-text wish
description: How the athlete's free-text wish influences route generation and how honesty is preserved.
---

- The route generator (`POST /api/routes/generate` + `/generate/options`) accepts a free-text `wish` alongside the structured inputs (afstand, vlak/heuvelachtig, trainingstype). The wish is passed only into `buildRationale`'s prompt — the round-trip routing engine (ORS) canNOT steer on arbitrary roads/places/"vermijd"-verzoeken; it only controls distance, elevation preference and surface/profile.

- Honesty contract for wishes: the rationale prompt is instructed to (1) confirm the parts of the wish that map to controllable dimensions (distance/elevation/surface), and (2) for any specific-road/place/avoidance part that can't be guaranteed, say so plainly and offer the generated route as a passend alternatief — and NEVER claim the route passes a place not present in the data.

**Why:** the app's no-fabrication rule — a wish about a specific weg/plaats cannot be verified against ORS round-trip output, so Sparki must not pretend it was honoured.

**How to apply:** if a future change adds real road/POI-aware routing, only then may the rationale assert the wish was met. Until then, keep the wish confined to the rationale prose, not to any claimed geometry.
