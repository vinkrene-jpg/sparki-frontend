---
name: Route rejoin after deviation
description: Web navigator off-route choice (terug/verder) — design decisions and constraints
---

# Route rejoin after deviation (web RouteNavigator)

- When >60 m off the planned line, the rider chooses: shortest real path back ("terug") or a real continuation rejoining further ahead ("verder", target = max(1 km, 2× offset) ahead, falls back to route end).
- **Why:** honesty rule — the connector must be a real routed path from the routing provider (ORS point-to-point), never a drawn straight line; unavailability is an honest 503/502, no fallback geometry.
- **How to apply:** routing profile is derived from route `surface` (mtb→cycling-mountain, gravel/pad/mixed→cycling-regular, else cycling-road) because the routes table has no sport/bike columns.
- Detour is client-side state only (no persistence): dashed amber polyline, detour cues take over the next-turn card, auto-clears when back within 40 m of the original route; the off-route choice prompt is suppressed while a detour is active.
- Nearest-point matching is nearest-vertex, not segment projection — fine for dense ORS geometries; revisit if sparse imported GPX routes misbehave.
