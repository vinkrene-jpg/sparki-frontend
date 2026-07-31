# Sparki — Functionele Current State

**Peildatum:** 23 juli 2026 · **Branch:** `main` · **Commit-basis:** `7cd4cad2…` (zie `docs/SPARKI_TECHNICAL_INVENTORY.md` en `docs/sparki-system-inventory.json`).
Bron: directe inspectie van de actuele code. Statustabel per module: `docs/SPARKI_MODULE_STATUS.md`; gebruikersflows: `docs/SPARKI_USER_FLOWS.md`.

**Statuslegenda** (gebruikt in alle drie de documenten):
- **Volledig** — frontend, backend en database gekoppeld; de gebruiker kan de functie echt gebruiken; regressietest aanwezig.
- **Gedeeltelijk** — werkt, met een bewuste, eerlijk gecommuniceerde beperking.
- **Voorbereid** — code + schema aanwezig maar niet actief door een externe afhankelijkheid; UI toont dit eerlijk (grijs, nooit nep-groen).
- **Placeholder / Niet bereikbaar** — niet aangetroffen: de codebase bevat geen dode knoppen of nep-schermen (het Health-Check-honestheidscontract in `artifacts/api-server/src/lib/health/checks.ts` dwingt "echt proben of grijs" af).

---

## 1. Onboarding & Sportpaspoort — Volledig

- **Gebruiker kan:** aanmelden via Clerk (`/sign-in`, `/sign-up`), wordt JIT geprovisioned (`POST /api/auth/sync` → `user_profiles` + `athlete_profiles`), doorloopt adaptieve vraagflow met verplichte connect-stap (koppelen zelf optioneel — eerlijkheid) en Strava-gap-fill; halverwege hervatten kan.
- **Rollen:** iedereen (athlete standaard); rolwissel `PUT /api/auth/me/role` (`routes/auth.ts`).
- **Koppeling:** `routes/onboarding.ts` + `engines/onboarding` ↔ tabel `onboarding_state`; web `pages/start.tsx` + onboarding-componenten. Tests: `test-onboarding-resume`, `test-onboarding-connect-step`, `test-onboarding-strava-gapfill`.
- **Sportpaspoort** (`/paspoort`, `pages/paspoort.tsx`): herkomstlaag bovenop `athlete_profiles` — elke waarde met bron + historie (`passport_value_events`), voorstellen met atomair besluit+toepassing (`passport_proposals`). Routes `routes/passport.ts`.

## 2. Today (Vandaag), trainingen, plannen & coaching — Volledig

- **Vandaag** (`pages/start.tsx` + `components/sparki/screen-shell.tsx`): dagtype-engine (rust/training/wedstrijd/algemeen), één leidend Momentblok (aandachtswet), State Card, coach-analyse met presentatievariatie (`lib/variation.ts`), thuisweer (Open-Meteo, `lib/weather/home.ts`), concreet dagadvies zonder plan.
- **Trainingen:** toevoegen opgesplitst plannen/registreren (`add-training.tsx`, server-whitelist `lib/plan-details.ts`), GPX/FIT/TCX-import via Data Hub (`lib/activity-file-ingest.ts`), afgeleide belastingsscore uit power+FTP (`lib/derived-load.ts`), sessiegrafieken + power bests alleen bij ingest (oude sessies eerlijk leeg).
- **Plannen:** autonome plan-engine — deterministische getallen, LLM alleen prose (`engines/training-plan`, tabellen `training_plans`/`plan_days`/`planned_workouts`); per-sessie-caps; leefagenda stuurt mee (`life_events`); lifecycle pauze/hervat/verwijder; uitvoering + adaptieve voorstellen (`lib/workout-execution.ts`, `lib/adjust-rules.ts`); feedbacklus (`workout_feedback`, test `test-feedback-adjust`).
- **Coaching door Sparki:** observatie-engine met ≥2-signalen-regel (`engines/observation`), voice/personality met centraal humorniveau (`engines/voice`, `ai_preferences.humor_level`), Vraag Sparki-chat (header-overlay, sessie-scoped thread, `routes/ai.ts` + input-center), Core-voorspelling per training (`engines/core-prediction`, `core_predictions`).

## 3. Coach- & ouderomgeving — Volledig

- **Coach-cockpit** (`/coach`, `pages/coach-cockpit.tsx` + `coach-home.tsx`): signalen per sporter (`lib/coach-signals.ts`), planning-CRUD incl. bulk, berichten, contextitems (transparant voor de sporter), audit. Sparki overschrijft coachtrainingen nooit: sporterfeedback → `coach_change_proposals`; alleen coachbesluit past aan. Cross-coach-isolatie via `planned_workouts.coach_clerk_id`. Routes `routes/coach-cockpit.ts` + `routes/coach.ts` (sharing-niveaus none/summary/full). Test `test:coach-cockpit` (19).
- **Ouderomgeving:** één rechtenlaag `lib/parent-permissions.ts` op álle ouder-routes (`routes/parent.ts`); onbekende leeftijd clampt naar veiligheidsminimum; onbevestigde ouder maximaal safety-only. Tabellen `parent_reports`, `emergency_contacts`, `parent_confirmations`, `parent_messages`. Tests: zes coach-parent-suites + link-isolatie (`test-links-end-isolation`, `test-links-unlink-isolation`).
- **Koppelingen:** token-uitnodigingen met atomaire accept (`routes/invitations.ts`), `coach_athlete_links`/`parent_athlete_links`; beëindigen wist toegang direct.

## 4. Lab — Volledig

- `/lab` (`pages/lab.tsx`): één belastingsmodel via `computeLoadSeries` (`lib/derived-load.ts`, `engines/recovery-load`); vorm/vermoeidheid/fitheid; radar-assen zonder data eerlijk `null` + reden (nooit 0.5); trainingsverloop uit echte series; FTP-vloerafleiding (eerlijke ondergrens, alleen geschatte FTP omhoog); mentale reflecties (`routes/mental.ts`, `workout_mental_reflections`, test `test-mental`); gezondheids-/herstelflow (status raises-only, "hersteld" alleen via resume-gate, `routes/health-flow.ts`).

## 5. Wedstrijden & Race Intelligence — Volledig (Wahoo/Karoo-sync bewust afwezig)

- **Wedstrijden** (`/races`, `pages/races.tsx`): CRUD, kalenderimport (Fietssport + We-Tri volledig; KNWU eerlijk "limited" — SPA zonder bereikbare API, `lib/calendar/`), advies-typologie coach-first, wedstrijddossier in Journey, Wedstrijd-room (`routes/race-rooms.ts` + `pages/wedstrijd-room.tsx`).
- **Race Intelligence:** veldmodel found/derived/missing, nooit verzonnen (`lib/race-intel.ts`, `engines/race`); wedstrijddagweer via `lib/weather/race.ts`.
- **Wedstrijdpunten:** `race_points` met statusmodel voorgesteld→bevestigd/aangepast/afgewezen (nooit terug); gids-upload levert alleen voorstellen mét bron/pagina/betrouwbaarheid; kaartcontrole met deterministische km-snap (`components/sparki/race-points-panel.tsx`, `routes/race-points.ts`).
- **Export:** GPX + Garmin FIT Course + FIT Workout (workout alleen bij echte warming-up/gekoppelde training — nooit verzonnen stappen); validatie vooraf + round-trip-verificatie; historie `race_exports`; gids-diff zet punten op `needsReconfirm` en exports op "verouderd" (`lib/race-export/`, `routes/race-exports.ts`). **Wahoo/Karoo:** alleen eerlijke uitleg, geen sync-knop. Tests `test:race-points` (9) + `test:race-export` (17).

## 6. Routes, GPX, course-points, technische gids & wedstrijdmodus — Volledig

- **Routes** (`/routes`, `pages/routes.tsx`): planner + generator (ORS via `lib/routing/providers/ors.ts`; echte routes of eerlijk niets; vrije-tekstwens alleen in rationale), routeketen (delen/versies/soft-delete, `route_shares`/`route_version_usages`), route-paspoort + POI's (Overpass), routevoorstellen (`routes/route-proposals.ts`), GPX-import (web + mobiel `gpx-import.tsx`), gereden rit als route bewaren.
- **Technische gids:** documentanalyse via Anthropic document block → eerlijk gevonden/ontbreekt + deterministische vervolgvragen; verrijkt races en levert puntvoorstellen (`engines/document-analysis`, tabel `document_analyses`).
- **Wedstrijdmodus mobiel:** `sparki-mobile/lib/race-mode.ts` — rondeteller via wrap-detectie, finish-cue alleen laatste ronde, POI's/verkeerslicht onderdrukt (11 tests).
- **Course-points:** actieve punten reizen mee in `GET /api/routes/:id` (`race`-blok) en in FIT/GPX-export.

## 7. Hoogteprofiel, routeopmerkingen & wegtypen — Volledig

- Interactief hoogteprofiel (`components/sparki/elevation-profile.tsx`: sleep ↔ kaartsync, gradiëntkleuren, markers); ingest-hoogte uit GPX/FIT/TCX (tests `test-ingest-elevation-profile`, `test-ingest-elevation-fit-tcx`, `test-session-elevation-profile`).
- Routeopmerkingen uit echte OSM-tags (`lib/route-remarks.ts`, `GET /api/routes/:id/remarks`, ODbL-bron zichtbaar; nooit een verzonnen waarschuwing; 16 testscenario's).
- Wegtypen/ondergrond + fietsgeschiktheid (`lib/route-surfaces.ts`, `GET /api/routes/:id/surfaces`; 10 categorieën; >40% onbekend ⇒ eerlijk "onvoldoende gegevens"; 24 testscenario's). Afhankelijk van Overpass-beschikbaarheid; storing wordt eerlijk getoond (502/datanotitie), nooit gemaskeerd.

## 8. Voeding — Volledig (jeugdbeperking is bewust beleid)

- Voeding-sheet (`components/sparki`-sheet, geen aparte pagina): deterministische rekenkern `lib/fueling.ts` (koolhydraten/vocht/natrium per duur/intensiteit/warmte; LLM formuleert alleen); <16 bewust géén getallen (RED-S); consent fail-closed (`nutrition_preferences.consentAt`); seizoensdoel 17+ (`nutrition_season_goals`, max 0,5 kg/week); daganalyse plan↔registratie; mobiele bidon/eetmoment-tikkers met snapshot bij STOP. Routes `routes/nutrition.ts`. Test `test:fueling` (16).

## 9. Mechanieker & fietsscan — Volledig

- `/mechanieker` (`pages/mechanieker.tsx`): multi-fiets garage; km/uren altijd live afgeleid uit `training_sessions.bike_id` (nooit een teller); auto-koppeling gokt nooit; onderhoudssignalen (`lib/maintenance-signals.ts`, defect alleen uit eigen registratie); materiaalkeuze per rit (`equipment_choices`). Test `test:mechanieker` (17).
- **Fietsscan** (`routes/bike-scan.ts`, tabellen `bike_scans`/`bike_scan_frames`): foto-frames → "Interactieve fotoweergave" (eerlijk zo genoemd; alleen het parametrische model heet 3D); achtergrondverwijdering client-side (@imgly); origineel altijd bewaard; verplichte assetherkomst.
- **Materiaalcoach** (`routes/material.ts`, `material_analyses`): foto-gedreven eerlijk advies, confidence-gated extra-foto-vraag, foto's in object storage met owner-checked serve.

## 10. Sociaal & ritten delen — Volledig

- Samen-feed (`/samen`), vrienden/volgen (`friend_links`/`follow_links`), profielprivacy op álle ontdekkingspaden (zoeken/verzoek/match; neutrale weigering), blokkeren atomair, groepstrainingsvoorstellen (`routes/social.ts`).
- **Live locatie tijdens navigatie:** opt-in per sessie (standaard uit), autorisatie bij élke lezing herchecked, minderjarig fail-closed in groepen, geen locatiegeschiedenis (`routes/live-location.ts`, `sparki-mobile/lib/live-share.ts`; 21+10 tests).
- **Rit delen:** deelkaart met whitelist-velden; Strava = handmatige activity (nooit verzonnen timestamps); socials via OS-deelmenu (`routes/share.ts`, `lib/share/ride-share.ts`, mobiel `lib/share-api.ts`). World-social: alleen referentie-deling; openbaar vereist volwassen-/oudertoestemming (`routes/world-social.ts`).

## 11. Clubomgeving — Volledig

- `/club` + `/club-beheer`: 16 tabellen (`lib/db/src/schema/club.ts`); least-privilege rechten (`lib/club-permissions.ts` — beheerders zien nooit sportdata); teams/groepen/locaties; clubtrainingen met aanmelden/reserve (FOR UPDATE op signup); wedstrijdselecties; berichten; jeugd-consent fail-closed; abonnementen/limieten (ook bij invite-accept); audit-log. Router achter `killSwitchGuard("club_features")` (`routes/index.ts` r.164).

## 12. AI-helpdesk — Volledig

- `/support` (web) + mobiel supportscherm: deterministische antwoordmatrix eerst, LLM daarna; minderjarig fail-closed; tickets met advisory-lock find-or-create (`support_tickets`, `helpdesk_turns`); bekende problemen + artikelen (`support_known_issues`, `support_articles`). Routes `routes/support.ts`, engine `lib/support/`.

## 13. Contextuele uitleg — Volledig

- Uitleglaag: `UitlegDot` (`components/viz/uitleg.tsx`) + centraal registry `artifacts/sparki/src/lib/uitleg-content.ts` (Wat/Waarom/Hoe + eerlijke "Bij jou" uit echte profiel-/loadwaarden); tweelaags kort/uitgebreid alleen waar echte diepte bestaat; "Belasting (TSS)"-naamgeving. Test `test:uitleg-content`.

## 14. Meldingen — Volledig (e-mail Gedeeltelijk)

- Centraal categorieregister; kritiek nooit uit; resolutionKey-dedupe + resolve-lifecycle; quiet hours dempen alleen push/e-mail (`routes/notifications.ts`, `routes/alerts.ts`, tabel `notifications`); dagvouwing in de bel (1 regel per Amsterdamse kalenderdag).
- **Web push:** Volledig — VAPID + SSRF-hostallowlist (`lib/push.ts`, `push_subscriptions`).
- **E-mail:** Gedeeltelijk — geen geverifieerd verzenddomein; Resend-sandbox bezorgt alleen aan de accounteigenaar; reminders slaan eerlijk over i.p.v. nep-verzenden (`lib/email.ts`, toelichting regels 9–19; Health Check toont dit oranje/grijs).

## 15. Beheer & privacy — Volledig

- **Admin** (`/admin`, allowlist `SPARKI_ADMIN_IDS`): Health-Check-engine met echte probes en vier eerlijke statussen (`lib/health/checks.ts`, `health_check_*`; CLI-job als release-gate); testeroverzicht + telemetrie (`tester_events`); sync-diagnostiek; kennisbeheer (`/knowledge-beheer`); releasegroepen/uitrol met auto-stop per flag (`routes/release.ts`, `rollout_guards`); kill switches; feature flags; foutenregister (`error_groups`/`error_events`).
- **Privacy:** schema-gedreven export met tokenmaskering; 14-dagen verwijdervenster + uitzonderingenregister; consent-audit-log (append-only); security-audit-log; data-trust herkomst-endpoint met constante tabel-allowlist. Routes `routes/privacy.ts`, `routes/account.ts`; test `test-cross-account-isolation`.

## 16. Mobiele ritregistratie, navigatie & Bluetooth — Volledig (BLE Gedeeltelijk; device-sync Voorbereid)

- **Ritregistratie:** achtergrondtracking (TaskManager, `lib/ride-tracker.ts` — native build vereist), auto-trim altijd ongedaan te maken (`api-server lib/ride-trim.ts`), upload-queue met fail-closed opslag (`lib/upload-queue.ts`), rit-herstel na crash, val-alarm (30s-venster; meldingen "klaargezet", bezorging nooit geclaimd — `lib/fall-detection.ts`), bordjes-sprints (`route_sprint_boards`/`sprint_results`), GPX met sensordata (`lib/ride-gpx.ts`).
- **Navigatie** (`app/(app)/navigate/[id].tsx`): route-match state machine (`lib/route-match.ts`), HUD, audio-cues (waypoints nooit bestemmingen, `lib/nav-cues.ts`), off-route-keuze per episode, klimfases, zelflerende verkeerslichten (`road_objects`), volgauto-modus (renner/volgauto-rolkeuze), wedstrijdmodus, live locatie delen.
- **BLE-sensoren:** **Gedeeltelijk** — hartslag/vermogen/cadans via ble-plx werken alleen in de volledige app-build; in Expo Go/web eerlijk "niet ondersteund" (`lib/ble-sensors.ts` r.68).
- **Garmin/Wahoo device-sync:** **Voorbereid** — volledige OAuth-/webhook-code aanwezig (`lib/connectors/providers/device-sync.ts` r.14, `routes/webhooks.ts` fail-closed), maar zonder fabrikantsleutels `configured: false` en eerlijk "niet beschikbaar" in de UI.

---

**Samenvattend:** 22 gecontroleerde modulegebieden; 19 Volledig, 3 met een eerlijk gecommuniceerde beperking (e-mailbezorging, BLE buiten native build, Garmin/Wahoo-sync voorbereid). Geen placeholders of onbereikbare functies aangetroffen.

---

## Update 31-07-2026 — trainerrechten (besluit B1)

Sectie 3 (coachomgeving) aangescherpt per besluit René 30-07-2026: individuele
berichten en alle individuele schrijfacties vereisen een directe geaccepteerde
coach-sporterlink; een club-/teamtoewijzing geeft alleen de vastgelegde
lees-/begeleidingsrechten. Server-side afgedwongen en bewezen
(`test:trainer-assignment-messages` 9/9, `test:trainer-assignment-write-contract`
5/5); coach-startpagina biedt de individuele cockpit niet meer aan voor
team-toegewezen sporters. Volledig register: `docs/BESLUITENREGISTER_RENE_2026-07-30.md`.
