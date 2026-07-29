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

# Valse-melding-lessen (racefiets-praktijktest)

- Toegangsdrempel is 6 m (niet 12/30): de routegeometrie volgt OSM-weggeometrie exact, dus 7–10 m afstand betekent vrijwel altijd "rijbaan naast het fietspad" — geen route-vak. Wegdekmeldingen 10 m. Beide met refine tegen de volledige geometrie + kruisings-drop (≤1 nabij punt = kruising, telt niet).
- Parallel-fietspad-controle: per beperkte_toegang-kandidaat één Overpass-query (cycleway/path/track-lane/footway-bicycle-yes binnen around:35); treffer ⇒ melding vervalt. Kan de controle niet draaien ⇒ degradeer de melding naar `uncertain` ("mogelijk apart fietspad") — nooit als feit laten staan én nooit stil laten vallen.
- Rijen paaltjes/poorten binnen 150 m bundelen tot één melding met (×N).
**Why:** René's praktijktest gaf tientallen valse "hier mag je niet fietsen"-meldingen; way-voor-way bleek vrijwel elk vak een rijbaan met parallel fietspad.
**How to apply:** elke nieuwe remark-soort krijgt strakke afstands-drempel + refine + eerlijke onzekerheids-degradatie i.p.v. hard feit bij ontbrekend bewijs.
