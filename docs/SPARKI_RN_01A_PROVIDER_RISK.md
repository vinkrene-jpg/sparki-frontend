# RN_01A — Provider-, licentie- en schaalrisico

Audit 2026-07-26, commit `149b37da`. Alleen aantoonbare feiten; wat niet uit repo,
configuratie of officiële bron blijkt, staat expliciet als NIET_TE_VERIFIËREN.

## OpenRouteService (ORS)
- **Gebruik:** alle routegeometrie, turn-by-turn, hoogte, geocoding. Endpoints: `/v2/directions/{profile}/geojson`, `/v2/directions/{profile}/round_trip`, `/geocode/search`, `/geocode/reverse` (`src/lib/routing/providers/ors.ts`; health-probe in `src/lib/health/checks.ts`).
- **Sleutel:** `ORS_API_KEY` — aanwezig als secret (alleen aanwezigheid gecontroleerd). `isConfigured()` faalt eerlijk zonder sleutel.
- **Account-tier/limieten:** NIET_TE_VERIFIËREN uit de repository. Nergens vastgelegd welk plan hoort bij de sleutel. Actie vóór schaal: tier + daglimieten bij het ORS-account zelf vaststellen.
- **Rate-limit-gedrag:** 429/quota wordt afgevangen met een eerlijke Nederlandse melding ("routeservice is even overbelast", r. 125–127). Geen automatische retry/backoff aangetroffen; geen server-side caching van directions-antwoorden.
- **Schaalrisico:** routegeneratie met best-of-N luskandidaten en rejoin-berekeningen vermenigvuldigt het aantal directions-calls per gebruikersactie. Bij productieschaal is dit de eerste limiet die knelt. Verwachte productiebelasting: NIET_TE_VERIFIËREN (geen telemetrie van calls per dag aangetroffen).

## Overpass API (OpenStreetMap-data)
- **Gebruik:** klimmen, wegobjecten (verkeerslichten e.d.), wegtypen/surfaces, route-opmerkingen, POIs, route-insight, volgauto-parkeerplaatsen.
- **Endpoints (publiek, zonder contract of SLA):**
  - Met mirror-rotatie (maps.mail.ru → overpass-api.de → kumi.systems): `lib/climbs/overpass.ts`, `lib/road-objects/overpass.ts`, `lib/route-surfaces.ts`, `lib/route-remarks.ts`.
  - Zonder fallback, alleen `overpass-api.de`: `lib/route-pois.ts`, `lib/route-insight.ts`.
  - Zonder fallback, alleen `maps.mail.ru`: `lib/volgauto/compute.ts`.
- **Timeouts:** 15–25 s per call; bij falen volgende mirror (waar rotatie bestaat).
- **Caching:** in-memory — POIs 6 u, klimmen 30 min, road-objects-sync per bbox 6 u. In-memory cache verdwijnt bij elke herstart/deploy; geen persistente providercache behalve de `road_objects`-tabel.
- **Risico:** publieke Overpass-instanties throttlen of weigeren zwaar/commercieel gebruik zonder aankondiging. De drie verschillende mirror-strategieën maken het faalgedrag inconsistent (volgauto valt bij een mail.ru-storing direct uit; POIs bij een overpass-api.de-storing). Attributie: ODbL-verwijzing aanwezig in `route-surfaces.ts` en `route-remarks.ts` (link naar openstreetmap.org/copyright).

## Nominatim (geocoding voor klimmen)
- **Gebruik:** `lib/climbs/geocode.ts` → `nominatim.openstreetmap.org/search` (publiek).
- **Risico:** de officiële Nominatim-gebruiksvoorwaarden eisen o.a. max 1 verzoek/s en een identificerende User-Agent; naleving daarvan is in deze audit NIET geverifieerd. Bulk-/commercieel gebruik van de publieke instantie is niet toegestaan volgens de officiële usage policy.

## Mapbox (mobiele tegels)
- **Gebruik:** alleen client-side rastertegels in de mobiele app (`lib/mapbox.ts`, style `dark-v11`, 512 px @2x). Token via `EXPO_PUBLIC_MAPBOX_TOKEN` (bewust client-zichtbaar; dit is bij Mapbox-publiekstokens het normale model). Geen server-side Mapbox-gebruik.
- **Account-tier/limieten:** NIET_TE_VERIFIËREN uit de repository.
- **Attributie:** verplichte Mapbox/OSM-attributie op de mobiele kaart is in de code NIET aangetroffen — controlepunt vóór release.
- **Kosten:** raster tiles 512@2x tellen per tegel; bij navigatie (continu pannen) loopt dit op. Werkelijke aantallen: NIET_TE_VERIFIËREN (geen metrics).

## CARTO basemaps (web standaard/donker)
- **Gebruik:** `basemaps.cartocdn.com` (Voyager + Dark Matter) in alle web-kaarten; attributiestring aanwezig.
- **Risico:** de gratis CARTO-basemaps zijn volgens CARTO's voorwaarden bedoeld voor niet-commercieel/beperkt gebruik; er is geen CARTO-account of -overeenkomst in de repo aantoonbaar. Vóór commerciële lancering: voorwaarden vaststellen of overstappen op een gecontracteerde tegelbron. NIET_TE_VERIFIËREN: huidig gebruiksvolume.

## OSM-tegelservers (fallback + CyclOSM) en Esri
- `tile.openstreetmap.org`: publieke server; de OSMF tile usage policy ontmoedigt zwaar/commercieel gebruik expliciet.
- `tile-cyclosm.openstreetmap.fr`: vrijwilligersserver, geen SLA.
- Esri World Imagery: gebruik valt onder Esri-voorwaarden (vereist normaliter een ArcGIS-account/attributie); overeenkomst NIET aantoonbaar in repo.

## Samenvattend risicobeeld
1. **Grootste afhankelijkheid:** ORS voor álle routegeometrie — één sleutel, geen retry/caching, tier onbekend.
2. **Grootste juridische onzekerheid:** tegelbronnen op web (CARTO/OSM/CyclOSM/Esri) zonder aantoonbare commerciële voorwaarden; Mapbox-attributie mobiel niet aangetroffen.
3. **Grootste operationele wankelheid:** publieke Overpass-endpoints met drie verschillende faalstrategieën en alleen vluchtige in-memory caches.
4. Foutgedrag is overal eerlijk (Nederlandse melding, nooit gefabriceerde data) — dat deel is op orde.
