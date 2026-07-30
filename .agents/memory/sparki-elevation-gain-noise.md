---
name: Route-hoogtemeters ruisdrempel
description: SRTM-ruis in vlak NL blaast naïeve hm-sommen op; smooth+threshold in summarizeTrack, y-as minimumschaal in profiel
---
- Provider-hoogtes (GraphHopper/ORS SRTM) ruisen per punt 1-2 m; een naïeve som van positieve deltas geeft in vlak NL honderden valse hm (400 hm op vlakke 48 km-lus).
- **Fix-SSOT:** `summarizeTrack` (api-server gpx-parse.ts) smooth over ±150 m wegafstand + 3 m hysterese-drempel (`smoothElevations`/`thresholdedGainM`). Echte klimmen blijven intact.
- **Why:** sectorstandaard (Strava/Garmin/Komoot); waarde blijft schatting uit echte bronhoogtes, UI labelt "(geschat)".
- **How to apply:** nieuwe consumers van route-hm moeten `summarizeTrack`-gain prefereren boven rauwe provider-`ascend`; nooit opnieuw naïef sommeren. Profiel-y-as heeft 100 m minimumschaal (elevation-profile.tsx toPoints) zodat vlak vlak oogt — niet verwijderen.
- Geen tweede hoogtebron (AHN) introduceren zonder route+profiel tegelijk om te zetten (één-bron-les).
- parseGpx (gereden activiteiten, baro/device-hoogte) is bewust NIET gedrempeld.
