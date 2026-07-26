# Sparki Providerregister — kaarten, navigatie en aanverwante databronnen

Opdracht RN_01A2, 26 juli 2026. Vervolg op de navigatie-audit RN_01A
(`docs/SPARKI_RN_01A_PROVIDER_RISK.md`). Dit register is de centrale inventaris van
álle externe kaart-, navigatie- en aanverwante dataproviders die in de code zijn
aangetroffen. Alleen documentatie — er is geen productiecode gewijzigd, geen provider
vervangen of toegevoegd.

Legenda accountstatus: **BEWEZEN** (uit repo/config aantoonbaar), **ONBEKEND**
(vereist controle door René in het account zelf), **N.V.T.** (sleutelloze publieke dienst).

---

## 1. Mapbox — rastertegels mobiele app

- **Functie:** enige kaartachtergrond in de mobiele app (stijl `dark-v11`, 512 px @2x rastertegels via `react-native-maps` UrlTile).
- **Bestanden:** `artifacts/sparki-mobile/lib/mapbox.ts` (URL + token), `components/TrackMap.tsx`, `components/RouteMap.tsx`, `components/VolgautoDriverMode.tsx`; schermen `app/(app)/record.tsx`, `app/(app)/ride/[id].tsx`, `app/(app)/navigate/[id].tsx`; buildcontrole `scripts/build.js`, `scripts/check-prod-config.mjs`.
- **Endpoint:** `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}@2x`.
- **Platform:** alleen mobiel. Web gebruikt géén Mapbox.
- **Sleutel:** publiek token via `EXPO_PUBLIC_MAPBOX_TOKEN` (bewust client-zichtbaar; normaal model bij Mapbox-publiekstokens). In de werkruimte bestaat ook een secret `MAPBOX_ACCESS_TOKEN`; welk token bij welk Mapbox-account hoort is ONBEKEND → accountchecklist.
- **Account-tier/limieten:** ONBEKEND. Raster Tiles API wordt per tegelverzoek gefactureerd; bij continue navigatie (pannen/zoomen) loopt dit op. Officiële bron: https://docs.mapbox.com/api/maps/raster-tiles/ en https://www.mapbox.com/pricing.
- **Commercieel gebruik:** toegestaan binnen de Mapbox Terms of Service, mits binnen het accountplan en mét verplichte attributie.
- **Verplichte attributie (officieel, https://docs.mapbox.com/help/dive-deeper/attribution/):** twee onderdelen — (1) het **Mapbox-logo** op de kaart zelf, en (2) **tekst-attributie** met minimaal drie klikbare links: `© Mapbox`, `© OpenStreetMap`, `Improve this map`. **In de mobiele app is GEEN van beide aanwezig** (grep op OpenStreetMap/©/logo in `artifacts/sparki-mobile`: nul treffers). Dit is releaseblokkade RB-2 uit RN_01A. Wijzigingsspecificatie: `docs/SPARKI_ATTRIBUTION_IMPLEMENTATION_SPEC.md`.
- **Caching/offline:** alleen toevallige OS-cache; bewust vooraf downloaden van tegels telt bij Mapbox per tegel in de facturering en vereist de daarvoor bestemde offline-API's. Er is nu géén offline caching gebouwd (en dat blijft zo in deze opdracht).
- **Privacy/log:** tegelverzoeken bevatten positie (tegelcoördinaten) + token; gaat rechtstreeks van het toestel naar Mapbox.
- **Fallback:** zonder token is `hasMapbox=false` en zegt de UI dat eerlijk (geen kapotte kaart). Geen tweede tegelbron op mobiel.
- **Schaalrisico:** kosten per tegel bij navigatiegebruik; werkelijke volumes NIET_TE_VERIFIËREN (geen metrics).
- **Beslissing René:** accountplan + maandbudget vaststellen; bevestigen dat het token bij het juiste (commerciële) account hoort.

## 2. OpenRouteService (ORS) — alle routeberekening

- **Functie:** álle routegeometrie, turn-by-turn-stappen, hoogteprofielen en geocoding voor routeplanning (web én mobiel, via de eigen api-server).
- **Bestanden:** `artifacts/api-server/src/lib/routing/providers/ors.ts`, `routing/index.ts`, `routing/types.ts`, `routing/loop-quality.ts`; health-probe `lib/health/checks.ts`.
- **Endpoints:** `api.openrouteservice.org` — `/v2/directions/{profile}/geojson`, `/v2/directions/{profile}/round_trip`, `/geocode/search`, `/geocode/reverse`.
- **Sleutel:** `ORS_API_KEY` (server-side secret; alleen aanwezigheid gecontroleerd, waarde nooit getoond).
- **Account-tier/limieten:** tier ONBEKEND (releaseblokkade RB-3 uit RN_01A). Officiële per-verzoek-restricties (https://openrouteservice.org/restrictions/, opgehaald 26-07-2026): fietsroutes max 6.000 km; **alternatieve routes en round-trip max 100 km**; met vermijdgebieden max 150 km; max 50 waypoints; max 3 alternatieven; hoogte max 2.000 punten. Dag-/minuutquota zijn plan-afhankelijk en alleen in het ORS-dashboard zichtbaar → accountchecklist. Let op: de round-trip-limiet van 100 km raakt de lusgenerator direct.
- **Commercieel gebruik:** ORS (HeiGIT) hanteert een freemium-model; voorwaarden en toegestaan commercieel gebruik per plan staan op https://openrouteservice.org/plans/ en in de Terms of Service — welke voorwaarden op het huidige account van toepassing zijn is ONBEKEND.
- **Attributie:** ORS levert data op basis van OpenStreetMap (ODbL); bij weergave van routes op OSM-gebaseerde kaarten dekt de bestaande OSM-attributie dit af. Geen apart ORS-logo vereist volgens de aangetroffen documentatie; expliciete plan-voorwaarden controleren.
- **Caching/offline:** geen server-side caching van directions-antwoorden; routegeometrie wordt wel als eigen route opgeslagen na acceptatie (dat is eigen data-opslag, geen tegelcaching).
- **Privacy/log:** start-/eindpunten en waypoints van gebruikers gaan naar HeiGIT (Duitsland).
- **Fallback:** `isConfigured()` faalt eerlijk zonder sleutel; 429/quota → eerlijke Nederlandse melding, geen retry/backoff.
- **Schaalrisico:** grootste operationele afhankelijkheid — best-of-N luskandidaten en rejoin-berekeningen vermenigvuldigen het aantal calls per gebruikersactie.
- **Beslissing René:** tier + daglimieten vaststellen; besluiten of een betaald plan of eigen ORS-backend nodig is vóór schaal.

## 3. CARTO basemaps — standaard webkaart

- **Functie:** standaard kaartachtergrond op ALLE webkaarten (Voyager licht, Dark Matter donker).
- **Bestanden:** `artifacts/sparki/src/components/sparki/route-map.tsx`, `route-explorer.tsx`, `route-discover.tsx`, `route-navigator.tsx`, `location-picker-map.tsx`.
- **Endpoint:** `https://{s}.basemaps.cartocdn.com/...` (zonder account of sleutel).
- **Platform:** alleen web.
- **Account-tier:** N.V.T./ONBEKEND — er is géén CARTO-account of -overeenkomst in de repo aantoonbaar.
- **Commercieel gebruik:** **officieel NIET toegestaan zonder Enterprise-licentie.** CARTO-FAQ (https://docs.carto.com/faqs/carto-basemaps, opgehaald 26-07-2026): "For commercial purposes, you will need an Enterprise license in order to use the CARTO Basemaps." Gratis gebruik is voor niet-commerciële toepassingen. Dit is de kern van releaseblokkade RB-1 uit RN_01A.
- **Attributie:** aanwezig in code: `© OpenStreetMap © CARTO` met klikbare links, op alle vijf kaartcomponenten (Leaflet attributionControl).
- **Caching/offline:** geen; browsercache alleen.
- **Privacy/log:** tegelverzoeken (positie) gaan rechtstreeks vanuit de browser naar CARTO-CDN.
- **Fallback:** geen automatische fallback; in de navigator kan de gebruiker handmatig een andere laag kiezen.
- **Beslissing René:** vóór commerciële lancering: CARTO Enterprise-contract afsluiten óf overstappen op een gecontracteerde tegelbron (bestaat als latere, aparte bouwopdracht; hier alleen vastgelegd).

## 4. OSM-standaardtegels — handmatige weblaag

- **Functie:** door de gebruiker te kiezen kaartlaag "OpenStreetMap" in de routenavigator (web).
- **Bestand:** `artifacts/sparki/src/components/sparki/route-navigator.tsx` (regel ±155).
- **Endpoint:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
- **Account-tier:** N.V.T. (publieke, door donaties gefinancierde server; geen SLA).
- **Commercieel gebruik:** de officiële OSMF Tile Usage Policy (https://operations.osmfoundation.org/policies/tiles/, opgehaald 26-07-2026) staat zwaar/grootschalig commercieel gebruik niet toe: capaciteit is beperkt, blokkade kan zonder aankondiging. Eisen: zichtbare licentie-attributie, geldige identificerende User-Agent, geldige HTTP Referer vanaf webpagina's, respecteer cache-headers (≥7 dagen), NOOIT bulk-download/prefetch.
- **Attributie:** `© OpenStreetMap`-link aanwezig in de laagconfiguratie.
- **Naleving onzeker:** de browser stuurt zijn eigen User-Agent (niet app-specifiek; voor webpagina's accepteert de policy een geldige Referer — controleer dat er geen restrictieve Referrer-Policy actief is). NIET geverifieerd in deze audit.
- **Beslissing René:** laag behouden als niet-standaard optie (licht gebruik) of verwijderen/vervangen bij commerciële schaal.

## 5. CyclOSM — fietskaartlaag web

- **Functie:** door de gebruiker te kiezen fietskaartlaag in de routenavigator (web).
- **Bestand:** `artifacts/sparki/src/components/sparki/route-navigator.tsx` (regel ±162).
- **Endpoint:** `https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png`.
- **Account-tier:** N.V.T. — vrijwilligersserver van OpenStreetMap-France onder fair-use-beleid, géén SLA; niet bedoeld voor commercieel productiegebruik (https://openmaps.fr/tile-usage-policy.html).
- **Attributie:** aanwezig in de laagconfiguratie (OSM + CyclOSM).
- **Risico:** kan zonder aankondiging wegvallen of throttlen; zelfde beslissing als bij OSM-tegels.

## 6. Esri World Imagery — satellietlaag web

- **Functie:** door de gebruiker te kiezen satellietlaag in de routenavigator (web).
- **Bestand:** `artifacts/sparki/src/components/sparki/route-navigator.tsx` (regel ±169).
- **Endpoint:** `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`.
- **Account-tier:** ONBEKEND — geen ArcGIS-account of -overeenkomst in de repo aantoonbaar.
- **Commercieel gebruik:** volgens Esri-voorwaarden (https://www.esri.com/en-us/legal/terms/web-site-service) is kosteloos gebruik beperkt tot niet-inkomstengenererende toepassingen mét attributie; commercieel gebruik vereist een ArcGIS-licentie.
- **Attributie:** aanwezig in code: "© Esri, Maxar, Earthstar Geographics, and the GIS User Community".
- **Beslissing René:** satellietlaag schrappen, of ArcGIS-account/licentie regelen vóór commerciële lancering.

## 7. Overpass API — OpenStreetMap-data (drie publieke instanties)

- **Functie:** klimmenverkenner, wegobjecten (o.a. verkeerslichten), wegtypen/ondergrond, route-opmerkingen, POIs, route-inzicht, volgauto-parkeerplaatsen.
- **Bestanden & instantiestrategieën (inconsistent, bewust vastgelegd):**
  - Mirror-rotatie maps.mail.ru → overpass-api.de → overpass.kumi.systems: `lib/climbs/overpass.ts`, `lib/road-objects/overpass.ts`, `lib/route-surfaces.ts`, `lib/route-remarks.ts`.
  - Alleen overpass-api.de (geen fallback): `lib/route-pois.ts`, `lib/route-insight.ts`.
  - Alleen maps.mail.ru (geen fallback): `lib/volgauto/compute.ts`.
- **Account-tier:** N.V.T. — publieke instanties zonder contract of SLA.
- **Commercieel gebruik:** publieke Overpass-instanties zijn bedoeld voor gematigd gebruik; zwaar of commercieel gebruik kan zonder aankondiging worden gethrottled of geweigerd (OSM-wiki, https://wiki.openstreetmap.org/wiki/Overpass_API). Voor schaal: eigen instantie of commerciële aanbieder.
- **Attributie:** OSM-data is ODbL; verwijzing naar openstreetmap.org/copyright aanwezig in `route-surfaces.ts` en `route-remarks.ts`. Voor Overpass-afgeleide inhoud elders (klimmen, POIs) dekt de kaart-attributie dit deels; zie attributiespecificatie.
- **Caching:** in-memory (POIs 6 u, klimmen 30 min, road-objects per bbox 6 u) — verdwijnt bij herstart; alleen `road_objects` is persistent.
- **Privacy/log (aandachtspunt):** bij de mirror-strategie gaan bounding boxes rond gebruikersroutes/-posities naar **maps.mail.ru** (VK, Rusland) als eerste keus; de volgauto-functie gebruikt zelfs uitsluitend maps.mail.ru. Er gaat geen naam of account mee, maar wél locatiegebied. Beslissing voor René: is dat acceptabel, of moet de voorkeursvolgorde anders (aparte, kleine bouwopdracht)?
- **Fallback:** timeouts 15–25 s; bij rotatie eerlijk door naar volgende mirror; zonder rotatie eerlijke foutmelding.
- **Schaalrisico:** grootste operationele wankelheid (RN_01A): drie faalstrategieën, vluchtige caches, geen contract.

## 8. Nominatim — geocoding klimmenverkenner

- **Functie:** vrije-tekst plaats/gebied → coördinaten + zoekgebied voor de klimmenverkenner.
- **Bestanden:** `artifacts/api-server/src/lib/climbs/geocode.ts` via `lib/climbs/http.ts`.
- **Endpoint:** `https://nominatim.openstreetmap.org/search`.
- **Account-tier:** N.V.T. — publieke OSMF-dienst.
- **Officiële eisen (https://operations.osmfoundation.org/policies/nominatim/, opgehaald 26-07-2026):** absoluut maximum **1 verzoek/seconde**; geldige identificerende User-Agent of Referer (standaard-bibliotheek-UA's volstaan niet); zichtbare attributie; geen bulk-geocoding; app moet zonder software-update naar een andere dienst kunnen wisselen; data onder ODbL.
- **Naleving nu:** User-Agent aanwezig én identificerend: `Mozilla/5.0 (compatible; SparkiKlimmen/1.0; +https://sparki.app)` ✔. Een expliciete 1-req/s-begrenzer is NIET aangetroffen (gebruik is licht: één geocode per zoekopdracht, dus feitelijk laag risico — maar niet technisch afgedwongen). Endpoint is hard-coded (wissel vereist deploy) — beperkt strijdig met "switchable"-aanbeveling; vastgelegd, niet gewijzigd.
- **Commercieel gebruik:** licht gebruik toegestaan binnen de policy; bulk/zwaar gebruik niet. Bij schaal: eigen Nominatim of commerciële geocoder.

## 9. Open-Meteo — weerdata

- **Functie:** enige weerbron: dag-/uurvoorspellingen voor thuislocatie, races en advies (server-side, `lib/weather/*`), plus **rechtstreekse client-side call** voor actuele wind in de webnavigator (`route-navigator.tsx` regel ±1691).
- **Endpoint:** `https://api.open-meteo.com/v1/forecast` (gratis endpoint, sleutelloos).
- **Account-tier:** N.V.T. (nu); geen abonnement aantoonbaar.
- **Commercieel gebruik:** **de gratis API is uitsluitend voor niet-commercieel gebruik** (officiële Terms, https://open-meteo.com/en/terms, opgehaald 26-07-2026): max 10.000 calls/dag, 5.000/uur, 600/min; CC BY 4.0-attributie verplicht; apps met abonnementen of advertenties gelden expliciet als commercieel. Zodra Sparki commercieel wordt (abonnementen zijn voorzien in het entitlement-fundament), is een betaald Open-Meteo API-abonnement vereist (ander endpoint + sleutel). **Nieuw bevonden releaseaandachtspunt — stond niet in RN_01A.**
- **Attributie:** CC BY 4.0-bronvermelding voor weergegeven weerdata is verplicht; in de UI is geen Open-Meteo-vermelding aangetroffen (NIET geverifieerd op alle schermen; zie attributiespecificatie).
- **Fallback:** bij falen null/leeg — eerlijk geen weer, nooit verzonnen (server); client-side windcall faalt stil (wind verschijnt dan niet).
- **Privacy/log:** afgeronde coördinaten (3 decimalen ≈ 111 m) gaan naar Open-Meteo; bij de client-side call rechtstreeks vanuit de browser.

## 10. Wikipedia REST + Wikidata — klimomschrijvingen

- **Functie:** echte omschrijvingen van cols/klimmen waar die bestaan (klimmenverkenner).
- **Bestanden:** `artifacts/api-server/src/lib/climbs/*` via `http.ts`-allowlist (`*.wikipedia.org`, `www.wikidata.org`).
- **Licenties:** Wikipedia-tekst CC BY-SA (naamsvermelding + gelijk delen), Wikidata CC0. Bronlabels bestaan in de web-UI (`climb-types.ts`: "Wikipedia", "Wikidata"); of de weergave overal aan CC BY-SA-naamsvermelding met link voldoet is NIET per scherm geverifieerd → attributiespecificatie.
- **Account/limieten:** N.V.T.; identificerende User-Agent aanwezig (zelfde `SparkiKlimmen/1.0`).

---

## Buiten scope van dit register

Geen kaart-/navigatieproviders, dus hier alleen benoemd: Strava (activiteitenimport, eigen OAuth-voorwaarden), Resend (e-mail), Clerk (auth), Anthropic/AI-gateway (modelaanroepen), Fietssport/We-Tri/KNWU (kalenderimport), arXiv (kennisbank). Die vallen onder de bestaande integratie-audits.

## Samenvattend: de drie releaseblokkades uit RN_01A, nu controleerbaar gemaakt

1. **RB-1 tegelrechten web:** CARTO vereist aantoonbaar een Enterprise-licentie voor commercieel gebruik; OSM/CyclOSM-policy staat commerciële schaal niet toe; Esri vereist licentie. → Accountchecklist + beslissing.
2. **RB-2 Mapbox/OSM-attributie mobiel:** officieel verplicht (logo + tekst), aantoonbaar volledig afwezig. → Implementatiespecificatie klaar; bouwen alleen met aparte goedkeuring.
3. **RB-3 ORS-tier:** per-verzoek-limieten nu officieel gedocumenteerd; dag-/minuutquota staan alleen in het ORS-dashboard. → Accountchecklist.
4. **Nieuw (RN_01A2): Open-Meteo** gratis endpoint is niet-commercieel-only — vóór commerciële lancering abonnement + attributie regelen.
