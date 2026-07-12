# Sparki — Featurecatalogus (codegedreven)

Datum audit: 12 juli 2026. Bron: actuele codebase (frontend `artifacts/sparki`, backend `artifacts/api-server`, schema `lib/db/src/schema`). Elke regel is gecontroleerd op concrete code-evidence; onzekerheden staan gemarkeerd met ⚠ en zijn verzameld in `AUDIT_UNCERTAINTIES.md`.

**Statuslegenda:** ✅ volledig werkend · ◐ gedeeltelijk werkend · 👁 verborgen (werkt, maar geen duidelijke ingang) · ⛔ niet bereikbaar · 🧪 experimenteel · 🕸 vermoedelijk verouderd · ❓ onbekend
**Classificatie (§5):** A kernwaarde · B contextuele waarde · C ondersteunende infrastructuur · D overlappend · E weesfunctie · F afleidend/onvoldoende gedefinieerd

De volledige veldenset per feature (doelgroep, gebruikersvraag, trigger, databronnen, output, afhankelijkheden, overlap, risico) staat in `FEATURE_INVENTORY.csv`. Dit document groepeert per domein en licht de bijzonderheden toe.

---

## 1. Vandaag / Home (renner)

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-001 | Dag-type home-engine | Rolbewuste startpagina; kiest dagbeeld (training/rust/race/algemeen) | `/` (nav VANDAAG) | `components/sparki/day-home.tsx`, `day-homes/` | `GET /api/athlete/dashboard`, `GET /api/state` | indirect (state/engines) | ✅ | A |
| F-002 | Sparki Core / Toestand (State Engine) | Levende toestandsweergave (belastbaar/solide/…) met glance-metrics en drill-in | StateCard op `/` | `state-card.tsx`, `sparki-core.tsx`, `core/` | `routes/state.ts`, `engines/state/` | `test-scheduled-tasks`-familie n.v.t.; state via engine-smokes ⚠ | ✅ | A |
| F-003 | Dagelijkse check-in | "Hoe voel je je vandaag?" — voeding voor readiness | bovenaan StateCard | `state-card.tsx` (hoisted prompt) | `athlete_daily_metrics` via athlete-routes | via readiness-engine ⚠ | ✅ | A |
| F-004 | Coach-analyse van de dag | Deterministische observaties + LLM-proza ("Wat valt op") | ScreenShell-kaart op home | `screen-shell.tsx` (CoachAnalysisCard), `coach-decision-card.tsx` | `routes/ai.ts` (composeCoachAnalysis), `engines/observation/` | `test:observation` | ✅ | A |
| F-005 | Dagelijkse briefing | Vers opgestelde tekstbriefing per bezoek | home (flag `ai_observations`) | `day-type-briefing.tsx` | `POST /api/ai/brief` | — | ✅ | A |
| F-006 | Adaptieve coachbeslissing | Beslislaag "pas je training aan" over alle dagtypes | CoachDecisionCard op home | `coach-decision-card.tsx`, `lib/coach-engine.ts` | feedback-adjust-routes | `test:feedback-adjust` (10) | ✅ | A |
| F-007 | Vervolgvragen (follow-up) | Avond-vervolgvraag op persoonlijke context | FollowUpPrompt in ScreenShell | `follow-up-prompt.tsx` | `coach_followup_answers`, context-memory | `test:context-memory` | ✅ | A |
| F-008 | Leskaart van de dag | Dagelijkse micro-les onderaan home | onderaan `/` | `leskaart-van-dag.tsx` | knowledge/feed ⚠ | — | ✅ | B |
| F-009 | Thuisweer | Open-Meteo-weer voor thuislocatie in dagadvies | home-secties | `home-sections.tsx` | `routes/weather.ts`, `lib/weather/open-meteo.ts` | — | ✅ | C |
| F-010 | Zelf-update hub | Vandaag als enige zelfinvoer-oppervlak (training/voeding/gezondheid toevoegen) | update-sectie op `/` | `add-training.tsx`, `health-status-control.tsx` | athlete/nutrition routes | — | ✅ | A |
| F-011 | Ontwikkelprioriteit-kaart home | "Grootste hefboom" samengevat op home | home-kaart | `ontwikkelprioriteit-home-card.tsx` | afgeleid client-side (`lib/ontwikkelprioriteit.ts`) | `test:ontwikkelprioriteit` | ✅ | A (D-risico met F-030) |
| F-012 | Presentatievariatie | Per app-open andere volgorde/leidend inzicht (getallen stabiel) | onzichtbaar (X-Sparki-Session) | `lib/session.ts` | `lib/variation.ts` | — | ✅ | C |
| F-013 | Engagement-nudges | Gezonde terugkeer-nudges op basis van echt open-ritme | notificatie/nudge | — | `engines/engagement/`, `routes/engagement.ts` | `test:engagement` | ✅ | C |

## 2. Trainen & schema

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-020 | Trainingspagina (vier lagen) | L1 bron / L2 doel / L3 vandaag / L4 patronen | `/train` (nav TRAINEN) | `pages/train.tsx`, `train/` | athlete + training-plan routes | — | ✅ | A |
| F-021 | Autonoom 3-wekenplan | Sparki bouwt/onderhoudt schema zonder coach (deterministische getallen) | `#three-week-plan` op `/train` | `three-week-plan.tsx`, `training-plan-panel.tsx` | `routes/training-plan.ts`, `engines/training-plan/` | via feedback-adjust + per-sessie-caps ⚠ | ✅ | A |
| F-022 | Interactief schema + feedback | Dagen aanklikbaar; feedback → aanpassingsvoorstel | dagen in 3-wekenplan | `day-detail-drawer.tsx`, `workout-detail-drawer.tsx` | PUT-validatie in training-plan routes | `test:feedback-adjust` | ✅ | A |
| F-023 | Werkout-/dagdetail | Detail-drawers voor geplande training | tap op dag/werkout | `workout-detail-drawer.tsx`, `day-detail-drawer.tsx` | athlete workouts | — | ✅ | A |
| F-024 | Trainingsverloop / progressie | CTL-sparkline + ontwikkelweergave uit echte series | onderaan trainingshome | `training-progression.tsx` | `GET /api/athlete/load` | — | ✅ | A |
| F-025 | Kern-voorspelling per training | Voorspeld effect nu→tijdens→eind→herstel; VOORSPELD/WERKELIJK | werkoutdetail | `core-prediction-panel.tsx` | `routes/core-prediction.ts`, `engines/core-prediction/` | `test:core-prediction` | ✅ | A |
| F-026 | Dagadvies zonder plan | Eén concreet uitlegbaar sessievoorstel op plan-loze dag | home/train | — | `lib/day-advice`, `lib/readiness` (api-server) | via day-advice tests ⚠ | ✅ | A |
| F-027 | FTP-schattingswizard | Gids voor renners die hun FTP niet weten | "Ik weet mijn FTP niet" | `ftp-estimate-wizard.tsx` | PUT profile (`ftpEstimated`) | — | ✅ | B |
| F-028 | FTP-vloer-afleiding | Eerlijke ondergrens uit NP-data, verhoogt alleen geschatte FTP | automatisch bij ingest | — | data-hub/derived (api-server) | `test:derived-load` | ✅ | C |
| F-029 | Belastingscore-afleiding (TSS) | TSS afgeleid uit power+FTP bij ingest + self-heal | automatisch | — | data-hub ingest | `test:derived-load` | ✅ | C |
| F-030 | Ontwikkelkompas / Ontwikkelmodel | Doel + belastbaarheid + benutting; ontwikkelprioriteit | `/you?focus=ontwikkelkompas` | `pages/you.tsx`, `insight/` | development-goal velden | `test:development-goal`, `test:bandbreedte` | ✅ | A |

## 3. Activiteiten & data

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-040 | Activiteitenlijst + sessie-analyse | Ritten met NP/IF/TSS-analyse t.o.v. recente sessies | `/activiteiten` (nav ACTIVITEITEN) | `pages/activiteiten.tsx`, `session-detail-drawer.tsx`, `lib/session-analysis.ts` | athlete sessions | `test:session-analysis` | ✅ | A |
| F-041 | Bestand-import (GPX/FIT/TCX) | Upload → parse → Data Hub-ingest; koppelen aan training | ActivityImportPanel op `/activiteiten` | `activity-import-panel.tsx` | `routes/activity-imports.ts`, `lib/activity-file-ingest` | `activity-file-ingest` (10), `test:fit-parse` | ✅ | A |
| F-042 | Strava-koppeling (per-gebruiker OAuth) | Tokens in `connector_connections`; activiteiten + profiel | `/you?focus=connections` | `connections-section.tsx` | `routes/connectors.ts`, `lib/connectors/providers/strava*` | `test:onboarding-strava-gapfill`, `test:connector-cleanup` | ✅ | A |
| F-043 | Data Hub (sync/dedupe/merge) | Centrale multi-platform pijplijn; consent per datatype | onzichtbaar | — | `engines/data-hub/`, `routes/hub.ts` | `test:data-hub` | ✅ | C |
| F-044 | Connector-herstel-nudge | Melding bij gebroken koppeling | ScreenShell | `connector-recovery-nudge.tsx` | hub-status | — | ✅ | C |
| F-045 | Garmin-koppeling | Flag bestaat (`garmin`); geen werkende provider gevonden ⚠ | — | — | — | — | ⛔/❓ | E |
| F-046 | Activity-imports-historie-endpoints | `GET/DELETE /api/activity-imports*` deels zonder UI-aanroep ⚠ | — | — | `routes/activity-imports.ts` | ✅ tests | 👁 | C/D |

## 4. Wedstrijden

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-050 | Wedstrijden (races) | Racelijst + formulier | `/races` (header RACES) | `pages/races.tsx`, `race/` | `routes/races.ts` | — | ✅ | B |
| F-051 | Wedstrijdkalender-import | Fietssport (vol), We-Tri (vol), KNWU (eerlijk-beperkt) | "Uit kalender" op `/races` | `import-from-calendar.tsx`, `hooks/use-calendar.ts` | `routes/calendar.ts`, `lib/calendar/` | — | ✅ (KNWU ◐, bewust) | B |
| F-052 | Race Intelligence | Deterministisch prep/report/fuel/checklist; brongatig eerlijk | racedetail | race-componenten | `engines/race/` | via race-tests ⚠ | ✅ | B |
| F-053 | Race-evaluatie-endpoint | `GET /api/races/:id/evaluation` — geen UI-hook gevonden ⚠ | — | — | `routes/races.ts` | — | 👁 | E |
| F-054 | Wedstrijd-room | Racedag-mediamontage met leden | `/wedstrijd-room` | `pages/wedstrijd-room.tsx` | `routes/race-rooms.ts`, `engines/race-room/` ⚠ | `test:race-room` | ✅ | B |
| F-055 | Documentanalyse (gidsen) | PDF/afbeelding van wedstrijdgids → gevonden/ontbreekt + verrijking | upload bij race | `document-analysis-panel.tsx` | `routes/document-analysis.ts`, `engines/document-analysis/` | — | ✅ | B |

## 5. Voeding, materiaal, gezondheid, routes

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-060 | Voeding-scherm + fuelingplan | Sheet met logs (foto's), dag-analyse, leeftijdsgevoelig | `?focus=nutrition` / update-sectie | `voeding-screen.tsx` | `routes/nutrition.ts` | — | ✅ | B |
| F-061 | Voeding-seizoensdoel (17+) | Seizoensstart/piek/streefgewicht; RED-S-weigering <17 | in Voeding-sheet | `voeding-screen.tsx` | `GET/PUT /api/nutrition/season-goal` | — | ✅ | B |
| F-062 | Materiaalcoach | Foto-gedreven materiaaladvies, confidence-gated | nudge op home / materiaal | `material-coach.tsx` | `routes/material.ts`, `engines/material/` | `test:material`, `test:material-nudge` | ✅ | B |
| F-063 | Gezondheidsstatus | Ziek/hersteld-melding beïnvloedt advies | update-sectie home | `health-status-control.tsx` | athlete metrics | — | ✅ | B |
| F-064 | Routeplanner / routes | Route-panel, GPX-gebaseerd, flag `route_planner` | `/train` (flag) | `route-panel.tsx`, `route-map.tsx`, `linked-route.tsx` | `routes/routes.ts`, `engines/route/` | — | ✅ (flag-gated) | B |
| F-065 | Mentale veerkracht-kaart | Mentale kaart; gemount op `/lab` — dus effectief verborgen (geverifieerd) | alleen via /lab | `mental-resilience-card.tsx` | `routes/mental.ts`, `engines/mental/` | — | 👁 | E |

## 6. Profiel, geheugen & inzicht

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-070 | Sparki Core levend profiel | Wat Sparki AFLEIDDE: lenzen, identiteit, evolutie | `/you` (nav JIJ, label PROFIEL) | `pages/you.tsx`, `core-profile*`-libs | insights/observations | `test:core-profile*` (3 suites) | ✅ | A |
| F-071 | Profielinstellingen (drill-in) | FTP/uren/gewicht/sport/doel/check-in/koppelingen; `?focus=` | sheet op `/you` | `profile-settings.tsx` | PUT profile | — | ✅ | C |
| F-072 | Doelen-werkblad + doelen-engine | Doelen incl. afgeleide; maandelijkse review-job | `/you?focus=doelen` | `goals-worksheet.tsx` | `routes/goals.ts`, `engines/goals/`, `jobs/goal-review.ts` | `test:goals` | ✅ | A |
| F-073 | Vraag Sparki (chat-overlay) | Chat met sessie-gescoped zichtbare thread; volledige historie = geheugen | SPARKI-merk in header | `sparki-chat-overlay.tsx`, `sparki-input-center.tsx` | `routes/ai.ts` chat | — | ✅ | A |
| F-074 | Persoonlijke-contextgeheugen | Deterministische NL-detectie, privacy-gated persist | via chat/check-in | `context-memory-panel.tsx` | `engines/context-memory/` | `test:context-memory` | ✅ | C |
| F-075 | Geheugengraaf (verbanden) | Cross-domein correlaties, zwijgt bij zwak bewijs | inzicht-oppervlakken | — | `engines/memory-graph/` | `test:memory-graph` | ✅ | C |
| F-076 | Observatie-dedup & lenzen | Presentatie-dedup van herhaalde feiten | `/you`, home | `insight-grouping` libs | — | `test:insight-grouping` | ✅ | C |
| F-077 | Profiel-consistentievragen | Vraagt alleen door op door gebruiker gezette waarden | prompt-kaart | `profile-prompt-card.tsx` | profile-consistency lib | `test:profile-consistency` | ✅ | C |
| F-078 | Inzicht-pagina (/lab) | INZICHT-oppervlak met insights-secties | `/lab` — **geen nav-ingang; enige link vanuit verborgen /core** (geverifieerd) | `pages/lab.tsx`, `insights-section.tsx` | `routes/insights.ts` | — | 👁 | D/E (overlapt /you; feitelijk onbereikbaar) |
| F-079 | AI-geheugenpaneel | Beheer opgeslagen observaties | `/you`-sectie ⚠ | `ai-memory-panel.tsx` | `routes/memory.ts` | — | ✅ | C |
| F-080 | Stem-/persoonlijkheidsengine | Deterministische toon/vertrouwen/empathie | onzichtbaar (proza) | `sparki-voice.tsx` | `engines/voice/`, `routes/voice.ts` | `test:voice` | ✅ | C |
| F-081 | Twee-laags uitleg | Kort standaard + "Uitgebreid" alleen bij echte diepte | overal | `tiered-explanation.tsx` | — | — | ✅ | C |
| F-082 | Smart Missing Input Flow | Lege staat → gerichte actie → terug → retry | overal | `missing-input-notice.tsx`, `lib/missing-input.ts` | — | — | ✅ | C |

## 7. Nieuws, kennis & ontdekken

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-090 | Nieuws/Ontdekken-feed | Gecureerd nieuws met verse ranking + lazy refresh | `/feed` (nav ONTDEKKEN, label NIEUWS) | `pages/feed.tsx`, `news-reader.tsx` | `routes/feed.ts` | — | ✅ | B |
| F-091 | In-app nieuwslezer | Excerpt + bronvermelding, nooit wegnavigeren | klik op nieuwsitem | `news-reader.tsx` | — | — | ✅ | B |
| F-092 | Kennisbank | Sport-wetenschapsbibliotheek, dagelijkse scan | `/kennis` (flag `knowledge_base`) | `pages/knowledge.tsx` | `routes/knowledge.ts`, `jobs/knowledge-scan.ts` | — | ✅ (flag) | B |
| F-093 | Intel "Voor jou" | Persoonlijke intelligentiemodule | `/kennis` (flag) | `intel-card.tsx`, `intel-reader.tsx` | `routes/intel.ts`, `engines/intel/` | `test:intel` | ✅ (flag) | B |
| F-094 | Renners-reel (Wereld in feed) | Swipe-reel met virtuele renners; dwell-gated leren | in `/feed` | `world-reel.tsx` | `engines/world-affinity/` | `test:world-affinity`, `test:world-feed` | ✅ | F→B ⚠ |

## 8. Samen & Wereld

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-100 | Samen (kring-feed) | Follow-ups + vrienden + races + nieuws samengevoegd | `/samen` (header-knop) | `pages/samen.tsx` | `routes/social.ts`, `GET /api/social/circle-feed` | — | ✅ | B |
| F-101 | Sparki World | Transparant-fictief eiland met virtuele renners; media-engine | `/wereld` (+ `/wereld/athlete/:slug`) | `pages/wereld.tsx` | `routes/sparki-world.ts`, `engines/world-*` (5 engines) | `test:world-*` (4+) | ✅ | F ⚠ |
| F-102 | World-simulatie/seed-scripts | `sim:world-day`, seed/backfill-scripts — alleen handmatig | CLI | — | `scripts/run-world-day.ts` e.a. | `test:world-sim`, `test:world-consistency` | 👁 (CLI-only) | C/E |

## 9. Coach & ouder

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-110 | Coach-portaal (roster + detail) | Gekoppelde renners, gedeelde data per niveau | `/` als coach | `coach-home.tsx`, `coach/` | `routes/coach.ts` | `test:coach-parent-*` (6 suites) | ✅ | B |
| F-111 | Coach-planadoptie | Advies-plan → coach-eigen plan (dedupe, nooit overschrijven) | `/coach/athletes/:id/plan` | `pages/coach-athlete-plan.tsx` | `POST .../plan/adopt` | via link-isolation tests | ✅ | B |
| F-112 | Ouder-portaal (welzijn) | Alleen welzijnssignalen; geen ruwe power/TSS | `/` als ouder | `parent-home.tsx` | `routes/parent.ts` | `test:coach-parent-sharing-levels` | ✅ | B |
| F-113 | Deelniveaus & privacygrenzen | none/summary/full (coach), none/safety_only/summary (ouder); fail-closed | `/you` privacy | `privacy-settings.tsx` | `lib/privacy.ts`, `routes/privacy.ts` | 6 isolatie-suites (alle groen) | ✅ | C |
| F-114 | Uitnodigingen & koppelingen | Token-invites; atomische accept; ontkoppelen | `/invitations`, `/invite/:token` | `pages/invitations.tsx`, `invite-accept.tsx`, `links-section.tsx` | `routes/invitations.ts`, `routes/links.ts` | `test:links-*` (2), invitations via isolatie | ✅ | C |
| F-115 | Rollen & rolwissel | athlete/coach/parent in eigen DB; wissel in header | ScreenShell-header | `screen-shell.tsx` | `PUT /api/auth/me/role` | `test:account` | ✅ | C |

## 10. Onboarding & account

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-120 | Onboarding V2 (adaptieve Q&A) | Vaste catalogus, eerlijke nonsens-afhandeling, skip-ontsnapping | eerste sign-in | `onboarding-v2.tsx` | `routes/onboarding.ts`, `engines/onboarding/` | `test:onboarding-v2`, `-personas`, `-resume` | ✅ | C |
| F-121 | Verplichte connect-stap + gap-fill | Koppelen verplicht getoond, koppelen zelf optioneel; alleen échte gaten vragen | in onboarding | `onboarding-gap-fill.tsx` | onboarding routes | `test-onboarding-connect-step` (7), `-strava-gapfill` | ✅ | C |
| F-122 | Account-gate & JIT-provisioning | Eén AccountGate voor elk ingelogd oppervlak; self-healing sync | `App.tsx` | `App.tsx` (AccountGate), `contexts/UserContext.tsx` | `POST /api/auth/sync`, `lib/auth.ts` | `test:account`, `test-cross-account-isolation` (19) | ✅ | C |
| F-123 | Landing + sign-in/up | Publieke landing; Clerk-thema in Sparki-stijl | `/`, `/sign-in`, `/sign-up` | `pages/landing.tsx`, `sign-in.tsx`, `sign-up.tsx` | Clerk + proxy-middleware | — | ✅ | C |
| F-124 | Account-herkoppeling | Nieuw Clerk-account, zelfde e-mail → bestaand profiel | automatisch bij sync | — | `routes/auth.ts` | `test:account` ⚠ | ✅ | C |

## 11. Meldingen & herinneringen

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-130 | Notificatiebel (dag-vouw) | Rijen gevouwen per Amsterdamse dag; badge telt dagen | bel in header | `notification-bell.tsx` | `routes/notifications.ts` | `test:notifications`, `-day-count`, `-read-batch` | ✅ | C |
| F-131 | Herinneringen (e-mail/push) | Geplande check-in/trainingsherinneringen, idempotent | instellingen `/you` | `reminder-settings.tsx` | `engines/reminders/`, `jobs/reminders.ts` | `test:email-channel` + reminders ⚠ | ✅ | C |
| F-132 | Web push | VAPID-push met SSRF-hostallowlist | browser-permissie | — | `lib/push` (api-server) | — | ✅ | C |
| F-133 | E-mail (Resend) | Eerlijk-beperkt: geen geverifieerd domein → slaat over, nooit nep-verzonden | — | — | `lib/email` | `test:email-channel` | ◐ (bewust) | C |
| F-134 | Wekker / Sound Studio | In-app wekker + eigen audio-identiteit | `/geluid`, gelinkt vanuit `/you` (geverifieerd) | `pages/geluid.tsx`, `wekker-overlay.tsx` | `routes/audio.ts`, `engines/audio/` | — | ✅ | B/F (productkeuze) |

## 12. Beheer, testers & platform

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-140 | Admin-gezondheidscheck | Echte probes, 4 eerlijke statussen, nooit nep-groen; CLI-job | `/admin`, `/admin/health/:key` | `pages/admin.tsx`, `admin-health-detail.tsx`, `admin-panel.tsx` | `routes/admin.ts`, `jobs/health-check.ts` | `test:health-endpoints` | ✅ | C |
| F-141 | Geplande-taken-overzicht | Status per job op /admin | `/admin` | admin-panel | scheduled-tasks lib | `test-scheduled-tasks` (14), `-route` (3) | ✅ | C |
| F-142 | Testeroverzicht + Test Dashboard | Roster, telemetrie-gated scoring | `/admin` | `test-dashboard.tsx` | `routes/telemetry.ts`, admin | `test:test-dashboard` | ✅ | C |
| F-143 | Tester-QR + welkomstmoment | QR-entry overleeft sign-in-round-trip; eenmalig welkom | `/tester-qr`, `/welkom-tester` | `pages/tester-qr.tsx`, `tester-welcome.tsx` | invitations/admin | — | ✅ | C |
| F-144 | Feedback & bugmeldingen | Globale feedback-sheet + threads | feedback-knop header | `feedback-sheet.tsx`, `bug-report-*.tsx`, `feedback-inbox.tsx` | `routes/bug-reports.ts` | — | ✅ | C |
| F-145 | Feature-flagsysteem | 10 sleutels; override > rol > default > head-tester | `/admin` flags-UI | `feature-gate.tsx`, `contexts/FeatureFlagContext.tsx` | `routes/flags.ts`, `lib/feature-flags` | — | ✅ | C |
| F-146 | Dev Preview Mode | Dev-only auth-bypass + schermwisselaar; prod dood | dev-server | `dev-preview.tsx`, `lib/dev.ts` | `routes/dev.ts` (alleen ≠production), devAuthBypass | — | ✅ (dev-only) | C |
| F-147 | Telemetrie | Gebruiksevents voor testers | onzichtbaar | — | `routes/telemetry.ts` | via test-dashboard | ✅ | C |
| F-148 | Objectopslag | Foto's/bestanden; ACL na bytes; owner-checked serve | via upload-flows | — | `routes/storage.ts` | via material/photo tests | ✅ | C |
| F-149 | Input Center | Centrale composer (tekst/foto/bestand/link) | chat rij 2 | `sparki-input-center.tsx` | `routes/input-center.ts`, `engines/input-center/` | — | ✅ | C |

## 13. Experimenteel / prototypes

| ID | Naam | Omschrijving | Entry | Frontend | Backend | Tests | Status | Kl. |
|---|---|---|---|---|---|---|---|---|
| F-160 | Core Playground | Design-prototype levende vorm | `/core` (geen nav-ingang) | `pages/core-playground.tsx` | — | — | 👁/🧪 | E |
| F-161 | Photo Lab | Gemini-relight fotoflow, geïsoleerd | `/photo-lab` (geen nav-ingang) | `pages/photo-lab.tsx` | `routes/photo-style.ts` | via photo-lab ⚠ | 👁/🧪 | E |
| F-162 | Bio-radar | Visuele component; in gebruik in training-day-home én /lab (geverifieerd) | drill-in home + /lab | `bio-radar.tsx` | — | — | ✅ | C |
| F-163 | Cinematic scene | Achtergrondscène-component | via ScreenShell ⚠ | `cinematic-scene.tsx` | — | — | ✅ ⚠ | C |

---

## Rolzichtbaarheid (samenvatting)

- **Alleen renner:** F-001…F-094 (athlete-home en alle trainings-/analysefuncties).
- **Alleen coach:** F-110, F-111; `/invitations` gedeeld met ouder.
- **Alleen ouder:** F-112 (welzijnsweergave); nieuws-feed gedeeld.
- **Alleen admin:** F-140…F-142; `isAdmin()` is dev-bypass-bewust, prod via `SPARKI_ADMIN_IDS`.
- **Alleen head-tester:** `/welkom-tester`, vroege-toegang-flags.
- **Alleen dev:** F-146, `/api/dev/*` (bestaat niet in productie-build).

## Overlap-hotspots (detail in FEATURE_CONSOLIDATION_MATRIX.md)

1. **Inzicht op 3 plekken:** `/lab` (INZICHT), `/you` (PROFIEL/Core), home-kaarten (F-004/F-011) tonen deels dezelfde observaties — dedupe bestaat op presentatieniveau maar de bestemmingen overlappen (D).
2. **Nieuws vs Kennis vs Intel:** `/feed`, `/kennis`, intel-module bedienen alle drie "iets leren/lezen" (D).
3. **Vandaag vs Training-dagdetail:** geplande training zichtbaar op home én `/train` én drawers — bewust, maar herhaling is voelbaar.
4. **Wereld vs Renners-reel:** zelfde virtuele-rennerscontent op `/wereld` én in `/feed` (D).

## Veiligheid & privacy (positief bevestigd door tests)

- 6 coach/ouder-isolatiesuites + `test-cross-account-isolation` (19 checks) zijn groen (12 juli 2026).
- Fail-closed privacy in `lib/privacy.ts`; persoonlijke context nooit ruw naar derden.
- Bekende risico-aandachtspunten: object-ACL-timing (opgelost patroon), SSRF-allowlists (push, calendar), Leaflet divIcon-escaping.
