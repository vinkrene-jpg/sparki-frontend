---
name: Sparki route remarks + interactive elevation profile
description: OSM/Overpass route-warnings engine and slider↔map elevation profile — honesty rules and Overpass geometry traps.
---

# Route remarks (routeopmerkingen)

- Warnings come ONLY from real OSM tags via Overpass; a plain paved road yields nothing (never a fabricated warning). Indications (access=private without bicycle=yes, natuurgebied) carry `uncertain: true`.
- **Overpass geometry trap:** `out geom`/`out center` can return ways/relations whose `geometry` array contains `null` entries (nodes outside the bbox) or a missing `center`. Type them as nullable and filter before mapping, or `.lat` reads crash the endpoint at runtime while tests with clean fixtures stay green.
- OSM `name` values must be HTML-stripped before rendering (Leaflet divIcon sink).
- Source/license attribution (OpenStreetMap via Overpass, ODbL 1.0) is shown in the UI with the caveat that map data may be outdated — required by the license and the honesty doctrine.

# Interactive elevation profile

- `InteractiveElevationProfile` syncs slider/drag position to the map via `positionKm` + `focusPoint`. Remarks render in TWO places: on the map (`remarkMarkers` prop of RouteMap) and on the profile (as `ProfileMarker` kind "opmerking"). The static `ElevationProfile` remains in use elsewhere — don't consolidate them blindly.

**Why:** the null-geometry crash surfaced only against live Overpass data after all unit scenarios passed; clean fixtures never contained null entries.
**How to apply:** any new Overpass consumer must treat every coordinate field as possibly null/missing and skip honestly.
