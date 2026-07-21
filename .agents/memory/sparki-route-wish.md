---
name: Route generation free-text wish
description: How the athlete's free-text wish influences route generation and how honesty is preserved.
---

- The route generator (`POST /api/routes/generate` + `/generate/options`) accepts a free-text `wish`. For LOOP routes, a scenery wish ("meer natuur", "minder verkeerslichten" — regex-detected) now genuinely steers: the loop selector collects multiple real ORS candidates, fetches real OpenStreetMap environment facts (forest share, traffic lights on route) for the best few, and re-ranks with nature/traffic-light penalties. The chosen route's measured environment feeds the rationale prompt so it can cite real numbers.
- Everything else in the wish (specific roads, places, "vermijd X") still cannot be steered — ORS round-trip only controls distance, elevation preference and surface/profile. Point-to-point and waypoint routes have NO candidate pool, so scenery steering does not apply there; the rationale prompt's capability text is mode-gated (loop vs. non-loop) to avoid overclaiming.
- Honesty contract: when the environment lookup fails, the scenery preference simply doesn't weigh in (never guessed); the rationale may only cite measured environment numbers actually passed in, and must plainly say when a wish part can't be steered — never claim the route passes a place not present in the data.

**Why:** the app's no-fabrication rule — steering claims must match what the selector actually did per mode.

**How to apply:** keep scenery steering selection-based (rank real candidates on real map data); if adding steering for a new dimension, extend the loop selector callback pattern and update the mode-gated capability text in `buildRationale` in lockstep.
