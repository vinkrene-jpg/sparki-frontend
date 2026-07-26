# Eindrapport en consistentiecontrole — audits DT_01A en RN_01A2

**Datum:** 26 juli 2026 · **Aard:** uitsluitend review en rapportage — geen productiecode,
data, configuratie of runtimegedrag gewijzigd. Alle onderliggende bestanden zijn
opnieuw gelezen en onderling vergeleken; feitelijke claims zijn steekproefsgewijs
tegen de code en git-status herverifieerd.

---

## 1. Samenvatting

Beide audits zijn volledig opgeleverd, onderling consistent en door de architect-review
met PASS beoordeeld. DT_01A toont aan dat Sparki nergens nep- of demodata als
persoonlijke gebruikersdata toont; er resteren drie productie-aandachtspunten
(P01–P03) die uitsluitend ná menselijke bevestiging via het bestaande
droogdraai-mechanisme opgeschoond mogen worden. RN_01A2 legt vier
provider-/licentieblokkades voor commerciële lancering vast (CARTO, mobiele
attributie, ORS-tier, Open-Meteo) met officiële bronnen en een kant-en-klare
attributiebouwspec. Productiecode en productiegegevens zijn in beide opdrachten en
in deze eindreview onaangeraakt. Advies: **GO_MET_VOORWAARDEN** (§15).

## 2. Status DT_01A — controle nep-, demo- en foutieve gebruikersdata

Alle vier bestanden bestaan, zijn compleet en komen onderling overeen:

| Bestand | Status |
|---|---|
| `docs/SPARKI_DATA_TRUST_AUDIT.md` | ✔ compleet (alle verplichte scopegebieden + stopregelbeoordeling) |
| `docs/SPARKI_MOCK_DATA_INVENTORY.csv` | ✔ 34 items, 12 kolommen, 9-klassenmodel |
| `docs/SPARKI_DATA_TRUST_DRY_RUN.json` | ✔ tellingen sluiten aan op CSV (9+7+7+5+2+2+1+1+0 = 34) |
| `docs/SPARKI_DATA_TRUST_EVIDENCE.json` | ✔ controles, testresultaat 17/17, dev- en prod-bevindingen |

Consistentie: de drie productiebevindingen (P01/P02/P03) staan identiek in alle
vier bestanden; `mutatiesUitgevoerd: 0` en `applyUitgevoerd: false` bevestigen dat
alleen read-only queries zijn gedaan; de regressietest `test:data-trust` slaagde
met 17/17 scenario's.

## 3. Status RN_01A2 — providerrechten, attributie en schaalbaarheid

Alle vijf bestanden bestaan, zijn compleet en komen onderling overeen:

| Bestand | Status |
|---|---|
| `docs/SPARKI_PROVIDER_REGISTER.md` | ✔ 10 providers, alle 12 verplichte velden per provider |
| `docs/SPARKI_PROVIDER_COMPLIANCE_MATRIX.csv` | ✔ PR01–PR10, 16 kolommen, parseert schoon |
| `docs/SPARKI_PROVIDER_ACCOUNT_CHECKLIST.md` | ✔ vraagt nooit om sleutels, alleen antwoorden |
| `docs/SPARKI_ATTRIBUTION_IMPLEMENTATION_SPEC.md` | ✔ bouwbaar, niets gebouwd |
| `docs/SPARKI_PROVIDER_EVIDENCE.json` | ✔ officiële bronnen mét ophaaldatum en expliciete onzekerheden |

Architect-review (26-07): PASS — feitelijke claims onafhankelijk tegen de code
geverifieerd (nul attributie mobiel, vijf webkaartcomponenten mét attributie,
Overpass-strategieën, Nominatim-User-Agent, client-side Open-Meteo-call).

## 4. Belangrijkste datavertrouwensrisico's

1. **P01 (middel):** afgeleide FTP-rij 410 W (25-05-2026) in productie zonder
   `[achterhaald]`-markering — vervuilt FTP-historie en mogelijk TSS/IF rond eind
   mei 2026. Actueel profiel-FTP (345 W, niet-geschat) is correct.
2. **P02 (laag):** 4 dubbele Strava-FTP-importrijen (272 W, 26-06-2026) — echte eigen
   metingen, alleen dubbel; import dedupliceert inmiddels, restanten nooit met
   `apply` opgeschoond.
3. **P03 (onbekend):** mogelijk Engelstalige observaties van vóór de taalcorrectie
   (161 totaal) — `UNKNOWN_REQUIRES_REVIEW`; exact aantal alleen via de bestaande
   cleanup-droogdraai vast te stellen.
4. **A05 (inherent, gemitigeerd):** modeladvies kan stellig ogen; guards aanwezig
   (alleen-echte-context, verzinverbod, bronplicht).
5. Cosmetisch: dev-QA-persona "Lars de Vries" (alleen dev-DB) draagt een
   persoonsachtige naam; optioneel hernoemen naar neutraal label.

**Aantoonbaar echt:** prod: 2 echte gebruikers, 391 sessies, 9 routes, 1 race,
1 fiets, FTP-metingen manual/Strava (345/258, niet-geschat); dev: profiel Rene Vink
eerlijk leeg. **Transparant fictief bij ontwerp (géén mockdata):** Sparki World
`virtual_*`-tabellen (215/610/116/117) — nooit automatisch verwijderen.
**Nooit automatisch verwijderen:** alle echte gebruikersdata, ftp_history als
geheel (markeren, niet deleten), virtual_*, intel/knowledge/flags, dev-QA-gebruiker,
invitations-historie, handmatige/coach-waarden. **Quarantaine later veilig (ná
bevestiging):** P01 (markeren), P02 (cleanup-apply, oudste rij blijft), P03 (eerst
droogdraai). Bevestigd: uitsluitend read-only productiequeries; nul mutaties.

**Consistentienotitie:** in `.agents/open-choices.md` staat al een besluit van
25-07-2026 (OD_005): de Engelstalige observaties én de dubbele Strava-FTP-rij mogen
weg, uitvoering door René zelf via /admin → Gegevens-opschoning. Dat dekt P02/P03
grotendeels — de uitvoering heeft alleen nog niet plaatsgevonden (DT_01A trof de
rijen op 26-07 nog aan). **P01 (410 W) valt níét onder dat besluit** en vereist een
aparte bevestiging.

## 5. Belangrijkste provider- en licentierisico's

1. **CARTO (RB-1):** standaard webkaart; commercieel gebruik vereist volgens de
   officiële FAQ een Enterprise-licentie — er is geen account of contract.
2. **Mapbox-attributie mobiel (RB-2):** logo + tekstlinks verplicht; aantoonbaar
   volledig afwezig (grep: nul treffers). Bouwspec ligt klaar.
3. **ORS-tier (RB-3):** dag-/minuutquota onbekend (alleen dashboard); officieel
   round-trip/alternatieven max 100 km — raakt de lusgenerator.
4. **Open-Meteo (nieuw in RN_01A2):** gratis endpoint uitsluitend niet-commercieel
   (10.000/dag, CC BY 4.0-attributie); webnavigator roept het bovendien rechtstreeks
   client-side aan. Abonnement verplicht vóór commerciële start.
5. **OSM/CyclOSM-tegels:** publieke vrijwilligersservers, geen SLA, commerciële
   schaal niet toegestaan; **Esri-satellietlaag:** gratis alleen niet-inkomstengenererend.
6. **Overpass-privacy:** route-bboxes gaan eerst (volgauto: uitsluitend) naar
   maps.mail.ru (VK/RU) — beslissing René.
7. **Nominatim:** User-Agent op orde (`SparkiKlimmen/1.0`); 1 req/s niet technisch
   afgedwongen (feitelijk gebruik licht).

Cache/offline/rate-limits per provider: volledig in de matrix (PR01–PR10);
kernpunten: geen offline tegels gebouwd (bulk-download bij OSM verboden, bij Mapbox
gefactureerd), Overpass-caches in-memory 30 min–6 u, Open-Meteo 10k/dag gratis tier.

## 6. Bewezen feiten

- Nul attributie in de mobiele app; vijf webkaartcomponenten mét correcte attributie (grep + architect-review).
- CARTO Enterprise-eis: hard citaat uit officiële FAQ (opgehaald 26-07-2026).
- ORS-restricties (o.a. 100 km round-trip) van de officiële restrictiepagina.
- Open-Meteo niet-commercieel-only: officiële terms, opgehaald 26-07-2026.
- OSMF-tile- en Nominatim-policies: officiële pagina's, opgehaald 26-07-2026.
- `test:data-trust` 17/17 geslaagd; nul seed-rijen in dev/prod `user_profiles`.
- Productie: alle persoonlijke data clerk-gebonden aan 2 echte gebruikers.
- Off-route-detectie in code: corridor 50–150 m, sprongfilter, alarm na 3 metingen én 6 s (`route-match.ts`, herverifieerd 26-07), met bestaande testdekking.

## 7. Niet bewezen of nog extern te controleren

- Mapbox-accountplan, tokentoewijzing en maandverbruik (alleen in Mapbox-account).
- ORS-tier en dag-/minuutquota (alleen in ORS-dashboard).
- Werkelijke tegel-/API-volumes per dag (geen telemetrie — NIET_TE_VERIFIËREN).
- CyclOSM/Esri-samenvattingen steunen op zoekresultaatniveau (URL's genoemd).
- Exact aantal Engelstalige observaties in productie (P03).
- Oorzaak van de ongemarkeerde 410 W-rij (vereist schrijfpad-analyse; buiten scope).
- Of elk weer-/klimscherm al bronvermelding toont (attributiespec behandelt dit).

## 8. Reconciliatie met bestaande productbesluiten

**Automatisch herrouteren — IMPLEMENTATIEGAT, geen open beslissing.**
- Vaststaand goedgekeurd productbesluit: na een bevestigde afwijking berekent
  Sparki automatisch op de achtergrond een nieuwe route.
- Huidig gedrag in de code: de renner krijgt een off-route-keuzekaart; er wordt
  nooit automatisch herberekend (cooldown 15 s, ≥100 m).
- Classificatie: **IMPLEMENTATIEGAT** — nog te bouwen in een aparte opdracht;
  punt 4 in `docs/SPARKI_RN_01A_OPEN_DECISIONS.md` is expliciet geherclassificeerd
  (benoemde correctie, gedateerd 26-07-2026).

**Off-route-drempel — generieke open vraag GESLOTEN.** De audit toonde aan:
dynamische corridor 50–150 m, sprongfilter, alarm na 3 metingen én 6 seconden,
bestaande testdekking. Punten 1 en 2 in het open-beslissingen-document zijn
gesloten. **Open blijft alleen:** echte toestelvalidatie, percentage valse
meldingen, batterijverbruik, uitzonderingssituaties en eventuele tuning.

## 9. Uitleg wijzigingen MEMORY.md

Aan `.agents/memory/MEMORY.md` (het agent-geheugenindex-bestand, geen
productbestand) is tijdens RN_01A2 **één indexregel toegevoegd** die verwijst naar
het nieuwe topicbestand `sparki-provider-compliance.md`. Er is niets anders
gewijzigd of verwijderd. Noodzaak: zonder die regel zou een volgende werkgang het
providerregister kunnen missen en een gratis publieke tegel-/databron opnieuw als
vanzelfsprekend commercieel bruikbaar kunnen behandelen. Er staan **geen
productbesluiten, aannames of tijdelijke conclusies** in — alleen duurzame,
bronbaseerde lessen (wat providers officieel wel/niet toestaan) met verwijzing
naar de docs als bron van waarheid.

## 10. Status sparki-provider-compliance.md

`.agents/memory/sparki-provider-compliance.md` is een **werkgeheugen-samenvatting
voor de agent**, aangemaakt bij afronding van RN_01A2. Het is uitsluitend een
verwijzing + kernlessen; de **enige bron van waarheid blijft `docs/SPARKI_PROVIDER_*`**
(het bestand zegt dat zelf expliciet). Het is niet dubbel met `replit.md` of de
docs (andere functie: sessie-overstijgend agent-geheugen) en hoeft niet verwijderd
te worden. Advies: laten staan; bij toekomstige wijziging van het providerregister
hoort dit topicbestand in dezelfde beweging bijgewerkt te worden.

## 11. Volledige lijst gewijzigde bestanden

Nieuw aangemaakt in DT_01A (eerder vandaag): de vier data-trust-bestanden (§2).
Nieuw aangemaakt in RN_01A2 (eerder vandaag): de vijf providerbestanden (§3), plus
`.agents/memory/sparki-provider-compliance.md` en één indexregel in
`.agents/memory/MEMORY.md`.

In déze eindreview-opdracht:
- **Nieuw:** `docs/SPARKI_AUDITS_FINAL_REVIEW_2026-07-26.md` (dit rapport).
- **Gewijzigd:** `docs/SPARKI_RN_01A_OPEN_DECISIONS.md` — punten 1, 2 en 4 expliciet
  gesloten/geherclassificeerd per Controle 4 (benoemde correctie, geen stille).
- **Nieuw (aangeleverd door René):** de opdrachttekst in `attached_assets/`.

Git bevestigt: geen enkel bestand buiten `docs/`, `.agents/memory/` en
`attached_assets/` is aangemaakt of gewijzigd.

## 12. Bevestiging productiecode en productiegegevens onaangeraakt

- Geen productiecode gewijzigd (git-diff: nul codebestanden).
- Geen configuratie, database-schema of dependency gewijzigd (geen wijziging aan
  `package.json`, `.replit`, `vite.config`, `lib/db/src/schema` of migraties).
- Geen databasegegevens gewijzigd of verwijderd; productiequeries waren uitsluitend
  read-only (DT_01A: `mutatiesUitgevoerd: 0`, `applyUitgevoerd: false`).
- Geen geheimen, sleutels of accountgegevens in de documentatie — alleen NAMEN van
  omgevingsvariabelen (architect-review: regex-scan leeg).

## 13. Open blokkades

1. CARTO-basemaps zonder Enterprise-licentie (standaard webkaart) — RB-1.
2. Mapbox/OSM-attributie volledig afwezig op mobiel — RB-2 (bouwspec ligt klaar).
3. ORS-accounttier en dagquota onbekend — RB-3 (dashboardcontrole René).
4. Open-Meteo gratis endpoint niet-commercieel-only — abonnement vóór lancering.
5. Esri-satellietlaag zonder licentie — schrappen of licentie.
6. Productie-opschoning P01–P03 nog niet uitgevoerd (P02/P03 al goedgekeurd op
   25-07, uitvoering bij René; P01 vereist nog aparte bevestiging).
7. Implementatiegat: automatische achtergrond-herroutering na bevestigde afwijking.

## 14. Kleinste veilige vervolgstap

**De attributiebouwopdracht voor mobiel** volgens
`docs/SPARKI_ATTRIBUTION_IMPLEMENTATION_SPEC.md`: één herbruikbare
attributiecomponent (Mapbox-logo + drie tekstlinks) in `TrackMap`/`RouteMap` plus de
zes beschreven testen. Puur additief, geen provider- of gedragswijziging, geen
data-aanraking, direct een releaseblokkade (RB-2) opgelost. Tweede kleinste:
René's accountcontroles (Mapbox/ORS) — nul code.

## 15. Advies

**GO_MET_VOORWAARDEN.**

- **GO** voor doorbouwen en de besloten testfase: datavertrouwen is aangetoond
  (eerlijk-leeg-eerst, geen mockdata als persoonlijke data), productie is schoon op
  drie gemarkeerde, beheersbare restanten na.
- **VOORWAARDEN vóór commerciële lancering:** de zeven open blokkades uit §13 —
  met name providercontracten/-accounts (CARTO, ORS, Open-Meteo, Esri-keuze),
  mobiele attributie, en uitvoering van de al goedgekeurde productie-opschoning
  plus bevestiging over P01.
- **NO_GO is niet aan de orde:** geen enkele bevinding wijst op vermengde of
  onherkenbare nepdata, en alle providerrisico's zijn vooraf gedocumenteerd met
  officiële bronnen en een concreet handelingspad.
