# RN_01A — Huidige staat kaarten & navigatie

Audit uitgevoerd op 2026-07-26, commit `149b37da03ca837fd47a0f0c1e37ada3c303cd59`.
Uitsluitend inventarisatie; geen productiecode gewijzigd.

## 1. Architectuur

### Web-frontend (`artifacts/sparki`)
- **Kaart-renderer:** Leaflet 1.9.4 (directe Leaflet-refs in `useEffect`, geen react-leaflet-wrapper).
- **Kaartcomponenten:**
  - `src/components/sparki/route-map.tsx` — statische kaart + eigen-routebouwer (punten tikken, slepen via `L.marker({draggable:true})`, verzamelpunten).
  - `src/components/sparki/route-navigator.tsx` — full-screen live navigatie: `navigator.geolocation.watchPosition` (`enableHighAccuracy`, `maximumAge:2000`, `timeout:15000`), koersrotatie via CSS-transform, basemap-wissel, "Terug naar startpunt" (`requestBackToStart`, r. 916–950: echte geroutete omweg, nooit een rechte lijn).
  - `src/components/sparki/route-explorer.tsx`, `route-discover.tsx`, `route-library.tsx`, `route-panel.tsx`, `location-picker-map.tsx`, `volgauto-panel.tsx`.
  - Hoogteprofiel: `src/components/sparki/elevation-profile.tsx` (`MiniElevationProfile` + `InteractiveElevationProfile` met slider en hellingskleuren, kaart↔profiel-sync).
  - Klimmenverkenner: `src/pages/klimmen.tsx` + `src/hooks/use-climbs.ts`.
  - Wegtypen: `src/components/sparki/route-surfaces.tsx` + `src/hooks/use-route-surfaces.ts`.
- **Tegelproviders (web):** CARTO Voyager (standaard), CARTO Dark Matter, CyclOSM (`tile-cyclosm.openstreetmap.fr`), Esri World Imagery (satelliet), `tile.openstreetmap.org` (fallback). Attributiestrings aanwezig in alle laagdefinities.
- **Cache (client):** `sessionStorage` voor actieve rit (`SavedRide` in route-navigator), `localStorage` voor rijvoorkeuren (`RIDE_OPTIONS_KEY`), TanStack Query voor API-antwoorden.

### Mobiele app (`artifacts/sparki-mobile`)
- **Kaart:** `react-native-maps` 1.18.0 met Mapbox-rastertegels (`lib/mapbox.ts`: style `dark-v11`, 512px `@2x`, token via `EXPO_PUBLIC_MAPBOX_TOKEN`). Web-stubs: `RouteMap.web.tsx`, `nav-audio.web.ts`, `ble-sensors.web.ts`, `ride-tracker.web.ts`.
- **GPS:** `expo-location` — `Accuracy.BestForNavigation`, `distanceInterval: 3` m, `timeInterval: 1000` ms (`hooks/useLiveLocation.ts`). Achtergrond: `TaskManager`-task `sparki-ride-location` met Android foreground-service; incrementele opslag naar AsyncStorage elke 4000 ms (`lib/ride-tracker.ts`).
- **Route-match / map-matching:** `lib/route-match.ts` — segmentprojectie (nooit puntmatching); dynamische corridor `30 + 2×accuracy + 1.5×snelheid` m (min 50, max 150); off-route pas na `MIN_BAD_READINGS = 3` opeenvolgende metingen én `MIN_BAD_DURATION_MS = 6000`; GPS-sprongfilter `JUMP_SPEED_MPS = 35`; `PROGRESS_GUARD_M = 20` (parallel-fietspadfilter).
- **Off-route/rejoin:** `lib/off-route-choice.ts` — keuzekaart per episode met twee opties: terug naar de route óf "opnieuw naar bestemming" (server berekent nieuw vervolg rechtstreeks naar het eindpunt; tijdelijke overlay, oorspronkelijke route blijft bewaard). `REJOIN_COOLDOWN_MS = 15000`, `REJOIN_MIN_MOVE_M = 100`, herprompt pas bij afwijking ×2,0 én +150 m. De route wordt nooit automatisch vervangen; de renner kiest.
- **Camera:** `lib/map-camera.ts` — volgen met `FOLLOW_PITCH = 45`, `FOLLOW_ZOOM = 16`; elk handgebaar (`onPanDrag`/`isGesture`) schakelt naar vrije modus; herstel alleen via expliciete recenter-knop (geen `animateCamera` in vrije modus).
- **Audio-cues:** `lib/nav-cues.ts` + `nav-audio.ts` (expo-av + expo-speech); snelheidsafhankelijk (`early` ≈ 20 s vooruit, 120–400 m; `now` ≈ 5 s, 30–80 m); alleen de echte eindbestemming geeft een aankomst-cue.
- **Offline:** actieve route + nav-stappen in AsyncStorage (`lib/active-nav.ts`); tegels alleen via impliciete OS-cache van `UrlTile`. Geen offline-tegelcorridor.

### API-server (`artifacts/api-server`) + database (`lib/db`)
- **Route-engine:** `src/engines/route/index.ts` boven `src/lib/routing/` — profielkeuze (`profile-selection.ts`: racefiets→`cycling-road`, mtb→`cycling-mountain`, gravel→`cycling-regular`), lussen via `round_trip` of handmatige cirkel-waypoints >95 km (`providers/ors.ts`), nav-sanitization (`nav-sanitize.ts`: tussen-waypoints zijn nooit bestemmingen).
- **Verrijking:** `lib/route-pois.ts` (POIs), `lib/climbs/` (klimmen + `geocode.ts` via Nominatim), `lib/route-surfaces.ts` (wegtypen), `lib/route-remarks.ts` (opmerkingen), `lib/road-objects/` (zelflerende verkeerslichten/rotondes), `lib/volgauto/compute.ts` (autoroute + parkeerplaatsen), `lib/route-insight.ts`.
- **Bestanden:** `lib/gpx-parse.ts`, `fit-parse.ts`, `tcx-parse.ts` (dependency-vrij; import via Data Hub `ingestBatch`, export GPX/TCX met round-trip-verificatie).
- **Live-locatie:** `src/routes/live-location.ts` — authz-hercheck per read, posities verwijderd na afloop, geen historie.
- **DB-tabellen:** `routes` (geometry, nav, profile, elevation_gain_m, source), `route_proposals`, `road_objects`, `live_location_*`, volgauto-plannen/segmenten.
- **Feature flags:** o.a. `route_planner`, `climb_explorer` (gate getest: 3/3).

## 2. Bewijs van huidige werking

Testresultaten van deze audit (alle uitgevoerd op 2026-07-26, exitcode 0):

| Test | Resultaat |
|---|---|
| web `test:nav-live`, `test:navigation`, `test:route-name` | geslaagd |
| mobiel `test:route-match`, `test:nav-hud`, `test:off-route-choice`, `test:nav-cues`, `test:volgauto-meet`, `test:ride-tracker`, `test:ride-sensor-summary` | geslaagd |
| api `test:route-chain` 17/17, `test:route-proposal` 10/10, `test:route-surfaces` 24/24, `test:route-remarks` 17/17, `test:road-objects` 18/18, `test:volgauto` 18/18, `test:nav-sanitize`, `test:climb-flag-gate` 3/3 | geslaagd |

Status per functie (één label; "logica" = geautomatiseerde tests, geen live device/provider):

| Functie | Status | Onderbouwing |
|---|---|---|
| Route aanmaken | AANWEZIG_MAAR_ONBEWEZEN | Volledige keten aanwezig (`ors.ts`, `ORS_API_KEY` aanwezig); omliggende logica getest (route-proposal 10/10), maar in deze audit is geen live ORS-verzoek gedaan. |
| Route wijzigen (punten tikken/slepen) | AANWEZIG_MAAR_ONBEWEZEN | Builder-code in `route-map.tsx`; geen geautomatiseerde test. |
| Waypoints/verzamelpunten | BEWEZEN_WERKEND (logica) | `nav-sanitize`-test geslaagd; verzamelpunten in builder + volgauto-meet-tests. |
| GPS-positie | AANWEZIG_MAAR_ONBEWEZEN | Instellingen en tracker-logica getest (ride-tracker); echt device-GPS is in deze omgeving NIET_TE_VERIFIËREN. |
| Kaart volgen en vrij bewegen | AANWEZIG_MAAR_ONBEWEZEN | `map-camera.ts` aanwezig met expliciete gesture-afhandeling; devicegedrag niet meetbaar hier. |
| Handmatig zoomen | AANWEZIG_MAAR_ONBEWEZEN | Gesture→vrije modus in code; geen test. |
| Off-route-detectie | BEWEZEN_WERKEND (logica) | `test:route-match` geslaagd; concrete drempels in code (zie §1). |
| Automatische rerouting | ONTBREEKT (bewust) | Ontwerpbesluit: nooit automatisch vervangen; keuze-gebaseerde rerouting AANWEZIG en getest (`off-route-choice`). |
| Terugkeer op de route (rejoin) | BEWEZEN_WERKEND (logica) | `test:off-route-choice` geslaagd; cooldown/verplaatsingseisen in code. |
| Terug naar start | AANWEZIG_MAAR_ONBEWEZEN | Web: `requestBackToStart` (echte geroutete omweg). Mobiel: niet aangetroffen (ONTBREEKT op mobiel). Geen test. |
| Klimkaart | AANWEZIG_MAAR_ONBEWEZEN | Flag-gate getest (3/3); live Overpass-berglaag niet in deze audit opgevraagd. |
| 2D | BEWEZEN_WERKEND | Leaflet/react-native-maps renderen in de draaiende apps. |
| 3D | ONTBREEKT | Geen terrein-rendering; mobiel alleen camera-pitch 45° op rastertegels; web puur 2D. |
| Offline routecorridor | ONTBREEKT | Alleen routegeometrie/nav-stappen offline (AsyncStorage); geen tegelcorridor-download. |
| Fietsprofielen weg/gravel/MTB | BEWEZEN_WERKEND (logica) | `profile-selection.ts` mapping + `test:route-surfaces` 24/24. |

## 3. Afhankelijkheidsoverzicht (vereenvoudigd)

```
web route-map/route-navigator (Leaflet + CARTO/CyclOSM/Esri/OSM-tegels)
        │  /api/routes*, /api/routes/:id/insight, /gpx, /tcx, /volgauto
        ▼
api-server engines/route ──► lib/routing/providers/ors.ts ──► OpenRouteService (ORS_API_KEY)
        ├─► lib/route-pois.ts / route-insight.ts ─► overpass-api.de (één URL, geen mirrors)
        ├─► lib/climbs/* / road-objects/* / route-surfaces.ts / route-remarks.ts
        │        └─► Overpass-mirrors (maps.mail.ru → overpass-api.de → kumi.systems)
        ├─► lib/climbs/geocode.ts ─► nominatim.openstreetmap.org
        └─► lib/volgauto/compute.ts ─► ALLEEN maps.mail.ru (geen fallback)
mobiel navigate/[id].tsx ─► route-match.ts / off-route-choice.ts / map-camera.ts / nav-cues.ts
        └─► react-native-maps + Mapbox-rastertegels (EXPO_PUBLIC_MAPBOX_TOKEN)
```

## 4. Dubbele of parallelle logica
1. **Twee Leaflet-instanties met eigen tegellaaglogica** — `route-map.tsx` en `route-navigator.tsx` definiëren elk hun eigen tile-layers en helpers (`cumulativeKm`, `nearestIdxForKm` dubbel).
2. **Vier Overpass-implementaties** met verschillende mirror-strategieën: `climbs/overpass.ts`, `road-objects/overpass.ts`, `route-surfaces.ts` (elk 3 mirrors) versus `route-pois.ts` en `route-insight.ts` (alleen `overpass-api.de`) versus `volgauto/compute.ts` (alleen `maps.mail.ru`). Geen gedeelde Overpass-client.
3. **Twee positiebronnen-implementaties** web (`watchPosition` in route-navigator) en mobiel (`useLiveLocation`); route-match-logica is bewust byte-gespiegeld web↔mobiel (gedeeld ontwerp, aparte bestanden).
