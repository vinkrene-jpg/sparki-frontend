# SPARKI_CURRENT_STATE.md — Officiële technische nulmeting

**Datum:** 24 juli 2026 · **Branch:** `main` · **Commit:** `9b2e0210` · Bron: uitsluitend de actuele broncode.

Dit document is de officiële technische nulmeting voor de SPARKI Master Specification. Het beschrijft wat er ís — geen plannen, geen aannames.

---

## 1. Samenvatting huidige staat

Dit document beschrijft wat op de exportdatum daadwerkelijk gebouwd en werkend is — niet wat gepland was. Het is de officiële technische basis voor de SPARKI Master Specification. Detail per module: MODULE_STATUS.md en `docs/SPARKI_MODULE_DETAILS.md` (in de broncode).

## Wat is Sparki

Sparki is een Nederlandstalig, Sparki-gestuurd wielrenplatform voor sporters, coaches en ouders: een intelligente assistent (geen registratie-app) die eerst alle beschikbare data verzamelt, combineert en analyseert, en de gebruiker alleen laat bevestigen en echte gaten laat invullen ("intelligent werkblad"-doctrine, app-breed). Drie applicaties: webapp, API-server, mobiele app (ritregistratie + navigatie).

## Kerncijfers (gemeten op de code)

| Meting | Waarde |
| --- | --- |
| Web-pagina's | 41 (`artifacts/sparki/src/pages/`) |
| Domeincomponenten web | 128 (`components/sparki/`) + viz + ui |
| API-routers | 74 bestanden, 548 endpoints (zie §17) |
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

---

## 2. Gebruikte technologieën & build-informatie

- **Exportdatum:** 24 juli 2026
- **Branch:** `main`
- **Laatste commit:** `9b2e0210c686b75fc3627a3a9905340a3a857e58` (24 juli 2026, 05:41 UTC)
- **Bron:** de door git bijgehouden broncode plus de gegenereerde documentatie in `export/current-state/` — in totaal 1497 bestanden in de ZIP. Bewust uitgesloten: oude backup-zips/bundles en chat-bijlagen (`attached_assets/`), want geen broncode.

## Runtime & tooling

| Component | Versie |
| --- | --- |
| Node.js | 24.13.0 |
| pnpm | 10.26.1 (pnpm workspaces monorepo) |
| TypeScript | ~5.9.3 |
| Vite | ^7.3.2 |
| esbuild | (api-server bundling, CJS/ESM `build.mjs`) |

## Kerntechnologieën

| Laag | Technologie |
| --- | --- |
| Web-frontend | React 19.1, Wouter ^3.3.5, TanStack Query ^5.90, Tailwind CSS v4 (^4.1.14), framer-motion ^12, lucide-react, Recharts, Leaflet ^1.9.4, Inter Variable (@fontsource) |
| API-server | Express ^5.2.1, @clerk/express ^2.1.30, Drizzle ORM ^0.45.2, pino ^9.14, zod ^3.25 |
| Database | PostgreSQL (Neon, Replit-managed) + Drizzle ORM, schema in `lib/db/src/schema/` |
| Auth | Replit-managed Clerk (cookie-based op web; geen Bearer-tokens) |
| Mobiel | Expo ~54.0.27, React Native 0.81.5, expo-router ~6.0.17 |
| Modelaanroepen | Anthropic (@anthropic-ai/sdk ^0.78) via één centrale gateway (`lib/ai/gateway.ts`), Gemini alleen in Photo Lab |

## Omgevingsvariabelen (vereist)

- `DATABASE_URL` — Postgres
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk
- Secrets aanwezig: `MAPBOX_ACCESS_TOKEN`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`
- Dev-only: `DEV_AUTH_BYPASS=true` (Development Preview Mode, fail-closed op productie)
- Optioneel prod: `SPARKI_ADMIN_IDS`, `SYNC_JOB_MAX_CONNECTIONS`, `GOAL_REVIEW_MAX_ATHLETES`

## Build & run

- `pnpm run typecheck` — volledige typecheck (groen op exportdatum)
- `pnpm run build` — typecheck + build van alle packages
- `pnpm --filter @workspace/api-server run dev` — API (poort 8080)
- `pnpm --filter @workspace/sparki run dev` — web
- `pnpm --filter @workspace/sparki-mobile run dev` — Expo
- `pnpm --filter @workspace/db run push` / `run build` — schema push / type-declaraties

---

## 3. Architectuur

## Monorepo-indeling

```
/
├── artifacts/
│   ├── sparki/          # Web-frontend (@workspace/sparki) — React 19 + Vite + Wouter + TanStack Query + Tailwind v4
│   ├── api-server/      # Express 5 API (@workspace/api-server) — routes, engines, jobs, tests
│   ├── sparki-mobile/   # Expo/React Native app (@workspace/sparki-mobile) — ritregistratie, navigatie, BLE
│   └── mockup-sandbox/  # Canvas-preview sandbox (ontwerp, geen productie)
├── lib/db/              # @workspace/db — Drizzle-schema (63 schemabestanden), migraties, pool
├── docs/                # Product- en reviewdocumentatie (bron van waarheid per module)
└── scripts/             # Hulpscripts
```

Volledige mappenstructuur: `export/current-state/FOLDER_TREE.txt`.

## Lagen (api-server)

```
HTTP (Express 5)
 └── src/routes/*.ts           ~74 routers, gemount onder /api/<prefix> (zie API_REFERENCE.md)
      └── src/engines/<naam>/  ~40 domein-engines (facades) — routes importeren engines, niet losse helpers
           └── src/lib/        gedeelde domeinlogica (dedupe, fueling, readiness, race-intel, routing, …)
                └── @workspace/db  Drizzle ORM → PostgreSQL (162 tabellen live)
```

Architectuurprincipes zoals afgedwongen in de code:

1. **Data Hub is de enige ingest-route.** Elke activiteit (Strava, bestand, handmatig, webhook, gepland) loopt via `runSync`/`ingestBatch` (`engines/data-hub`): valideren → dedupe/merge (+ conflictlogboek `merge_log`) → consent → opslag. Geen tweede syncsysteem.
2. **Eén centrale modelgateway.** Elke modelaanroep loopt via `aiMessage()` (`lib/ai/gateway.ts`): killswitch → consent → minderjarigen-regels → redactie → dedupe → metadata-only logging (`ai_call_logs`). Deterministische engines rekenen; het model verwoordt alleen.
3. **Engineslaag.** `engines/<domein>/index.ts` is de façade per domein (observation, training-plan, data-hub, race, route, world-*, …). Smoke-harnas + `docs/engine-architecture.md`.
4. **Eerlijkheidscontract.** Geen mockdata of stille fallbacks: ontbrekende data is expliciet "ontbreekt", probes tonen GRIJS in plaats van nep-groen, syncs falen zichtbaar.
5. **Fail-closed veiligheid.** Minderjarigen (media, sociaal, support), ouder-rechtenlaag, privacy-visibility, webhook-secrets en Development Preview Mode zijn allemaal fail-closed.

## Frontend (web)

- `App.tsx`: ClerkProvider (`publishableKeyFromHost`), routing (Wouter), beschermde routes; alles achter één `AccountGate` (profiel vereist).
- `components/sparki/screen-shell.tsx`: gedeelde schil — navigatie (Vandaag·Activiteiten·Ontdekken·Trainen·Jij), rolwissel, cinematische blauw-zwarte achtergrond, Coach-analysekaart, chat-overlay, meldingenbel.
- 41 pagina's (`src/pages/`, zie PAGES.txt), 128 domeincomponenten (`components/sparki/`), viz-componenten (`components/viz/`), ui-primitieven.
- Data via TanStack Query op `/api/*`; cookies via Vite-proxy (dev) of same-origin (prod). Nooit Bearer-tokens.

## Mobiel (Expo)

- expo-router app (`app/(app)`, `(auth)`): ritregistratie op achtergrond, auto-trim/herstel, val-alarm, sprints, turn-by-turn navigatie (route-match state machine, HUD, audio-cues), volgauto-modus, BLE-sensoren (native build), wedstrijdmodus.
- Native-only libraries in platform-gesplitste bestanden (`.tsx` + `.web.ts` stub). Upload van ritten via dezelfde Data Hub-ingest.

## Auth & rollen

- Clerk (cookie-based), JIT-provisioning via `POST /api/auth/sync`; rollen (`athlete`/`coach`/`parent`) in eigen DB (`user_profiles.roles[]`), NIET in Clerk-metadata. Admin via `SPARKI_ADMIN_IDS`-allowlist (dev-bypass in Preview Mode). Clubrollen (11) apart in `club_members`. Zie ROLES_AND_PERMISSIONS.md.

## Achtergrondprocessen

Vijf jobs (Scheduled Deployments) + in-proces mechanismen; zie BACKGROUND_PROCESSES.md.

## Observability & beheer

- Admin Health Check-engine: echte probes of eerlijk GRIJS; release-CLI faalt op onopgeloste rode checks.
- Geplande-taken-overzicht (5 jobs) in admin; foutenregister, telemetrie, testerbeheer, releasegroepen + uitrol met kill switches.
- Logging: pino (JSON in prod); tests gebruiken sync in-process stream.

---

## 4. Mappenstructuur

```
artifacts
artifacts/api-server
artifacts/api-server/assets
artifacts/api-server/assets/music
artifacts/api-server/.replit-artifact
artifacts/api-server/scripts
artifacts/api-server/src
artifacts/api-server/src/engines
artifacts/api-server/src/engines/audio
artifacts/api-server/src/engines/coaching
artifacts/api-server/src/engines/context-memory
artifacts/api-server/src/engines/core-prediction
artifacts/api-server/src/engines/data-hub
artifacts/api-server/src/engines/document-analysis
artifacts/api-server/src/engines/engagement
artifacts/api-server/src/engines/garage
artifacts/api-server/src/engines/goals
artifacts/api-server/src/engines/input-center
artifacts/api-server/src/engines/insights
artifacts/api-server/src/engines/integration
artifacts/api-server/src/engines/intel
artifacts/api-server/src/engines/knowledge
artifacts/api-server/src/engines/material
artifacts/api-server/src/engines/memory-graph
artifacts/api-server/src/engines/mental
artifacts/api-server/src/engines/observation
artifacts/api-server/src/engines/onboarding
artifacts/api-server/src/engines/profile
artifacts/api-server/src/engines/race
artifacts/api-server/src/engines/race-room
artifacts/api-server/src/engines/recovery-load
artifacts/api-server/src/engines/reminders
artifacts/api-server/src/engines/road-objects
artifacts/api-server/src/engines/route
artifacts/api-server/src/engines/share
artifacts/api-server/src/engines/social
artifacts/api-server/src/engines/source-quality
artifacts/api-server/src/engines/sprint
artifacts/api-server/src/engines/state
artifacts/api-server/src/engines/training-plan
artifacts/api-server/src/engines/voice
artifacts/api-server/src/engines/world-affinity
artifacts/api-server/src/engines/world-feed
artifacts/api-server/src/engines/world-media
artifacts/api-server/src/engines/world-population
artifacts/api-server/src/engines/world-simulation
artifacts/api-server/src/jobs
artifacts/api-server/src/lib
artifacts/api-server/src/lib/ai
artifacts/api-server/src/lib/calendar
artifacts/api-server/src/lib/climbs
artifacts/api-server/src/lib/connectors
artifacts/api-server/src/lib/connectors/providers
artifacts/api-server/src/lib/document-analysis
artifacts/api-server/src/lib/garage
artifacts/api-server/src/lib/health
artifacts/api-server/src/lib/knowledge
artifacts/api-server/src/lib/live-location
artifacts/api-server/src/lib/material
artifacts/api-server/src/lib/photo-style
artifacts/api-server/src/lib/profile
artifacts/api-server/src/lib/race-export
artifacts/api-server/src/lib/race-points
artifacts/api-server/src/lib/race-room
artifacts/api-server/src/lib/road-objects
artifacts/api-server/src/lib/routing
artifacts/api-server/src/lib/routing/providers
artifacts/api-server/src/lib/security
artifacts/api-server/src/lib/share
artifacts/api-server/src/lib/support
artifacts/api-server/src/lib/test-dashboard
artifacts/api-server/src/lib/training
artifacts/api-server/src/lib/volgauto
artifacts/api-server/src/lib/weather
artifacts/api-server/src/lib/world
artifacts/api-server/src/lib/world-social
artifacts/api-server/src/middlewares
artifacts/api-server/src/routes
artifacts/api-server/src/scripts
artifacts/api-server/src/scripts/data
artifacts/api-server/src/tests
artifacts/api-server/src/types
artifacts/mockup-sandbox
artifacts/mockup-sandbox/public
artifacts/mockup-sandbox/public/images
artifacts/mockup-sandbox/.replit-artifact
artifacts/mockup-sandbox/src
artifacts/mockup-sandbox/src/components
artifacts/mockup-sandbox/src/components/mockups
artifacts/mockup-sandbox/src/components/mockups/sparki-reboot
artifacts/mockup-sandbox/src/components/ui
artifacts/mockup-sandbox/src/.generated
artifacts/mockup-sandbox/src/hooks
artifacts/mockup-sandbox/src/lib
artifacts/sparki
artifacts/sparki-mobile
artifacts/sparki-mobile/app
artifacts/sparki-mobile/app/(app)
artifacts/sparki-mobile/app/(app)/navigate
artifacts/sparki-mobile/app/(app)/ride
artifacts/sparki-mobile/app/(auth)
artifacts/sparki-mobile/assets
artifacts/sparki-mobile/assets/images
artifacts/sparki-mobile/assets/sounds
artifacts/sparki-mobile/components
artifacts/sparki-mobile/constants
artifacts/sparki-mobile/hooks
artifacts/sparki-mobile/lib
artifacts/sparki-mobile/.replit-artifact
artifacts/sparki-mobile/scripts
artifacts/sparki-mobile/server
artifacts/sparki-mobile/server/templates
artifacts/sparki/public
artifacts/sparki/public/sounds
artifacts/sparki/public/sounds/sparki
artifacts/sparki/public/sounds/sparki/performance
artifacts/sparki/.replit-artifact
artifacts/sparki/src
artifacts/sparki/src/components
artifacts/sparki/src/components/sparki
artifacts/sparki/src/components/sparki/coach
artifacts/sparki/src/components/sparki/day-homes
artifacts/sparki/src/components/sparki/insight
artifacts/sparki/src/components/sparki/race
artifacts/sparki/src/components/sparki/train
artifacts/sparki/src/components/ui
artifacts/sparki/src/components/viz
artifacts/sparki/src/contexts
artifacts/sparki/src/hooks
artifacts/sparki/src/lib
artifacts/sparki/src/lib/sound
artifacts/sparki/src/pages
docs
docs/product
docs/review-bundle
docs/store
lib
lib/api-client-react
lib/api-client-react/src
lib/api-client-react/src/generated
lib/api-spec
lib/api-zod
lib/api-zod/src
lib/api-zod/src/generated
lib/api-zod/src/generated/types
lib/db
lib/db/manual
lib/db/migrations
lib/db/src
lib/db/src/schema
lib/feature-flags
lib/feature-flags/src
lib/integrations
lib/integrations-anthropic-ai
lib/integrations/anthropic_ai_integrations
lib/integrations/anthropic_ai_integrations/src
lib/integrations/anthropic_ai_integrations/src/server
lib/integrations/anthropic_ai_integrations/src/server/batch
lib/integrations-anthropic-ai/src
lib/integrations-anthropic-ai/src/batch
lib/integrations-gemini-ai
lib/integrations-gemini-ai/src
lib/integrations-gemini-ai/src/batch
lib/integrations-gemini-ai/src/image
lib/integrations-gemini-ai/src/video
scripts
scripts/src
```

---

## 5. Modulestatus (Gebouwd / Gedeeltelijk / Placeholder / Niet gebouwd)

Statuslegenda conform de opdracht: **Gebouwd** · **Gedeeltelijk gebouwd** · **Placeholder** · **Niet gebouwd**.
(De interne status "Voorbereid" — code volledig, wacht op externe sleutels — is hieronder als "Gedeeltelijk gebouwd" geclassificeerd met toelichting.)

Bron: code-inspectie + `docs/SPARKI_MODULE_STATUS.md` (peildatum 23-24 juli 2026). Kolom Koppeling = bewijs frontend/backend/database.

| # | Module | Status | Toelichting / bewijs |
|---|---|---|---|
| 1 | Onboarding (adaptieve vragen, connect-stap, gap-fill, hervatten) | **Gebouwd** | `pages/start.tsx` / `routes/onboarding.ts` + `engines/onboarding` / `onboarding_state` |
| 2 | Sportpaspoort (herkomst, historie, voorstellen) | **Gebouwd** | `pages/paspoort.tsx` / `routes/passport.ts` / `passport_value_events` |
| 3 | Vandaag (dagtype, Momentblok, State Card, weer, dagadvies) | **Gebouwd** | `screen-shell.tsx` / `routes/state.ts`, `routes/weather.ts` / `ai_observations` |
| 4 | Trainingen (plannen/loggen/importeren GPX-FIT-TCX, feedback) | **Gebouwd** | `pages/activiteiten.tsx` / `lib/activity-file-ingest.ts` / `training_sessions` |
| 5 | Autonoom trainingsplan (levenscyclus, adaptieve voorstellen) | **Gebouwd** | `three-week-plan.tsx` / `routes/training-plan.ts` + engine / `training_plans`, `plan_days` |
| 6 | Sparki-coaching (observaties, chat, voice, Core-voorspelling) | **Gebouwd** | `engines/observation`, `engines/voice`, `engines/core-prediction`, centrale gateway |
| 7 | Coach-cockpit (signalen, planning, berichten, voorstellen) | **Gebouwd** | `pages/coach-cockpit.tsx` / `routes/coach-cockpit.ts` / `coach_*` |
| 8 | Ouderomgeving (sharing-niveaus, rapporten, noodcontacten) | **Gebouwd** | `routes/parent.ts` + `lib/parent-permissions.ts` / `parent_*` |
| 9 | Lab (belasting/vorm, FTP-ondergrens, mentaal, herstel) | **Gebouwd** | `pages/lab.tsx`, `pages/lichaam.tsx` / `computeLoadSeries` SSOT |
| 10 | Wedstrijden + Race Intelligence | **Gebouwd** | `pages/races.tsx` / `routes/races.ts`, `lib/race-intel.ts` |
| 11 | Wedstrijdpunten + technische-gids-analyse (PDF/foto) | **Gebouwd** | `routes/race-points.ts`, `engines/document-analysis` |
| 12 | Wedstrijdexport (GPX / FIT Course / FIT Workout) | **Gebouwd** | round-trip-verificatie; directe Wahoo/Karoo-push bewust afwezig (eerlijke uitleg) |
| 13 | Wedstrijdkalender-import | **Gebouwd** | Fietssport + We-Tri volledig; KNWU eerlijk-beperkt (login-SPA onbereikbaar, nooit gefingeerd) |
| 14 | Routes & generator (ORS, delen, keten/versies, GPX-import) | **Gebouwd** | `pages/routes.tsx` / `routes/routes.ts`, `lib/routing/` |
| 15 | Route-verrijking (hoogteprofiel, POI's, wegtypen, opmerkingen, klimmen) | **Gebouwd** | Overpass-gedreven; storing eerlijk getoond |
| 16 | Voeding (richtwaarden, logs+foto's, seizoensdoel 17+) | **Gebouwd** | deterministische rekenkern; jeugd zonder getallen (bewust) |
| 17 | Mechanieker, garage, fietsscan, materiaalcoach | **Gebouwd** | km altijd afgeleid; foto-analyse met provenance |
| 18 | Sociaal (vrienden, feed, live locatie, rit delen) | **Gebouwd** | fail-closed privacy, minderjarig fail-closed |
| 19 | Club (trainingen, teams, selecties, beheer, audit) | **Gebouwd** | 16 `club_*`-tabellen, 11 rollen, achter kill switch `club_features` |
| 20 | Helpdesk & support (deterministische antwoorden, tickets) | **Gebouwd** | `routes/support.ts` / `support_*` |
| 21 | Uitleglaag (UitlegDot, "Bij jou") | **Gebouwd** | frontend-registry met echte profielwaarden |
| 22 | Meldingen in-app + web push | **Gebouwd** | dagvouwing, categorie-registry, quiet hours, VAPID-push |
| 23 | Meldingen per e-mail | **Gedeeltelijk gebouwd** | code compleet; geen geverifieerd maildomein → sandbox bezorgt alleen aan accounteigenaar, jobs slaan eerlijk over |
| 24 | Admin (health check, testers, flags, uitrol, fouten) | **Gebouwd** | echte probes of GRIJS; release-CLI faalt op rood |
| 25 | Privacy & account (export, 14d-verwijderen, consents, audit) | **Gebouwd** | tokens gemaskeerd in export |
| 26 | Mobiele ritregistratie (achtergrond, auto-trim, herstel, val-alarm, sprints) | **Gebouwd** | vereist native build; val-alarm claimt nooit bezorging |
| 27 | Mobiele navigatie (turn-by-turn, HUD, audio, off-route, volgauto, verkeerslichten) | **Gebouwd** | `lib/route-match.ts`, `lib/nav-cues.ts`, `routes/volgauto.ts` |
| 28 | Bluetooth-sensoren (HR/vermogen/cadans) | **Gedeeltelijk gebouwd** | werkt alleen in volledige native build; Expo Go/web eerlijk "niet ondersteund" |
| 29 | Garmin/Wahoo-datasync | **Gedeeltelijk gebouwd** (voorbereid) | providers/webhooks/fail-closed secrets compleet; `configured: false` tot fabrikantsleutels; UI eerlijk "niet beschikbaar" |
| 30 | Strava-sync (OAuth, import, backfill, webhook, geplande inhaalsync) | **Gebouwd** | `lib/connectors/providers/strava*`, `engines/data-hub/scheduled-sync.ts` |
| 31 | Data Hub (multi-bron ingest, dedupe/merge, conflictlogboek, sync-logboek) | **Gebouwd** | `engines/data-hub`; `training_sessions.merge_log`; `sync_runs` |
| 32 | Journey & wedstrijddossier | **Gebouwd** | composed timeline; minderjarig media fail-closed |
| 33 | Kennisbank + Performance Intelligence Hub | **Gebouwd** | governed, versie-gepind; achter feature-flag `knowledge_base` |
| 34 | World (transparant-fictieve renners, reel, reference-shares) | **Gebouwd** | expliciet fictief gelabeld; harde muur naar echte data |
| 35 | Doelen + maandelijkse review-job | **Gebouwd** | `routes/goals.ts`, `jobs/goal-review.ts` |
| 36 | Volgauto (aparte autoroute, aansluitpunten, automodus) | **Gebouwd** | ETA's altijd "geschat" |
| 37 | Sparki Connect (centrale synclaag: statussen, geplande catch-up, logboek) | **Gebouwd** | `docs/SPARKI_CONNECT.md`; consentExpired-status; `job:sync` |
| 38 | Komoot-integratie | **Niet gebouwd** | geen code aanwezig |
| 39 | Google-integratie (Fit/agenda) | **Niet gebouwd** | geen code aanwezig |
| 40 | Fitbit | **Placeholder** | registry-vermelding zonder provider-code; niet als werkend aangeboden in UI |
| 41 | Abonnementen/betalingen (premium) | **Niet gebouwd** | alleen feature-flag `premium` (uit); geen betaalcode |

**Niet aangetroffen:** dode knoppen, onbereikbare schermen of mock-UI. Elk "Gedeeltelijk gebouwd" onderdeel meldt zijn beperking eerlijk in de gebruikersinterface.

---

## 6. Feature-matrix & productiestatus per onderdeel

Per feature: platform, rollen, feature-flag/kill switch en productiestatus.
Productiestatus-legenda: **Prod-klaar** (werkt in productie zonder extra stappen) · **Prod-klaar met voorwaarde** (werkt, maar externe sleutel/configuratie of native build nodig) · **Niet in productie**.

| Feature | Platform | Rollen | Flag / switch | Productiestatus |
|---|---|---|---|---|
| Onboarding (vragen → connect → gap-fill) | web | allen | — | Prod-klaar |
| Sportpaspoort | web | athlete | — | Prod-klaar |
| Vandaag (dagtype, Momentblok, State Card, dagadvies, weer) | web | athlete | — | Prod-klaar |
| Trainingen (plan/log/import GPX-FIT-TCX) | web | athlete, coach | — | Prod-klaar |
| Autonoom trainingsplan + adaptieve voorstellen | web | athlete | — | Prod-klaar |
| Sparki-coaching (observaties, chat, Core-voorspelling, voice) | web | athlete | `ai_observations`-flag (uit; observaties via engine actief), gateway-killswitch | Prod-klaar |
| Coach-cockpit | web | coach | `coach_portal` (flag uit — uitrol via releasegroepen) | Prod-klaar (flag-gestuurd) |
| Ouderomgeving | web | parent | `parent_portal` (flag uit — uitrol via releasegroepen) | Prod-klaar (flag-gestuurd) |
| Lab (belasting/vorm/FTP-ondergrens/mentaal/herstel) | web | athlete | — | Prod-klaar |
| Wedstrijden + Race Intelligence + gids-analyse | web | athlete, coach | — | Prod-klaar |
| Wedstrijdexport GPX/FIT | web | athlete | — | Prod-klaar |
| Kalenderimport (Fietssport, We-Tri, KNWU-beperkt) | web | athlete | — | Prod-klaar (KNWU eerlijk beperkt) |
| Routes & generator + verrijking (POI's, wegtypen, klimmen) | web | athlete | `route_planner` (aan), `climb_explorer` (aan) | Prod-klaar (Overpass/ORS-afhankelijk, storing eerlijk) |
| Voeding + seizoensdoel | web | athlete (jeugdveilig) | — | Prod-klaar |
| Mechanieker / garage / fietsscan / materiaalcoach | web | athlete | — | Prod-klaar |
| Sociaal (vrienden, feed, live locatie, rit delen) | web + mobiel | athlete | — | Prod-klaar |
| Club | web | clubrollen | kill switch `club_features` | Prod-klaar (switch-gestuurd) |
| Helpdesk & support | web + mobiel | allen | — | Prod-klaar |
| Meldingen in-app + web push | web | allen | — | Prod-klaar (VAPID-sleutels aanwezig) |
| Meldingen per e-mail | server | allen | — | Prod-klaar met voorwaarde: geverifieerd maildomein ontbreekt (sandbox-only, slaat eerlijk over) |
| Admin (health check, testers, flags, uitrol) | web | admin | `testing_tools` (uit) | Prod-klaar (`SPARKI_ADMIN_IDS` vereist) |
| Privacy & account (export, verwijderen, consents) | web | allen | — | Prod-klaar |
| Strava-sync (OAuth, webhook, backfill, geplande catch-up) | web + server | athlete | flag `strava` (uit — uitrol), kill switches `imports_sync`/`external_providers` | Prod-klaar (client-secrets aanwezig) |
| Garmin/Wahoo-sync | server | athlete | flag `garmin` (uit) | Prod-klaar met voorwaarde: fabrikantsleutels ontbreken (`configured:false`, eerlijk in UI) |
| Data Hub (ingest, dedupe/merge, conflictlogboek, sync-logboek) | server | athlete | — | Prod-klaar |
| Journey & wedstrijddossier | web | athlete | — | Prod-klaar |
| Kennisbank + intel-hub | web | athlete; beheer admin | `knowledge_base` (aan) | Prod-klaar |
| World (fictieve renners) + world-social | web | athlete | — | Prod-klaar (expliciet fictief) |
| Doelen + maandreview-job | web + job | athlete | — | Prod-klaar (Scheduled Deployment vereist) |
| Rit-verhaal | web | athlete | `rit_verhaal` (uit) | Prod-klaar (flag-gestuurd) |
| Mobiele ritregistratie (achtergrond, val-alarm, sprints, BLE) | mobiel | athlete | — | Prod-klaar met voorwaarde: native build (EAS); Expo Go beperkt en eerlijk gemeld |
| Mobiele navigatie (HUD, audio, off-route, volgauto, wedstrijdmodus) | mobiel | athlete | — | Prod-klaar met voorwaarde: native build |
| Store-distributie / releasegroepen / releasecandidate-straat | server + admin | admin | releasegroepen | Prod-klaar |
| Premium/abonnementen | — | — | flag `premium` (uit) | Niet in productie (niet gebouwd) |
| Komoot / Google / Fitbit | — | — | — | Niet in productie (niet gebouwd; Fitbit alleen registry-vermelding) |

## Feature flags (live DB, 24 juli 2026)

| Flag | Globaal aan | Rollout % |
|---|---|---|
| ai_observations | nee | 100 |
| climb_explorer | ja | 100 |
| coach_portal | nee | 100 |
| garmin | nee | 100 |
| knowledge_base | ja | 100 |
| parent_portal | nee | 100 |
| premium | nee | 100 |
| rit_verhaal | nee | 100 |
| route_planner | ja | 100 |
| strava | nee | 100 |
| testing_tools | nee | 100 |

Flags met "nee" zijn per releasegroep/tester of per-gebruiker overschrijfbaar (resolutie-precedentie in `lib/flags.ts`); kill switches staan los daarvan (fail-safe uit-knoppen).

---

## 7. Alle pagina's

### Web (artifacts/sparki/src/pages/ — 41)

```
activiteiten.tsx
admin-account-prefill.test.tsx
admin-health-detail.tsx
admin-page-smoke.test.tsx
admin.tsx
club-beheer.tsx
club.tsx
coach-athlete-plan.tsx
coach-cockpit.tsx
feed.tsx
geluid.tsx
invitations.tsx
invite-accept.tsx
journey.tsx
kalender.tsx
klimmen.tsx
knowledge.tsx
lab.tsx
landing.tsx
legal.tsx
lichaam.tsx
mechanieker.tsx
meer.tsx
not-found.tsx
paspoort.tsx
photo-lab.tsx
profiel.tsx
races.tsx
routes.tsx
samen.tsx
sign-in.tsx
sign-up.tsx
sparki-connect.tsx
sprinten.tsx
start.tsx
support.tsx
tester-qr.tsx
tester-welcome.tsx
train.tsx
wedstrijd-room.tsx
wereld.tsx
you.tsx
```

### Mobiel (artifacts/sparki-mobile/app/)

```
artifacts/sparki-mobile/app/(app)/diagnostiek.tsx
artifacts/sparki-mobile/app/(app)/gpx-import.tsx
artifacts/sparki-mobile/app/(app)/index.tsx
artifacts/sparki-mobile/app/(app)/instellingen.tsx
artifacts/sparki-mobile/app/(app)/_layout.tsx
artifacts/sparki-mobile/app/(app)/navigate/[id].tsx
artifacts/sparki-mobile/app/(app)/record.tsx
artifacts/sparki-mobile/app/(app)/ride/[id].tsx
artifacts/sparki-mobile/app/(app)/rides.tsx
artifacts/sparki-mobile/app/(app)/support.tsx
artifacts/sparki-mobile/app/(auth)/_layout.tsx
artifacts/sparki-mobile/app/(auth)/sign-in.tsx
artifacts/sparki-mobile/app/(auth)/sign-up.tsx
artifacts/sparki-mobile/app/_layout.tsx
artifacts/sparki-mobile/app/+not-found.tsx
```

### Domeincomponenten web (components/sparki/ — 128)

```
account-privacy-panel.tsx
activity-import-panel.tsx
add-training.tsx
admin-panel.tsx
ai-memory-panel.tsx
analysis-feedback.tsx
bike-3d.tsx
bike-3d-werkblad.tsx
bike-garage.tsx
bike-scan-capture.tsx
bike-scan-viewer.tsx
bio-radar.tsx
bottom-nav.tsx
bron-vermelding.tsx
bug-report-form.tsx
bug-report-thread.tsx
chapter-grid.tsx
check-in-chip.tsx
checkin-sheet.tsx
cinematic-scene.tsx
club-chip.tsx
coach
coach-decision-card.tsx
coach-home.tsx
coach-input-actions.tsx
connections-section.tsx
connector-recovery-nudge.tsx
context-memory-panel.tsx
core-prediction-panel.tsx
day-detail-drawer.tsx
day-homes
day-home.tsx
day-type-briefing.tsx
dev-preview.tsx
document-analysis-panel.tsx
elevation-profile.tsx
equipment-asset-panel.tsx
equipment-choice.tsx
error-boundary.tsx
feature-gate.tsx
feedback-inbox.tsx
feedback-sheet.tsx
follow-up-chip.tsx
follow-up-prompt.tsx
free-ride-sprint.tsx
ftp-estimate-wizard.tsx
goal-context-line.tsx
goals-worksheet.tsx
health-flow-section.tsx
health-status-control.tsx
home-sections.tsx
home-weather-row.tsx
humor-line.tsx
import-from-calendar.tsx
insight
insights-section.tsx
intel-card.tsx
intel-reader.tsx
knowledge-admin.tsx
leskaart-van-dag.tsx
linked-route.tsx
links-section.tsx
location-picker-map.tsx
main-menu.tsx
maintenance-signals.tsx
material-coach.tsx
material-nudge-card.tsx
material-test.tsx
meerijder-nudge.tsx
mental-resilience-card.tsx
missing-input-notice.tsx
nav-settings-panel.tsx
news-reader.tsx
notification-bell.tsx
onboarding-gap-fill.tsx
onboarding-v2.tsx
ontwikkelprioriteit-home-card.tsx
parent-home.tsx
performance-numbers.tsx
primitives.tsx
privacy-settings.tsx
profile-privacy-grid.tsx
profile-prompt-card.tsx
profile-settings.tsx
race
race-export-center.tsx
race-points-panel.tsx
release-admin.tsx
release-note-card.tsx
reminder-settings.tsx
ride-moment-block.tsx
ride-story.tsx
route-explorer.tsx
route-library.tsx
route-map.tsx
route-navigator.tsx
route-panel.tsx
route-remarks.tsx
route-surfaces.tsx
screen-shell.tsx
session-detail-drawer.tsx
session-graphs.tsx
share-ride.tsx
sparki-chat-overlay.tsx
sparki-core.tsx
sparki-input-center.tsx
sparki-voice.tsx
sport-passport.tsx
state-card.tsx
support-admin.tsx
test-dashboard.tsx
three-week-plan.tsx
tiered-explanation.tsx
train
training-builder.tsx
training-day-home.tsx
training-plan-panel.tsx
training-progression.tsx
ui.tsx
version-block-screen.tsx
voeding-screen.tsx
volgauto-panel.tsx
wekker-overlay.tsx
wireless-sensors.tsx
workout-detail-drawer.tsx
workout-hud.tsx
world-reel.tsx
world-social-section.tsx
```

---

## 8. Database & datamodel

- **Database:** PostgreSQL (Replit-managed), Drizzle ORM. Schema-SSOT: `lib/db/src/schema/` (63 bestanden). Live: **162 tabellen** (volledige lijst: `export/current-state/DB_TABLES.txt`).
- **Migraties:** dev via `drizzle-kit push` (additief, migratieveilig — vaste afbouwregel); expliciete SQL-migraties in `lib/db/migrations/` (0001–0003: legal/ai_consents). Constraints altijd idempotent-guarded toegevoegd.

## Domeinclusters (tabelgroepen)

| Cluster | Kerntabellen |
|---|---|
| Identiteit & rollen | `user_profiles` (clerkId-identiteit, roles[], active_role), `athlete_profiles`, `coach_athlete_links`, `parent_athlete_links` |
| Activiteiten (Data Hub) | `training_sessions` (incl. `merge_log`, streams, bests, afgeleide TSS, dedupe_key), `connector_connections`, `connector_activities`, `sync_runs`, `webhook_events`, `activity_imports` |
| Planning | `training_plans`, `plan_days`, `planned_workouts`, `workout_feedback`, `life_events` (leefagenda) |
| Coaching-intelligentie | `ai_observations` (confidence, expiresAt, pattern), `ai_call_logs` (metadata-only), `core_predictions`, `athlete_daily_metrics`, `context_memories`, memory-graph-tabellen |
| Sportpaspoort | `passport_value_events` (waarde+event in één transactie), `passport_proposals` |
| Gezondheid & voeding | `health_complaints` (raises-only status), `nutrition_*`, seizoensdoel-tabellen, `ftp_history` |
| Wedstrijden | `races` (incl. localLaps), `race_points`, `race_exports`, `document_analyses` |
| Routes & navigatie | `routes` (versies), `route_shares` (nullsNotDistinct), `route_proposals`, `road_objects` (zelflerende verkeerslichten), `volgauto_*` |
| Sociaal | `friend_links`, feed-/share-tabellen, `live_location_*` (één positie-rij = geen historie), blokkades |
| Club | 16 `club_*`-tabellen (leden/rollen, trainingen, teams, selecties, berichten, audit) |
| Journey | `journey_*` (composed timeline, dossier, media) |
| Kennis & intel | `managed_knowledge_*` (versie-gepind, publish=tx+snapshot), `intel_*` |
| World (fictief) | `virtual_*`, `world_*` (harde muur naar echte data; media-cache met promptKey UNIQUE) |
| Doelen | `athlete_goals`, `goal_*` (afgeleide voorstellen via DB unique index + onConflict) |
| Meldingen | `notifications` (resolutionKey-dedupe, dedupeKey+sentAt), `push_subscriptions`, `reminder_preferences` |
| Beheer & release | `feature_flags` (composite PK), `kill_switches`, releasegroepen/uitrol, `health_check_*`, `error_*`, tester-/telemetrietabellen, invitations |
| Privacy & audit | `privacy_settings` (17 categorieën), `consent_audit_log`, `security_audit_log`, verwijderregister |
| Materiaal | `garage_*` (km afgeleid), `bike_scans`, `material_analyses`, foto's in object storage |
| Onboarding & support | `onboarding_state`, `support_*`, `helpdesk_turns` |

## Vaste datamodel-principes

1. **Additief & migratieveilig** — nooit bestaande data/relaties/historie verwijderen.
2. **Herkomst** — paspoort-events, merge_log, bronnenregister: elke waarde is herleidbaar.
3. **Dedupe op DB-niveau** — unique indexes + onConflict (nooit read-then-insert); partial-index-gotcha's gedocumenteerd.
4. **Eigenaarschap** — athlete-owned rijen altijd via clerkId-filter; coach-schrijfbare resources hebben eigen owner-kolom.
5. **Consent & audits als data** — consents, audit-logs en verwijdervensters zijn eersteklas tabellen.

### Alle 162 live tabellen

```
activity_imports
ai_call_logs
ai_memory_events
ai_observations
ai_preferences
analysis_feedback
athlete_daily_metrics
athlete_goals
athlete_profiles
audio_preferences
bike_scan_frames
bike_scans
bug_report_comments
bug_reports
club_audit_log
club_consents
club_group_members
club_groups
club_locations
club_members
club_message_reads
club_messages
club_race_events
club_race_selections
club_subscriptions
club_team_members
club_teams
club_trainer_assignments
club_training_signups
club_trainings
clubs
coach_athlete_links
coach_change_proposals
coach_context_items
coach_followup_answers
coach_messages
coach_signal_actions
coaching_profiles
component_events
connector_activities
connector_connections
connector_consents
consent_audit_log
core_predictions
document_analyses
emergency_contacts
equipment
equipment_assets
equipment_choices
error_events
error_groups
feature_flags
follow_links
friend_links
ftp_history
garage_bikes
garage_components
garage_sensors
goal_events
goal_proposals
group_training_invitees
group_training_proposals
health_check_batches
health_check_results
health_check_runs
health_complaint_updates
health_complaints
health_safety_info
helpdesk_turns
intel_cards
intel_interactions
invitations
journey_items
journey_media
journey_reflections
kill_switches
knowledge_feedback
knowledge_items
knowledge_usage_events
legal_acceptances
legal_documents
life_events
live_location_grants
live_location_positions
live_location_sessions
managed_knowledge_items
managed_knowledge_versions
material_analyses
nav_settings
notifications
nutrition_hydration_logs
nutrition_preferences
nutrition_season_goals
onboarding_state
parent_athlete_links
parent_confirmations
parent_messages
parent_reports
passport_proposals
passport_value_events
personal_context_memories
photo_lab_uploads
pilot_consents
plan_days
planned_workout_changes
planned_workouts
privacy_settings
profile_privacy
push_subscriptions
race_exports
race_points
race_room_compilations
race_room_items
race_rooms
races
release_note_reads
release_notes
reminder_preferences
road_object_reports
road_objects
rollout_guards
route_proposals
route_shares
route_sprint_boards
route_version_usages
routes
security_audit_log
social_reports
sparki_input_messages
sprint_results
support_articles
support_known_issues
support_ticket_messages
support_tickets
sync_runs
team_identities
tester_events
training_plans
training_sessions
user_flag_overrides
user_profiles
user_virtual_affinity
user_virtual_follows
version_requirements
virtual_athlete_relationships
virtual_athletes
virtual_career_entries
virtual_events
virtual_interactions
virtual_media
virtual_posts
volgauto_plans
volgauto_positions
volgauto_reports
webhook_events
workout_feedback
workout_mental_reflections
world_blocks
world_notification_prefs
world_reactions
world_reports
world_shared_items
```

---

## 9. Engines (deterministische domein-engines, api-server)

```
audio
coaching
context-memory
core-prediction
data-hub
document-analysis
engagement
garage
goals
input-center
insights
integration
intel
knowledge
material
memory-graph
mental
observation
onboarding
profile
race
race-room
recovery-load
reminders
road-objects
route
share
social
source-quality
sprint
state
training-plan
voice
world-affinity
world-feed
world-media
world-population
world-simulation
```

Routes importeren engines (façades), niet losse helpers. Elke modelaanroep loopt via de centrale gateway (`lib/ai/gateway.ts`): killswitch → consent → minderjarig → redactie → dedupe → metadata-only logging. Deterministische engines rekenen; het model verwoordt alleen.

---

## 10. Integraties

| Integratie | Status | Details |
|---|---|---|
| **Clerk** (Replit-managed) | Actief | Cookie-based auth web, `publishableKeyFromHost`, FAPI-proxy prod-only, JIT-provisioning |
| **PostgreSQL** (Replit/Neon) | Actief | Drizzle ORM, 162 tabellen |
| **Anthropic** | Actief | Alle modelaanroepen via centrale gateway `aiMessage()`; metadata-only logging |
| **Gemini** (Replit AI-integratie) | Actief (beperkt) | Alleen Photo Lab (relight); geïsoleerde flow |
| **Strava** | Actief | Per-gebruiker OAuth (tokens in `connector_connections`), import/backfill, webhook, rit-upload (handmatige activiteit), geplande inhaalsync; secrets aanwezig |
| **Garmin / Wahoo** | Voorbereid | Providers + webhooks compleet, fail-closed secrets; `configured:false` tot fabrikantsleutels |
| **Fitbit** | Placeholder | Registry-vermelding, geen provider-code, niet aangeboden in UI |
| **openrouteservice (ORS)** | Actief | Routegeneratie op echte wegen; rejoin/loop-kwaliteitsbewaking; nooit rechte lijnen |
| **Overpass (OSM)** | Actief | POI's, wegtypen/ondergrond, route-opmerkingen, klimmen; mirror-keuze; storing eerlijk |
| **Open-Meteo** | Actief | Weer op thuislocatie voor dagelijkse oppervlakken |
| **Mapbox** | Actief | Kaarttegels (token aanwezig) |
| **Resend** (Replit-integratie) | Beperkt actief | Sandbox zonder geverifieerd domein → alleen accounteigenaar; jobs slaan eerlijk over |
| **Web Push (VAPID)** | Actief | Eigen sleutels; host-allowlist SSRF-guard op subscribe én send |
| **Object storage (Replit App Storage)** | Actief | Foto's (voeding, materiaal, fietsscan, journey); ACL pas ná bytes; owner-checked serve |
| **Fietssport / We-Tri / KNWU** | Actief / beperkt | Kalenderimport: eerste twee volledig (regex-parsers, SSRF-allowlist); KNWU eerlijk-beperkt |
| **arXiv / literatuurbronnen** | Actief | Kennisscan-job met word-boundary relevantie-guard |

Kill switches: `imports_sync`, `external_providers`, `club_features` + gateway-killswitch — allemaal fail-safe.

---

## 11. Rollen en rechten

## Accountrollen (eigen DB, niet Clerk-metadata)

`user_profiles.roles[]` + `active_role`; wisselen via rolwissel in ScreenShell (`/api/auth/me/role`).

| Rol | Rechten (kern) |
| --- | --- |
| **athlete** (default) | Volledige eigen omgeving: trainingen, plan, wedstrijden, routes, voeding, gezondheid, sociaal, Journey, privacy-instellingen. Alle `:id`-routes zijn eigenaar-gebonden (clerkId uit sessie, nooit request-body). |
| **coach** | Cockpit voor gekoppelde sporters (via `coach_athlete_links` + sharing-niveau): signalen, planning-voorstellen (adoptie in sporter-eigen `planned_workouts`), berichten. Cross-coach isolatie afgedwongen; coach-schrijfbare resources hebben een eigen owner-kolom. |
| **parent** | Ouderomgeving via één centrale rechtenlaag (`lib/parent-permissions.ts`) voor ÁLLE ouder-routes; sharing-niveaus (niets → safety-only → …); onbekende leeftijd clampt naar veiligheidsminimum; onbevestigde links nooit boven safety-only. |
| **admin** | Allowlist `SPARKI_ADMIN_IDS` (prod); dev-bypass alleen in Development Preview Mode. Health check, testers, flags, kill switches, uitrol, foutenregister, kennisbeheer. |

## Clubrollen (11, least privilege)

`club_members.role`: owner, admin, trainer e.a. — limieten ook bij invite-accept, club-scoped ID-checks, FOR UPDATE op inschrijvingen, jeugd-consent fail-closed.

## Privacy-laag

- Profielzichtbaarheid: 17 categorieën, fail-closed op alle ontdekkingspaden (zoeken/verzoek/match); geblokkeerd = verborgen = niet-bestaand (neutrale weigering).
- Minderjarigen: media, sociaal delen, support en live-locatie fail-closed; voeding zonder getallen <16; seizoensdoel 17+.
- Consents: per datatype (connector-import), per modelgebruik (centrale gateway), met audit-log.

## Auth-mechanica

Clerk cookie-based (web), JIT-provisioning via `/api/auth/sync` (e-mail server-side uit Clerk; re-link bij zelfde geverifieerde e-mail), `publishableKeyFromHost` op server én client. Mobiel: eigen token-flow via Clerk. Development Preview Mode: `NODE_ENV!=production` ÉN `DEV_AUTH_BYPASS=true` (fail-closed).

---

## 12. Datastromen

## 1. Activiteitendata (de hoofdader)

```
Bronnen: Strava (OAuth + webhook) · GPX/FIT/TCX-upload · handmatige invoer · mobiele rit-opname
   │
   ▼
runSync(clerkId, provider, trigger)          engines/data-hub/index.ts
   ├─ kill switches (imports_sync, external_providers)
   ├─ busy-wacht (advisory lock, nooit 2 syncs per gebruiker+platform)
   ├─ adapter.fetchAndNormalize (+2 herkansingen bij tijdelijke fouten)
   ▼
ingestBatch                                   engines/data-hub/ingest.ts
   ├─ validatie (sport vóór coerce, plausibiliteit)
   ├─ dedupe: sport + 5-min-startbucket + buurbucket   (dedupe.ts)
   │    └─ merge: eerste bron wint · eigen velden verversen · manualFields heilig
   │         └─ conflictlogboek → training_sessions.merge_log (max 20)
   ├─ consent per datatype (AND, fail-closed)
   ▼
training_sessions (+ streams, power bests, afgeleide TSS bij ingest)
   ├─ sync_runs-logregel (received/nieuw/merged/skipped/errors)
   └─ connector_connections-status (Nederlandse statussen, consentExpired)
```

Afnemers van `training_sessions`: Lab (computeLoadSeries — SSOT belastingsmodel), dagtype-engine, observatie-engine, trainingsplan (feedback/adjust), doelen, Journey, sociaal/feed, Sportpaspoort, FTP-ondergrens, Core-voorspellingen.

## 2. Intelligentie-flow (waarnemen → adviseren)

```
data (sessies, gezondheid, voeding, agenda, weer, profiel, paspoort)
   ▼
deterministische engines (observation, state, day-advice, readiness,
  core-prediction, memory-graph, fueling, race-intel, adaptive coach)
   │   — rekenen, drempels, confidence (<100), ≥2-signalen-guard
   ▼
aiMessage() — centrale gateway (lib/ai/gateway.ts)
   ├─ killswitch → consent → minderjarig → redactie → dedupe
   ├─ Anthropic; prompts met eigen Nederlands-regel
   └─ metadata-only logging (ai_call_logs)
   ▼
verwoording (nooit nieuwe getallen) → ai_observations / adviezen
   ▼
presentatie: dedupe + presentatievariatie (volgorde-seed) → ScreenShell-kaarten
```

## 3. Auth & accountflow

```
Clerk sign-in (cookie) → POST /api/auth/sync (JIT: user_profiles + athlete_profiles,
  e-mail server-side uit Clerk; re-link bij zelfde geverifieerde e-mail)
→ AccountGate (profiel vereist) → onboarding (vragen → connect → gap-fill) → app
Rollen in eigen DB; rolwissel via /api/auth/me/role.
```

## 4. Route- & navigatieflow

```
routeplanner/generator (ORS, echte wegen) → routes (versies, delen, keten)
  ├─ verrijking: hoogteprofiel, Overpass (POI's, wegtypen, opmerkingen, klimmen)
  ├─ export: GPX/FIT (round-trip geverifieerd)
  └─ mobiel: route-match state machine → HUD, audio-cues, off-route-episodes,
     volgauto (aparte autoroute), road-objects (zelflerende verkeerslichten)
Rit-opname (mobiel) → GPX met sensordata → Data Hub-ingest (flow 1)
```

## 5. Meldingenflow

```
producenten (engines, jobs) → notifications (categorie-registry, resolutionKey-dedupe)
  ├─ in-app bel (dagvouwing per Amsterdamse kalenderdag)
  ├─ web push (VAPID, host-allowlist SSRF-guard)
  └─ e-mail (Resend; eerlijk beperkt zonder geverifieerd domein)
Quiet hours dempen alleen push/e-mail; kritieke categorieën nooit uit.
```

## 6. Privacy-flow

Alle deel-/discovery-paden checken visibility fail-closed (17 categorieën); minderjarigen clampen naar veiligheidsminimum; export maskeert tokens; verwijderen = 14 dagen venster + uitzonderingenregister; consent-wijzigingen in audit-log.

---

## 13. Achtergrondprocessen

## Geplande jobs (Scheduled Deployments; CLI in `artifacts/api-server/src/jobs/`)

| Job | Script | Cadans (aanbevolen, Europe/Amsterdam) | Doet |
|---|---|---|---|
| Connector-sync | `job:sync` → `jobs/connector-sync.ts` | dagelijks 05:00 (`0 5 * * *`) | Inhaalsync voor álle gekoppelde platforms via `runScheduledConnectorSync` (zelfde `shouldCatchUp`-regels als per-gebruiker; sequentieel; busy=overslaan; `SYNC_JOB_MAX_CONNECTIONS`). |
| Doelen-review | `job:goal-review` → `jobs/goal-review.ts` | maandelijks (`0 6 1 * *`) | Maandelijkse doelen-review per sporter (`GOAL_REVIEW_MAX_ATHLETES` klep). |
| Health check | `jobs/health-check.ts` | periodiek | Draait de echte admin-probes; release-modus faalt op rood. |
| Kennisscan | `jobs/knowledge-scan.ts` | periodiek | Literatuur-/bronneningest met word-boundary relevantie-guard. |
| Herinneringen | `jobs/reminders.ts` | dagelijks | E-mailherinneringen; idempotent via notifications dedupeKey+sentAt; slaat eerlijk over zonder geverifieerd maildomein. |

Alle vijf zichtbaar in het admin-overzicht "Geplande taken" (`lib/scheduled-tasks.ts`): eerlijke status per job (groen/grijs met reden), cadansbewaking op echte traces.

## In-proces achtergrondmechanismen

- **Per-gebruiker Strava-inhaalsync** (`maybeScheduleStravaCatchUp`): bij app-gebruik, incrementeel met overlap.
- **Webhook-verwerking** (`routes/webhooks.ts`): Strava push-events → gerichte `runSync` per activiteit; fail-closed secrets.
- **Boot self-heal**: afgeleide belastingscore-backfill (`lib/derived-load-backfill.ts`) bij het opstarten.
- **Lazy refresh op leespad**: nieuwsversheid ververst zichzelf bij lezen (geen stille rot als een Scheduled Deployment ontbreekt).
- **Busy-/lock-mechanismen**: pg advisory locks (sync per gebruiker+platform, ticket find-or-create, TSS-backfill).

## Wat er bewust NIET is

Geen cron-daemon in de webserver, geen queues/workers buiten bovenstaande, geen fire-and-forget die stil kan falen (audits zijn de bewuste uitzondering en zijn gelogd).

---

## 14. Feature flags, seed-data en demo-inhoud

## Feature flags (live, zie ook FEATURE_MATRIX.md)

11 flags in `feature_flags` (composite PK, resolutie: per-gebruiker override → releasegroep → rol → globaal; head-tester early access voor has-row flags). Aan: `climb_explorer`, `knowledge_base`, `route_planner`. Uit (uitrol-gestuurd): `ai_observations`, `coach_portal`, `garmin`, `parent_portal`, `premium`, `rit_verhaal`, `strava`, `testing_tools`.

Kill switches (aparte tabel, fail-safe): o.a. `imports_sync`, `external_providers`, `club_features`, model-gateway.

## Seed-/curated data (inhoudelijk, geen mock)

- **Intel-kaarten**: `seed:intel`-script (`intel-seed.ts`) — redactionele startcontent voor de Performance Intelligence Hub.
- **Kennisbank**: governed items, versie-gepind, publish = transactie + snapshot.
- **Uitleg-registry**: frontend-content (Wat/Waarom/Hoe) die met échte profielwaarden rendert.
- **World**: transparant-fictieve virtuele renners + media-cache — expliciet als fictief gelabeld, harde muur naar echte data.

## Wat er NIET is

- Geen mock-UI, geen placeholder-schermen, geen fabricated gebruikersdata (vaste productwet: "Never build static mock-UI").
- Geen demo-accounts in productie. Development Preview Mode is dev-only en fail-closed (`NODE_ENV!=production` én `DEV_AUTH_BYPASS=true`), en resolvet naar een echte `user_profiles`-rij.
- Testers/telemetrie: echte invitations + tester_events (geen synthetische data).

---

## 15. Bekende beperkingen, technische schuld & productiestatus

## Bekende beperkingen (bewust en eerlijk in de UI gemeld)

1. **Garmin/Wahoo**: code compleet, wacht op fabrikant-API-sleutels (`configured: false`).
2. **E-mail**: geen geverifieerd domein; Resend-sandbox bezorgt alleen aan de accounteigenaar; herinnerings-/meldingsmails slaan eerlijk over.
3. **KNWU-kalender**: volledige kalender achter onbereikbare login-SPA; import eerlijk beperkt.
4. **BLE + achtergrondopname mobiel**: vereisen een native (EAS) build; Expo Go/web melden "niet ondersteund".
5. **Wekker/alarm web**: web kan een vergrendelde telefoon niet laten rinkelen — wordt letterlijk zo gezegd.
6. **Weer in analyses**: weer is beschikbaar op Vandaag (Open-Meteo) maar telt in de observatie-engine bewust als "ontbrekend signaal" voor historische analyses.
7. **Externe afhankelijkheden**: Overpass (POI's/wegtypen), ORS (routing), Open-Meteo — storingen worden eerlijk getoond, nooit met verzonnen data gemaskeerd.
8. **Route-generator**: vrije-tekst-wens stuurt alleen de toelichting (ORS kan geen wegen "kiezen op wens"); eerlijk "kan niet + alternatief".
9. **Exacte FTP**: zonder power-curve alleen een eerlijke ondergrens-afleiding.
10. **Fitbit**: registry-vermelding zonder implementatie (niet aangeboden in UI).

## Technische schuld (klein, gedocumenteerd)

1. **api-server serverbundel is groot** (multi-MB esbuild-bundel; server-side, niet naar de browser — echte verkleining vraagt route-lazy loading).
2. **Testworkflows delen één `dist/`** en moeten sequentieel draaien (build-semafoor + retry-runner aanwezig; workflow-limiet van het platform is bereikt, nieuwe tests draaien via shell).
3. **Drizzle push drift-lussen**: 63-tekens naamafkapping en array-default `'{}'` geven eeuwige no-op-diffs (gedocumenteerd, onschadelijk).
4. **`.migration-backup/`**: originele Next.js-bron als referentie in de repo (bewust bewaard als content-SSOT voor Insights).
5. **pino worker-transport** is flaky in tests/jobs → sync stream in tests (prod JSON ongewijzigd).
6. **Open TODO's/FIXME's in code: 0** (grep bevestigd op exportdatum).

## Productiestatus (deployment)

- Autoscale-deployment voor web+API (Vite-build + esbuild-serverbundel); liveness vereist een antwoord op de kale `/api`-basis (aanwezig).
- Scheduled Deployments nodig voor de vijf jobs (cadans in BACKGROUND_PROCESSES.md); zonder deze draaien alleen de in-proces mechanismen.
- Productie-secrets vereist: Clerk-sleutels, `DATABASE_URL`, `SPARKI_ADMIN_IDS`, Strava-sleutels, `VAPID_PRIVATE_KEY`, `MAPBOX_ACCESS_TOKEN`.
- Mobiel: distributie via releasecandidate-straat + store-distributiekanaal (426-mechanisme; nooit tijdens actieve rit).
- Release-gate: health-check `release`-modus faalt op onopgeloste rode checks — verplicht vóór promotie.

---

## 16. Open TODO's

Grep over de volledige broncode op TODO/FIXME/HACK/XXX op 24 juli 2026: **0 treffers**. Er zijn geen open TODO-markeringen in de code.

---

## 17. Alle API-endpoints (548, per router met mount-prefix)

Alle endpoints van de Express API-server (@workspace/api-server), gegroepeerd per routerbestand. Prefix = mount-pad onder /api zoals gemount in src/routes/index.ts. Auth: Clerk-sessiecookie; athlete-owned routes filteren op clerkId; admin-routes vereisen SPARKI_ADMIN_IDS.

## account.ts — /api/account
- GET /overview
- POST /delete/cancel

## activity-imports.ts — /api/activity-imports
- GET /
- POST /
- PATCH /:id/link
- DELETE /:id

## admin.ts — /api/admin
- GET /whoami
- GET /status
- POST /reset-onboarding
- GET /health
- POST /health/run
- GET /testers
- GET /test-dashboard
- GET /feedback
- GET /failed-imports
- GET /health/batches
- GET /security
- GET /quality
- GET /ai-insights
- GET /data-provenance

## ai.ts — /api/ai (kill switch ai_processing)
- POST /brief
- POST /ask
- GET /observations
- GET /sources
- POST /connections
- PATCH /observations/:id
- GET /preferences
- PUT /preferences
- POST /workout-explain
- POST /workout-explain-extended
- POST /workout-adjust

## alerts.ts — /api/alerts
- POST /crash

## analysis-feedback.ts — /api/analysis-feedback
- POST /
- GET /

## athlete.ts — /api/athlete
- GET /profile
- PUT /profile
- PUT /health-status
- GET /dashboard
- GET /workouts/today
- GET /workouts
- POST /workouts
- PUT /workouts/:id
- DELETE /workouts/:id
- GET /workouts/:id/history
- GET /workouts/:id
- POST /workouts/:id/feedback
- GET /life-events
- POST /life-events
- DELETE /life-events/:id
- POST /plan/generate
- GET /sessions
- GET /sessions/:id
- POST /sessions/:id/trim-preview
- POST /sessions/:id/trim
- DELETE /sessions/:id/trim
- POST /sessions
- PUT /sessions/:id
- GET /metrics
- POST /metrics
- GET /load
- GET /power-bests
- GET /ftp
- POST /ftp

## audio.ts — /api/audio
- GET /preferences
- PUT /preferences

## auth.ts — /api/auth
- POST /sync
- GET /me
- PUT /me/role

## bike-scan.ts — /api/bike-scan
- POST /start
- POST /:scanId/frame
- POST /frame/:frameId/cutout
- POST /:scanId/complete
- GET /bike/:bikeId
- GET /frame/:frameId/:kind
- DELETE /bike/:bikeId
- GET /assets
- POST /assets
- GET /assets/:id/image
- DELETE /assets/:id

## bug-reports.ts — /api/bug-reports
- POST /
- GET /mine
- GET /admin
- PATCH /admin/:id
- GET /:id/comments
- POST /:id/comments

## calendar.ts — /api/calendar
- GET /sources
- GET /search
- GET /event

## climbs.ts — /api/climbs
- GET /search
- GET /detail

## club.ts — /api/clubs (kill switch club_features)
- POST /
- GET /
- POST /join
- GET /:clubId
- PUT /:clubId
- POST /:clubId/join-code
- GET /:clubId/locations
- POST /:clubId/locations
- PUT /:clubId/locations/:locationId
- GET /:clubId/calendar
- GET /:clubId/subscription
- PUT /:clubId/subscription
- GET /:clubId/members
- PUT /:clubId/members/:memberId/role
- POST /:clubId/members/:memberId/end
- POST /:clubId/teams
- PUT /:clubId/teams/:teamId
- POST /:clubId/groups
- POST /:clubId/teams/:teamId/members
- POST /:clubId/groups/:groupId/members
- POST /:clubId/trainer-assignments
- POST /:clubId/trainings
- GET /:clubId/trainings
- PUT /:clubId/trainings/:trainingId
- POST /:clubId/trainings/:trainingId/signup
- POST /:clubId/trainings/:trainingId/link-schedule
- PUT /:clubId/trainings/:trainingId/attendance
- POST /:clubId/races
- GET /:clubId/races
- PUT /:clubId/races/:eventId
- POST /:clubId/races/:eventId/selection
- PUT /:clubId/races/:eventId/availability
- POST /:clubId/messages
- GET /:clubId/messages
- POST /:clubId/messages/:messageId/read
- GET /:clubId/consents/mine
- POST /:clubId/consents
- GET /:clubId/trainer/athletes
- GET /:clubId/trainer/athletes/:athleteId/summary
- GET /:clubId/export
- GET /:clubId/audit

## coach-cockpit.ts — /api/coach
- GET /dashboard
- GET /athletes/:athleteId/signals
- POST /athletes/:athleteId/review
- GET /athletes/:athleteId/workouts
- POST /athletes/:athleteId/workouts
- POST /workouts/bulk
- GET /athletes/:athleteId/proposals
- POST /proposals/:proposalId/decision
- GET /athletes/:athleteId/messages
- POST /athletes/:athleteId/messages
- GET /messages
- POST /messages/reply
- GET /athletes/:athleteId/context-items
- POST /athletes/:athleteId/context-items
- PUT /context-items/:itemId
- DELETE /context-items/:itemId
- GET /context-items/about-me

## coach.ts — /api/coach
- GET /athletes
- GET /athletes/:athleteId
- GET /athletes/:athleteId/plan
- GET /athletes/:athleteId/context
- POST /athletes/:athleteId/plan/adopt
- GET /analysis
- POST /followup
- POST /feedback

## connectors.ts — /api/connectors
- GET /
- POST /:id/sync
- GET /:id/runs
- POST /:id/backfill
- POST /:id/disconnect
- POST /:id/revoke
- GET /:id/authorize
- GET /strava/callback

## core-prediction.ts — /api/core-prediction
- GET /:workoutId

## device-sync.ts — /api/device-sync
- GET /status
- GET /:provider/authorize
- GET /:provider/callback
- POST /:provider/disconnect
- POST /send

## dev.ts — /api/dev
- GET /preview-athletes

## document-analysis.ts — /api/document-analyses (kill switch ai_processing)
- GET /
- GET /:id
- POST /
- POST /:id/answers
- POST /:id/link
- DELETE /:id

## engagement.ts — /api/engagement
- GET /rhythm

## feed.ts — /api/feed
- GET /news

## flags.ts — /api/flags
- GET /
- GET /admin/definitions
- PUT /admin/definitions/:key
- GET /admin/overrides/:clerkId

## garage.ts — /api/garage
- GET /
- POST /bikes
- PATCH /bikes/:id
- DELETE /bikes/:id
- POST /bikes/:id/photo
- GET /photo/:bikeId/:idx
- GET /catalog
- POST /components
- PATCH /components/:id
- DELETE /components/:id
- GET /upgrade
- POST /test/estimate
- GET /test/compare
- GET /developments
- GET /pro-teams
- POST /sensors
- PATCH /sensors/:id
- DELETE /sensors/:id
- GET /usage
- GET /components/:id/usage
- GET /signals
- GET /components/:id/events
- POST /components/:id/events
- DELETE /events/:eventId
- GET /events/:eventId/photo/:idx
- PUT /sessions/:sessionId/bike
- GET /choices
- PUT /choices

## goals.ts — /api/goals
- GET /
- POST /
- PUT /:id
- DELETE /:id
- GET /:id/events
- POST /proposals/build
- POST /proposals/:id/decision

## health-flow.ts — /api/health-flow
- GET /overview
- GET /checkin-context
- GET /history
- POST /complaints
- POST /complaints/:id/updates
- POST /resume
- GET /safety-info
- PUT /safety-info

## health.ts — /api (root-gemount)
- GET /
- GET /healthz

## hub.ts — /api/hub
- GET /overview
- GET /sources
- GET /consents
- PUT /consents/:provider
- GET /logs
- GET /equipment
- POST /equipment
- PATCH /equipment/:id
- DELETE /equipment/:id
- POST /sync/:id
- POST /sync

## index.ts — /api (mount-bestand; eigen basisroutes)

## input-center.ts — /api (root-gemount)

## insights.ts — /api (root-gemount)
- GET /open-loops
- GET /honest

## intel.ts — /api/intel
- GET /meta
- GET /
- GET /:id
- POST /:id/flag

## invitations.ts — /api/invitations
- POST /
- GET /
- GET /:token
- POST /:token/accept
- POST /:token/decline
- POST /:id/revoke

## journey.ts — /api/journey
- GET /
- GET /race/:raceId
- POST /items
- POST /media
- PUT /media/:id

## knowledge-admin.ts — /api/knowledge-beheer
- GET /
- POST /items
- PUT /items/:id
- POST /items/:id/publiceer
- POST /items/:id/status
- GET /items/:id/versies
- POST /feedback/:id/afhandelen

## knowledge.ts — /api/knowledge
- GET /meta
- GET /
- POST /scan
- GET /explain
- GET /bronnen
- POST /feedback

## legal.ts — /api/legal
- GET /status
- GET /:kind
- POST /:kind/accept
- POST /:kind/revoke

## links.ts — /api/links
- GET /
- DELETE /coach/:coachClerkId
- DELETE /parent/:parentClerkId
- DELETE /as-coach/:athleteClerkId
- DELETE /as-parent/:athleteClerkId
- GET /parents/manage
- GET /parent-reports
- POST /parent-reports/:id/status
- GET /parent/:parentClerkId/messages
- POST /parent/:parentClerkId/messages
- GET /emergency-contacts

## live-location.ts — /api/live-location
- GET /group-options
- POST /sessions
- GET /sessions/current
- DELETE /sessions/current
- POST /positions
- GET /friends

## material.ts — /api/material
- GET /categories
- GET /nudge
- GET /
- POST /analyze
- POST /:id/photo
- GET /photo/:id/:idx

## memory.ts — /api/memory
- POST /context
- GET /context
- GET /follow-ups/due
- POST /follow-ups/:id/answer
- POST /follow-ups/:id/dismiss
- PATCH /context/:id
- DELETE /context/:id

## mental.ts — /api (root-gemount)

## nav-settings.ts — /api/nav-settings
- GET /
- PUT /

## notifications.ts — /api/notifications
- GET /push/key
- POST /push/subscribe
- POST /push/unsubscribe
- GET /preferences
- PUT /preferences
- GET /
- PATCH /:id/read
- POST /read-batch
- POST /read-all

## nutrition.ts — /api/nutrition
- GET /
- POST /
- DELETE /:id
- GET /photo/:id/:idx
- POST /:id/photo-advice
- GET /day-analysis
- GET /season-goal
- PUT /season-goal
- GET /fueling-plan
- GET /preferences
- PUT /preferences
- GET /session-targets
- GET /guidance

## onboarding.ts — /api/onboarding
- GET /missing-data
- POST /missing-data
- GET /state
- PUT /state
- POST /quick-start
- POST /complete-v2
- GET /identity
- POST /coaching-mode
- GET /next-questions
- POST /answer
- POST /skip

## parent.ts — /api/parent
- GET /athletes
- GET /athletes/:athleteId/context
- GET /overview
- GET /athletes/:athleteId/permissions
- PUT /athletes/:athleteId/permissions
- POST /athletes/:athleteId/reports
- GET /athletes/:athleteId/reports
- GET /athletes/:athleteId/messages
- POST /athletes/:athleteId/messages
- GET /reports/for-coach

## passport.ts — /api/passport
- GET /
- GET /ontwikkeling
- POST /waarde
- POST /voorstellen/:id/besluit
- POST /export

## photo-style.ts — /api/photo-style
- POST /stylize
- POST /decor/clear
- POST /:id/choose
- POST /:id/use-as-decor
- GET /latest

## privacy.ts — /api/privacy
- GET /
- PUT /

## race-exports.ts — /api/races
- GET /:raceId/exports
- POST /:raceId/exports
- GET /:raceId/exports/:exportId/download

## race-points.ts — /api/races
- GET /:raceId/points
- POST /:raceId/points
- PATCH /:raceId/points/:pointId
- DELETE /:raceId/points/:pointId

## race-rooms.ts — /api (root-gemount)
- GET /race-rooms/music
- GET /race-rooms
- POST /race-rooms

## races.ts — /api/races
- GET /
- GET /insight
- GET /:id/intel
- GET /:id/context
- GET /:id/evaluation
- GET /:id/course
- GET /:id/advice
- GET /:id/dossier
- POST /
- PUT /:id
- PUT /:id/checklist
- DELETE /:id

## release.ts — /api/release
- POST /errors
- GET /notes
- POST /notes/:id/read
- GET /pilot-status
- POST /pilot-consent
- GET /version-check
- GET /admin/kill-switches
- PUT /admin/kill-switches/:key
- GET /admin/versions
- PUT /admin/versions/:platform
- GET /admin/users
- PUT /admin/users/:clerkId/group
- GET /admin/clubs
- PUT /admin/clubs/:id/group
- GET /admin/errors
- GET /admin/errors/:id
- POST /admin/errors/:id/resolve
- GET /admin/guards
- PUT /admin/guards/:flagKey
- GET /admin/notes
- POST /admin/notes
- POST /admin/notes/:id/publish
- POST /admin/rollback
- GET /admin/operations

## ride-story.ts — /api/ride-story
- GET /sync-status
- GET /moment

## road-objects.ts — /api/road-objects
- GET /along-route/:routeId
- GET /session/:importId/stops
- POST /:id/confirm

## route-proposals.ts — /api/routes
- POST /:id/voorstel
- GET /voorstellen
- POST /voorstellen/:id/reageer
- POST /voorstellen/:id/aanpassen

## routes.ts — /api/routes
- GET /
- GET /gedeeld
- GET /geocode
- GET /pace
- GET /:id
- GET /:id/insight
- POST /:id/rejoin
- POST /remarks-preview
- POST /surfaces-preview
- GET /:id/surfaces
- GET /:id/remarks
- GET /:id/pois
- POST /:id/detour-via
- GET /:id/gpx
- GET /:id/tcx
- GET /candidate/:candidateId/gpx
- GET /candidate/:candidateId/tcx
- POST /generate
- POST /generate/options
- POST /
- POST /from-activity
- PUT /:id
- POST /:id/duplicate
- POST /:id/delen
- GET /:id/delen
- DELETE /:id/delen/:shareId
- POST /:id/navigatie-start
- GET /:id/vergelijk
- DELETE /:id

## share.ts — /api/share
- GET /session/:id
- POST /session/:id/strava

## social.ts — /api/social
- GET /overview
- POST /follow/:clerkId
- DELETE /follow/:clerkId
- GET /blocks
- POST /blocks/:clerkId
- DELETE /blocks/:clerkId
- POST /reports
- GET /privacy
- PUT /privacy
- GET /profile/:clerkId
- POST /contacts/match
- GET /friends
- GET /requests
- GET /search
- POST /requests
- POST /requests/:id/respond
- POST /friends/:clerkId/buddy
- DELETE /friends/:clerkId
- GET /feed
- GET /circle-feed
- GET /suggestion
- GET /proposals
- POST /proposals
- POST /proposals/:id/respond
- GET /team
- PUT /team

## sparki-world.ts — /api/world
- GET /feed
- GET /athletes/:slug
- POST /athletes/:id/follow
- DELETE /athletes/:id/follow
- POST /posts/:id/like
- GET /posts/:id/comments
- POST /posts/:id/view
- POST /posts/:id/save
- POST /posts/:id/share
- GET /saved
- GET /recommended
- GET /heroes
- POST /posts/:id/comments

## sprints.ts — /api/sprints
- GET /route/:id
- POST /route/:id/rescan
- POST /result
- GET /season
- POST /place
- POST /result/:id/share

## state.ts — /api/state
- GET /

## storage.ts — /api (root-gemount)

## support.ts — /api/support
- POST /helpdesk/ask
- POST /helpdesk/:id/feedback
- GET /artikelen
- GET /tickets
- GET /tickets/:id
- POST /tickets/:id/messages
- GET /beheer/tickets
- GET /beheer/groepen
- GET /beheer/tickets/:id
- PATCH /beheer/tickets/:id
- POST /beheer/tickets/:id/notitie
- POST /beheer/tickets/:id/concept
- POST /beheer/tickets/:id/verzend
- POST /beheer/tickets/:id/samenvoegen
- GET /beheer/storingen
- POST /beheer/storingen
- PATCH /beheer/storingen/:id
- GET /beheer/artikelen
- POST /beheer/artikelen
- POST /beheer/tickets/:id/naar-artikel
- PATCH /beheer/artikelen/:id
- POST /beheer/artikelen/:id/publiceer

## telemetry.ts — /api/telemetry
- POST /

## training-plan.ts — /api/training-plan
- GET /
- POST /generate
- POST /regenerate
- POST /adapt
- POST /pause
- POST /resume
- DELETE /

## voice.ts — /api/voice (kill switch ai_processing)
- GET /

## volgauto.ts — /api/routes
- GET /:id/volgauto
- POST /:id/volgauto
- DELETE /:id/volgauto
- POST /:id/volgauto/rejoin
- POST /:id/volgauto/position
- GET /:id/volgauto/positions
- POST /:id/volgauto/reports
- GET /:id/volgauto/reports

## weather.ts — /api/weather
- GET /home

## webhooks.ts — /api/webhooks
- GET /strava
- POST /strava
- POST /garmin
- POST /wahoo

## world-social.ts — /api/world-social
- POST /items
- PUT /items/:id
- DELETE /items/:id
- GET /items/mine
- GET /feed
- GET /items/:id
- GET /blocks
- POST /blocks
- POST /reports
- GET /moderation
- GET /prefs
- PUT /prefs


**Totaal:** 548 endpoints in 74 routerbestanden.
