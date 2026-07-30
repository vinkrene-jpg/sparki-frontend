# Hertest hoogtemeters — heuvelachtig terrein (Zuid-Limburg + Sallandse Heuvelrug)

**Datum:** 2026-07-30 · **Taak:** #432 (keerzijde-hertest van de SRTM-ruisdemping uit #429/#431) · **Uitgevoerd door:** agent, live tegen de draaiende dev-API.

## Waarom deze hertest

Taak #429/#431 dempten SRTM-ruis in de hoogtemeterberekening (smoothing ±150 m wegafstand +
3 m-hysteresedrempel in `artifacts/api-server/src/lib/gpx-parse.ts` → `summarizeTrack`). Dat is
live bewezen op vlak terrein (zie `hertest-hengelo-rene-2026-07-30.md`: 91–106 hm op ~49 km rond
Hengelo, geen valse honderden hm meer). De keerzijde was nog onbewezen: op écht heuvelachtig
terrein moeten hoogtemeters en klimdetectie juist WEL substantieel blijven — de demping mag geen
echte klimmen wegfilteren.

## Wat is getest

Live routegeneratie via hetzelfde endpoint dat de app gebruikt (`POST /api/routes/generate`),
met de route-generator + echte providerhoogtes (SRTM). Sport `cycling`, fiets `racefiets`
(routingProfile `cycling-road`), modus lus, doelafstand 50 km, `elevationPreference: "hilly"`.

1. **Zuid-Limburg** — start bij Gulpen (50.8081 N / 5.8683 E)
2. **Sallandse Heuvelrug** — start bij Holten (52.2827 N / 6.4194 E), seed 7

## Resultaten (2026-07-30)

| # | Gebied | Kandidaat | Afstand | Hoogtemeters | Klimmen | Profiel min–max |
|---|--------|-----------|---------|--------------|---------|-----------------|
| 1 | Zuid-Limburg (Gulpen) | duurtraining-lus vanuit Camping Osebos · 51 km | 50,83 km | **612 m** | **3** | 96–328 m (spreiding 232 m) |
| 2 | Sallandse Heuvelrug (Holten) | duurtraining-lus vanuit Abraham Berg-hof · 46 km | 46,17 km | **237 m** | 0 | 9–73 m (spreiding 64 m) |

Gedetecteerde klimmen op de Zuid-Limburg-lus (echte, aanhoudende hellingen):

| Klim | Lengte | Gem. stijging | Top op |
|------|--------|---------------|--------|
| Klim 1 | 2,1 km | 4,4 % | km 14,8 |
| Klim 2 | 2,4 km | 4,1 % | km 17,7 |
| Klim 3 | 1,5 km | 4,0 % | km 38,3 |

## Beoordeling

- **Hoogtemeters blijven substantieel op heuvelterrein:** 612 hm op ~51 km rond Gulpen is een
  realistische orde voor een Zuid-Limburgse racefietslus (Strava/Komoot-lussen van 50 km in het
  Heuvelland zitten typisch rond 500–800 hm). Vergelijk: dezelfde afstand op de vlakke
  Hengelo-lus gaf 91–106 hm — de demping onderscheidt vlak en heuvelachtig dus duidelijk.
- **Klimdetectie werkt:** `climbs[]` bevat 3 echte klimmen met plausibele lengtes (1,5–2,4 km)
  en gemiddelde stijgingen (4,0–4,4 %) — passend bij Heuvelland-klimmen. De klimdrempels
  (≥40 m stijging, ≥0,6 km, ≥3 %) filteren geen echte klimmen weg.
- **Profiel toont echt reliëf:** de Zuid-Limburgse lus beslaat 96–328 m absolute hoogte
  (spreiding 232 m) — ruim boven de 100 m-minimumschaal van de y-as, dus het profiel rendert
  als echt bergachtig, geen vlakke lijn.
- **Middenterrein klopt ook:** Sallandse Heuvelrug geeft 237 hm op ~46 km met 64 m
  hoogtespreiding — glooiend, tussen vlak Twente (91–106 hm) en Limburg (612 hm) in. 0 klimmen
  is eerlijk: de Holterberg-hellingen op deze lus halen de aanhoudende-klim-drempels net niet,
  maar hun hoogtemeters tellen wél gewoon mee in de 237 hm.
- De waarden blijven schattingen op basis van providerhoogtes (SRTM); de UI labelt dit als
  "(geschat)".

## Conclusie

**GESLAAGD.** De ruisdemping uit #429/#431 filtert geen echte klimmen weg: op heuvelachtig
terrein blijven hoogtemeters substantieel (612 hm Zuid-Limburg, 237 hm Salland op ~50 km) en
bevat `climbs[]` echte klimmen met realistische lengte en stijging. Samen met het
Hengelo-bewijs (vlak: 91–106 hm) is beide kanten van de fix nu live aangetoond. Ruwe
API-antwoorden stonden tijdelijk in `/tmp/route-gulpen.json` en `/tmp/route-holten.json`;
de kerngetallen zijn hierboven vastgelegd.
