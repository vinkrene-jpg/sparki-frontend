# Sparki — Productoverzicht

**Peildatum:** 23 juli 2026 · **Branch:** `main` · Onderdeel van de reviewbundel (`docs/SPARKI_REVIEW_BUNDLE.zip`).

## Wat is Sparki nu?

Sparki is een **Nederlandstalig, productie-rijp wielerplatform** (web + mobiele app + API) voor renners, coaches, ouders/verzorgers en clubs. Het combineert:

1. **Dagelijkse coaching** — een deterministische coach-engine (observaties, dagtype, State Card, Core-voorspelling) waarbij een taalmodel uitsluitend formuleert en nooit rekent of verzint.
2. **Training & planning** — autonome planbouw, coach-cockpit met voorstellen-workflow (Sparki overschrijft coachwerk nooit), feedbacklus, Data Hub met multi-bron-ingest (Strava OAuth, GPX/FIT/TCX, handmatig) en per-veld herkomst.
3. **Wedstrijdintelligence** — kalenderimport, technische-gids-analyse met kaartcontrole, course-points-export (GPX/FIT met round-trip-verificatie), mobiele wedstrijdmodus, volgauto-planning.
4. **Routes & navigatie** — ORS-generatie, OSM-verrijking (opmerkingen, wegtypen, geschiktheid racefiets/gravel/MTB, klimmen, POI's), interactief hoogteprofiel gekoppeld aan de kaart, mobiele turn-by-turn met BLE-sensoren, val-alarm en live locatie delen.
5. **Omgevingen per rol** — coach-cockpit, ouderomgeving (fail-closed rechtenlaag), clubomgeving (least-privilege), admin met echte Health-Check-engine.
6. **Ondersteunend** — voeding (RED-S-veilig), Mechanieker + fietsscan, Journey, sociaal, kennisbank, AI-helpdesk, contextuele uitleglaag, meldingen (in-app/push; e-mail eerlijk beperkt).

**Productdoctrine, afdwongen in code en tests:** eerlijke gaten (nooit gefabriceerde data), privacy fail-closed voor minderjarigen, plain Dutch, deterministische kern + LLM alleen voor proza.

**Omvang:** 4 werkruimtes, 161 databasetabellen, 74 API-routebestanden, 38 engines, 38 webpagina's, 12 mobiele schermen, ±130 testsuites (details: `docs/SPARKI_TECHNICAL_INVENTORY.md`).

## Vijf sterkste onderdelen

1. **Eerlijkheidsarchitectuur** — het hele product weigert nep-data: Health Check "echt proben of grijs", export-round-trip-verificatie, eerlijke lege staten met actieknoppen (Smart Missing Input Flow). Dit is structureel, niet cosmetisch.
2. **Privacy- en rollenmodel** — fail-closed rechtenlagen voor ouders/minderjarigen/clubs, sharing-niveaus, consent-audit-log, cross-account-isolatie met eigen testsuites.
3. **Wedstrijdketen** — gids-upload → puntvoorstellen → kaartcontrole → gevalideerde FIT/GPX-export → mobiele wedstrijdmodus: een complete, geteste keten die weinig consumentenapps bieden.
4. **Route-intelligentie** — echte OSM/ORS-data (opmerkingen, wegtypen, geschiktheid per fietstype, klimmen, volgauto) met transparante bronvermelding en deterministische engines.
5. **Testdiscipline** — vrijwel elke module heeft een end-to-end-scenario-suite tegen de echte Express-app en database (deze review draaide 19 suites, ≈243 scenario's, alles groen).

## Vijf grootste risico's

Zie `docs/SPARKI_RISKS_AND_GAPS.md` voor de volledige lijst; samengevat:

1. **Externe afhankelijkheden zonder contract** — Overpass/ORS/Open-Meteo zijn publieke diensten zonder SLA; storing degradeert route-verrijking (eerlijk getoond, maar wel functieverlies).
2. **E-mailbezorging niet operationeel** — geen geverifieerd verzenddomein; herinneringen per e-mail bereiken alleen de accounteigenaar.
3. **Garmin/Wahoo-sync wacht op fabrikantsleutels** — volledig voorbereid maar niet actief; voor veel wielrenners een kernverwachting.
4. **Operationele processen leunen op handmatige Scheduled Deployments** — nachtelijke scan, doelen-review en health-jobs moeten als geplande deployments zijn ingericht; ontbreekt dat, dan roteert alleen de lazy-refresh vangnetlaag.
5. **Onderhoudsconcentratie** — grote, samenhangende codebase (161 tabellen, 38 engines) met veel domeinregels in `replit.md`/geheugen; inwerktijd voor nieuwe ontwikkelaars is aanzienlijk.

## Modulestatus in aantallen (uit `docs/SPARKI_MODULE_STATUS.md`)

- **Volledig:** 33 modules
- **Gedeeltelijk (eerlijk beperkt):** 2 — e-mailmeldingen (sandbox), BLE-sensoren (alleen native build)
- **Voorbereid:** 1 — Garmin/Wahoo device-sync (geen fabrikantsleutels)
- **Placeholder / niet bereikbaar:** 0
