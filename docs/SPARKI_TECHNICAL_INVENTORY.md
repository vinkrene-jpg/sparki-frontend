# Sparki — Technische Inventarisatie (actuele code)

**Peildatum:** 23 juli 2026
**Branch:** `main`
**Commit:** `7cd4cad218984deb1921b61cf213e7d33115148d`
**Bron:** uitsluitend de werkelijke code in deze repository (geen plannen of oude opdrachten).

Machine-leesbare variant: `docs/sparki-system-inventory.json`.

---

## 1. Architectuur

pnpm-monorepo (Node.js 24, TypeScript 5.9) met vier werkruimtes:

| Werkruimte | Pad | Rol |
|---|---|---|
| `@workspace/sparki` | `artifacts/sparki/` | Webapp — React + Vite + Wouter + TanStack Query + Tailwind v4 |
| `@workspace/api-server` | `artifacts/api-server/` | Express 5 API (poort 8080), Drizzle ORM, esbuild CJS-bundel |
| `@workspace/sparki-mobile` | `artifacts/sparki-mobile/` | Expo/React Native navigatie-app (Expo Router) |
| `@workspace/db` | `lib/db/` | Gedeeld Drizzle-schema + migraties (PostgreSQL) |

Kernpunten uit de code:
- **Auth:** Replit-managed Clerk, cookie-based op web (geen Bearer-tokens). Server: `@clerk/express` + `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` (Clerk FAPI-proxy, alleen prod). Dev-bypass: `DEV_AUTH_BYPASS` (fail-closed, nooit in productie).
- **API-koppeling web:** Vite-proxy `/api` → `localhost:8080`; centrale fetch in `artifacts/sparki/src/lib/api.ts` met per-app-open `X-Sparki-Session` header (presentatievariatie).
- **Backend-gelaagdheid:** routes (`src/routes/`) → engine-facades (`src/engines/`, 38 stuks) → domeinlogica (`src/lib/`). Routes importeren engines, niet losse helpers (`docs/engine-architecture.md`).
- **Mobiel:** Expo Router-schermen in `app/(app)/`, native-only libs via platform-splits (`.tsx` + `.web.ts` stubs), achtergrond-rittracking via TaskManager (`lib/ride-tracker.ts`).
- **Jobs/Scheduled Deployments:** `artifacts/api-server/src/jobs/` — `goal-review.ts`, `health-check.ts`, `knowledge-scan.ts`, `reminders.ts`; overzicht in `src/lib/scheduled-tasks.ts`.

## 2. Database

PostgreSQL + Drizzle ORM. **161 tabellen** in 62 schemabestanden onder `lib/db/src/schema/`.

Belangrijkste clusters (tabel → schemabestand):

- **Identiteit & rollen:** `user_profiles` (`users.ts` — `roles[]`, `active_role`), `athlete_profiles`, `ftp_history`, `athlete_daily_metrics` (`athlete-profiles.ts`, `athlete-metrics.ts`).
- **Koppelingen:** `coach_athlete_links`, `parent_athlete_links` (`links.ts`); sociale relaties `friend_links`, `follow_links`, `profile_privacy`, `social_reports`, `team_identities`, `group_training_*` (`social.ts`).
- **Training:** `training_sessions`, `planned_workouts`, `training_plans`, `plan_days`, `workout_feedback`, `planned_workout_changes`, `workout_mental_reflections` (`athlete-training.ts`).
- **Data Hub / connectors:** `connector_connections`, `connector_activities`, `connector_consents`, `sync_runs`, `webhook_events` (`connectors.ts`), `activity_imports` (`activity-imports.ts`).
- **AI:** `ai_call_logs` (`ai-gateway.ts`), `ai_observations`, `ai_memory_events`, `ai_preferences` (`ai-memory.ts`), `personal_context_memories` (`context-memory.ts`), `core_predictions` (`core-predictions.ts`), `document_analyses`, `material_analyses`.
- **Wedstrijden:** `races`, `race_points`, `race_exports` (`races.ts`, `race-points.ts`, `race-exports.ts`), `race_rooms`/`race_room_items`/`race_room_compilations` (`race-rooms.ts`).
- **Routes & navigatie:** `routes`, `route_proposals`, `route_shares`, `route_version_usages` (`routes.ts`, `route-proposals.ts`, `route-shares.ts`), `nav_settings`, `road_objects`/`road_object_reports` (`road-objects.ts`), `route_sprint_boards`/`sprint_results` (`sprints.ts`), `volgauto_plans`/`volgauto_reports`/`volgauto_positions` (`volgauto.ts`), `live_location_sessions`/`live_location_grants`/`live_location_positions` (`live-location.ts` — één positierij per sessie, geen historie).
- **Club:** 16 tabellen `clubs` … `club_audit_log` (`club.ts`).
- **Coach-cockpit:** `coach_signal_actions`, `coach_messages`, `coach_context_items`, `coach_change_proposals` (`coach-cockpit.ts`).
- **Ouderomgeving:** `parent_reports`, `emergency_contacts`, `parent_confirmations`, `parent_messages` (`parent.ts`).
- **Garage/materiaal:** `garage_bikes`, `garage_components`, `garage_sensors`, `bike_scans`, `bike_scan_frames`, `equipment_choices`, `component_events` (`garage.ts`).
- **Voeding:** `nutrition_preferences`, `nutrition_hydration_logs`, `nutrition_season_goals` (`nutrition.ts`).
- **Kennis:** `managed_knowledge_items`/`_versions`, `knowledge_usage_events`, `knowledge_feedback` (`knowledge-governance.ts`), `knowledge_items` (`knowledge.ts`), `intel_cards`/`intel_interactions` (`intel.ts`).
- **Gezondheid & privacy:** `health_complaints`, `health_safety_info` (`health.ts`), `privacy_settings`, `consent_audit_log` (`privacy.ts`), `security_audit_log` (`security.ts`), `health_check_*` (`health-checks.ts`).
- **World (fictieve renners):** `virtual_athletes`, `virtual_events`, `virtual_posts`, `virtual_media`, `user_virtual_follows`, `user_virtual_affinity` (`sparki-world.ts`), `world_shared_items`/`world_reactions`/`world_blocks`/`world_reports` (`world-social.ts`).
- **Beheer & release:** `feature_flags`, `user_flag_overrides` (`feature-flags.ts`), `kill_switches`, `version_requirements`, `rollout_guards`, `release_notes`, `error_groups`/`error_events` (`release.ts`), `invitations`, `tester_events` (`telemetry.ts`), `bug_reports`, `support_tickets` e.a. (`support.ts`).
- **Overig:** `journey_*` (`journey.ts`), `athlete_goals`/`goal_*` (`goals.ts`), `passport_value_events`/`passport_proposals` (`passport.ts`), `life_events` (`life-events.ts`), `notifications` + `push_subscriptions`, `onboarding_state`, `photo_lab_uploads`, `audio_preferences`, `reminder_preferences`, `legal_documents`, `coaching_profiles`, `helpdesk_turns`.

Relaties lopen vrijwel overal via `clerk_user_id`-kolommen naar `user_profiles` en via integer-FK's binnen clusters (bv. `race_points.race_id` → `races`, `plan_days.plan_id` → `training_plans`, `training_sessions.bike_id` → `garage_bikes`).

## 3. Gebruikersrollen & rechten

- **Rollen:** `athlete` (default), `coach`, `parent` — opgeslagen in eigen DB (`user_profiles.roles[]` + `active_role`), NIET in Clerk. Rolwissel via `PUT /api/auth/me/role` (`routes/auth.ts`); UI-switcher in `artifacts/sparki/src/components/sparki/screen-shell.tsx`.
- **Admin:** env-lijst `SPARKI_ADMIN_IDS` (o.a. `routes/admin.ts`, `lib/flags.ts`).
- **Coach:** toegang via geaccepteerde `coach_athlete_links` + sharing-niveau; eigenaarschap per training (`planned_workouts.coach_clerk_id`); cockpit-rechten in `routes/coach-cockpit.ts`.
- **Ouder:** één rechtenlaag `lib/parent-permissions.ts` voor álle ouder-routes; onbekende leeftijd clampt naar veiligheidsminimum; onbevestigde ouder nooit boven safety-only.
- **Minderjarigen fail-closed:** o.a. journey-media nooit "gedeeld" (`routes/journey.ts`), World openbaar delen alleen met ouder-toestemming (`routes/world-social.ts`), live locatie in groepen alleen vrienden/begeleiders (`routes/live-location.ts`), voeding zonder getallen <16 (`lib/fueling.ts`), club-jeugdconsent (`lib/club-permissions.ts`).
- **Sociale privacy:** profielzichtbaarheid + blokkades op alle ontdekkingspaden (`routes/social.ts`, `lib/profile-privacy.ts`).
- **Feature flags & kill switches:** `lib/flags.ts`, `lib/kill-switches.ts` (routers gedragen met `killSwitchGuard`, zie `routes/index.ts`).

## 4. Pagina's, mobiele schermen en API-endpoints

### Webpagina's (38, `artifacts/sparki/src/pages/`)
`landing`, `sign-in`, `sign-up`, `start` (Vandaag), `activiteiten`, `feed` (Ontdekken), `train`, `lab`, `you`, `samen`, `routes`, `klimmen`, `sprinten`, `races`, `wedstrijd-room`, `journey`, `kalender`, `knowledge`, `wereld`, `lichaam`, `geluid`, `paspoort`, `profiel`, `mechanieker`, `photo-lab`, `coach-cockpit`, `coach-athlete-plan`, `club`, `club-beheer`, `admin`, `admin-health-detail`, `invitations`, `invite-accept`, `tester-qr`, `tester-welcome`, `support`, `legal`, `not-found`. Routing/ClerkProvider: `artifacts/sparki/src/App.tsx`; 128 feature-componenten in `src/components/sparki/`, 81 hooks in `src/hooks/`.

### Mobiele schermen (`artifacts/sparki-mobile/app/`)
`(auth)/sign-in`, `(auth)/sign-up`; `(app)/index` (home), `navigate/[id]` (navigatie incl. live locatie delen, volgauto, wedstrijdmodus), `ride/[id]`, `record`, `rides`, `gpx-import`, `instellingen`, `diagnostiek`, `support`. Domeinlogica in `artifacts/sparki-mobile/lib/` (43 modules, o.a. `ride-tracker`, `route-match`, `nav-cues`, `ble-sensors`, `fall-detection`, `live-share`, `race-mode`, `volgauto-meet`, `upload-queue`).

### API-endpoints (74 routebestanden, `artifacts/api-server/src/routes/`)
Mounts in `routes/index.ts` onder `/api`: `/auth`, `/flags`, `/athlete`, `/races` (3 routers: punten/exports/kern), `/invitations`, `/ai`*, `/memory`, `/privacy`, `/account`, `/legal`, `/analysis-feedback`, `/journey`, `/health-flow`, `/passport`, `/onboarding`, `/connectors`, `/device-sync`, `/webhooks` (geen auth; verificatie per provider), `/hub`, `/coach` (2), `/parent`, `/links`, `/nutrition`, `/notifications`, `/routes` (3: proposals/volgauto/kern), `/nav-settings`, `/training-plan`, `/bug-reports`, `/support`, `/knowledge`, `/knowledge-beheer`, `/intel`, `/feed`, `/social`, `/live-location`, `/voice`*, `/admin`, `/material`, `/garage`, `/bike-scan`, `/document-analyses`*, `/calendar`, `/state`, `/photo-style`, `/core-prediction`, `/telemetry`, `/road-objects`, `/weather`, `/audio`, `/world`, `/world-social`, `/goals`, `/engagement`, `/ride-story`, `/sprints`, `/climbs`, `/alerts`, `/share`, `/clubs`*, `/release`, `/dev` (alleen dev) plus root-routers (health, insights, mental, storage, input-center, race-rooms). *= achter `killSwitchGuard`.

## 5. Engines, AI en externe integraties

### Engine-facades (38, `artifacts/api-server/src/engines/`)
`audio`, `coaching`, `context-memory`, `core-prediction`, `data-hub`, `document-analysis`, `engagement`, `garage`, `goals`, `input-center`, `insights`, `integration`, `intel`, `knowledge`, `material`, `memory-graph`, `mental`, `observation`, `onboarding`, `profile`, `race`, `race-room`, `recovery-load`, `reminders`, `road-objects`, `route`, `share`, `social`, `source-quality`, `sprint`, `state`, `training-plan`, `voice`, `world-affinity`, `world-feed`, `world-media`, `world-population`, `world-simulation`.

Belangrijke domeinlogica in `src/lib/` (selectie): `derived-load.ts` (belastingsmodel), `fueling.ts`, `race-intel.ts` + `race-points/` + `race-export/` (incl. `fit-encode.ts`), `routing/` (ORS-provider, loop-kwaliteit), `route-surfaces.ts`/`route-remarks.ts`/`route-pois.ts` (Overpass), `live-location/`, `volgauto/`, `weather/` (Open-Meteo), `health/checks.ts` (Health Check-engine), `variation.ts` (presentatievariatie), `scheduled-tasks.ts`, `security/`, `push.ts`, `email.ts`.

### AI
- **Centrale gateway:** `lib/ai/gateway.ts` — één `aiMessage()`-poort voor alle modelcalls (Anthropic): killswitch → consent → minderjarigenregels → redactie → dedupe → metadata-only logging (`ai_call_logs`).
- **Consumers:** coach-analyses/observaties (`engines/observation`, `engines/coaching`), dagelijkse brief, chat (Vraag Sparki, `routes/ai.ts` + input-center), documentanalyse (technische gidsen, `engines/document-analysis`), materiaalcoach (`engines/material`), voice/personality (`engines/voice`, deterministisch met LLM-prose), ride-story, Photo Lab (Gemini relight, `routes/photo-style.ts`).
- **Honestheidsprincipe app-breed:** deterministische engines rekenen; LLM formuleert alleen; ontbrekende data blijft eerlijk ontbreken.

### Externe integraties
| Integratie | Doel | Code |
|---|---|---|
| Clerk (Replit-managed) | Auth | `middlewares/clerkProxyMiddleware.ts`, `App.tsx` |
| Strava (per-user OAuth + webhook) | Activiteitenimport | `lib/connectors/providers/strava-oauth.ts`, `strava.ts` |
| Garmin/Wahoo (device-sync shells) | Eerlijk "niet beschikbaar" zonder fabrikantsleutels | `lib/connectors/providers/device-sync.ts`, `routes/webhooks.ts` |
| openrouteservice (ORS) | Routegeneratie/volgauto | `lib/routing/providers/ors.ts`, `lib/volgauto/` |
| Overpass / OpenStreetMap | Wegtypen, opmerkingen, POI's, klimmen, verkeerslichten | `lib/route-surfaces.ts`, `lib/route-remarks.ts`, `lib/route-pois.ts`, `lib/road-objects/overpass.ts` |
| Open-Meteo | Weer (thuis/wedstrijd/rit) | `lib/weather/` |
| Mapbox | Mobiele kaarten | `artifacts/sparki-mobile/lib/mapbox.ts` (`MAPBOX_ACCESS_TOKEN`) |
| Resend | E-mail (honest-limited zonder geverifieerd domein) | `lib/email.ts` |
| Web Push (VAPID) | Meldingen | `lib/push.ts`, schema `push-subscriptions.ts` |
| Replit Object Storage | Foto's/bestanden | `lib/objectStorage.ts`, `lib/objectAcl.ts` |
| Anthropic / Gemini | AI | `lib/ai/gateway.ts`, `routes/photo-style.ts` |
| Kalenderbronnen (Fietssport, We-Tri, KNWU-limited) | Wedstrijdimport | `lib/calendar/` |

## 6. Hoofdmodules (42 daadwerkelijk aanwezig)

De 38 engine-modules hierboven, plus de vier werkruimte-modules: webapp (`artifacts/sparki`), API-server (`artifacts/api-server`), mobiele navigatie-app (`artifacts/sparki-mobile`) en gedeeld datamodel (`lib/db`). Grote productgebieden die deze modules samen dragen: Vandaag/Momentblok, Data Hub, Trainen & plan-lifecycle, Wedstrijdintelligence + export, Routes/navigatie (incl. volgauto, sprints, live locatie), Coach-cockpit, Ouderomgeving, Club, Journey, Mechanieker/garage, Voeding, Kennisbank, World, Admin/Health Check, Release & store-distributie, Privacy & accountbeheer.

## 7. Tests

31 test-workflows (zie `.replit`-workflows) + shell-gedraaide suites in `artifacts/api-server/src/tests/` en `node --test`-suites in `artifacts/sparki-mobile/lib/*.test.ts`.

---

## Afsluiting

- **Branch:** `main`
- **Commit-SHA:** `7cd4cad218984deb1921b61cf213e7d33115148d`
- **Aantal gevonden hoofdmodules:** 42 (38 backend-engines + 4 werkruimtes); 161 databasetabellen, 74 API-routebestanden, 38 webpagina's, 12 mobiele schermen
- **Opgeleverde bestanden:**
  - `docs/SPARKI_TECHNICAL_INVENTORY.md`
  - `docs/sparki-system-inventory.json`
