# Accountchecklist providers — voor René

Opdracht RN_01A2, 26 juli 2026. Dit zijn de controles die alleen jij kunt doen,
omdat ze in de accounts zelf zitten en niet in de code. **Plak nooit sleutels,
tokens of wachtwoorden in documenten of chat** — noteer alleen de antwoorden
(plannaam, limiet, ja/nee).

---

## 1. Mapbox — account.mapbox.com

Log in op https://account.mapbox.com en controleer:

- [ ] **Actief abonnement:** welk plan staat er (Pay-as-you-go of contract)? Staat er een betaalmethode op het account?
- [ ] **Tokens:** onder *Tokens* — hoort het publieke token dat de mobiele app gebruikt (`pk.…`) bij dít account? Zijn er URL-/app-restricties op het token gezet? (Aanbevolen: restrictie op de app-bundle-id zodra die vastligt.)
- [ ] **Verbruik & limieten:** onder *Statistics/Usage* — hoeveel "Raster Tiles API requests" per maand nu, en waar ligt de gratis grens van het plan? Elke tegel telt; navigatie op mobiel is de grootste verbruiker.
- [ ] **Commercieel gebruik:** het standaard Mapbox-plan staat commercieel gebruik toe — bevestig dat er geen speciale voorwaarden (educatie/non-profit) op het account staan.
- [ ] **Offline/caching:** wij bouwen nu géén offline tegels. Als dat ooit gewenst is: alleen via Mapbox' offline-API's, telt in facturering.
- [ ] **Facturatie-/overschrijdingsrisico:** staat er een uitgavenlimiet of alert ingesteld? (Aanbevolen: budgetalert instellen vóór lancering.)

## 2. OpenRouteService — openrouteservice.org (dashboard)

Log in op het ORS-dashboard (account waarmee `ORS_API_KEY` is aangemaakt):

- [ ] **Plan/tier:** welk plan staat er bij de sleutel (Standard/Collaborative/betaald)? Dit is releaseblokkade RB-3 — zonder dit antwoord is productieschaal niet te beoordelen.
- [ ] **Dag- en minuutquota:** het dashboard toont per endpoint (directions, geocoding, elevation) de quota per dag en per minuut. Noteer die getallen.
- [ ] **Commercieel gebruik:** controleer in de plan-voorwaarden (https://openrouteservice.org/plans/) of het huidige plan commercieel gebruik dekt, of dat daarvoor een betaald plan/contact met HeiGIT nodig is.
- [ ] **Verbruik:** hoeveel directions-calls per dag nu? De lusgenerator doet meerdere calls per gebruikersactie — reken met factor 5–10 per routeaanvraag.
- [ ] **Domein-/appbeperkingen:** staan er restricties op de sleutel?
- [ ] **Let op (uit officiële restricties):** round-trip en alternatieve routes zijn beperkt tot 100 km — relevant voor lange lusroutes, los van het plan.

## 3. CARTO — geen account aanwezig (beslissing nodig)

Er ís geen CARTO-account in gebruik; de webkaarten gebruiken de open basemap-CDN.

- [ ] **Beslissing:** CARTO's officiële FAQ zegt dat commercieel gebruik een Enterprise-licentie vereist. Kies vóór commerciële lancering: (a) Enterprise-contract aanvragen via https://carto.com/pricing/, of (b) overstappen op een andere gecontracteerde tegelbron (bijv. Mapbox ook op web — één contract voor alles). Dit is releaseblokkade RB-1.
- [ ] Tot die keuze: geen actie in een account mogelijk; er is niets te controleren.

## 4. OSM-standaardtegels & CyclOSM — geen account (beslissing nodig)

Publieke vrijwilligersservers; er bestaat geen account of contract.

- [ ] **Beslissing:** deze twee handmatige kaartlagen in de navigator behouden (licht gebruik, geen garantie) of schrappen zodra er een gecontracteerde bron is? De OSMF-policy staat commerciële schaal niet toe.

## 5. Esri World Imagery — arcgis.com

- [ ] **Account:** is er ergens een (gratis developer-)ArcGIS-account? In de code is niets aantoonbaar.
- [ ] **Commercieel gebruik:** gratis gebruik is beperkt tot niet-inkomstengenererende apps. Beslissing: satellietlaag schrappen, of ArcGIS Location Platform-account met passend plan aanmaken en de voorwaarden voor World Imagery controleren (https://www.esri.com/en-us/legal/terms/web-site-service).

## 6. Open-Meteo — geen account (abonnement nodig bij commerciële start)

- [ ] **Nu:** gratis sleutelloos endpoint, uitsluitend toegestaan voor niet-commercieel gebruik (max 10.000 calls/dag). Zolang Sparki in besloten test draait zonder betalende gebruikers is dat verdedigbaar; **zodra abonnementen actief worden is een API-abonnement verplicht** (https://open-meteo.com/en/pricing).
- [ ] **Beslissing:** abonnement afsluiten vóór commerciële lancering; dat geeft een eigen endpoint + sleutel (kleine, aparte bouwopdracht om die te gebruiken).
- [ ] **Attributie:** CC BY 4.0-bronvermelding "Weergegevens: Open-Meteo.com" hoort zichtbaar te zijn waar weer getoond wordt — staat in de attributiespecificatie.

## 7. Overpass / Nominatim / Wikipedia / Wikidata — geen accounts

Publieke diensten zonder registratie; er is niets in een account te controleren.

- [ ] **Beslissing (privacy):** de Overpass-mirrorvolgorde zet maps.mail.ru (VK, Rusland) op de eerste plaats en de volgauto-functie gebruikt uitsluitend die server. Er gaat geen naam mee, wel het gebied van de route. Akkoord, of volgorde wijzigen (kleine, aparte bouwopdracht)?
- [ ] **Bij schaal:** eigen Overpass-instantie of commerciële aanbieder overwegen; publieke servers mogen zwaar gebruik weigeren.

---

## Samenvatting: wat blokkeert commerciële lancering

| # | Punt | Waar |
|---|------|------|
| 1 | CARTO-basemaps zonder Enterprise-licentie (web-standaardkaart) | beslissing + evt. contract |
| 2 | Mapbox/OSM-attributie ontbreekt volledig op mobiel | bouwopdracht (spec ligt klaar) |
| 3 | ORS-tier en dagquota onbekend | ORS-dashboard |
| 4 | Open-Meteo gratis endpoint is niet-commercieel-only | abonnement bij lancering |
| 5 | Esri-satellietlaag zonder licentie | beslissing (schrappen of licentie) |
