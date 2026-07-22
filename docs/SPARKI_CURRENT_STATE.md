# Sparki — Actuele feitelijke inventarisatie (t.b.v. Garmin- en Wahoo-goedkeuring)

Datum: 22 juli 2026. Bron: directe code-inspectie van deze repository (pnpm-monorepo). Geen aannames; elk onderdeel is gemarkeerd met status en bewijs (bestandspad/route/tabel). Onderdelen die niet bestaan of niet betrouwbaar vastgesteld konden worden zijn expliciet gemarkeerd.

Statuslegenda: **volledig werkend** · **gedeeltelijk werkend** · **alleen interface** · **nog niet gekoppeld** · **buiten gebruik**

---

## 1. Samenvatting van Sparki nu

Sparki is een Nederlandstalig wielerplatform (web + mobiele app) voor renners, coaches en ouders/verzorgers. Kern:

- **Web-app** (`artifacts/sparki`, React + Vite): dagcoaching ("Vandaag"), trainingsplan-engine, wedstrijden, routes, materiaal ("Mechanieker" incl. begeleide fietsscan), voeding, sociaal ("Samen"), club, sportpaspoort, kennisbank, admin-gezondheidscheck.
- **API-server** (`artifacts/api-server`, Express 5 + Drizzle/PostgreSQL): 50+ routers (`src/routes/index.ts`), centrale **Data Hub** (multi-bron activiteiten-ingest met deduplicatie), deterministische coach-/observatie-engines, taalmodel-analyse (Anthropic/Gemini via Replit AI-proxy) voor uitsluitend proza.
- **Mobiele app** (`artifacts/sparki-mobile`, Expo/React Native): turn-by-turn-navigatie, achtergrond-ritregistratie, BLE-sensoren (hartslag/vermogen/cadans), val-alarm, bordjes-sprints, rit delen.
- **Auth**: Replit-beheerde Clerk (cookie-gebaseerd op web); rollen in eigen DB.
- **Databronnen nu echt actief**: Strava (per-gebruiker OAuth, import + export), bestandsupload (GPX/FIT/TCX), handmatige invoer, Open-Meteo (weer), OpenRouteService (routes), Overpass/OSM, wedstrijdkalenders (Fietssport, We-Tri, KNWU beperkt).
- **Garmin en Wahoo**: OAuth-/push-scaffolding aanwezig, maar **nog niet gekoppeld** — er zijn geen fabrikant-API-keys; de UI meldt dit eerlijk (`configured: false`). Zie §5.

Productdoctrine (afdwingbaar in code en tests): eerlijke gaten (nooit gefabriceerde data), plain Dutch, geen "AI"-terminologie in gebruikersteksten, privacy-gated analyse.

## 2. Gebruikers en rollen

Rollen staan in eigen DB: `user_profiles.roles[]` + `active_role` (`lib/db/src/schema/users.ts`). Waarden: `athlete` (standaard), `coach`, `parent`. Admin is géén DB-rol maar een allowlist-check (`isAdmin`, env `SPARKI_ADMIN_IDS`; dev-bypass in ontwikkelmodus).

| Rol | Onboarding | Ziet | Mag |
|---|---|---|---|
| **Sporter (athlete)** | Verplichte flow: quick-start-vragen → **connect-stap** (koppelen verplicht getoond, koppelen zelf optioneel) → gap-fill van alléén ontbrekende velden (`routes/onboarding.ts`) | Alle eigen data | Alles op eigen data: invoeren, koppelen, verwijderen, delen instellen |
| **Trainer/Coach** | Via uitnodiging (token, `routes/invitations.ts`) → `coach_athlete_links` | Per atleet afhankelijk van `data_sharing_coach`: `none` / `summary` (readiness + volgende sessie) / `full` (+ ruwe metrics 14 dagen). Persoonlijke context alleen geabstraheerd, nooit ruwe woorden (`routes/coach.ts`) | Adviesplan voorstellen en overnemen naar atleet-schema (`/api/coach/athletes/:id/plan/adopt`); koppeling beëindigen |
| **Club** | **Geen aparte rol.** `/club`-pagina bestaat (`pages/club.tsx`) en toont trainer(s), clubtrainingen, wedstrijden en clubfeed op basis van bestaande coach-links — geen club-entiteit in de database | Zie links | — |
| **Ouder/verzorger (parent)** | Via uitnodiging → `parent_athlete_links` | `data_sharing_parent`: `none` / `safety_only` (alleen gezondheid/welzijn, géén vermogensdata) / `summary` (+ komend schema) (`routes/parent.ts`) | Toezicht; koppeling beëindigen |
| **Beheerder (admin)** | Allowlist | Gezondheidscheck-dashboard, testersbeheer, geplande-taken-status (`routes/admin.ts`) | Checks draaien, uitnodigingen, storingen markeren |

**Toestemmingen** (`lib/db/src/schema/privacy.ts`, `routes/privacy.ts`): `privacy_settings` per gebruiker met o.a. `dataSharingCoach`, `dataSharingParent`, `parentConsentRequired/Status`, `aiMemoryEnabled`, `aiSensitiveAnalysisEnabled`, `shareActivityWithFriends`, `marketingConsent`, `exportAllowed`, `acceptedTermsAt/acceptedPrivacyAt`, plus **append-only consent-auditlog** (`consent_audit_log`). Per connector kan toegang worden ingetrokken (`permission_revoked`; disconnect/revoke-routes in `routes/connectors.ts`).

**Isolatie is getest**: cross-account-, coach/parent-sharing- en link-isolatie hebben eigen testworkflows (test-cross-account-isolation, test-coach-parent-* — allemaal groen).

## 3. Functiematrix per hoofdstuk

| Hoofdstuk | Route | Status | Kern (bewijs) |
|---|---|---|---|
| Vandaag | `/vandaag` | volledig werkend | Dagtype-engine, één leidend Momentblok, coach-beslislaag, weer (Open-Meteo), zelf-invoerhub (`pages/vandaag.tsx`, engines) |
| Training | `/train` | volledig werkend | Vierlagen-opbouw (bron/doel/vandaag/patronen), planengine met per-sessie-caps, feedback→aanpassingsvoorstel (`pages/train.tsx`, `training-plan.ts`) |
| Wedstrijd | `/races` | volledig werkend | Race Intelligence (voorbereiding/rapport/fuel/checklist, deterministisch), kalender-import Fietssport/We-Tri/KNWU-beperkt, documentanalyse van wedstrijdgidsen (`routes/races.ts`, `lib/calendar/`) |
| Lichaam (Lab/Inzicht) | `/lab` | volledig werkend | Belasting (afgeleide TSS), vorm/vermoeidheid, sessiegrafieken (streams alleen bij ingest; oud = eerlijk leeg), FTP-ondergrens-afleiding (`pages/lab.tsx`) |
| Voeding | sheet in app | volledig werkend | Logs met foto's, leeftijdsgebonden advies (<16 licht), seizoensdoel alléén 17+ (RED-S-bescherming) (`routes/nutrition.ts`) |
| Mechanieker | `/mechanieker` | volledig werkend | Garage (fietsen/onderdelen/sensoren), foto-advies, begeleide **fietsscan** met achtergrondverwijdering en eerlijke 360-weergave (≥8 echte cutouts), productbeelden met verplichte herkomst (`routes/bike-scan.ts`, `routes/garage.ts`) |
| Navigatie/Routes | `/routes` + mobiel | volledig werkend | Routegeneratie (ORS, best-of-N lussen), klimmenverkenner (Overpass), route-paspoort, POI's/koffiestop; mobiel turn-by-turn + herroutering (`routes/routes.ts`, `sparki-mobile/app/navigate/[id].tsx`) |
| Club | `/club` | gedeeltelijk werkend | Weergave op basis van coach-links; **geen club-entiteit/rol in DB** (`pages/club.tsx`) |
| Feed/Sociaal | `/feed`, `/samen` | volledig werkend | Nieuws (echte bronnen, zelfherstellende verversing), Ontdekken-reel (transparant-fictieve Sparki World), vriendenfeed privacy-fail-closed (`routes/feed.ts`, `routes/social.ts`) |
| Sportpaspoort | `/paspoort` | volledig werkend | Profiel, doelen, FTP/CTL/TSB, 90-dagen-ontwikkeling, materiaal; printstijl voor PDF (`pages/paspoort.tsx`) |
| Profiel (Jij) | `/you` | volledig werkend | Afgeleid levend profiel (lenzen/identiteit/evolutie), Ontwikkelkompas, instellingen-sheet (`pages/you.tsx`) |
| Kennis | `/kennis` | volledig werkend | Kennisbank + "Voor jou"-intel, achter feature-flag (`routes/knowledge.ts`, `routes/intel.ts`) |
| Admin | `/admin` | volledig werkend | Gezondheidscheck-engine (echt proben of GRIJS, nooit nep-groen), geplande taken, testers (`routes/admin.ts`) |
| Mobiel: achtergrond-ritregistratie | app | volledig werkend (native build vereist) | OS-taak blijft loggen bij vergrendeld scherm (`sparki-mobile/lib/ride-tracker.ts`) |
| Mobiel: BLE-sensoren | app | volledig werkend (niet in Expo Go) | Hartslag/vermogen/cadans via `react-native-ble-plx`; horloge/derailleur alleen registratie (`lib/ble-sensors.ts`) |
| Mobiel: val-alarm | app | gedeeltelijk werkend | GPS-gebaseerde detectie; "meldingen klaargezet", claimt nooit aflevering (`route-navigator.tsx`) |
| Mobiel: bordjes-sprint, rit delen | app | volledig werkend | Plaatsnaamsprints; Strava-upload + OS-deelmenu (`pages/sprinten.tsx`) |
| Garmin/Wahoo-sync | instellingen | **nog niet gekoppeld** | OAuth-scaffolding (authorize/callback/disconnect) + route-push-endpoint `/api/device-sync/send`; géén webhooks; eerlijk `configured: false` zonder fabrikantkeys (`lib/connectors/providers/device-sync.ts`) |
| Fitbit | registry | **alleen interface** | Registry-entry, geen provider-implementatie |
| E-mailherinneringen | jobs | gedeeltelijk werkend | Engine + dedupe aanwezig; zonder geverifieerd verzenddomein wordt eerlijk overgeslagen (`lib/email.ts`) |

## 4. Sportdata: ontvangen · opslaan · analyseren · visualiseren · aanpassen · exporteren · doorsturen

Centrale ingest: **Data Hub** (`engines/data-hub/`): alle bronnen → `ingestBatch` → validatie → deduplicatie (sport + start-bucket + buurvenster-tolerantie, `dedupe.ts`) → samengevoegde `training_sessions`; ruwe brondata blijft herleidbaar in `connector_activities.raw`.

| Gegeven | Bron | Opslag (tabel) | Verwerking | Doel | Bewaartermijn | Verwijderbaar |
|---|---|---|---|---|---|---|
| Activiteiten | Strava, GPX/FIT/TCX-upload, mobiele ritopname | `training_sessions`, `connector_activities`, `activity_imports` | dedupe, samenvoegen, TSS-afleiding | analyse/coaching | onbeperkt | ja (DELETE-routes; cascade bij profielverwijdering) |
| Vermogen | FIT/TCX-streams, BLE (mobiel), Strava-samenvatting | streams in `activity_imports.parsed_summary` (max 720 buckets); `avg/normalized_power` in sessies | power bests bij parse, FTP-ondergrens, TSS | belasting/vorm | onbeperkt | ja (via import/sessie) |
| Hartslag | idem | idem (`avg_hr`, `max_hr`, streams) | zones, sessiegrafieken | idem | onbeperkt | ja |
| HRV | handmatige check-in | `athlete_daily_metrics.hrv` | readiness/herstel | dagadvies | onbeperkt | ja |
| Cadans | streams/BLE | streams + `avg_cadence` | grafieken | techniek | onbeperkt | ja |
| Snelheid/GPS/hoogte | GPX/FIT/TCX, mobiele opname | streams; track in `parsed_summary.route`; hoogteprofiel in `routes.profile` | hoogte-/klimanalyse, "rit als route bewaren" | navigatie/analyse | onbeperkt | ja |
| Slaap/herstel | check-in | `athlete_daily_metrics` (`sleep_hours`, `sleep_quality`, `fatigue_score`, `feel_score`) | observatie-engine | coaching | onbeperkt | ja |
| Voeding | handmatig + foto's | `nutrition_hydration_logs`, `nutrition_season_goals` | leeftijdsgebonden regels | fueling | onbeperkt | ja (DELETE aanwezig) |
| Gewicht | handmatig / Strava-profiel | `athlete_profiles.weight_kg` (SSOT), daily metrics | seizoensdoel-sturing (≤0,5 kg/wk, 17+) | gezondheid | actueel veld | overschrijfbaar |
| Materiaal | handmatig + fietsscan-foto's | `garage_*`, `bike_scans`, `bike_scan_frames`, `equipment_assets` (verplichte bron+licentie) | foto-advies, slijtage | onderhoud | onbeperkt | ja |
| Wedstrijden | handmatig + kalender-import | `races` (incl. resultaat, checklist, logistiek) | Race Intelligence | voorbereiding | onbeperkt | ja |
| Trainingsplannen | Sparki-engine / coach-adoptie | `training_plans`, `plan_days`, `planned_workouts` | deterministische planbouw | training | onbeperkt | ja |

**Exporteren/doorsturen (feitelijk):** routes als **GPX/TCX** (`/api/routes/:id/gpx`, `/tcx`); rit-GPX vanuit mobiele opname (incl. BLE-sensordata als gpxtpx-extensies); **doorsturen naar Strava** (rit-upload, `activity:write`); OS-deelmenu (mobiel). **NIET aanwezig:** volledige account-data-export (alleen `exportAllowed`-vlag), automatische doorstuur naar andere platformen.

## 5. Bestaande integraties

| Integratie | Status | Details |
|---|---|---|
| **Strava** | OAuth ✓ import ✓ export ✓ sync ✓ webhooks ✗ productiegetest: dev-getest | Per-gebruiker OAuth2 (signed state); endpoints `/oauth/token`, `/athlete`, `/athlete/activities`, activity-upload; scopes `read,activity:read_all,profile:read_all,activity:write`; tokens in `connector_connections`; bestanden `lib/connectors/providers/strava.ts`, `strava-oauth.ts`; env `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`. Geen webhooks — sync is pull-gebaseerd. |
| **Garmin** | configuratie aanwezig, OAuth-scaffolding aanwezig, **nog niet gekoppeld** | `lib/connectors/providers/device-sync.ts` + `routes/device-sync.ts`: OAuth2/PKCE-flow (authorize/callback/disconnect-routes; verifier in signed state) en een route-push-endpoint (`/api/device-sync/send`) voorbereid; **géén webhook-endpoints**. Zonder `GARMIN_CLIENT_ID`/`GARMIN_CLIENT_SECRET` meldt de API eerlijk `configured: false`. Geen import/export/sync actief; niets productiegetest. Vereist Garmin Connect Developer Program-goedkeuring. |
| **Wahoo** | idem | Zelfde architectuur; env `WAHOO_CLIENT_ID`, `WAHOO_CLIENT_SECRET` (Wahoo Cloud API). |
| **Fitbit** | alleen gepland | Registry-entry (`registry.ts`), geen provider-implementatie. |
| **Google** | niet aanwezig | Alleen `fcm.googleapis.com` als push-endpoint-allowlist-item; geen Google-koppeling. (Google-login kan via Clerk beschikbaar zijn, buiten deze codebase geconfigureerd.) |
| **OpenRouteService** | import ✓ (routing/geocoding/hoogte) | `lib/routing/providers/ors.ts`; env `ORS_API_KEY`. |
| **Mapbox** | tiles ✓ | Mobiele kaartweergave; env `MAPBOX_ACCESS_TOKEN` / `EXPO_PUBLIC_MAPBOX_TOKEN`. |
| **Overpass/OSM** | import ✓ | Klimmen, wegobjecten, POI's; meerdere mirrors met fallback (`lib/climbs/overpass.ts`, `lib/road-objects/overpass.ts`). |
| **Open-Meteo** | import ✓ | Dag-/uurweer, uur-matching op utc_offset (`lib/weather/open-meteo.ts`); geen key. |
| **Resend (e-mail)** | configuratie ✓, eerlijk-beperkt | Via Replit-connector (`lib/email.ts`); zonder geverifieerd domein slaat verzending eerlijk over. |
| **Web push (VAPID)** | volledig ✓ | `lib/push.ts` met host-allowlist (SSRF-guard); env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. |
| **Anthropic / Gemini** | volledig ✓ (via Replit AI-proxy) | Proza-generatie, documentanalyse, foto-advies; `lib/integrations-anthropic-ai/`, `lib/integrations-gemini-ai/`; env `AI_INTEGRATIONS_*`. Cijfers/beslissingen blijven deterministisch. |
| **Wedstrijdkalenders** | Fietssport ✓, We-Tri ✓, KNWU eerlijk-beperkt | Regex-parsers, SSRF-allowlist (`lib/calendar/`); KNWU: alleen server-gerenderde "Komende wedstrijden", `mijn.knwu.nl` onbereikbaar — niet nagebootst. |
| **BLE-sensoren (lokaal)** | volledig ✓ (native build) | Hartslag/vermogen/cadans in `sparki-mobile/lib/ble-sensors.ts`; geen cloud-koppeling. |

## 6. Architectuur en datastromen

**Route van data:** bron (Strava/bestand/handmatig/mobiel) → **toestemming** (connector-consent per datatype; `effectiveImportedDataTypes` filtert import op consent) → **import** (`runSync`/`ingestBatch`) → **validatie** (parser-checks, tijdloze GPX ≠ activiteit) → **opslag** (ruwe rij + samengevoegde sessie) → **analyse** (deterministische engines; taalmodel alleen proza, privacy-gated persist) → **visualisatie** (React, sessiegrafieken met eerlijke gaten) → **export/verwijdering** (GPX/TCX, Strava-upload; DELETE-routes, cascade).

- **API-architectuur:** Express 5-routers onder `/api`, engine-laag (`engines/<naam>` facades) tussen routes en lib.
- **Authenticatie:** Clerk (cookie), `requireAuth` middleware; mobiel gebruikt dezelfde API.
- **OAuth/tokenopslag:** per-gebruiker tokens in `connector_connections` (`access_token`/`refresh_token` als text, **niet versleuteld op applicatieniveau**; nooit naar client gestuurd). Refresh bij verlopen.
- **Encryptie:** in transit TLS (platform); at rest platform-niveau (beheerde Postgres); geen kolom-encryptie.
- **Logging:** pino; `authorization`/`cookie` geredigeerd; prod JSON.
- **Foutafhandeling:** per-route try/catch met Nederlandse foutteksten; health-probes gooien nooit.
- **Rate limiting:** **ONTBREEKT** (geen middleware in `app.ts`).
- **Retry:** frontend TanStack Query-retries; mobiele test-runner retries; geen server-side retry-queue voor mislukte syncs.
- **Dubbele activiteiten:** Data Hub-dedupe (sport + 5-min startbucket + buurvenster, tolerantie op afstand/duur), veld-merge via `MERGEABLE_FIELDS`.
- **Synchronisatieconflicten:** bron-prioriteit echt > handmatig > geschat; handmatige override blijft mogelijk.
- **Accountontkoppeling:** disconnect (lokaal wissen) én revoke (ook bij Strava intrekken) per connector.
- **Dataverwijdering:** DELETE-routes per entiteit; `ON DELETE CASCADE` op `clerk_id` door het hele schema; `privacy_settings.deleteRequestedAt` bestaat als vlag, maar er is **geen zelfbedienings-"verwijder account"-flow** die de verwijdering ook uitvoert.
- **Achtergrondprocessen:** gezondheidscheck (dagelijks), doelen-review (maandelijks), herinneringen (dagelijks), nachtelijke kennis-/nieuwsscan; alle idempotent met dedupe-keys (`lib/scheduled-tasks.ts`, `jobs/`). Nieuws heeft zelfherstellende verversing op het leespad.

## 7. Privacy en veiligheid

| Onderdeel | Status | Bewijs |
|---|---|---|
| Toestemming (sharing, connector-consent, auditlog) | aanwezig | `routes/privacy.ts`, `consent_audit_log`, `permission_revoked` |
| Privacyverklaring (leesbare tekst/pagina) | **ONTBREEKT** | `acceptedPrivacyAt`-veld bestaat, maar geen verklaringstekst in frontend |
| Gebruiksvoorwaarden (leesbare tekst/pagina) | **ONTBREEKT** | idem (`acceptedTermsAt`) |
| Gegevensinzage | gedeeltelijk | alle eigen data zichtbaar in de app; geen samengevoegd inzage-overzicht |
| Gegevenscorrectie | aanwezig | alle eigen invoer bewerkbaar; profiel-consistentievragen met compare-and-set |
| Export | gedeeltelijk | GPX/TCX per route/rit; **geen volledige account-export** |
| Accountverwijdering (zelfbediening) | **ONTBREEKT** | alleen `deleteRequestedAt`-vlag + cascade-schema; geen uitvoerende flow |
| Intrekken van koppelingen | aanwezig | disconnect/revoke-routes |
| Minderjarigen | aanwezig | `parentConsentRequired/Status`, ouder-rol met `safety_only`, seizoensgewichtsdoel geblokkeerd <17 (RED-S), leeftijd uit volledige geboortedatum |
| Trainer-/clubrechten | aanwezig (trainer), club beperkt | sharing-levels + geteste isolatie; club heeft geen eigen rechtenmodel |
| Medische/gevoelige data | gedeeltelijk | HRV/slaap/mentaal privacy-gated (`aiSensitiveAnalysisEnabled`); geen aparte medische-dataclassificatie |
| Token-/persoonsgegevensbeveiliging | gedeeltelijk | tokens server-only maar plaintext in DB; logs redigeren cookies/authorization; SSRF-allowlists op kalender/push/klimmen; XSS-escaping op kaartlabels |
| Rate limiting / brute-force-bescherming | **ONTBREEKT** | geen middleware |

## 8. Waarde voor Garmin

Feitelijk gebouwd en werkend (boven "activiteiten opslaan"):

- Trainingsanalyse: afgeleide belasting (TSS uit vermogen+FTP), vorm/vermoeidheid, power bests, FTP-ondergrens-afleiding.
- Interactieve sessiegrafieken (vermogen/hartslag/cadans/snelheid/hoogte, eerlijke gaten).
- Deterministische dagcoaching en trainingsplannen met feedback-lus en per-sessie-caps.
- Wedstrijdvoorbereiding (Race Intelligence, kalender-import, documentanalyse van wedstrijdgidsen).
- Routefunctionaliteit: generatie, klimmenverkenner, route-paspoort, turn-by-turn (mobiel), GPX/TCX-export.
- Materiaalbeheer incl. fietsscan; sportpaspoort; trainer- en ouderkoppeling met granulaire sharing; contextafhankelijke analyses (leefagenda, geheugengraf); doel- en ontwikkelingsweergave (Ontwikkelkompas).

Voor Garmin-gebruikers zou een koppeling betekenen: automatische activiteiten-import in dit analyse-/coachingsecosysteem via de al gebouwde Data Hub (dedupe met Strava/bestanden al bewezen). **Nog niet gebouwd:** de Garmin-dataprovider zelf (wacht op API-toegang).

## 9. Waarde voor Wahoo

Identiek aan §8 (zelfde Data Hub-architectuur; providers zijn bron-agnostisch). Extra relevant voor Wahoo: geplande workouts bestaan gestructureerd (`planned_workouts.structure` met blokken/zones/%FTP) — technisch fundament voor workout-push naar headunits, maar **een exportformaat/push naar Wahoo is niet gebouwd**.

## 10. Risico's en ontbrekende onderdelen

| # | Punt | Ernst | Bewijs | Benodigde oplossing |
|---|---|---|---|---|
| 1 | Geen Garmin/Wahoo API-toegang (keys ontbreken) | kritiek (blokkade) | `device-sync.ts` `configured: false` | Aanmelden Garmin Connect Developer Program / Wahoo Cloud API; daarna dataprovider bouwen |
| 2 | Geen privacyverklaring en gebruiksvoorwaarden | kritiek voor goedkeuring | geen tekstpagina's in frontend | Juridische teksten opstellen + acceptatieflow koppelen aan bestaande velden |
| 3 | Geen zelfbedienings-accountverwijdering | hoog | alleen `deleteRequestedAt`-vlag | Verwijderflow bouwen (schema-cascade bestaat al) |
| 4 | Geen volledige data-export | hoog (AVG + platformvoorwaarden) | alleen GPX/TCX per route | Account-export-endpoint |
| 5 | OAuth-tokens plaintext in DB | hoog | `connectors.ts` schema | Kolom-encryptie of secrets-vault |
| 6 | Geen rate limiting | normaal | `app.ts` | express-rate-limit op auth-/koppel-routes |
| 7 | Geen webhooks (Strava pull-only) | normaal | geen webhook-routes | Voor Garmin/Wahoo zijn push/webhooks verplicht — er bestaan nu géén webhook-endpoints (alleen OAuth-flow + route-push-endpoint); implementatie kan pas na API-toegang |
| 8 | Productie niet gevalideerd met echte multi-user Strava-sync | normaal | dev-getest via smoke/testworkflows | Productietest na deploy |
| 9 | Kalender-import parseert HTML van derden | normaal (voorwaarden-risico) | `lib/calendar/` | Toestemming bronnen verifiëren vóór commerciële lancering |
| 10 | E-mail zonder geverifieerd domein | laag | `lib/email.ts` eerlijk overslaan | Domein verifiëren in Resend |
| 11 | Club zonder eigen rechtenmodel | laag | geen club-tabellen | Alleen bouwen indien gewenst |
| 12 | Fitbit alleen registry-entry | laag | `registry.ts` | Verwijderen of bouwen |

## 11. Bewijs

- **Routers:** `artifacts/api-server/src/routes/` (55 bestanden, zie `index.ts` voor registraties).
- **Schema:** `lib/db/src/schema/` — o.a. `users.ts`, `athlete-profiles.ts`, `links.ts`, `privacy.ts`, `connectors.ts`, `garage.ts`, `knowledge.ts`.
- **Data Hub:** `artifacts/api-server/src/engines/data-hub/` (`ingest.ts`, `dedupe.ts`).
- **Integraties:** `src/lib/connectors/providers/` (strava.ts, strava-oauth.ts, device-sync.ts, registry.ts), `src/lib/routing/providers/ors.ts`, `src/lib/weather/open-meteo.ts`, `src/lib/calendar/`, `src/lib/push.ts`, `src/lib/email.ts`.
- **Tests (groen op 22-07-2026):** 30+ testworkflows, o.a. cross-account-isolatie, coach/parent-sharing-levels, sessie-contract, ingest-hoogteprofielen, onboarding-connect-stap, geplande taken; plus scan-quality unit-tests.
- **Machineleesbare inventaris:** `docs/SPARKI_INTEGRATION_INVENTORY.json`.

### Niet betrouwbaar vaststelbaar vanuit de code
- Clerk-loginproviders (bijv. Google-login) — geconfigureerd buiten deze repository.
- Productiestatus van Scheduled Deployments (gebruikersconfiguratie in Replit, niet in code).
- Werkelijke productie-secrets (alleen dev-omgeving zichtbaar: `STRAVA_CLIENT_ID/SECRET`, `MAPBOX_ACCESS_TOKEN`, `VAPID_PRIVATE_KEY` aanwezig).
