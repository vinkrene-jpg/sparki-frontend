# SPARKI MODULE BUILD MATRIX

Datum: 24 juli 2026. Bron van waarheid: actuele repository (pnpm-monorepo: `artifacts/sparki`, `artifacts/api-server`, `artifacts/sparki-mobile`, `lib/db`, `lib/feature-flags`).

**BELANGRIJK — ontbrekende bron:** `SPARKI_AI_MASTER_PLAN_v2.16_CONFIRMED_ANSWERS.md` staat NIET in de repository en is niet aangeleverd. Alle velden die uitsluitend uit het Master Plan kunnen komen (variant-indeling Sparki Go/Basic/Performance/Pro, standaard-of-add-on, commerciële positionering per module) zijn daarom gemarkeerd als `MASTERPLAN_SOURCE_REQUIRED` en NIET zelf ingevuld. Concurrentiefeiten zonder aantoonbare bron zijn gemarkeerd als `MARKET_RESEARCH_REQUIRED`. Zodra het planbestand wordt aangeleverd, hoort het ongewijzigd op `docs/SPARKI_AI_MASTER_PLAN_v2.16_CONFIRMED_ANSWERS.md` en moeten deze velden in één vervolgstap worden ingevuld.

Statussen: `BUILT_STABLE` | `BUILT_NEEDS_REPAIR` | `PARTIALLY_BUILT` | `NOT_BUILT` | `LATER_OUT_OF_SCOPE`

---

MODULE: Account, authenticatie en rollen
STATUS: BUILT_STABLE
BEWIJS: `artifacts/api-server/src/routes/auth.ts` (/api/auth/sync, /me, /me/role), `artifacts/sparki/src/contexts/UserContext.tsx`, `lib/db/src/schema/users.ts` (user_profiles: roles[], active_role), pagina's `sign-in.tsx`/`sign-up.tsx`; tests `test:account`, `test:cross-account-isolation` (groen in laatste validatierun).
BESTAANDE WERKENDE ONDERDELEN: Clerk cookie-auth, JIT-provisioning, rolwissel (athlete/coach/parent), account-re-link op geverifieerd e-mailadres, uitnodigingen (`routes/invitations.ts`).
DEFECTEN: geen bekende; flags-fetch-race (403 na inloggen → alles uit) is deze week gerepareerd in `FeatureFlagContext.tsx`, wacht op publicatie.
ONTBREKENDE ONDERDELEN: geen aparte rollen "ploegleider"/"mechanieker" als accountrol (functies bestaan wél, zie die modules).
AFHANKELIJKHEDEN: Clerk (Replit-managed), DATABASE_URL.
DATA-TRUST-RISICO: laag — identiteit server-side uit Clerk, nooit uit req.body.
PRIVACY/RECHTEN-RISICO: laag — fail-closed, isolatie getest.
COMMERCIËLE WAARDE: fundament (randvoorwaarde voor alles).
CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO: MASTERPLAN_SOURCE_REQUIRED
SPARKI BASIC: MASTERPLAN_SOURCE_REQUIRED
SPARKI PERFORMANCE: MASTERPLAN_SOURCE_REQUIRED
SPARKI PRO: MASTERPLAN_SOURCE_REQUIRED
STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO (in stand houden)
EERSTVOLGENDE KLEINE BOUWSTAP: geen — alleen fix publiceren.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Sporteromgeving
STATUS: BUILT_STABLE
BEWIJS: pagina's `start.tsx`, `train.tsx`, `activiteiten.tsx`, `lichaam.tsx`, `you.tsx`, `paspoort.tsx`; API `routes/athlete.ts`; schema `athlete-profiles.ts`, `athlete-training.ts`, `athlete-metrics.ts`, `passport.ts`; tests o.a. `test:athlete-load`, `test:sportpaspoort`, `test:core-profile` (groen).
BESTAANDE WERKENDE ONDERDELEN: dashboard, Core-profiel (/you), Sportpaspoort met herkomstlaag, intelligent-werkbladdoctrine app-breed.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern; verfijning doorlopend.
AFHANKELIJKHEDEN: Data Hub, engines.
DATA-TRUST-RISICO: laag (bronnenregister + provenance aanwezig).
PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: kernproduct.
CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO: MASTERPLAN_SOURCE_REQUIRED
STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Trainer/coachomgeving
STATUS: BUILT_STABLE
BEWIJS: `coach-cockpit.tsx`, `coach-athlete-plan.tsx`; API `routes/coach.ts`, `coach-cockpit.ts`; schema `coach-cockpit.ts`, `links.ts`; tests `test:coach-cockpit`, `test:coach-parent-sharing-levels` e.a. (groen).
BESTAANDE WERKENDE ONDERDELEN: roster, voorstellen-workflow, plan-adoptie (advisory → athlete-owned), cross-coach-isolatie.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: links, trainingsplanning.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag (sharing-levels getest).
COMMERCIËLE WAARDE: hoog (coach-abonnementen denkbaar). CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Ouder-/verzorgeromgeving
STATUS: BUILT_STABLE
BEWIJS: API `routes/parent.ts`; schema `parent.ts` (parent_athlete_links, parent_reports, parent_confirmations); tests `test:parent-environment`, `test:coach-parent-link-isolation`, `test:coach-parent-share-nothing` (groen).
BESTAANDE WERKENDE ONDERDELEN: één rechtenlaag voor alle ouder-routes, leeftijd fail-closed (onbekende leeftijd clampt naar veiligheidsminimum), welzijnsfocus zonder prestatiedata.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: links, rollen.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: hoogste zorg-categorie maar aantoonbaar fail-closed + getest.
COMMERCIËLE WAARDE: differentiator jeugdmarkt. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Clubomgeving
STATUS: BUILT_STABLE
BEWIJS: pagina's `club.tsx`, `club-beheer.tsx`; API `routes/club.ts`; schema `club.ts` (clubs, club_members, club_teams, club_trainings, auditlog); test `test:club` (aanwezig).
BESTAANDE WERKENDE ONDERDELEN: least-privilege clubrechten (11 rollen), limieten bij invite-accept, jeugd-consent fail-closed, clubtrainingen.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern; club blijft volledig in scope.
AFHANKELIJKHEDEN: rollen, live-locatie (groepsritten).
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: middel (veel rollen) — getest.
COMMERCIËLE WAARDE: hoog (clublicenties denkbaar). CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Ploegleideromgeving (Volgauto)
STATUS: BUILT_STABLE
BEWIJS: API `routes/volgauto.ts`; schema `volgauto.ts` (volgauto_plans, volgauto_positions, volgauto_reports); geïntegreerd in `routes.tsx`; test `test:volgauto`.
BESTAANDE WERKENDE ONDERDELEN: aparte autoroute-laag (fietsroute intact), aansluitpunten, live posities, ETA "geschat".
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen aparte ploegleider-accountrol (werkt via bestaande rollen/links).
AFHANKELIJKHEDEN: routes, live-locatie, ORS.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: middel (locatie) — sessiegebonden.
COMMERCIËLE WAARDE: nichedifferentiator. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Mechaniekeromgeving
STATUS: PARTIALLY_BUILT
BEWIJS: pagina `mechanieker.tsx`; API `routes/material.ts`, `routes/garage.ts`; schema `material.ts`, `garage.ts`; engine `engines/material/analyze.ts`; tests `test:mechanieker`, `test:material`, `test:material-nudge`.
BESTAANDE WERKENDE ONDERDELEN: foto-gedreven slijtage-analyse, materiaalkring, km altijd afgeleid, onderhouds-nudges, kostenindicatie.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: het is een self-service-module voor de sporter; er is géén aparte omgeving voor een externe mechanieker (eigen rol, werkorders).
AFHANKELIJKHEDEN: object storage, vision-gateway, garage.
DATA-TRUST-RISICO: laag (asset-provenance verplicht). PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: middel. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO (self-service); externe-mechanieker-rol: besluit vereist → MASTERPLAN_SOURCE_REQUIRED
EERSTVOLGENDE KLEINE BOUWSTAP: pas na Master Plan-besluit over externe mechanieker-rol.
ACCEPTATIECRITERIA: n.v.t. tot besluit.

---

MODULE: Today/dagbegeleiding (Vandaag)
STATUS: BUILT_STABLE
BEWIJS: `pages/feed.tsx`, `pages/start.tsx`, `components/sparki/day-homes/*` (race-day, recovery-day, briefing-only); API `routes/engagement.ts`; engines `engines/engagement/`; test `test:day-type` (groen).
BESTAANDE WERKENDE ONDERDELEN: day-type-precedentie, aandachtswet (één leidend Momentblok), adaptive coach-beslislaag, weer (Open-Meteo), zelf-invoerhub.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: state engine, plannen, gezondheid.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: kernbeleving. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Trainingsplanning
STATUS: BUILT_STABLE
BEWIJS: `pages/train.tsx`; API `routes/training-plan.ts` (/generate, /adapt, /pause, /resume); engine `engines/training-plan/`; schema `training_plans`, `plan_days`, `planned_workouts`; tests plan-execution, `test:feedback-adjust` (groen).
BESTAANDE WERKENDE ONDERDELEN: coachloze planengine (deterministische getallen, model verwoordt alleen), plan-lifecycle, leefagenda, per-sessie-caps, adaptieve voorstellen.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: Data Hub, doelen-engine, gezondheid.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: kernproduct, hoogste betaalbereidheid verwacht (MARKET_RESEARCH_REQUIRED voor bewijs).
CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Training uitvoeren en registreren
STATUS: BUILT_STABLE
BEWIJS: AddTrainingModal/ConfirmActivityCard in `train.tsx`, `activiteiten.tsx`; API `routes/hub.ts`, `activity-imports.ts`; engine `engines/data-hub/` (ingest, dedupe); schema `training_sessions`, `activity_imports`; tests ingest/elevation/sessions-contract (groen).
BESTAANDE WERKENDE ONDERDELEN: handmatige invoer, file-ingest (GPX/FIT/TCX), Strava-sync, dedupe, afgeleide belastingscore, sessiegrafieken + power bests, mobiele rit-registratie met sensoren.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: Garmin/Wahoo eerlijk "niet geconfigureerd" tot fabrikantsleutels bestaan (extern geblokkeerd).
AFHANKELIJKHEDEN: connectors, object storage.
DATA-TRUST-RISICO: laag (manualFields heilig, provenance). PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: kern. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen (Garmin/Wahoo wacht op externe keys).
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Analyse en feedback
STATUS: BUILT_STABLE
BEWIJS: `pages/lab.tsx` (Performance Radar, trends); API `routes/analysis-feedback.ts`, `core-prediction.ts`; engines `core-prediction/`, `insights/`; schema `ai_observations`, `analysis_feedback`; tests `test:session-analysis`, `test:performance-radar` (groen).
BESTAANDE WERKENDE ONDERDELEN: SSOT computeLoadSeries, eerlijke null-radar, observation-engine (≥2-signaalregel), feedbacklus, Core-predictie.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: sessies, AI-gateway.
DATA-TRUST-RISICO: laag (bronnenregister per analyse). PRIVACY/RECHTEN-RISICO: laag (consent-gated persist).
COMMERCIËLE WAARDE: hoog. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Wedstrijden & Race Intelligence
STATUS: BUILT_STABLE
BEWIJS: `pages/races.tsx`, `wedstrijd-room.tsx`; API `routes/races.ts` (/:id/intel, /insight, /export), `race-exports.ts`; engines `engines/race/`; schema `races`, `race-exports.ts`, race_points; kalenderimport (Fietssport/We-Tri volledig, KNWU eerlijk-beperkt); tests race-flow, race-room; export met round-trip-verificatie.
BESTAANDE WERKENDE ONDERDELEN: wedstrijdflow, technische-gids-analyse (documentanalyse), export GPX/FIT, mobiele wedstrijdmodus, Wedstrijd-room.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: KNWU-kalender blijft eerlijk-beperkt (externe SPA onbereikbaar).
AFHANKELIJKHEDEN: routes, documentanalyse, AI-gateway.
DATA-TRUST-RISICO: laag (nooit fabriceren-regel). PRIVACY/RECHTEN-RISICO: laag; minderjarig media fail-closed in dossier.
COMMERCIËLE WAARDE: hoog. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Mentale training en mentale kaarten
STATUS: PARTIALLY_BUILT
BEWIJS: `components/sparki/mental-resilience-card.tsx` (in lab.tsx en lichaam.tsx); API `routes/mental.ts` (/overview, /reflection/:workoutId); engine `engines/mental/`; schema `workout_mental_reflections`; test `test:mental` (groen).
BESTAANDE WERKENDE ONDERDELEN: reflecties per workout, mentale-weerbaarheidskaart.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen zelfstandig mentaal trainingsprogramma / oefenkaarten-bibliotheek; wat "mentale kaarten" in het Master Plan precies omvat is onbekend → MASTERPLAN_SOURCE_REQUIRED.
AFHANKELIJKHEDEN: workouts, AI-gateway.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: middel (mentaal welzijn = gevoelig; consent fail-closed aanwezig).
COMMERCIËLE WAARDE: middel/hoog. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: besluit vereist (scope "mentale kaarten") → MASTERPLAN_SOURCE_REQUIRED
EERSTVOLGENDE KLEINE BOUWSTAP: pas na scopebesluit.
ACCEPTATIECRITERIA: n.v.t. tot besluit.

---

MODULE: Voeding
STATUS: BUILT_STABLE
BEWIJS: `components/sparki/voeding-screen.tsx` (via lichaam.tsx); API `routes/nutrition.ts` (incl. photo-advice); schema `nutrition_hydration_logs`, `nutrition_preferences`; fueling-engine deterministisch; seizoensdoel 17+ RED-S-veilig; tests nutrition/fueling aanwezig.
BESTAANDE WERKENDE ONDERDELEN: deterministische rekenkern, jeugd-geen-getallen, foto-logging, fueling per sessie, seizoensdoel-sturing.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: sessies, profiel, AI-gateway (verwoording).
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: middel (RED-S-regels aanwezig, fail-closed).
COMMERCIËLE WAARDE: hoog. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Herstel en belasting / gezondheid
STATUS: BUILT_STABLE
BEWIJS: HealthFlowSection/CheckinSheet in `lichaam.tsx`; API `routes/health-flow.ts` (/complaints, /resume met 409-gate); engine `engines/recovery-load/` (CTL/ATL/TSB); schema `health_complaints`, `health_complaint_updates`; tests health-flow, `test:health-endpoints` (groen).
BESTAANDE WERKENDE ONDERDELEN: raises-only status, expliciete hervat-stap, readiness SSOT, TSB-guards in advies.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: sessies, plannen.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: middel (gezondheidsdata; consent fail-closed).
COMMERCIËLE WAARDE: hoog. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Lab (Performance Lab)
STATUS: BUILT_STABLE
BEWIJS: `pages/lab.tsx` (radar, HRV-trend, FTP-ontwikkeling); SSOT computeLoadSeries; FTP-floor-afleiding; tests `test:performance-radar`, load-tests (groen).
BESTAANDE WERKENDE ONDERDELEN: radar met eerlijke nulls, trends, power bests.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: analyse-engines.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: hoog. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen zelfstandige.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Routes en navigatie
STATUS: BUILT_STABLE
BEWIJS: `pages/routes.tsx`, `pages/klimmen.tsx`; API `routes/routes.ts` (planner, bibliotheek, delen, versies), ORS-provider `lib/routing/providers/ors.ts`; nav-sanitize; mobiel `sparki-mobile/lib/route-match.ts` + HUD; schema `routes.ts`; tests navigation/route-match (aanwezig, unit).
BESTAANDE WERKENDE ONDERDELEN: routeplanner (loops best-of-N, echte rejoins), bibliotheek/versies/delen, route-paspoort + POI's, wegtypen/geschiktheid, klimverkenner, nav-HUD, off-route-keuze, audio-cues.
DEFECTEN: flags-race maakte planner onzichtbaar in prod — gefixt, wacht op publicatie.
ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: ORS_API_KEY, Overpass-mirrors, Mapbox-token.
DATA-TRUST-RISICO: laag (routing-eerlijkheidsregels). PRIVACY/RECHTEN-RISICO: laag (privacy-zones rond huisadres bestaan).
COMMERCIËLE WAARDE: hoog. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: publiceren van de flags-fix.
ACCEPTATIECRITERIA: dylan ziet de routeplanner in productie na één normale sessie.

---

MODULE: GPX/FIT/TCX
STATUS: BUILT_STABLE
BEWIJS: parsers `lib/gpx-parse.ts`, `fit-parse.ts`, `tcx-parse.ts`; ingest via Data Hub provider "file"; export `routes/race-exports.ts` met round-trip-verify; tests `test:ingest-elevation-fit-tcx` (groen).
BESTAANDE WERKENDE ONDERDELEN: import (incl. hoogteprofiel), export, tijdloze-GPX-onderscheid.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: Data Hub. DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: randvoorwaarde. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Wedstrijdmodus (mobiel)
STATUS: BUILT_STABLE
BEWIJS: mobiele wedstrijdmodus in `artifacts/sparki-mobile` (race-gerelateerde schermen), wedstrijd-room dagindex; test `test:ride-tracker` (groen).
BESTAANDE WERKENDE ONDERDELEN: race-day begeleiding mobiel, fuel-snapshot bij STOP.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: races, mobiele tracker. DATA-TRUST/PRIVACY: laag.
COMMERCIËLE WAARDE: hoog. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Live locatie en groepen
STATUS: BUILT_STABLE
BEWIJS: API `routes/live-location.ts` (incl. GET /friends); schema `live-location.ts` (sessions + grants); minor fail-closed in groepstak; één positierow = geen historie.
BESTAANDE WERKENDE ONDERDELEN: opt-in per sessie, authz per read, idle-expiry, koppeling clubtrainingen.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: social, club. DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: hoog van aard, aantoonbaar gemitigeerd (geen historie, fail-closed).
COMMERCIËLE WAARDE: middel. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Vrienden, volgen en sociale feed
STATUS: BUILT_STABLE
BEWIJS: `pages/samen.tsx`; API `routes/social.ts` (circle-feed, volgen, verzoeken, blokkeren), `sparki-world.ts`; schema `social.ts`; privacytests social (fail-closed, 17 categorieën).
BESTAANDE WERKENDE ONDERDELEN: unified feed, profielprivacy op álle ontdekkingspaden, World (transparant-fictief) met harde muur naar echte data.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: privacy-instellingen. DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: middel — getest.
COMMERCIËLE WAARDE: retentie. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Dating voor volwassenen
STATUS: NOT_BUILT
BEWIJS: repo-brede zoektocht op "dating"/gerelateerde termen levert nul functionele treffers (alleen een toevallige woordmatch in `race-types.ts`-commentaar).
BESTAANDE WERKENDE ONDERDELEN: geen.
DEFECTEN: n.v.t.
ONTBREKENDE ONDERDELEN: alles; scope, leeftijdsverificatie, matching, veiligheid volledig onbepaald.
AFHANKELIJKHEDEN: social, privacy, leeftijdsverificatie (18+ hard vereist).
DATA-TRUST-RISICO: hoog. PRIVACY/RECHTEN-RISICO: zeer hoog (18+-verificatie, misbruikrisico, jeugdplatform-mix).
COMMERCIËLE WAARDE: MASTERPLAN_SOURCE_REQUIRED. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: NO-GO tot Master Plan-besluit + expliciet veiligheidsontwerp (jeugdgebruikers op hetzelfde platform).
EERSTVOLGENDE KLEINE BOUWSTAP: geen — eerst besluit.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Communicatie (meldingen, e-mail, push)
STATUS: BUILT_STABLE
BEWIJS: API `routes/notifications.ts`; schema `notifications.ts` (categorie-registry, resolutionKey-dedupe); web push (`use-push.ts`, VAPID-secrets aanwezig); e-mail via Resend-integratie (eerlijk-beperkt zonder geverifieerd domein); dagvouw in bel; tests reminder/notification aanwezig.
BESTAANDE WERKENDE ONDERDELEN: centraal categorieregister, kritiek-nooit-uit, quiet hours, push+e-mail+in-app.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geverifieerd e-maildomein (extern).
AFHANKELIJKHEDEN: Resend, VAPID. DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: retentie. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: e-maildomein verifiëren (externe actie gebruiker).
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: AI-helpdesk (Sparki-helpdesk)
STATUS: BUILT_STABLE
BEWIJS: API `routes/support.ts`; `lib/support/helpdesk.ts` (deterministische antwoordmatrix, classificatie, kennisbank `support_articles`, ticket find-or-create met advisory lock); minor fail-closed; tests support aanwezig.
BESTAANDE WERKENDE ONDERDELEN: vraagclassificatie, artikelzoek, automatische tickets.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: AI-gateway, kennisbank. DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: kostenbesparing support. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Materiaal, fietsscan en Digital Bike Twin
STATUS: BUILT_STABLE
BEWIJS: API `routes/material.ts`, `routes/garage.ts`; engine `engines/material/analyze.ts` (vision-slijtage-analyse cassette/ketting/banden); schema `material.ts`, `garage.ts`; fietsscan met achtergrond-cutout; tests material/bike-scan aanwezig.
BESTAANDE WERKENDE ONDERDELEN: garage ("digital twin" per fiets), foto-analyse met confidence-gating, onderhouds-nudges op km.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: diepte van "Digital Bike Twin" volgens Master Plan onbekend → MASTERPLAN_SOURCE_REQUIRED.
AFHANKELIJKHEDEN: object storage, vision. DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: differentiator. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: pas na plandefinitie-check.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Voorraad en reserveonderdelen
STATUS: NOT_BUILT
BEWIJS: alleen `costEstimate` bij materiaaladvies (`material.ts`); geen voorraadtabellen, geen onderdelencatalogus, geen bestel-/webshopfunctie in schema of routes.
BESTAANDE WERKENDE ONDERDELEN: kostenindicatie per advies.
DEFECTEN: n.v.t.
ONTBREKENDE ONDERDELEN: voorraadmodel, onderdelenregistratie, (eventuele) commerce-koppeling — scope onbekend → MASTERPLAN_SOURCE_REQUIRED.
AFHANKELIJKHEDEN: garage/materiaal.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: MASTERPLAN_SOURCE_REQUIRED. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: besluit vereist.
EERSTVOLGENDE KLEINE BOUWSTAP: geen — eerst besluit.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Strava
STATUS: BUILT_STABLE
BEWIJS: `lib/connectors/providers/strava.ts` (OAuth per gebruiker, webhooks, backfill); secrets STRAVA_CLIENT_ID/SECRET aanwezig; ingest via Data Hub; tests `test:onboarding-strava-gapfill` (groen).
BESTAANDE WERKENDE ONDERDELEN: OAuth, webhook-first sync, historische gap-fill, rit-delen als handmatige activiteit.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: Strava API-limieten. DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag (activiteit-consent AND).
COMMERCIËLE WAARDE: randvoorwaarde adoptie. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: ANT+
STATUS: NOT_BUILT
BEWIJS: repo-brede zoektocht op ANT+/antplus levert geen implementatie (enige treffer is tekst in `ai-memory.ts`, geen sensorcode). Mobiele sensoren lopen uitsluitend via Bluetooth (`sparki-mobile/lib/ble-sensors.ts`).
BESTAANDE WERKENDE ONDERDELEN: geen.
DEFECTEN: n.v.t.
ONTBREKENDE ONDERDELEN: alles; ANT+ vereist native modules buiten Expo Go en is op iOS zonder extra hardware niet beschikbaar.
AFHANKELIJKHEDEN: native build-straat mobiel.
DATA-TRUST/PRIVACY: laag.
COMMERCIËLE WAARDE: MASTERPLAN_SOURCE_REQUIRED. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: besluit vereist (BLE dekt de meeste moderne sensoren al).
EERSTVOLGENDE KLEINE BOUWSTAP: geen — eerst besluit.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Bluetooth (BLE-sensoren)
STATUS: BUILT_STABLE
BEWIJS: `sparki-mobile/lib/ble-sensors.ts` (guarded require, Expo Go eerlijk-niet-ondersteund), 1s-sampler → GPX met power/cadans; CPS-crankcadans; tests ride-tracker (groen).
BESTAANDE WERKENDE ONDERDELEN: hartslag/power/cadans-koppeling, sensordata in ritbestand.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geen kern (dev-build vereist voor BLE — platformbeperking, eerlijk gemeld).
AFHANKELIJKHEDEN: native dev-build. DATA-TRUST/PRIVACY: laag.
COMMERCIËLE WAARDE: hoog mobiel. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Overige integraties (Garmin/Wahoo, weer, Overpass, Mapbox, ORS, Resend)
STATUS: PARTIALLY_BUILT
BEWIJS: `lib/connectors/providers/device-sync.ts` (Garmin/Wahoo voorbereid, eerlijk configured:false zonder fabrikantsleutels; webhooks fail-closed); Open-Meteo (weer), Overpass (POI's/wegtypen), Mapbox (kaarten), ORS (routing), Resend (e-mail) werken.
BESTAANDE WERKENDE ONDERDELEN: alles behalve daadwerkelijke Garmin/Wahoo-koppeling.
DEFECTEN: geen bekende.
ONTBREKENDE ONDERDELEN: Garmin/Wahoo API-sleutels (externe aanvraag bij fabrikant — buiten repo).
AFHANKELIJKHEDEN: externe partijen.
DATA-TRUST-RISICO: laag (fail-closed). PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: hoog (device-sync = adoptiedrempel). CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO (koppeling activeren zodra sleutels er zijn)
EERSTVOLGENDE KLEINE BOUWSTAP: fabrikantsleutels aanvragen (actie René, extern).
ACCEPTATIECRITERIA: echte activiteit van device verschijnt via webhook in Data Hub.

---

MODULE: Abonnementen, varianten, add-ons en entitlements
STATUS: NOT_BUILT
BEWIJS: geen betaal-/abonnementscode in de repo (geen Stripe/RevenueCat/Whop-referenties in artifacts of lib); `lib/feature-flags/src/index.ts:10` bevat alléén een gereserveerde `premium`-flag ("reserved for future paid features") die nergens functioneel gebruikt wordt. Wél bestaat een volledig rechtenfundament: feature-flags met resolutievolgorde override > rol > releasegroep > globaal + rollout-percentage (`lib/db/src/schema/feature-flags.ts`), releasegroepen intern/test/pilot/productie (`users.ts`), kill-switches en rollout-guards (`release.ts`).
BESTAANDE WERKENDE ONDERDELEN: het volledige flag/releasegroep/rollen-systeem als herbruikbaar entitlement-fundament.
DEFECTEN: n.v.t.
ONTBREKENDE ONDERDELEN: productvarianten (Go/Basic/Performance/Pro), variant→feature-mapping, upgrades/downgrades, proefperioden, losse aankopen, tijdelijke contentpakketten, route-/GPX-aankopen, betaalprovider.
AFHANKELIJKHEDEN: HERBRUIK VERPLICHT — (1) Clerk-identiteit, (2) `user_profiles` voor de variantkolom, (3) feature-flag-resolutie als afdwingingslaag (variant wordt een extra bron in de bestaande precedentie, GEEN parallel systeem), (4) admin-flagbeheer als beheer-UI-basis. Betaalprovider is een later, apart besluit. Géén aparte codebases per variant.
DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: middel (jeugd + betalingen → ouderrol betrekken; besluit vereist).
COMMERCIËLE WAARDE: zeer hoog (voorwaarde voor omzet).
CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO: MASTERPLAN_SOURCE_REQUIRED (welke features per variant is een plan-besluit)
SPARKI BASIC: MASTERPLAN_SOURCE_REQUIRED
SPARKI PERFORMANCE: MASTERPLAN_SOURCE_REQUIRED
SPARKI PRO: MASTERPLAN_SOURCE_REQUIRED
STANDAARD OF ADD-ON: MASTERPLAN_SOURCE_REQUIRED
GO/NO-GO: GO voor de neutrale fundamentstap (variantveld + entitlement-resolutie zonder betalingen en zonder feature-toewijzing); feature-per-variant wacht op Master Plan.
EERSTVOLGENDE KLEINE BOUWSTAP: zie `docs/NEXT_REPLIT_ASSIGNMENT.md` — centrale entitlement-laag op het bestaande flag-systeem, zonder betaalprovider en zonder zelfbedachte variantinhoud.
ACCEPTATIECRITERIA: zie NEXT_REPLIT_ASSIGNMENT.md.

---

MODULE: Admin, monitoring en productiecontrole
STATUS: BUILT_STABLE
BEWIJS: health-check-engine `lib/health/engine.ts` + `health_check_results` (green/orange/red/grey, release-gate CLI); Test Dashboard 2.0 op `tester_events`-telemetrie; error_groups met fingerprint + auto-rollback via rollout_guards; admin-pagina's (/admin, /invitations); tests scheduled-tasks (groen).
BESTAANDE WERKENDE ONDERDELEN: echte probes of grijs (nooit nep-groen), releasegroepen-uitrol, kill-switches, testertelemetrie.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: SPARKI_ADMIN_IDS in prod. DATA-TRUST-RISICO: laag. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: operationele randvoorwaarde. CONCURRENTIEBELANG: n.v.t.
SPARKI GO/BASIC/PERFORMANCE/PRO + STANDAARD OF ADD-ON: n.v.t. (intern)
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Data Trust en cleanup
STATUS: BUILT_STABLE
BEWIJS: `lib/db/src/schema/privacy.ts` + `security.ts` (append-only security_audit_log, consent fail-closed, delete_requested_at met 14-dagenvenster + uitzonderingenregister); schema-gedreven export met tokenmasking; provenance-endpoint met constante tabel-allowlist; tests `test:privacy-security`, `test:data-trust` (aanwezig).
BESTAANDE WERKENDE ONDERDELEN: export, verwijderpad, consentlagen, audits, bronnenregister.
DEFECTEN: geen bekende. ONTBREKENDE ONDERDELEN: geen kern.
AFHANKELIJKHEDEN: —. DATA-TRUST-RISICO: dit ís de mitigatie. PRIVACY/RECHTEN-RISICO: laag.
COMMERCIËLE WAARDE: vertrouwensfundament. CONCURRENTIEBELANG: MARKET_RESEARCH_REQUIRED
SPARKI GO/BASIC/PERFORMANCE/PRO: n.v.t. (altijd inbegrepen — wettelijk)
STANDAARD OF ADD-ON: standaard (wettelijk verplicht deel)
GO/NO-GO: GO
EERSTVOLGENDE KLEINE BOUWSTAP: geen.
ACCEPTATIECRITERIA: n.v.t.

---

MODULE: Multisport
STATUS: LATER_OUT_OF_SCOPE
BEWIJS: sportenregister bestaat als SSOT met `isSportActive`-gating op entrypoints (gefaseerd voorbereid), maar per opdracht buiten scope.
Overige velden: n.v.t. per opdracht.
