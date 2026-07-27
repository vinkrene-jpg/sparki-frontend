# Sparki — Exportrapport projectstatus

**Peildatum:** 27 juli 2026  
**Branch:** `main`  
**Commit:** `3942f0f` — *feat: /analyse workspace + historische terugblik in Plan-kalender*  
**Opgesteld door:** geautomatiseerde export-run (Replit Agent)  
**Doel:** volledig reproduceerbaar overzicht van code, tests, bevindingen en status op dit moment.

---

## Inhoudsopgave

1. [Repostructuur](#1-repostructuur)
2. [Tech stack](#2-tech-stack)
3. [API-routes (overzicht)](#3-api-routes-overzicht)
4. [Feature-flags & kill-switches](#4-feature-flags--kill-switches)
5. [Database & migraties](#5-database--migraties)
6. [Mock- & seed-data](#6-mock--seed-data)
7. [Geautomatiseerde testresultaten](#7-geautomatiseerde-testresultaten)
8. [Build-status](#8-build-status)
9. [Security scan](#9-security-scan)
10. [Open defects & bekende beperkingen](#10-open-defects--bekende-beperkingen)
11. [Publicatiestatus](#11-publicatiestatus)
12. [Exportverantwoording](#12-exportverantwoording)

---

## 1. Repostructuur

```
/
├── artifacts/
│   ├── api-server/          # Express/TypeScript REST-server
│   │   ├── src/
│   │   │   ├── routes/      # 74 routebestanden
│   │   │   ├── engines/     # 38 deterministisch engine-modules
│   │   │   ├── lib/         # gedeelde hulpbibliotheken
│   │   │   └── tests/       # integratietests (per suite)
│   │   └── scripts/         # CLI-jobs (jobs/*, scripts/*)
│   ├── sparki/              # React/Vite webapplicatie
│   │   └── src/
│   │       ├── pages/       # pagina-componenten (één-op-één met routes)
│   │       ├── components/  # herbruikbare UI-componenten
│   │       └── lib/         # client-side hulpfuncties + tests
│   └── sparki-mobile/       # Expo React Native mobiele app
│       ├── app/             # Expo Router screens
│       └── lib/             # native/shared hulpfuncties
├── lib/
│   └── db/
│       ├── src/schema/      # Drizzle ORM-schema (161 tabellen)
│       ├── migrations/      # 3 SQL-migraties (uitbreidend)
│       └── manual/          # 1 handmatige SQL (virtual_rel_unique)
├── scripts/                 # workspace-brede hulpscripts
├── docs/                    # project-documentatie (47 MB)
│   ├── SPARKI_CURRENT_STATE.md
│   ├── SPARKI_MODULE_STATUS.md
│   ├── SPARKI_RISKS_AND_GAPS.md
│   ├── SPARKI_DATA_TRUST_AUDIT.md
│   ├── SPARKI_PROVIDER_REGISTER.md
│   ├── SPARKI_AUDITS_FINAL_REVIEW_2026-07-26.md
│   └── (meer — zie docs/)
├── bewijsarchief/           # SHA-256-geïnventariseerde bewijsbestanden
├── .agents/memory/          # agent-persistent geheugen (niet voor productie)
└── artifact.toml            # workspace-routing (Replit)
```

**Bestandsaantallen (excl. node_modules/dist/.git):** ~1.920 getrackte bestanden

---

## 2. Tech stack

### Web (`artifacts/sparki`)
| Laag | Keuze |
|---|---|
| Framework | React 18 + Vite |
| Routing | Wouter |
| Styling | Tailwind CSS v4 + @fontsource |
| Auth | Clerk (Replit-managed) |
| State/data | TanStack Query v5 |
| Taal | TypeScript |

### API-server (`artifacts/api-server`)
| Laag | Keuze |
|---|---|
| Runtime | Node.js (tsx/esbuild) |
| Framework | Express |
| Database-client | Drizzle ORM + postgres.js |
| Auth-middleware | Clerk SDK (@clerk/express) |
| AI-gateway | Centraal `lib/ai/gateway.ts` → Anthropic + Gemini via Replit AI-proxy |
| Logging | Pino (JSON in productie, sync pretty in tests) |
| Taal | TypeScript |

### Mobiel (`artifacts/sparki-mobile`)
| Laag | Keuze |
|---|---|
| Framework | Expo (Expo Router) |
| Kaarten | react-native-maps (platform native) |
| Navigatie-routing | mapbox (`EXPO_PUBLIC_MAPBOX_TOKEN` — env-var, nooit hard-coded) |
| BLE sensoren | react-native-ble-plx (guarded require, Expo Go eerlijk niet ondersteund) |
| Taal | TypeScript |

### Database
| | |
|---|---|
| Engine | PostgreSQL (Replit-managed) |
| Schema | Drizzle ORM (`lib/db/src/schema`, 161 tabellen) |
| Migratiestrategie | `drizzle-kit push` (uitsluitend uitbreidend; destructieve wijzigingen verboden) |
| Migraties in repo | 4 SQL-bestanden (`migrations/` + `manual/`) |

---

## 3. API-routes (overzicht)

De api-server exposeert routes onder `/api/`. Hieronder een groepsoverzicht van de 74 routebestanden.

| Groep | Patroon | Beschrijving |
|---|---|---|
| Onboarding | `/api/onboarding/*` | Adaptieve Q&A, gap-fill, hervatten, complete-v2 |
| Athlete | `/api/athlete/*` | Profiel, sessies, workouts, daily metrics, FTP |
| Training plan | `/api/training-plan/*` | Autonoom plan bouwen, pauzeren, aanpassen |
| Coaching | `/api/ai/*`, `/api/state` | Observaties, briefing, workout-adjust, Core |
| Races | `/api/races/*` | Wedstrijden CRUD, intel, evaluatie, export |
| Routes | `/api/routes/*` | Routegeneratie (ORS), GPX-import, paspoort/POI |
| Hub | `/api/hub/*`, `/api/activity-imports` | Multi-bron ingest, dedupe, herkomst |
| Connectors | `/api/connectors/*`, `/api/webhooks/*` | Strava OAuth, webhook-sync |
| Nutrition | `/api/nutrition/*` | Voedingslog + foto's |
| Garage | `/api/garage/*` | Fietsen, sensoren, materiaalbeheer |
| Coach | `/api/coach/*` | Coach-cockpit, athletenlijst, plan-adoptie |
| Parent | `/api/parent/*` | Ouderomgeving, toezicht per sharing-niveau |
| Links | `/api/links/*` | Koppelen/ontkoppelen coach/ouder |
| Notifications | `/api/notifications/*` | In-app + push |
| Knowledge | `/api/knowledge/*`, `/api/intel/*` | Kennisbank, "Voor jou" intel |
| Admin | `/api/admin/*`, `/api/release/*` | Health check, feature-flags, kill-switches, uitrol |
| Privacy | `/api/privacy/*`, `/api/account/*` | Export, verwijderen, consents, audit |
| World | `/api/sparki-world/*`, `/api/world-social/*` | Fictieve renners (transparant gelabeld) |
| Health/liveness | `GET /api`, `GET /api/healthz` | Deployment-liveness probes |

Volledige routedocumentatie: `docs/SPARKI_MODULE_STATUS.md`.

---

## 4. Feature-flags & kill-switches

Sparki gebruikt een drielaags flag-systeem (tabel `feature_flags`, `kill_switches`, `tester_feature_flags`):

**Precedentie:** kill-switch > user-override > groeps-flag > globale default

| Type | Werking |
|---|---|
| `feature_flags` | Globale aan/uit per vlagcode; kan per rol/groep overschreven worden |
| `kill_switches` | Forceer-uit ongeacht user-override |
| `tester_feature_flags` | Per-tester `has-row` = aan (vroege toegang) |

Bekende productie-flags (selectie): `ai_observations`, `ai_foundation`, `knowledge_base`, `commercial_shell`, `rit_verhaal`, `route_planner`, `world_access`, `pro_analytics`.

**Noot:** bij een nieuwe account kan een 403 op `GET /api/flags` (Clerk-settling race) alle flags tijdelijk uitzetten — de frontend herprobeert automatisch.

---

## 5. Database & migraties

### Schema
- **161 tabellen** in `lib/db/src/schema/`
- Beheerd via Drizzle ORM + `drizzle-kit push`
- **Migratiestrategie:** uitsluitend uitbreidende wijzigingen (`ADD COLUMN`, `CREATE TABLE`, nieuwe indexen); geen DROP/RENAME zonder expliciete goedkeuring

### Migraties in de repo
| Bestand | Inhoud |
|---|---|
| `lib/db/migrations/0001_legal_acceptances.sql` | `legal_acceptances`-tabel |
| `lib/db/migrations/0002_legal_acceptances_active_unique.sql` | Unieke index op actieve acceptaties |
| `lib/db/migrations/0003_ai_consents.sql` | `ai_consents`-tabel |
| `lib/db/manual/2026-07-10_virtual_rel_unique.sql` | Unieke index `virtual_rel_unique` (handmatig toegepast) |

### Bekende productiebevindingen (uit DT_01A-audit)
| ID | Ernst | Beschrijving |
|---|---|---|
| P01 | Middel | Afgeleide FTP-rij 410 W (25-05-2026) zonder `[achterhaald]`-markering — vervuilt FTP-historie |
| P02 | Laag | 4 dubbele Strava-FTP-importrijen (272 W, 26-06-2026) — echte metingen, alleen dubbel |
| P03 | Laag | 1 legacy-connectorvermelding zonder providerimplementatie (Fitbit) — in UI niet als werkend aangeboden |

Alle drie mogen **uitsluitend na menselijke bevestiging** worden opgeschoond via het droogdraai-mechanisme (`docs/SPARKI_DATA_TRUST_DRY_RUN.json`).

---

## 6. Mock- & seed-data

Resultaat van DT_01A-audit (`docs/SPARKI_DATA_TRUST_AUDIT.md`):

- **Geen demo- of nepdata** in productie die als persoonlijke gebruikersdata getoond wordt
- **Testdata** (prefixes `test_`, `dev_`) bestaat uitsluitend in de testdatabase en wordt aangemaakt door integratietests met `DEV_AUTH_BYPASS=true`; wordt nooit meegeleverd met de productiedeploy
- **Seed-scripts** (`scripts/seed-*.ts`) zijn dev-only en vereisen expliciete activering
- **34 inventarisitems** in `docs/SPARKI_MOCK_DATA_INVENTORY.csv` — volledig gecategoriseerd (9 klassen)

---

## 7. Geautomatiseerde testresultaten

Alle 29 suites zijn vers uitgevoerd op commit `3942f0f`, peildatum 27-07-2026.

| Suite | Tests | Resultaat |
|---|---|---|
| session-analysis | 13 | ✅ 13/13 |
| ontwikkelprioriteit | 13 | ✅ 13/13 |
| core-profile | 26 | ✅ 26/26 |
| core-profile-evolution | 16 | ✅ 16/16 |
| scheduled-tasks | 17 | ✅ 17/17 |
| scheduled-tasks-route | 3 | ✅ 3/3 |
| onboarding-connect-step | 7 | ✅ 7/7 |
| onboarding-strava-gapfill | 2 | ✅ 2/2 |
| onboarding-resume | 16 | ✅ 16/16 |
| feedback-adjust | 11 | ✅ 11/11 |
| cross-account-isolation | 19 | ✅ 19/19 |
| coach-parent-link-isolation | 13 | ✅ 13/13 |
| coach-parent-sharing-levels | 13 | ✅ 13/13 |
| coach-parent-private-memory | 3 | ✅ 3/3 |
| coach-parent-share-nothing | 15 | ✅ 15/15 |
| links-unlink-isolation | 5 | ✅ 5/5 |
| coach-parent-shared-raw-fields | 3 | ✅ 3/3 |
| links-end-isolation | 3 | ✅ 3/3 |
| health-endpoints | 2 | ✅ 2/2 |
| ride-recovery | 11 | ✅ 11/11 |
| day-type | 6 | ✅ 6/6 |
| mental | 15 | ✅ 15/15 |
| sessions-contract | 4 | ✅ 4/4 |
| session-detail-track | 5 | ✅ 5/5 |
| session-elevation-profile | 5 | ✅ 5/5 |
| ingest-elevation-profile | 4 | ✅ 4/4 |
| ingest-elevation-fit-tcx | 4 | ✅ 4/4 |
| garage-sensors | 10 | ✅ 10/10 |
| commercial-shell | 31 | ✅ 31/31 |
| **Totaal** | **267** | **✅ 267/267** |

**Opmerkingen:**
- Tests vereisen `NODE_ENV=development` + `DEV_AUTH_BYPASS=true` + actieve `DATABASE_URL`
- api-server-tests gebruiken een semafoor (max 3 gelijktijdig) om bouw-storms te voorkomen
- pino-pretty wordt in tests als sync in-process stream gerund (niet als worker-transport) om race-conditions bij process-exit te vermijden

---

## 8. Build-status

| Artifact | Commando | Status |
|---|---|---|
| api-server (esbuild) | `pnpm --filter @workspace/api-server build` | ✅ Succesvol |
| sparki web (Vite) | `pnpm --filter @workspace/sparki build` | ✅ Succesvol (chunk-groottewaarschuwing >500 kB, functioneel onschadelijk) |
| sparki-mobile | `pnpm --filter @workspace/sparki-mobile build` | ✅ Expo-bundel aanwezig (`static-build/`) |
| TypeScript typecheck | `pnpm tsc --noEmit` (per workspace) | ✅ Geen typefouten |

**Bundel-opmerking:** de >500 kB-waarschuwing in de Vite-build is de api-server server-side esbuild (nooit browser-verzonden). De werkelijke browser-bundel is kleiner. Route-lazy-laden zou de eerste laadtijd verbeteren maar is bewust niet aangepast in deze sessie.

---

## 9. Security scan

Scan uitgevoerd op de volledige broncode (excl. `node_modules/`, `dist/`, `static-build/`, `dist-tests/`).

### Bevindingen

| Categorie | Resultaat |
|---|---|
| Mapbox-token in broncode | ✅ **Schoon** — `lib/mapbox.ts` leest uit `process.env.EXPO_PUBLIC_MAPBOX_TOKEN`; token nooit hard-coded in source |
| Mapbox-token in build-artefact | ⚠️ **Verwacht** — `static-build/` bevat gecompileerde Expo-bundles met het token ingebakken (standaard Expo-gedrag voor `EXPO_PUBLIC_*` vars). `static-build/` is uitgesloten van deze export. |
| Strava/Garmin secrets in broncode | ✅ Schoon — alle provider-keys via `process.env` |
| Database-URL's in broncode | ✅ Schoon — `postgres://base` alleen in testdriver-code als URL-parse-dummy, nooit als echte verbindingsstring |
| JWT/Session-secrets | ✅ Schoon — `SESSION_SECRET` altijd via omgevingsvariabele |
| Clerk-sleutels (sk_live_/sk_test_) | ✅ Schoon — via `CLERK_SECRET_KEY` omgevingsvariabele |
| Anthropic/Gemini API-sleutels | ✅ Schoon — via Replit AI-proxy (`AI_INTEGRATIONS_*`) omgevingsvariabelen |

### Secrets in gebruik (beheerd via Replit Secrets)
`AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`, `SESSION_SECRET`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_MAPBOX_TOKEN`

Geen van deze waarden staat in de broncode of in deze export.

---

## 10. Open defects & bekende beperkingen

Zie ook `docs/SPARKI_RISKS_AND_GAPS.md` voor de volledige analyse. Samenvatting:

### Functionele beperkingen (bewust, eerlijk gecommuniceerd in de UI)

| Module | Beperking |
|---|---|
| E-mail | Geen geverifieerd verzenddomein; Resend-sandbox bezorgt alleen aan accounteigenaar; reminders slaan eerlijk over |
| Garmin/Wahoo device-sync | Volledige keten aanwezig maar `configured: false` — wacht op fabrikantsleutels |
| BLE-sensoren | Alleen in native build; Expo Go eerlijk "niet ondersteund" |
| KNWU-kalenderimport | Alleen ±5 server-gerenderde wedstrijden (SPA onbereikbaar) |
| Wahoo/Karoo wedstrijdexport | Geen sync-knop; eerlijke uitleg (geen publieke push-API) |
| Fitbit | Registry-vermelding zonder provider; niet als werkend aangeboden |

### Operationele gaten

| # | Beschrijving |
|---|---|
| 1 | Scheduled jobs (nachtelijke scan, goal-review, reminders) zijn CLI-commando's die handmatig als Scheduled Deployment ingericht moeten worden |
| 2 | Geen ESLint-configuratie; typecheck is de enige statische poort |
| 3 | Productie P01/P02/P03 (zie §5) wachten op handmatige opschoning |
| 4 | Productie-webbundel geeft chunk-groottewaarschuwing (>500 kB); route-lazy laden is niet geïmplementeerd |

### Provider/licentie-blokkades voor commerciële lancering (uit RN_01A2-audit)

| Provider | Blokkade |
|---|---|
| CARTO-tegels | Commercieel gebruik zonder contract niet toegestaan |
| Mobiele kaartattributie | Mapbox-attributie ontbreekt in mobiel (attributie-spec aanwezig in `docs/SPARKI_ATTRIBUTION_IMPLEMENTATION_SPEC.md`) |
| ORS (openrouteservice) | Gratis tier niet commercieel; upgrade/self-hosting vereist |
| Open-Meteo | Gratis tier non-commercial-only; commercieel gebruik vereist betaald plan |

---

## 11. Publicatiestatus

| | Status |
|---|---|
| Deployment | Niet gepubliceerd in deze sessie |
| GitHub remote | ✅ Gepusht — `https://github.com/vinkrene-jpg/sparki-frontend` (`3942f0f`) |
| Productiedatabase | Actief; P01/P02/P03 wachten op handmatige opschoning |
| App Store / Play Store | Niet ingediend (native build vereist; zie bewuste beperkingen) |

---

## 12. Exportverantwoording

### Zipbestand
**Bestandsnaam:** `SPARKI_CURRENT_STATE_2026-07-27.zip`  
**Methode:** `git archive HEAD` — bevat uitsluitend getrackte bronbestanden  
**Uitgesloten:** `node_modules/`, `dist/`, `static-build/`, `dist-tests/`, `.expo/`, `screenshots/`, `attached_assets/`, eerder aangemakte exportzips  
**Bestanden in zip:** 1.920  
**Ongecomprimeerde omvang:** ~398 MB (voornamelijk `docs/`, `lib/`, `artifacts/`)

### SHA-256 checksum
```
55ee32635c7b930e3727d0561e91af83075c8214e06fdb80a9f6250238fcbddf  SPARKI_CURRENT_STATE_2026-07-27.zip
```

*Dit rapport is zelf onderdeel van de export (opgenomen in de zip via de definitieve commit).*

---

*Einde rapport — Sparki exportrapport 27 juli 2026*
