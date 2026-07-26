# Sparki Data-Trust Audit — DT_01A (controle nep-, demo- en foutieve gebruikersdata)

**Datum:** 26 juli 2026 · **Commit onderzocht:** ed68b4e · **Aard:** uitsluitend audit + dry-run — geen productiecode, UI, engines, schema of data gewijzigd. Vervangt en actualiseert de audit van 23 juli 2026 (Opdracht 0A.1, samengevat onderaan).

## Doel
Applicatiebreed vaststellen of Sparki persoonlijke gegevens, trainingen, planning, belasting, herstel, routes, wedstrijden, sociale gegevens of adviezen toont die niet aantoonbaar uit echte gebruikersdata komen. Een lege toestand is beter dan geloofwaardige maar onjuiste persoonlijke data.

## Aanpak en bewijs
1. Drie read-only code-inventarisaties: web-frontend (`artifacts/sparki`), api-server (`artifacts/api-server`), mobiel + gedeelde libs (`artifacts/sparki-mobile`, `lib/db`, `lib/feature-flags`).
2. Alleen-lezen databasecontrole van de **ontwikkeldatabase** (alle ~150 tabellen geïnventariseerd, gevulde tabellen per eigenaar uitgesplitst) én de **productiedatabase** (read-only replica).
3. Bestaande regressietest uitgevoerd: `test:data-trust` → **17/17 scenario's geslaagd** (leeg account overal eerlijk leeg; gegevensbroncontrole; FTP-zelfherstel; fiets-autokoppeling; opschoning-droogdraai).
4. Classificatie van elk item volgens het verplichte 9-klassenmodel; volledige lijst in `docs/SPARKI_MOCK_DATA_INVENTORY.csv` (34 items), tellingen/quarantainelijst in `docs/SPARKI_DATA_TRUST_DRY_RUN.json`, bronnen in `docs/SPARKI_DATA_TRUST_EVIDENCE.json`.

## Kernconclusie
**Er wordt nergens mock-, demo- of voorbeelddata als persoonlijke gebruikersdata getoond.** De architectuur is aantoonbaar "eerlijk-leeg-eerst". Wel zijn in de productiedatabase **twee restanten van foutieve afgeleide metriek** gevonden (zie bevinding P01/P02) die met het reeds bestaande, droogdraai-verplichte opschoonmechanisme verwijderd kunnen worden — ná menselijke bevestiging, niet in deze opdracht.

## Bevindingen per verplicht scopegebied

### Vandaag
- Aanhef: echte voornaam; ontbreekt die dan neutraal "Atleet" (label, geen dataclaim) — `home-sections.tsx`.
- Weer: echte Open-Meteo-forecast voor de echte thuislocatie; zonder forecast expliciet "Sparki laat hier geen schatting zien" — `general-day-home.tsx`.
- Zonder check-in/metrics: oproep om in te checken; geen verzonnen herstelwaarden.

### Trainingskalender, plannen, training koppelen/toevoegen
- Lege kalender ⇒ lege lijst (vastgelegd in test, `koppellijst-workouts.ts`).
- Workout-TSS wordt uit de échte workoutstructuur geschat en expliciet als schatting gemarkeerd (`engines/core-prediction/tss.ts`).
- FTP-invoerveld toont "bijv. 250" — instructieplaceholder, wordt nooit als waarde opgeslagen.

### Lab, CTL/ATL/TSB/TSS en herstel
- `deriveTss` geeft `null` zonder power/FTP — nooit een verzonnen belastingscore (`lib/derived-load.ts`).
- `ftpAtDate` valt terug op profiel-FTP mét `ftp_estimated`-vlag; test bewijst dat echte metingen winnen van schattingen.
- UI (`performance-numbers.tsx`): "—" plus eerlijke meldingen ("FTP en gewicht zijn nog niet bekend", "Nog geen trainingsbelasting bekend", "Nog geen beste vermogens bekend").
- **Bevinding P01 (productie):** in `ftp_history` staat een afgeleide rij van **410 W (25 mei 2026) zonder `[achterhaald]`-markering**, terwijl er nieuwere echte metingen zijn (manual 250 op 22 juni; Strava 258/272 op 26 juni; manual 345 op 9/12 juli). De tweede afgeleide rij (331 W, zelfde dag) is wél gemarkeerd. Classificatie: `STALE_OR_INVALID_PERSONAL_METRIC`. Gevolg: de 410 W-rij blijft zichtbaar in de FTP-historie en kan TSS/IF-afleidingen rond eind mei vertekenen. Het actuele profiel-FTP is correct (345 W, niet-geschat). Oorzaak is read-only niet vaststelbaar; herstel kan via het bestaande zelfherstel/markeermechanisme of de admin-opschoning — ná menselijke bevestiging.
- **Bevinding P02 (productie):** 4 dubbele Strava-importrijen (272 W, alle 26 juni 2026) staan er nog — de import dedupliceert inmiddels per dag, maar de bestaande opschoning (`POST /api/admin/data-trust/cleanup`, standaard droogdraai) is voor deze rijen nooit met `apply` uitgevoerd. Classificatie: `STALE_OR_INVALID_PERSONAL_METRIC` (vervuiling, geen tonings-risico van vreemde data: het zijn echte eigen metingen, alleen dubbel).

### Doelen en wedstrijden
- Clerk-gebonden tabellen; productie: 1 race, dev: 0 rijen. Geen vervuiling aangetroffen.

### Routes en ritten
- ORS-fouten worden vertaald naar eerlijke Nederlandse uitleg; nooit een gefabriceerde rechte-lijn-route (`lib/routing/providers/ors.ts`).
- Rittitel-fallback "Rit" en mobiele ritnaam "Ochtendrit/Middagrit" zijn tijd-/typelabels, geen persoonlijke metriek.
- Productie: 391 sessies en 9 routes, alle clerk-gebonden aan de 2 echte gebruikers.

### Materiaal en fietsen
- `garage_bikes` clerk-gebonden (productie: 1 fiets). Regel "km altijd afgeleid, nooit een teller" geborgd; historische foute auto-koppelingen worden door het bestaande zelfherstel losgemaakt (getest in `test:data-trust`).

### Vrienden, feed en sociale gegevens
- Vriendverzoeken renderen niets bij geen data; naamfallbacks "Onbekend"/"Sparki-vriend" zijn labels bij een ontbrekende naam van een échte vriend, geen verzonnen personen.
- **Sparki World is transparant fictief bij ontwerp:** eigen `virtual_*`-tabellen (215 atleten, 610 media, 116 posts, 117 events in dev én prod), feed levert altijd `fictional: true`, seedscript heeft een honesty-gate tegen onmogelijke waarden. Productfeature, géén mockdata; mag nooit automatisch worden verwijderd.

### Coach-, ouder- en clubomgeving
- User-binding via `requireAuth` + clerkId-filters; bestaande isolatiesuites (cross-account, coach/parent-sharing-niveaus, links-unlink/end) dekken dit af.

### Adminfuncties
- Gegevensbroncontrole `/api/admin/data-provenance`: per oppervlak bron-tabel/record-id/telling uit een vaste allowlist; lege blokken tonen "geen brondata — eerlijk leeg"; getest (incl. 404 onbekende gebruiker, 403 niet-admin fail-closed).
- Opschoning `POST /api/admin/data-trust/cleanup`: standaard droogdraai, verwijderen alleen met `apply=true`. **In deze audit is géén apply uitgevoerd.**

### API-fallbacks en foutafhandeling
- Weer: lege lijst bij falen. Modelaanroep: 500 met eerlijke melding. Frontend: letterlijke foutweergave of "Er ging iets mis"-melding; error-boundary met eerlijke crashmelding.
- Modeladviezen: context bevat alleen echte records, ontbrekend gaat expliciet als "missing" mee, prompt verbiedt verzinnen en eist bronvermelding. Restrisico inherent aan taalmodellen, gemitigeerd.
- **Bevinding P03 (productie):** 161 observaties; of daar nog Engelstalige rijen van vóór de taalcorrectie tussen staan is read-only niet betrouwbaar vast te stellen → `UNKNOWN_REQUIRES_REVIEW`; het bestaande droogdraai-endpoint kan dit exact tonen.

### Seed-, fixture-, demo- en ontwikkeldata
- Seedscripts gebruiken herkenbare prefixes (`seed_va_`, `seed_preview_`) en domeinen (`@virtual.sparki`, `@preview.sparki`). **Geen enkele `seed_%`-rij in dev of productie `user_profiles`.**
- Testfixtures ("Testrit", "Test Vriend") staan uitsluitend in `*.test.ts`-bestanden; niet geïmporteerd door productiecode.
- Canvas-mockups (`artifacts/mockup-sandbox`, o.a. `Prototype.tsx` en de Vandaag-sfeervarianten) bevatten voorbeeldwaarden maar zijn ontwerp-previews in een apart artifact dat nooit als product wordt geleverd.
- **Dev-QA-account** `dev_qa_a…` ("Lars de Vries", `@sparki.dev`, gewicht 68,50 kg, 1988 tester-events, 1 flag-override, 3 head-tester-uitnodigingen): bewust behouden Development Preview-gebruiker (gedocumenteerd in de 0A.1-audit; `DEV_AUTH_CLERK_ID`/eerste profielrij). Alleen in de ontwikkeldatabase; classificatie `SEED` (dev-tooling), niet gebruikersgericht.

### Hardcoded persoonsgegevens en sportwaarden
- Geen hardcoded persoonsgegevens van echte personen in productiecode (web, api, mobiel). Sensor-UUID's en navigatie-instructies ("linksaf") zijn functionele constanten.

## Herkomstkolommen in het schema
- Mét herkomst: `training_sessions` (source/sources/field_sources/manual_fields), `computation_traces` (reliability: gemeten/afgeleid/geschat), `knowledge_items` (provider/source), `road_objects` (source), `intel_cards` (source_label/source_url), alle `virtual_*`-tabellen (fictie per definitie).
- Zonder herkomstkolom (acceptabel — directe gebruikersinvoer/instellingen): `user_profiles`, `privacy_settings`, `audio_preferences`, `push_subscriptions`.

## Stopregelbeoordeling
Geen stop nodig: echte en niet-echte data zijn overal betrouwbaar te onderscheiden (clerk-binding, aparte `virtual_*`-tabellen, herkomstkolommen, seed-prefixes, dev-domeinen). De drie productie-onzekerheden (P01–P03) zijn onderscheidbaar en gemarkeerd; er is geen situatie waarin echte gebruikersdata onherkenbaar vermengd is met mockdata.

## Verplichte auditvragen — items met verhoogde aandacht
Voor elk CSV-item zijn UI/API, veld, bron, user-binding, gedrag bij ontbrekende data, gedrag bij fout, verwarringsrisico, voorstel en risico vastgelegd. Samengevat voor de risicogevallen:
1. **P01 — afgeleide FTP 410 W zonder markering (prod):** getoond in FTP-historie (Sportpaspoort/instellingen); bron `ftp_history.test_type='derived'`; gebonden aan één echte gebruiker; risico middel (historie + afleidingen rond mei 2026); voorstel: markeren `[achterhaald]` via bestaand mechanisme na menselijke bevestiging — historie nooit deleten.
2. **P02 — 4 dubbele Strava-FTP-rijen (prod):** eigen echte metingen, alleen dubbel; risico laag; voorstel: bestaande cleanup-droogdraai → apply na bevestiging (oudste rij blijft).
3. **P03 — mogelijk Engelstalige observaties (prod):** `UNKNOWN_REQUIRES_REVIEW`; exact vast te stellen via cleanup-droogdraai.
4. **A05 — modeladvies:** kan taalkundig stellig ogen; guards aanwezig (alleen-echte-context, verzinverbod, bronplicht); geen wijziging in deze golf.

## Samenvatting eerdere audit (Opdracht 0A.1, 23 juli 2026)
- 6 achtergebleven dev-testaccounts (`test_*`) destijds verwijderd; `dev_qa_athlete` bewust behouden als Development Preview-gebruiker.
- Drie structurele fouten hersteld: Strava-import zet `ftpEstimated=false` + dedupliceert per dag; fiets-autokoppeling koppelt alleen vanaf registratiedatum + zelfherstel voor historische foutkoppelingen; schattingen tonen "(schatting)" in UI.
- Waarborgen sindsdien: admin-gegevensbroncontrole, `test:data-trust`-regressietest, admin-opschoning met verplichte droogdraai.
