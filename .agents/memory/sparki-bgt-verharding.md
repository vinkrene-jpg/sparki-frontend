---
name: BGT-verhardingscontrolelaag (PDOK)
description: NL-only surface control layer on top of OSM/GraphHopper via PDOK BGT wegdeel data — where it plugs in and its traps.
---

# BGT-controlelaag (alleen Nederland)

Bron: PDOK OGC API `.../lv/bgt/ogc/v1/collections/wegdeel/items?bbox=lon,lat,lon,lat&f=json` (CC0). Per wegdeel-polygoon `fysiek_voorkomen`: gesloten/open verharding, half verhard, onverhard.

Rol: CONTROLELAAG, geen routemotor-vervanging. Drie consumenten:
- `lib/route-surfaces.ts`: vult ALLEEN OSM-onbekende meetpunten (assign→apply→build split), nooit een OSM-oordeel overschrijven; analysis krijgt `bgt`-metadata + bronvermelding.
- `lib/routing/loop-quality.ts`: opts.`unpavedShareOf` — alleen cycling-road, top-3 kandidaten, zelfde gewicht als de provider-wegdekpoort; null = weegt niet mee.
- `lib/route-remarks.ts`: `buildBgtRemarks` — ≥2 meetpunten per stuk (één treffer = kruisend vlak), overslaan waar OSM al onverhard/slecht_wegdek meldt.

**Traps:**
- PDOK geeft óók HISTORISCHE versies terug: filter `eind_registratie`/`termination_date` null + status "bestaand", anders spook-wegdelen.
- Routepunt kan op een voetpad-vlak naast de rijbaan vallen: bij meerdere polygonen wint een rijbaan/fietspad/woonerf-functie.
- Rate-limited: alles per ~450 m-tegel met in-memory cache (24 h; mislukte tegel 10 min) en hard tegel-plafond per aanvraag; tegels boven het plafond blijven eerlijk onbeoordeeld.
- NL-check is een ruwe omtrek-polygoon, GEEN bbox — een NL-bbox omvat Vlaanderen/Ruhrgebied (Brussel viel er eerst "binnen").
- `bgtUnpavedShare` weigert eerlijk (null) onder 40% puntdekking — anders stuurt een dun oordeel de selectie.

**Why:** hertest Hengelo (30-07-2026): OSM kent ~16% van sommige routes geen wegdek; BGT is landsdekkend en door gemeentes onderhouden.
**How to apply:** elke nieuwe wegdek-consument hergebruikt `lib/bgt-verharding.ts` (tegelcache) en labelt eerlijk "alleen Nederland".
