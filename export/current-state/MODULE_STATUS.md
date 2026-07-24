# MODULE_STATUS — Sparki (24 juli 2026)

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
