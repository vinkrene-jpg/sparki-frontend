# SPARKI MASTER BLUEPRINT

**Datum:** 22 juni 2026
**Doel:** De geconsolideerde doelarchitectuur voor Sparki — de samensmelting van **Sparki Insights** (inhoudelijk leidend) met de **nieuwe Sparki Frontend** (presentatie- en UX-laag) en de **intelligentielaag** (day-type engine).

> Dit is het richtinggevende document. `SPARKI_MIGRATION_AUDIT.md` beschrijft de huidige stand en gaten; dit document beschrijft het eindbeeld waar de migratie naartoe werkt.

---

## 0. Grondregels
1. **Insights is inhoudelijk leidend.** Geen enkele functionaliteit uit Insights mag verdwijnen.
2. **De nieuwe frontend is de presentatie/UX-laag.** Dark, premium, cinematic; cyan accent `oklch(0.82 0.16 200)`; glass cards ~82%; Inter Variable.
3. **Mock-data wordt echt datamodel.** Alles uit `lib/sparki-data.ts` krijgt een live bron (DB + API) of een expliciete, eerlijke placeholder — nooit verzonnen "live" data.
4. **Coach-first.** Sparki ondersteunt de coach, vervangt deze nooit.
5. **Briefing, geen dashboard.** Elke homepage beantwoordt: *Wat is vandaag? Waarom? Wat wil mijn coach? Wat ziet Sparki? Wat is het volgende?* — met max. 1 primaire actie, max. 3 observaties, max. 3 aanbevelingen.
6. **Integratie-klaar.** Ontworpen voor TrainingPeaks, Garmin, Strava, Komoot en een coach-portal.
7. **Leer de atleet (adaptief).** De homepage past zich aan op profiel/niveau: beginner krijgt uitleg, ervaren rijder beknopte info, elite performance-metrics, junior meer begeleiding, recreant meer motivatie. De homepage wordt slimmer over tijd.
8. **Lange-termijnvisie.** Sparki wordt het dagelijkse operating system van de atleet (training, herstel, voeding, slaap, materiaal, reizen, race-prep, competitie, seizoensplanning, teamcommunicatie, routes, analyse). Elke nieuwe feature versterkt dit, en wordt geen geïsoleerde module.

---

## 1. Architectuur

| Laag | Verantwoordelijkheid | Locatie |
|---|---|---|
| Frontend (UX) | React + Vite, schermen, cinematic design | `artifacts/sparki/` |
| API | Express + Clerk + Drizzle, businesslogica | `artifacts/api-server/` |
| Data | PostgreSQL + Drizzle schema | `lib/db/src/schema/` |
| Auth | Replit-managed Clerk (cookie-based) | App.tsx + auth-routes |
| Intelligentie | Day-type engine + AI-brief/Ask Sparki | frontend lib + `ai.ts` |
| Integraties | TrainingPeaks/Garmin/Strava/Komoot/Coach | toekomstig, integratie-klaar |

---

## 2. Rollen
- **Atleet** (default) — volledige training-, race- en analyse-ervaring.
- **Coach** — atleten beheren, plannen, feedback geven, observeren (portal/dashboard).
- **Ouder** — read-only inzicht in voortgang en welzijn.

Rollen staan in de eigen DB (`user_profiles.roles[]`, `active_role`) — niet in Clerk-metadata. Rolswitch via de `ScreenShell`-header.

---

## 3. De vijf kernschermen (doelbeeld = Insights-inhoud + nieuwe UX)

### 3.1 Home `/` — Training Day (briefing)
Day-type-bewuste briefing met:
- Readiness-reactor (`sparki-core`) + vitals-grid (HRV, slaap, fatigue, form, RHR, 7d-load).
- Systeembalans-radar (`bio-radar`).
- Dagtype-kop: *wat is vandaag & waarom* + 1 primaire actie.
- Max. 3 observaties (wat Sparki ziet) + max. 3 aanbevelingen (coach-first).
- Intervalblok-preview van de dagtraining.

### 3.2 Train `/train` — Workout-uitvoering
- Doelzones (Z1–Z6, live op FTP) + expliciet **target-blok** (power/HR/cadans/zone).
- **Intervalblok-visualisatie** (render workout-structuur).
- **Routeplanner**: elevatieprofiel, climbs (lengte/grade), turn-by-turn navigatie.
- **Fueling/voedingsstrategie** (tijdlijn vóór/tijdens/na).
- **Prep-checklist** (bandenspanning, vermogensmeter, Di2, weer, bidons).
- Sessie-logging + workout-status (planned/modified/completed/skipped).
- Compliance na afloop (IF, % uitvoering, plan vs. werkelijk).

### 3.3 Feed `/feed` — Biometric & sociale feed
- Filterbare stream: coach, team, club, race, AI, video, comment.
- **Echte data** (posts/comments-tabel) i.p.v. statisch.
- **Ask Sparki** interactieve AI (behouden, verbeterd t.o.v. Insights).

### 3.4 Lab `/lab` — Analytics & observatie
- Bio-radar (6 assen).
- **Power/duration-curve** (huidig vs. seizoenspiek).
- FTP-historie + readiness-trend (14d) + HRV-trend.
- Seizoensmodel CTL/ATL/TSB (fitness/fatigue/form).
- FTP-voorspelling (trendmodel).

### 3.5 You `/you` — Profiel & instellingen
- Identiteit (FTP, W/kg, discipline) + dagelijkse check-in.
- **Gestructureerde doelen** (datum + progressie).
- **Materiaal** (fietsen/sensoren) + **gekoppelde apps** (Garmin/Strava/Wahoo/Komoot/TrainingPeaks).
- Privacy + voorkeuren (NL/metrisch).

---

## 4. Intelligentielaag — Day-type engine
Beslissingshiërarchie (hoog → laag), elke dag exact één type, met eigen briefing:
1. **Emergency / Health** (ziek/blessure)
2. **Race Day**
3. **Dag vóór Race**
4. **Race Week**
5. **Coach Training** (externe coach-plan)
6. **Sparki Training** (door Sparki gegenereerd)
7. **Recovery**
8. **Rest**
9. **General / geen training**

Engine = detectie (op basis van workout-bron, metrics, load/TSB, gezondheidsstatus, race-agenda) + registry die `DayType → homepage-component` mapt. *(Geïmplementeerd in Fase 4; taken #3/#4 leveren dit.)*

---

## 5. Doel-datamodel (uitbreidingen op huidige schema)
Bestaand: `users`, `athlete_profiles`, `athlete_metrics`, `athlete_training` (planned_workouts + sessions + ftp_history), `feature_flags`, `conversations`/`messages`.

Toe te voegen (per fase):
- **Workout-bron** op `planned_workouts` (`source`: sparki | coach) — voor day-type detectie.
- **Gezondheidsstatus** op `athlete_profiles` (ok | sick | injured) — voor emergency-detectie.
- **Routes** (naam, afstand, elevatieprofiel, climbs, nav-stappen).
- **Fueling** (per workout: tijdlijn-items).
- **Prep-checklist** (per workout/dag).
- **Power-curve** (mean-maximal uit sessies + seizoenspiek).
- **Goals** (gestructureerd: naam, datum, progressie).
- **Equipment + integrations** (materiaal, gekoppelde apps + sync-status).
- **Feed posts/comments** (auteur, type, body, meta).
- **Races/events** (datum, categorie, prioriteit, inschrijving).
- **Group rides / meeting points** (locatie, tijd, deelnemers, carpool).

---

## 6. Integratie-roadmap
- **TrainingPeaks / coach-plannen** → vult `planned_workouts` (source=coach).
- **Garmin / Strava** → vult `sessions`, `metrics`, power-curve.
- **Komoot / Strava routes** → vult routes + elevatie + nav.
- **Coach-portal** → coach maakt/past plannen aan, geeft feedback (feed).

Alles via integraties (Replit integration-systeem), nooit verzonnen live data.

---

## 7. Migratievolgorde (samenvatting)
Zie `SPARKI_MIGRATION_AUDIT.md §6` voor detail:
- **Fase 1** — kritische basis: power-curve, intervalvisualisatie, target-blok, gestructureerde doelen.
- **Fase 2** — training-experience: fueling, prep-checklist, compliance, in-workout coaching.
- **Fase 3** — routeplanner, groepsritten, verzamelpunten.
- **Fase 4** — race day/week + day-type engine (taken #3/#4).
- **Fase 5** — coach/ouder/social/lab compleet.

---

## 8. Wat behouden blijft (nieuw t.o.v. Insights, niet weggooien)
Auth (Clerk), multi-rol, JIT-provisioning, onboarding-flow, cinematic-achtergrond, feature-flags, live AI-brief + Ask Sparki, echte sessie-logging/metrics-check-in, server-side PMC.

---

*Bron-van-waarheid voor inhoud: Sparki Insights (`.migration-backup/`). Bron-van-waarheid voor presentatie/UX: nieuwe frontend (`artifacts/sparki/`). Dit blueprint verenigt beide.*
