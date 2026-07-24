# CURRENT_STATE — Sparki (nulmeting, 24 juli 2026)

Dit document beschrijft wat op de exportdatum daadwerkelijk gebouwd en werkend is — niet wat gepland was. Het is de officiële technische basis voor de SPARKI Master Specification. Detail per module: MODULE_STATUS.md en `docs/SPARKI_MODULE_DETAILS.md` (in de broncode).

## Wat is Sparki

Sparki is een Nederlandstalig, Sparki-gestuurd wielrenplatform voor sporters, coaches en ouders: een intelligente assistent (geen registratie-app) die eerst alle beschikbare data verzamelt, combineert en analyseert, en de gebruiker alleen laat bevestigen en echte gaten laat invullen ("intelligent werkblad"-doctrine, app-breed). Drie applicaties: webapp, API-server, mobiele app (ritregistratie + navigatie).

## Kerncijfers (gemeten op de code)

| Meting | Waarde |
| --- | --- |
| Web-pagina's | 41 (`artifacts/sparki/src/pages/`) |
| Domeincomponenten web | 128 (`components/sparki/`) + viz + ui |
| API-routers | ~74 bestanden, ~466 unieke endpoints, 62 mount-prefixen onder `/api` |
| Engines (api-server) | 40 domein-engines |
| Achtergrondjobs | 5 (connector-sync, goal-review, health-check, knowledge-scan, reminders) |
| Databasetabellen (live) | 162 |
| Drizzle-schemabestanden | 63 |
| Feature flags (DB) | 11 |
| Open TODO's/FIXME's in code | 0 |
| Typecheck | groen (alle packages) |

## Functionele staat in één alinea

Volledig werkend end-to-end: onboarding (adaptieve vragen + verplichte connect-stap + gap-fill), Sportpaspoort met herkomst, Vandaag-scherm met dagtype/Momentblok/State Card/weer/dagadvies, trainingen (plannen, loggen, GPX/FIT/TCX-import), autonoom trainingsplan met feedback-aanpassing, Sparki-coaching (deterministische observatie-engine + centrale modelgateway + chat + Core-voorspellingen), coach-cockpit, ouderomgeving, Lab (belasting/vorm/FTP-ondergrens/mentaal/herstel), wedstrijden + Race Intelligence + technische-gids-analyse + export (GPX/FIT), wedstrijdkalender-import (Fietssport/We-Tri volledig; KNWU eerlijk beperkt), routes (generator, paspoort, POI's, hoogteprofiel, wegtypen, opmerkingen, delen, keten/versies), voeding (deterministische rekenkern, jeugdveilig), mechanieker/garage/fietsscan/materiaalcoach, sociaal (vrienden, feed, live locatie, rit delen), club (16 tabellen, 11 rollen), Journey & wedstrijddossier, kennisbank + intel-hub, World (transparant-fictieve renners), doelen + maandreview, meldingen (in-app + web push; e-mail eerlijk beperkt), privacy & account (export/verwijderen/consents), admin (health check, testers, flags, uitrol), Strava-sync (OAuth, import, backfill, webhook, geplande inhaalsync), Data Hub met dedupe/merge/conflictlogboek, mobiele ritregistratie en turn-by-turn-navigatie incl. volgauto, val-alarm, sprints en BLE (native build).

## Bewust beperkt of voorbereid (eerlijk, geen placeholder)

- **Garmin/Wahoo-sync**: volledig voorbereid (providers, webhooks, fail-closed secrets) maar `configured: false` tot fabrikantsleutels bestaan; UI zegt eerlijk "niet beschikbaar".
- **E-mailbezorging**: geen geverifieerd domein; Resend-sandbox bezorgt alleen aan accounteigenaar; jobs slaan eerlijk over, doen nooit alsof.
- **KNWU-kalenderimport**: volledige kalender achter onbereikbare login-SPA; eerlijk-beperkte import, nooit gefingeerd.
- **BLE-sensoren / achtergrondopname**: vereisen native build (niet Expo Go/web); onbeschikbaarheid wordt eerlijk gemeld.
- **Fitbit**: registry-vermelding zonder provider-code; wordt in de UI niet als werkend aangeboden.
- **Wahoo/Karoo directe push van exports**: bewust afwezig met eerlijke uitleg (download GPX/FIT werkt).

## Geen mockdata

Er is geen mock-UI en geen fabricated data. Seed-/curated data die wél bestaat is inhoudelijk en gelabeld: intel-kaarten (`seed:intel`), kennisbank-items (governed, versie-gepind), World = transparant-fictieve virtuele renners (expliciet gelabeld), uitleg-registry (frontend-content met echte profielwaarden). Development Preview Mode is dev-only en fail-closed. Zie FLAGS_SEED_DEMO.md.

## Kwaliteitsborging

- ~120 test-suites in api-server/web/mobiel (contract-, isolatie-, privacy-, engine- en parser-tests); draaien sequentieel (gedeelde dist/). Validatieset op exportdatum: groen.
- Architect-review verplicht per bouwgolf; vaste afbouwregels in `AGENTS.md`/`replit.md` (additieve DB, hergebruik vóór herbouw, geen "AI"-woord in UI, neutrale stem, Nederlands).

## Bekende beperkingen & technische schuld

Zie LIMITATIONS_AND_DEBT.md. Productiestatus per onderdeel: FEATURE_MATRIX.md (kolom Productiestatus).
