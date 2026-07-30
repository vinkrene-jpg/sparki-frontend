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

## GRB-laag (alleen Vlaanderen, eerste EU-land)
`lib/grb-verharding.ts` spiegelt het BGT-patroon voor Vlaanderen (GRB Wegsegment, geo.api.vlaanderen.be): zelfde tegelcache/plafond/honest-null, maar LIJN-geometrie ⇒ punt-op-lijn (dichtstbijzijnd segment ≤20 m wint, nooit "eerste rij"). Mapping: vaste verharding=verhard; losse=half_verhard behalve MORF aardeweg=onverhard; "zowel vaste en losse"=half_verhard; nvt/onbekend=null. Vlaanderen-omtrek met Brussel als GAT in de ring (Wallonië/Brussel niet getoetst). Licentie eist naamvermelding "Bron: Grootschalig Referentie Bestand Vlaanderen, Digitaal Vlaanderen" — zit in grbSource() én in elke GRB-melding; nooit strippen. Consumenten gaan via `lib/surface-control.ts` (controlUnpavedShare kiest BGT of GRB op regio) en dezelfde generieke apply/remark-helpers — een volgend land haakt daar in, geen vierde codepad.

**Why:** hertest Hengelo (30-07-2026): OSM kent ~16% van sommige routes geen wegdek; BGT is landsdekkend en door gemeentes onderhouden.
**How to apply:** elke nieuwe wegdek-consument hergebruikt `lib/bgt-verharding.ts` (tegelcache) en labelt eerlijk "alleen Nederland".
