# Sparki — Belangrijkste gebruikersflows (actuele code)

**Peildatum:** 23 juli 2026 · **Branch:** `main` · Elke stap is onderbouwd met concrete bestanden, endpoints en tabellen. Status per module: `docs/SPARKI_MODULE_STATUS.md`.

---

## 1. Nieuwe sporter: aanmelden → onboarding → eerste plan

1. Landing (`pages/landing.tsx`) → `/sign-up` (Clerk-thema, `pages/sign-up.tsx`).
2. Eerste sign-in: `UserContext` roept `POST /api/auth/sync` → upsert `user_profiles` + `athlete_profiles` (`routes/auth.ts`).
3. Adaptieve vraagflow (`engines/onboarding`, tabel `onboarding_state`) — onzin-antwoorden falen eerlijk met skip-optie.
4. **Connect-stap (verplicht getoond, koppelen optioneel):** Strava-OAuth (`lib/connectors/providers/strava-oauth.ts`) of overslaan; daarna gap-fill van alléén ontbrekende velden.
5. Vandaag verschijnt (`pages/start.tsx`); zonder plan toont Smart Missing Input Flow gerichte actieknoppen (`src/lib/missing-input.ts`); "Bouw mijn plan" → `POST /api/training-plan/...` (`engines/training-plan`) → `training_plans` + `plan_days`.

## 2. Dagelijkse loop: Vandaag → training uitvoeren → feedback → aanpassing

1. App-open: verse presentatie per sessie (`X-Sparki-Session` → `lib/variation.ts`); dagtype-engine kiest Momentblok.
2. Training van vandaag met Core-voorspelling (`engines/core-prediction` → `core_predictions`).
3. Uitvoeren: mobiel opnemen (flow 7) of import; koppeling gepland↔uitgevoerd race-safe (`lib/workout-execution.ts`).
4. Feedback (`workout_feedback`) → deterministisch aanpassingsvoorstel (`lib/adjust-rules.ts`); bij coachtraining wordt het een `coach_change_proposals`-rij — Sparki past nooit zelf aan.
5. Observaties/brief (`engines/observation`, `POST /api/ai/brief`) met ≥2-signalen-regel; privacy-gated persist (`ai_observations`).

## 3. Coach: uitnodigen → cockpit → plannen → voorstel beslissen

1. Sporter (of coach) maakt token-uitnodiging (`routes/invitations.ts`, tabel `invitations`); accept is atomair → `coach_athlete_links`.
2. Cockpit `/coach` (`pages/coach-cockpit.tsx`): signalen per sporter (`lib/coach-signals.ts`), zicht afhankelijk van `data_sharing_coach` (none/summary/full).
3. Trainingen plannen (ook bulk) → `planned_workouts` met `coach_clerk_id` (cross-coach-isolatie).
4. Sporterfeedback → open voorstel in cockpit; coach beslist via `routes/coach-cockpit.ts` (alleen eigenaar-coach).
5. Berichten coach↔sporter (`coach_messages`, werkt ook bij sharing "none"); alles in audit.

## 4. Ouder: koppelen → toezicht binnen sharing-niveau

1. Uitnodiging → `parent_athlete_links`; bevestigingsstatus bepaalt plafond (onbevestigd = maximaal safety-only).
2. Alle ouder-routes lopen door één rechtenlaag (`lib/parent-permissions.ts`); onbekende leeftijd clampt naar veiligheidsminimum.
3. Zicht per `data_sharing_parent`: none / safety_only (gezondheid, geen vermogensdata) / summary (+ komend schema) (`routes/parent.ts` → `parent_reports`).

## 5. Wedstrijd: aanmaken → technische gids → punten → export → wedstrijdmodus

1. `/races`: handmatig of "Uit kalender" (Fietssport/We-Tri volledig, KNWU eerlijk beperkt — `GET /api/calendar/search`, `lib/calendar/`); import prefillt het RaceForm, geen auto-write.
2. Gids uploaden → documentanalyse (`engines/document-analysis`, `document_analyses`) → puntVOORSTELLEN met bron/pagina/betrouwbaarheid.
3. Kaartcontrole in `race-points-panel.tsx`: bevestigen/aanpassen/afwijzen (`PATCH /api/races/:id/points/...` → `race_points`; nooit terug naar "voorgesteld").
4. Export-centrum: GPX / FIT Course / FIT Workout met validatie vooraf + round-trip-verificatie (`lib/race-export/`, `race_exports`); nieuwe gids → `needsReconfirm` + exports "verouderd".
5. Op de fiets: route met `race`-blok (`GET /api/routes/:id`) → mobiele wedstrijdmodus (`lib/race-mode.ts`): rondeteller, finish-cue laatste ronde.
6. Achteraf: wedstrijddossier in Journey (`routes/journey.ts`) + Wedstrijd-room (`pages/wedstrijd-room.tsx`).

## 6. Route: genereren → verrijken → delen → navigeren

1. `/routes`: genereren via ORS (`lib/routing/providers/ors.ts`; echte route of eerlijk niets) of GPX-import.
2. Verrijking: hoogteprofiel (`elevation-profile.tsx`), opmerkingen (`GET /api/routes/:id/remarks`), wegtypen + fietsgeschiktheid (`GET /api/routes/:id/surfaces`), POI's, klimmen (`routes/climbs.ts`).
3. Optioneel: volgauto-plan (`POST /api/routes/:id/volgauto` → `volgauto_plans`) en route delen (`route_shares`).
4. Mobiel navigeren (flow 7); versiegebruik vastgelegd (`route_version_usages`).

## 7. Mobiele rit: opnemen → navigeren → sensoren → opslaan → delen

1. Start in `record.tsx` of `navigate/[id].tsx`; achtergrondtracking via TaskManager (`lib/ride-tracker.ts`, native build).
2. Optioneel BLE-sensoren koppelen (`lib/ble-sensors.ts`; Expo Go eerlijk "niet ondersteund"); 1s-sampling → GPX met hartslag/vermogen (`lib/ride-gpx.ts`).
3. Onderweg: route-match + off-route-keuze (`lib/route-match.ts`, `lib/off-route-choice.ts`), audio-cues, klimfases, verkeerslichten (`road_objects`), bordjes-sprints (`lib/race-mode.ts`-onafhankelijk, `sprint_results`), val-alarm (`lib/fall-detection.ts`), optioneel live locatie delen (flow 8), voedingstikkers (snapshot bij STOP).
4. Stoppen: auto-trim met ongedaan-maken (`ride-trim`), upload via fail-closed queue (`lib/upload-queue.ts`) → Data Hub-ingest → `training_sessions` (afgeleide TSS, streams, bests).
5. Delen: deelkaart (whitelist), Strava handmatige activity, OS-deelmenu (`routes/share.ts`, `lib/share-api.ts`); rit als route bewaren kan.

## 8. Live locatie delen (tijdens navigatie)

1. In `navigate/[id].tsx` kiest de renner expliciet: niet delen (default) / geaccepteerde vrienden / groepsrit van vandaag (`GET /api/live-location/group-options`).
2. `POST /api/live-location/sessions` → `live_location_sessions` + `live_location_grants`; minderjarig/onbekende leeftijd in groep fail-closed tot vrienden/begeleiders.
3. Zender stuurt adaptief (stilstand/scherm/batterij/offline, `lib/live-share.ts`) naar `POST /positions` — één rij per sessie, geen historie.
4. Kijkers zien geclusterde initialen-markers; autorisatie bij élke `GET /friends` herchecked; eerlijke veroudering (Live ≤20s → "x geleden" → coördinaten weg ≥5 min → verdwenen ≥15 min).
5. Stoppen (of schermverlaten, of 30 min idle) beëindigt de sessie en wist de positierij.

## 9. Voeding: consent → richtwaarden → registratie → daganalyse

1. Voeding-sheet: consent fail-closed (`nutrition_preferences.consentAt`).
2. Richtwaarden per sessie deterministisch (`GET /api/nutrition/session-targets`, `lib/fueling.ts`); <16 géén getallen; coachinstructies letterlijk bovenaan.
3. Registratie (logs met foto's + `energyFeel`); mobiele tikkers posten één log na opslaan.
4. Daganalyse vergelijkt plan↔registratie (`compareFuelPlanToLogs`); 17+ optioneel seizoensdoel (max 0,5 kg/week, `nutrition_season_goals`).

## 10. Mechanieker: fiets → gebruik → signalen → scan

1. Fiets(en) aanmaken in de garage (`garage_bikes`); ritten koppelen automatisch alleen bij zekerheid (Strava gear_id of precies één actieve fiets).
2. Km/uren per fiets/onderdeel altijd live afgeleid uit `training_sessions.bike_id` (`lib/bike-usage.ts`).
3. Onderhoudssignalen (`lib/maintenance-signals.ts`): controleadvies / vermoedelijke slijtage / vastgesteld defect (alleen uit eigen registratie).
4. Fietsscan: foto-frames → interactieve fotoweergave (`routes/bike-scan.ts`); materiaalcoach-foto-advies (`routes/material.ts`).

## 11. Club: oprichten → leden → trainingen → selecties

1. Club + rollen via clubuitnodigingen (`routes/club.ts`, `lib/club-permissions.ts`); limieten ook bij invite-accept.
2. Trainingen met aanmelden/reserve (FOR UPDATE op `club_training_signups`); nooit een coachtraining overschrijven.
3. Wedstrijdselecties + beschikbaarheid; berichten; jeugd-consent fail-closed (`club_consents`); beheerders zien nooit sportdata; audit (`club_audit_log`).

## 12. Hulp & uitleg

1. Term/grafiek onduidelijk → `UitlegDot` → Wat/Waarom/Hoe + "Bij jou" met echte waarden (`src/lib/uitleg-content.ts`).
2. Vraag → AI-helpdesk `/support`: deterministische matrix eerst, dan LLM; ticket bij onopgelost (`support_tickets`, advisory-lock find-or-create).
3. Bug → bugmelding (`routes/bug-reports.ts` → `bug_reports`, zichtbaar in admin).

## 13. Beheer & privacy

1. Admin: `/admin` → "Controleer nu" draait alle echte probes (`lib/health/checks.ts` → `health_check_results`); detailpagina per check met historie en "Markeer als opgelost".
2. Uitrol: releasegroepen + auto-stop per flag (`routes/release.ts`, `rollout_guards`); kill switches schakelen routergroepen uit (`routes/index.ts`).
3. Gebruiker: export (gemaskeerd) en verwijderen met 14-dagen venster (`routes/privacy.ts`, `routes/account.ts`); elke consent-wijziging append-only gelogd (`consent_audit_log`).
