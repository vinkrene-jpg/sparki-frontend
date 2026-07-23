# Sparki Data-Trust Audit — applicatiebrede controle op mockdata

Datum: 23 juli 2026 (aangevuld met Opdracht 0A.1 — data-trust herstellen) · Scope: alle modules (web, api-server, mobiel, mockup-sandbox) + database (dev én productie)

## Doel

Vaststellen dat nergens in Sparki mock-, seed-, demo- of fallbackdata als
persoonlijke gebruikersdata wordt getoond, en dat elke zichtbare waarde een
controleerbare echte herkomst heeft.

## Aanpak

1. Geautomatiseerde codescan van alle vier de artifacts (patronen: mock, seed,
   demo, sample, fixture, fallback-arrays, hardcoded persoonsdata).
2. Databasescan (dev + productie) op seed-/testaccounts en verweesde testrijen.
3. Classificatie van elke vondst in vijf herkomstcategorieën (zie hieronder).
4. Nieuwe admin-gegevensbroncontrole (`GET /api/admin/data-provenance`) die per
   gegevensblok bron-tabel, record-id, berekening, laatste update en gebruiker
   toont.
5. Geautomatiseerde regressietest `test:data-trust` (12 scenario's).

## Herkomstcategorieën

| Categorie | Betekenis | Toegestaan zichtbaar als persoonlijke data? |
|---|---|---|
| 1. Directe gebruikersdata | door de gebruiker ingevoerd of geüpload | ja |
| 2. Afgeleide echte data | deterministisch berekend uit categorie 1 (TSS, readiness, observaties) | ja, met uitleg |
| 3. Externe echte bron | Strava/OSM/Open-Meteo e.d., met bronvermelding | ja, met bron |
| 4. Bewust fictief product | Sparki World virtuele renners — transparant fictief, harde muur naar echte data | ja, mits als fictief gelabeld |
| 5. Mock/seed/test/fallback | voorbeelddata, demo-rijen, stille fallbacks | **nee — nooit** |

## Bevindingen

### Code (alle artifacts)

- **Frontend (`artifacts/sparki`)** — schoon. Geen mock-arrays als persoonlijke
  data; lege datasets renderen eerlijke lege staten (`?? []` + Smart Missing
  Input Flow). Geen stille fallback die een API-fout door verzonnen data vervangt.
- **API-server** — schoon. `world-seed`/`intel-seed` zijn bewuste
  productfeatures (categorie 4: transparant fictieve Sparki World-renners met
  harde muur naar echte gebruikersdata), géén mockdata. `DEV_AUTH_BYPASS`
  faalt gesloten in productie (vereist NODE_ENV≠production én expliciete flag).
  Alle persoonlijke-data-queries zijn clerkId-gescoped.
- **Mobiel (`artifacts/sparki-mobile`)** — schoon.
- **Mockup-sandbox** — `Prototype.tsx` bevat hardcoded voorbeeldactiviteiten.
  Onschadelijk: dit is de design-sandbox (canvas-previews), geen
  gebruikersgerichte omgeving, en wordt niet mee-gedeployed als product. Alleen
  gedocumenteerd, niet verwijderd.

### Database

- **Productie**: schoon — 2 echte gebruikers, nul testaccounts.
- **Dev**: 6 achtergebleven testaccounts verwijderd (`test-intel-athlete`,
  `test_fueling_user`, 4× `test_koppel_*`). `dev_qa_athlete` bewust behouden
  (dat is de Development Preview-gebruiker).
- **Structurele oorzaak**: sommige oudere tests ruimden hun
  `user_profiles`-rijen niet op na afloop. De nieuwe `data-trust`-test ruimt
  alles op (incl. user/athlete-profielen); bestaande tests laten soms residu
  achter — aanbeveling: bij toekomstige testonderhoud dezelfde volledige
  cleanup toepassen.

### Opdracht 0A.1 — foute afgeleide waarden in productie (23 juli 2026)

Drie structurele fouten gevonden en verholpen (productie-DB is voor de agent
alleen-lezen; alle herstel is daarom **zelfherstellend bij het draaien van de
engines**, plus een gerichte admin-opschoning):

1. **FTP bleef ten onrechte "schatting" (331 W) terwijl er nieuwere echte
   invoer was (handmatig 250, Strava 258).** Oorzaak: de Strava-import schreef
   wél een `ftp_history`-rij maar zette `ftpEstimated` nooit op `false`,
   waardoor de ondergrens-engine de schatting bleef ophogen.
   Fix: (a) import zet nu `ftpEstimated=false` en dedupliceert per dag;
   (b) `recalibrateEstimatedFtp` heeft een zelfherstel-stap: staat er een echte
   (niet-afgeleide) `ftp_history`-rij die minstens zo nieuw is als de nieuwste
   afgeleide rij, dan wordt die echte waarde overgenomen (met herleidbaar
   paspoort-event) en stopt het automatisch ophogen; een nieuwere echte invoer
   blokkeert elke auto-verhoging — hoogstens een paspoortvoorstel.
2. **Fiets-autokoppeling koppelde ALLE historische ritten aan de enige actieve
   fiets**, waardoor kilometerstanden en onderhoudsadvies (±3800 km) verzonnen
   waren. Fix: de enkelvoudige-fiets-fallback koppelt alleen ritten vanaf de
   registratiedatum van de fiets, en een idempotente zelfherstel-stap maakt
   eerdere foute auto-koppelingen (rit ouder dan de fiets) weer los. Koppeling
   met écht bewijs (Strava gear_id) en handmatige keuzes blijven onaangetast.
3. **Schattingen stonden niet als schatting op het scherm.** Fix: FTP en
   weekuren tonen nu "(schatting)" op het Sportpaspoort en in de
   profielinstellingen zodra de bijbehorende `…Estimated`-vlag waar is.

**Opschoning productie (René):** Engelstalige observaties van vóór de
taalcorrectie en dubbele `ftp_history`-importrijen zijn via de nieuwe
admin-opschoning verwijderbaar: `POST /api/admin/data-trust/cleanup`
(alleen admin; standaard droogdraai die exact toont wat weg zou gaan,
verwijderen alleen met `apply=true`). Echte data (191 sessies, gewicht,
vriendkoppeling, garagefiets, echte FTP-metingen) blijft onaangeroerd.

## Nieuwe waarborgen

1. **Admin-gegevensbroncontrole** — `/admin` → sectie "Gegevensbroncontrole"
   (alleen admins/testers; server-side 403 voor anderen). Per gegevensblok
   (profiel, kalender, sessies, doelen, routes, wedstrijden, voeding,
   meldingen, observaties, chat): brontabel + kolom, aantal records, laatste
   record-id, laatste update, berekeningstoelichting en herkomstoordeel. Lege
   blokken tonen eerlijk "geen brondata — eerlijk leeg"; een mislukte controle
   toont "controle mislukt", nooit vervangende cijfers.
2. **Regressietest `test:data-trust`** (16/16 geslaagd, run via shell:
   `pnpm --filter @workspace/api-server run test:data-trust`):
   - leeg account is op 8 kernoppervlakken eerlijk leeg (geen fallbackdata);
   - twee-gebruikers-isolatie (training van A onzichtbaar voor B);
   - gegevensbroncontrole: 403 voor niet-admin (echte adminlijst, fail-closed),
     echte bron + juiste telling + record-id voor admin, 404 bij onbekende
     gebruiker;
   - FTP-zelfherstel: echte invoer wint van een oudere afgeleide schatting, en
     een echte FTP wordt daarna nooit automatisch aangepast;
   - fiets-autokoppeling: historische ritten (van vóór de registratiedatum)
     worden niet gekoppeld en eerdere foute auto-koppelingen worden losgemaakt;
   - admin-opschoning: droogdraai herkent exact de vervuiling (Engelstalige
     observaties, dubbele ftp-rijen) en `apply` verwijdert alléén die rijen.
3. **Admin-opschoning `POST /api/admin/data-trust/cleanup`** — gerichte,
   controleerbare opschoning per gebruiker met verplichte droogdraai-stap.

## Opschoning uitgevoerd

Alleen aantoonbaar seed-/testmateriaal is verwijderd (de 6 dev-testaccounts
hierboven, herkenbaar aan `test_`-prefixen en testdomein-e-mails). Er is geen
productiedata of echte gebruikersdata aangeraakt.

## Conclusie

Sparki toont nergens mock-, seed- of fallbackdata als persoonlijke data.
Alle persoonlijke oppervlakken zijn clerkId-gescoped, falen eerlijk en zijn nu
controleerbaar via de admin-gegevensbroncontrole en geborgd met een
geautomatiseerde regressietest.
