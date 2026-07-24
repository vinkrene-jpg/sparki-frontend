# ARCHITECTURE — Sparki (huidige staat, 24 juli 2026)

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
