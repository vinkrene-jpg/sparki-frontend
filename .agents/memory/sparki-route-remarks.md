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

# Obstakelgrenzen René (30-07-2026, bindend)

- Trap = harde afkeur (custom model STEPS ×0.05 + selectiestraf +1000); poorten: minste wint (lichte straf); doorfietsbare poort (cycle_barrier, bicycle=yes/designated/permissive, access=yes) wordt NIET gemeld; poort op slot/privé zonder fiets-uitzondering = "Afgesloten poort"; aantoonbaar geblokkeerde winnaar (trap/verbod/privé-poort) ⇒ generatie FAALT eerlijk (nooit "minst slechte" aanbieden — absolute grens René).
- `getRouteObstacles`/`routeObstaclesOf` (route-remarks) voedt `obstaclesOf` in generateVariedLoop; interactieve paden budgetMs 2500 → null (nooit wachten/gokken).
- Toegangssplitsing in route-surfaces: bicycle=no/private ⇒ `forbiddenKm` ⇒ verdict "afgeraden"; access=no/private zonder fiets-uitzondering ⇒ `restrictedKm` ⇒ milde reden + cap "gedeeltelijk".
**Why:** routeopmerkingen meldden obstakels die je fietsend niet kunt oplossen; melden zonder mijden is oneerlijk, en doorfietsbare poorten benoemen zaait twijfel.
**How to apply:** nieuwe generatiepaden geven obstaclesOf mee; nieuwe remark-consumenten onderscheiden verbod vs. access; obstakeltellingen alleen uit echte metingen (null = niet meewegen).

## Poort-matching precisie (30-07-2026, route 265 Hengelo)
- Poorten zijn PUNTobstakels: alleen melden als de node vrijwel op de routelijn ligt. Grens = SEGMENTafstand ≤15 m (routegeometrie is bemonsterd ~44 m; punt-match mist echte poorten tussen twee routepunten én vangt hekjes op zijpaden via schuine punten). De oude punt-match ≤30 m gaf 7/17 valse meldingen (opritten/zijpaden op 18–25 m) en miste tegelijk 6 echte poorten.
- Extra zijpad-controle: haal parent-ways van elke gemelde poortnode op (Overpass `node(id:…)->.g;way(bn.g);out body geom`) en eis dat ≥1 parent-way door de route wordt gevolgd: ≥15 m verdichte weglengte binnen 8 m van de routelijn, buiten ~7,5 m rond de poort zelf (segment-gebaseerd, GEEN vertex-telling — schaars-genode ways vallen anders vals weg). 20 m volg-tolerantie was te ruim: parallelle parkeerstroken en naastgelegen privéstraten telden mee. Storing of geen parent-ways ⇒ melding laten staan (nooit een hek verzwijgen).
**Why:** René (veel regio-ervaring) zag 17 poort/privéterrein-meldingen op 36 km — onmogelijk in de praktijk; way-voor-way gemeten bleken het hekken náást de route.
**How to apply:** elke punt-obstakelmeting (barrier-nodes) in route-remarks/blokkadepoort: segmentafstand + parent-way-volgcontrole, nooit kale nabijheid.
