# SPARKI MASTER BLUEPRINT

**Datum:** 22 juni 2026
**Status:** Compleet — dit is de volledige doelarchitectuur. Bevat *alle* functionaliteit uit Sparki Insights plus de lange-termijnvisie. **Nog geen implementatievolgorde** — die wordt pas ná goedkeuring van dit blueprint bepaald (zie §10).
**Doel:** De geconsolideerde doelarchitectuur voor Sparki — de samensmelting van **Sparki Insights** (inhoudelijk leidend) met de **nieuwe Sparki Frontend** (presentatie- en UX-laag) en de **intelligentielaag** (day-type engine + adaptieve homepage).

> Dit is het richtinggevende document. `SPARKI_MIGRATION_AUDIT.md` beschrijft de huidige stand en de gaten; dit document beschrijft het volledige eindbeeld waar de migratie naartoe werkt.

---

## 0. Grondregels

1. **Insights is inhoudelijk leidend.** Geen enkele functionaliteit uit Insights mag verdwijnen. Elk datapunt uit `.migration-backup/lib/sparki-data.ts` krijgt een plek in dit blueprint (zie §6 catalogus + §9 dekkingsmatrix).
2. **De nieuwe frontend is de presentatie/UX-laag.** Dark, premium, cinematic; cyan accent `oklch(0.82 0.16 200)`; glass cards ~82%; Inter Variable. Niets wordt heromtworpen naar flat-black, witte vlakken of generieke dashboards.
3. **Mock-data wordt echt datamodel.** Alles uit `lib/sparki-data.ts` krijgt een live bron (DB + API) of een expliciete, eerlijke placeholder — **nooit verzonnen "live" data** (geen verzonnen weer, verkeer, GPS).
4. **Coach-first.** Sparki ondersteunt de coach, vervangt hem nooit. Een coach-plan heeft altijd voorrang op een door Sparki gegenereerd plan.
5. **Briefing, geen dashboard.** Elke homepage beantwoordt: *Wat is vandaag? Waarom? Wat wil mijn coach? Wat ziet Sparki? Wat is het volgende?* — met max. **1 primaire actie**, max. **3 observaties**, max. **3 aanbevelingen**.
6. **Integratie-klaar.** Ontworpen voor TrainingPeaks, Garmin, Strava, Komoot, Wahoo en een coach-portal — alles via het Replit-integratiesysteem.
7. **Leer de atleet (adaptief).** De homepage past zich aan op profiel/niveau: beginner krijgt uitleg, ervaren rijder beknopte info, elite performance-metrics, junior meer begeleiding, recreant meer motivatie. Wordt slimmer over tijd.
8. **Lange-termijnvisie.** Sparki wordt het dagelijkse operating system van de atleet: training, herstel, voeding, slaap, materiaal, routes, reizen, race-prep, competitie, seizoensplanning, teamcommunicatie en analyse. Elke nieuwe feature versterkt dit geheel en wordt geen geïsoleerde module.

---

## 1. Architectuur

| Laag | Verantwoordelijkheid | Locatie |
|---|---|---|
| Frontend (UX) | React + Vite, schermen, cinematic design | `artifacts/sparki/` |
| API | Express + Clerk + Drizzle, businesslogica | `artifacts/api-server/` |
| Data | PostgreSQL + Drizzle schema | `lib/db/src/schema/` |
| Auth | Replit-managed Clerk (cookie-based) | `App.tsx` + auth-routes |
| Intelligentie | Day-type engine + adaptieve homepage + AI-brief/Ask Sparki | frontend lib + `ai.ts` |
| Integraties | TrainingPeaks/Garmin/Strava/Komoot/Wahoo/Coach | toekomstig, integratie-klaar |

**Filosofieverschil dat de migratie overbrugt:** Insights draait volledig op één mock-databron (`lib/sparki-data.ts`), zonder auth/backend/DB. De nieuwe frontend is een echte full-stack app. Migreren = niet alleen "scherm overzetten" maar "mock-data omzetten naar een echt datamodel met live bron of eerlijke placeholder".

---

## 2. Rollen

- **Atleet** (default) — volledige training-, race- en analyse-ervaring.
- **Coach** — atleten beheren, plannen, feedback geven, observeren (portal/dashboard).
- **Ouder** — read-only inzicht in voortgang en welzijn.

Rollen staan in de eigen DB (`user_profiles.roles[]`, `active_role`) — niet in Clerk-metadata. Rolswitch via de `ScreenShell`-header.

---

## 3. De vijf kernschermen (doelbeeld = Insights-inhoud + nieuwe UX)

Insights heeft exact vijf schermen; die blijven de ruggengraat. De features in §6 hangen onder deze schermen (of onder de intelligentielaag).

| Scherm | Insights-bron | Doelbeeld |
|---|---|---|
| **Home `/`** | `app/page.tsx` → `training-day-home.tsx` | Day-type-bewuste briefing: readiness-reactor, vitals, systeembalans-radar, dagtype-kop, observaties (≤3), aanbevelingen (≤3), intervalblok-preview. |
| **Train `/train`** | `app/train/page.tsx` | Uitvoering: intervalvisualisatie, doelzones + target-blok, smart route planner, fueling, prep-checklist, in-workout AI-coaching, compliance. |
| **Feed `/feed`** | `app/feed/page.tsx` | Filterbare stream (coach/team/club/race/ai/video/comment) op **echte data** + Ask Sparki. |
| **Lab `/lab`** | `app/lab/page.tsx` | Analyse: bio-radar, readiness-trend, HRV-trend, power curve, FTP-ontwikkeling, recovery & form, season progress, AI-analyse. |
| **You `/you`** | `app/you/page.tsx` | Identiteit, gestructureerde doelen, materiaal, voeding, gekoppelde apps, gezondheid, privacy, voorkeuren. |

---

## 4. Intelligentielaag — Day-type engine & adaptieve homepage

**Beslissingshiërarchie (hoog → laag), elke dag exact één type, elk met eigen briefing:**

1. **Emergency / Health** (ziek/blessure) — herstel/medisch eerst, training geblokkeerd.
2. **Race Day** — wedstrijddag-modus.
3. **Dag vóór Race** — taperen, prep, reizen, materiaalcheck.
4. **Race Week** — aftellen, vormpiek bewaken, belasting afbouwen.
5. **Coach Training** (extern coach-plan) — coach-plan leidend.
6. **Sparki Training** (door Sparki gegenereerd) — alleen als er geen coach-plan is; dekt de inspannende/normale sessies.
7. **Recovery** — actief herstel. Een herstel-workout die niet door de coach is gepland valt hieronder (SparkiTraining dekt de inspannende sessies).
8. **Rest** — volledige rust.
9. **General / geen training** — algemene briefing/fallback.

**Engine** = *detectie* (op basis van workout-bron, metrics, load/TSB, gezondheidsstatus, race-agenda) + een *registry* die `DayType → homepage-component` mapt. Elke dagtype-homepage is een onafhankelijk component met getypeerde dataproviders.

**Adaptieve homepage** = bovenop het dagtype past de briefing zich aan op **atleetniveau** (beginner/ervaren/elite/junior/recreant): hoeveelheid uitleg, toon, welke metrics prominent zijn, en hoeveel begeleiding. De engine leert over tijd (welke aanbevelingen worden opgevolgd, welke observaties resoneren).

---

## 5. Sparki AI — observaties & coaching (Insights `aiSignals` → live)

Insights levert vier AI-observatietypen (`aiSignals`), plus executie-coaching en analyse. Die blijven, omgezet naar de live AI-laag:

- **Opportunity** — "systeem geprimed voor threshold-doorbraak" (kans).
- **Risk** — "hydratatie-schuld gedetecteerd" (waarschuwing).
- **Performance** — "verwacht 20-min vermogen 364–372W" (voorspelling).
- **Recovery** — "volledig hersteld, groen om te pushen" (statusduiding).
- **Executie-coaching** (Train) — pacing/cadans/ademhaling-advies vóór en tijdens de rit ("negatieve split, cadans ~92 rpm, stoppen i.p.v. forceren").
- **AI-analyse** (Lab) — duiding van trends + FTP-voorspelling (~10 dagen, bijv. "rond 350W").

In de nieuwe app wordt dit geleverd door de live AI-brief (`POST /ai/brief`) en interactieve **Ask Sparki** (`POST /ai/ask`) — een verbetering t.o.v. de statische Insights-tekst, met behoud van de vier observatiecategorieën. Max. 3 observaties op de homepage (grondregel 5).

---

## 6. Functionele catalogus — ALLE Insights-functionaliteit + visie

Elke feature uit de gevraagde lijst, met: **Bron** (waar het in Insights zit), **Doelgedrag** (Insights-inhoud in de nieuwe UX), **Data** (datamodel), **Migratie** (behouden / uitbreiden / nieuw — niets gaat verloren).

### A. Training & uitvoering

**A1 · Training Experience** *(Train `/train`)*
- **Bron:** `app/train/page.tsx` (de sessie, doelzones, route, voeding, voorbereiding, AI-coach) + `intervals`, `zones`, `target` in `sparki-data.ts`.
- **Doelgedrag:** Volledige uitvoeringservaring per dagtraining: kop (titel/duur/TSS/IF), intervalvisualisatie, doelzones + target, route, fueling, prep, in-workout coaching, en na afloop compliance.
- **Data:** `planned_workouts` (titel, duur, TSS, `structure` jsonb), gekoppeld aan `training_sessions` voor uitvoering.
- **Migratie:** Deels aanwezig (zones + logging). Uitbreiden met de onderstaande deelfeatures (A2–A8).

**A2 · Intervalblok-visualisatie**
- **Bron:** `intervals.blocks` (WU/T1/R/T2/.../CD met zone `z` en genormaliseerde intensiteit `w`), gerenderd als staafprofiel in Train §01.
- **Doelgedrag:** Render de workout-structuur als intervalprofiel op Home (preview) en Train (volledig), met zonekleur en accent op de sleutelzone.
- **Data:** `planned_workouts.structure` (jsonb) — al opgeslagen, nog niet gevisualiseerd.
- **Migratie:** Uitbreiden (UI bouwen op bestaande data).

**A3 · Doelzones + expliciet target-blok**
- **Bron:** `zones` (Z1–Z5 met power/HR/kleur) + `target` (power 324–342W, HR 162–171, cadans 90–95, zone 4).
- **Doelgedrag:** Live op FTP berekende zones (`computeZones()`) + een expliciet target-blok (power/HR/cadans/zone) voor de sleutelinspanning.
- **Data:** Zones afgeleid uit `athlete_profiles.ftp`; target afgeleid uit workout + zones.
- **Migratie:** Zones aanwezig; target-blok toevoegen.

**A4 · Fueling Strategy (voeding & hydratie)**
- **Bron:** `fueling[]` — tijdlijn (−15 min, T1, R2, T3, CD) met type (drink/fuel) en tekst (gels, elektrolyten, koolhydraten).
- **Doelgedrag:** Voedingstijdlijn vóór/tijdens/na de rit, gekoppeld aan de intervalstructuur; later koolhydraat-strategie per intensiteit/duur.
- **Data:** Nieuwe `workout_fueling` (per workout: t-offset, kind, tekst, gram koolhydraten).
- **Migratie:** Nieuw datamodel; UI bestaat als referentie in Insights.

**A5 · Prep-checklist**
- **Bron:** `prep[]` — bandenspanning, vermogensmeter (gekalibreerd), Di2-accu, weer, bidons (met done-status).
- **Doelgedrag:** Afvinkbare voorbereidingschecklist vóór de rit; materiaal- en sensorstatus, weer, bidons.
- **Data:** Nieuwe `workout_prep` (per workout/dag: label, waarde, done) — deels gevoed door materiaal (A7) en weer (C5).
- **Migratie:** Nieuw datamodel.

**A6 · In-workout executie-coaching**
- **Bron:** Train §06 "AI Coach uitvoering" — pacing/cadans/ademhaling, negatieve split, "stoppen i.p.v. forceren".
- **Doelgedrag:** Concreet uitvoeringsadvies vóór en tijdens de sessie via de AI-laag (zie §5).
- **Data:** Gegenereerd door `POST /ai/brief` / `/ai/ask` op basis van workout + readiness.
- **Migratie:** Uitbreiden (live AI i.p.v. statische tekst).

**A7 · Equipment Advisor & Materiaalbeheer**
- **Bron:** `youGroups` "Setup → Materiaal: 2 fietsen · 4 sensoren" + prep-items (bandenspanning, Di2, vermogensmeter).
- **Doelgedrag:** Beheer van fietsen + sensoren; advies (bandenspanning naar weer/ondergrond, kalibratie-herinnering, accu-waarschuwingen). Voedt de prep-checklist (A5).
- **Data:** Nieuwe `equipment` (type, naam, sensoren, accu, laatste kalibratie) + advieslogica.
- **Migratie:** Materiaalbeheer = uitbreiden (rij bestaat in You); Advisor = nieuw.

**A8 · Compliance / uitvoering (plan vs. werkelijk)**
- **Bron:** Train-kop "IF 0.91", `intervals.tss`, "98% uitvoering"-filosofie.
- **Doelgedrag:** Na afloop: IF, % uitvoering, plan-vs.-werkelijk vergelijking; voedt de readiness/AI-analyse.
- **Data:** Vergelijking `planned_workouts` ↔ `training_sessions` (NP, IF, TSS, duur).
- **Migratie:** Uitbreiden (sessie-logging bestaat).

### B. Routes & groep

**B1 · Smart Route Planner**
- **Bron:** `route` — naam, afstand, elevatie, ondergrond, status, genormaliseerd `profile[]`, `climbs[]` (lengte/grade), `nav[]` (turn-by-turn).
- **Doelgedrag:** Routekeuze met elevatieprofiel, climb-directory en turn-by-turn navigatie; "smart" = afgestemd op dagtype/doelzones (bv. threshold-dag → route met passende klim). **Geen verzonnen GPS** — route komt uit een opgeslagen route of import (Komoot/Strava).
- **Data:** Nieuwe `routes` (naam, afstand, elevatie, ondergrond, profiel, climbs, nav-stappen) + koppeling aan workout.
- **Migratie:** Nieuw datamodel; volledige UI bestaat als referentie in Insights.

**B2 · Coach Route**
- **Bron:** Coach-context (feed `coach`-items "plan aangepast") + coach-rol.
- **Doelgedrag:** Coach wijst een route toe aan een geplande training; verschijnt bij de atleet met coach-attributie.
- **Data:** `routes` + `planned_workouts.source = coach` + coach-koppeling.
- **Migratie:** Nieuw (bovenop B1 + coach-portal F2).

**B3 · Group Ride Planner**
- **Bron:** Feed `club`-item "Clubrit zondag 09:00, verzamelen bij clubhuis" + `team`-item.
- **Doelgedrag:** Groepsritten als echte feature: tijd, route, deelnemers, RSVP — niet enkel een feed-melding.
- **Data:** Nieuwe `group_rides` (route, tijd, organisator, deelnemers) + `ride_participants`.
- **Migratie:** Uitbreiden van feed-content naar echte entiteit.

**B4 · Meeting Point Optimizer**
- **Bron:** Feed "verzamelen bij het clubhuis" (verzamelpunt-concept).
- **Doelgedrag:** Optimaal verzamelpunt + carpool voor een groepsrit op basis van deelnemerslocaties. **Geen verzonnen reistijd** — vereist echte locatie-input of integratie.
- **Data:** Op `group_rides`: verzamelpunt, carpool-opties, deelnemerslocaties (opt-in).
- **Migratie:** Nieuw (visie; bouwen ná locatiebron beschikbaar is).

**B5 · Shared Routes**
- **Bron:** Routebibliotheek-concept (Insights toont één route; visie = delen).
- **Doelgedrag:** Routes delen binnen team/club; bibliotheek van opgeslagen/gedeelde routes.
- **Data:** `routes` met eigenaar + zichtbaarheid (privé/team/club/publiek).
- **Migratie:** Nieuw (bovenop B1).

**B6 · Export naar Garmin / Komoot / Wahoo / GPX**
- **Bron:** `youGroups` "Gekoppelde apps: Garmin · Strava · Wahoo".
- **Doelgedrag:** Workout/route exporteren naar fietscomputer of als GPX/FIT; tweerichtings-sync waar mogelijk.
- **Data:** Export-adapter op `routes` + `planned_workouts`; integraties (zie §8).
- **Migratie:** Nieuw; gekoppelde-apps-rij bestaat in You als startpunt.

### C. Race & competitie

**C1 · Race Week** *(day-type 4)*
- **Bron:** Feed `race`-item (KNWU-inschrijving, "sluiting over 9 dagen") + goal "Amstel Gold Race · 12 apr".
- **Doelgedrag:** Aftel-modus de week vóór een doelwedstrijd: belasting afbouwen, vormpiek bewaken, prep/reis plannen.
- **Data:** Nieuwe `races`/`events` (datum, categorie, prioriteit, inschrijfstatus) → voedt day-type-detectie.
- **Migratie:** Nieuw datamodel; bestaat in Insights enkel als feed-item + goal.

**C2 · Day Before Race** *(day-type 3)*
- **Bron:** Race-context + prep-checklist.
- **Doelgedrag:** Taper, openingsrit, materiaal-/reischeck, voeding voor de avond, vroege nacht.
- **Data:** `races` + prep + reis-items.
- **Migratie:** Nieuw (day-type homepage).

**C3 · Race Day** *(day-type 2)*
- **Bron:** Race-context (hoogste niet-medische prioriteit).
- **Doelgedrag:** Wedstrijddag-briefing: starttijd, weer, warming-up, voeding, doelstrategie, parcours-highlights.
- **Data:** `races` + route (parcours) + fueling.
- **Migratie:** Nieuw (day-type homepage).

**C4 · Race Day Planner**
- **Bron:** Race-context + prep + fueling + route.
- **Doelgedrag:** Gedetailleerd dagplan rond de wedstrijd: aankomst, inschrijven, warming-up, startblok, recovery na afloop.
- **Data:** `races` met tijdlijn-items.
- **Migratie:** Nieuw (bovenop C3).

**C5 · Team Meeting Planner**
- **Bron:** Feed `team`-item "Selectie Amstel Gold bekend / voorselectie".
- **Doelgedrag:** Teambijeenkomsten/briefings plannen rond races: selectie, taken, tijd/plaats, RSVP.
- **Data:** Nieuwe `team_meetings` (event, tijd, plaats, deelnemers, agenda).
- **Migratie:** Nieuw; bestaat als feed-item.

**C6 · Season Planning**
- **Bron:** `season` (CTL/ATL/TSB per week), `ftpHistory` (Sep–Mrt), `goals[]` met datum (12 apr / Q2 / Dec).
- **Doelgedrag:** Seizoensoverzicht: periodisering (CTL/ATL/TSB), doelwedstrijden op de tijdlijn, FTP-ontwikkeling, vormpieken richten op A-races.
- **Data:** `races` + `ftp_history` + afgeleide PMC + gestructureerde `goals`.
- **Migratie:** Analyse bestaat (Lab); planning-koppeling met races = uitbreiden.

### D. Analyse — Lab

**D1 · Lab (scherm)** *(`/lab`)*
- **Bron:** `app/lab/page.tsx` — radar, readiness-history, HRV-trend, power curve, FTP-development, recovery & form, season progress, AI-analyse.
- **Doelgedrag:** Het volledige analysescherm; container voor D2–D6.
- **Data:** Metrics + sessies + ftp + afgeleide PMC.
- **Migratie:** Deels aanwezig; aanvullen met power curve (D2).

**D2 · Power Curve**
- **Bron:** `powerCurve` — mean-maximal vermogen over duren (5s, 15s, 1m, 5m, 8m, 20m, 60m), `watts` (vandaag) vs `peak` (seizoen), gerenderd in Lab §04.
- **Doelgedrag:** Power/duration-curve: huidig vermogen per duur vs. seizoenspiek, met duiding ("20-min nadert beste waarde").
- **Data:** Nieuwe `power_curve` afgeleid uit sessies (mean-maximal) + seizoenspiek-cache.
- **Migratie:** Volledig ontbrekend in de nieuwe app → terugbrengen (datamodel + UI).

**D3 · Recovery & Form**
- **Bron:** Lab §06 (Form TSB, 7d Load, "Herstel: Volledig") + `recoveryTrend` (14d) + vitals `fatigue`/`form`.
- **Doelgedrag:** Herstel- en vormstatus: TSB, load, recovery-trend; voedt de Recovery-dagtype.
- **Data:** `athlete_metrics` + `computeLoad()` (CTL/ATL/TSB).
- **Migratie:** Aanwezig (PMC + metrics); recovery-trendlijn aanvullen.

**D4 · Readiness- & HRV-trend**
- **Bron:** `readinessHistory` (14d) + `vitals.hrv.trend`, Lab §02/§03.
- **Doelgedrag:** Readiness-trend (14d) en HRV vs. baseline met delta.
- **Data:** `athlete_metrics` (hrv, afgeleide readiness).
- **Migratie:** Aanwezig.

**D5 · FTP-ontwikkeling + voorspelling**
- **Bron:** `ftpHistory` (maandwaarden) + AI-analyse "FTP rond 350W binnen 10 dagen".
- **Doelgedrag:** FTP-historie + trendgebaseerde voorspelling.
- **Data:** `ftp_history` + voorspelmodel.
- **Migratie:** Historie aanwezig; voorspelling = uitbreiden.

**D6 · Season Progress (CTL/ATL/TSB)**
- **Bron:** `season` + `SeasonChart` (drie lijnen) in Lab §07.
- **Doelgedrag:** Periodiseringsgrafiek fitness/fatigue/form over het seizoen.
- **Data:** `computeLoad()` server-side.
- **Migratie:** Aanwezig (live PMC). Zie ook C6.

### E. Welzijn & profiel — You

**E1 · You (scherm)** *(`/you`)*
- **Bron:** `app/you/page.tsx` — identiteit (FTP/W·kg/gewicht), doelen, en config-groepen Atleet/Setup/Account.
- **Doelgedrag:** Profielcentrum; container voor E2–E7 + dagelijkse check-in.
- **Data:** `user_profiles` + `athlete_profiles` + `athlete_metrics`.
- **Migratie:** Aanwezig; aanvullen met E2/E5/E6.

**E2 · Goals (gestructureerd)**
- **Bron:** `goals[]` — naam, datum, progressie (Amstel Gold 72%, FTP 350W 84%, 10.000 km 41%).
- **Doelgedrag:** Gestructureerde doelen met datum + progressiebalk, gekoppeld aan races (C1/C6) en FTP (D5).
- **Data:** Nieuwe `goals` (naam, doeldatum, type, doelwaarde, progressie) — vervangt het enkele tekstveld, met backward-compat.
- **Migratie:** Vereenvoudigd naar tekstveld → terug naar gestructureerd (geen verlies).

**E3 · Recovery (welzijn)**
- **Bron:** `vitals` (HRV, slaap, fatigue, RHR) + dagelijkse check-in.
- **Doelgedrag:** Dagelijkse herstelregistratie (feel/sleep/fatigue/HRV/RHR) die readiness en de Recovery-dagtype voedt.
- **Data:** `athlete_metrics` (live).
- **Migratie:** Aanwezig (check-in + metrics).

**E4 · Sleep**
- **Bron:** `vitals.sleep` (uren + kwaliteit, trend).
- **Doelgedrag:** Slaapduur/-kwaliteit als kernsignaal in check-in, readiness en herstel.
- **Data:** `athlete_metrics.sleepHours` + `sleepQuality`.
- **Migratie:** Aanwezig.

**E5 · Nutrition**
- **Bron:** `youGroups` "Setup → Voeding: Koolhydraat-strategie" + fueling (A4).
- **Doelgedrag:** Voedingsprofiel/-strategie (koolhydraat-aanpak), gekoppeld aan fueling per rit en aan racevoeding.
- **Data:** `athlete_profiles` (voedingsvoorkeuren) + `workout_fueling`.
- **Migratie:** Profielrij = uitbreiden; fueling = nieuw (A4).

**E6 · Connected Apps**
- **Bron:** `youGroups` "Gekoppelde apps: Garmin · Strava · Wahoo" (+ Komoot/TrainingPeaks-visie).
- **Doelgedrag:** Koppelingen beheren + sync-status; voedt sessies/metrics/power-curve/routes en export (B6).
- **Data:** Nieuwe `integrations` (provider, status, laatste sync) via Replit-integraties.
- **Migratie:** Uitbreiden (rij bestaat); echte koppeling = nieuw.

**E7 · Account: Gezondheid, Privacy, Voorkeuren**
- **Bron:** `youGroups` "Account → Gezondheid (baseline), Privacy (privé), Voorkeuren (NL · metrisch)".
- **Doelgedrag:** Gezondheidsstatus (ok/ziek/geblesseerd → voedt Emergency-dagtype), privacy-instellingen, taal/eenheden.
- **Data:** `athlete_profiles` (gezondheidsstatus + voorkeuren).
- **Migratie:** Privacy/voorkeuren deels; gezondheidsstatus = uitbreiden (nodig voor day-type 1).

### F. Sociaal, coach & ouder

**F1 · Feed (scherm)** *(`/feed`)*
- **Bron:** `app/feed/page.tsx` + `feed[]` — types coach/team/club/race/ai/video/comment, met auteur/tijd/titel/body/meta en categoriefilters (Alles/Coach/Team/Race/AI).
- **Doelgedrag:** Filterbare stream op **echte data** (geen statische array) + Ask Sparki als interactieve deelnemer.
- **Data:** Nieuwe `feed_posts` (+ `comments`) met type, auteur, body, meta, bron.
- **Migratie:** UI + filters + AI aanwezig; data nog statisch → echte tabel.

**F2 · Coach-ondersteuning (portal)**
- **Bron:** Feed `coach`/`comment`-items (plan aanpassen, post-workout feedback) + coach-rol.
- **Doelgedrag:** Coach-portal: atleten beheren, plannen (`source = coach`), feedback geven, observeren. Coach-plan heeft voorrang (grondregel 4).
- **Data:** Coach↔atleet-koppeling + `planned_workouts.source` + feedback in feed.
- **Migratie:** Rol + nav + filter aanwezig; echt portal = nieuw.

**F3 · Ouder-dashboard**
- **Bron:** Niet in Insights; nieuw concept (rol-skelet aanwezig).
- **Doelgedrag:** Read-only inzicht in voortgang en welzijn van de atleet.
- **Data:** Read-only views op atleetdata met toestemming.
- **Migratie:** Nieuw (scaffolding aanwezig).

---

## 7. Doel-datamodel (uitbreidingen op huidig schema)

**Bestaand:** `users`, `athlete_profiles`, `athlete_metrics`, `athlete_training` (`planned_workouts` + `training_sessions` + `ftp_history`), `feature_flags`, `conversations`/`messages`.

**Toe te voegen (per feature uit §6):**
- `planned_workouts.source` (`sparki` | `coach`) — day-type detectie (A1, B2, F2).
- `athlete_profiles` gezondheidsstatus (`ok` | `sick` | `injured`) — Emergency-dagtype (E7).
- `workout_fueling` — fueling-tijdlijn per workout (A4, E5).
- `workout_prep` — prep-checklist per workout/dag (A5).
- `equipment` — fietsen/sensoren + accu/kalibratie (A7).
- `routes` (+ profiel/climbs/nav, eigenaar, zichtbaarheid) — route planner & shared routes (B1, B5).
- `group_rides` (+ `ride_participants`, verzamelpunt/carpool) — groepsritten (B3, B4).
- `races`/`events` (datum, categorie, prioriteit, inschrijving, tijdlijn) — race-dagtypes & season (C1–C4, C6).
- `team_meetings` — teambijeenkomsten (C5).
- `power_curve` — mean-maximal + seizoenspiek (D2).
- `goals` (gestructureerd: naam, doeldatum, type, doelwaarde, progressie) — (E2).
- `integrations` (provider, status, sync) — connected apps & export (E6, B6).
- `feed_posts` (+ `comments`) — echte feed (F1, F2).

> Alle uitbreidingen via Drizzle (`lib/db`), daarna `db push` + rebuild. Niets vervangt bestaande tabellen — alleen toevoegen.

---

## 8. Integratie-roadmap

| Integratie | Vult | Features |
|---|---|---|
| **TrainingPeaks / coach-plannen** | `planned_workouts` (source=coach) | A1, B2, F2 |
| **Garmin / Strava / Wahoo** | `training_sessions`, `athlete_metrics`, `power_curve` | A8, D2, E6 |
| **Komoot / Strava routes** | `routes` (profiel/elevatie/nav) | B1, B5, B6 |
| **Coach-portal** | coach-plannen + feedback | F2 |

Alles via het Replit-integratiesysteem. **Nooit verzonnen live data** (weer, verkeer, GPS, reistijd) — altijd echte bron of eerlijke placeholder.

---

## 9. Dekkingsmatrix — gevraagde lijst → blueprint

Bewijs dat *alle* gevraagde functionaliteit gedekt is en niets verloren gaat.

| # | Gevraagde feature | Insights-bron | Blueprint | Status |
|---|---|---|---|---|
| 1 | Power Curve | `powerCurve`, Lab §04 | D2 | missing → terug |
| 2 | Training Experience | Train-scherm | A1 | deels → afmaken |
| 3 | Smart Route Planner | `route` | B1 | missing → terug |
| 4 | Coach Route | coach-feed + rol | B2 | nieuw |
| 5 | Group Ride Planner | feed club/team | B3 | uitbreiden |
| 6 | Meeting Point Optimizer | feed "verzamelen" | B4 | nieuw (visie) |
| 7 | Shared Routes | route-concept | B5 | nieuw |
| 8 | Weather Optimizer | `prep` "Weer" | A5 + C-prep | uitbreiden |
| 9 | Fueling Strategy | `fueling[]` | A4 | missing → terug |
| 10 | Equipment Advisor | `youGroups`+`prep` | A7 | uitbreiden/nieuw |
| 11 | Export Garmin/Komoot/Wahoo/GPX | gekoppelde apps | B6 | nieuw |
| 12 | Race Week | race-feed + goal | C1 | nieuw |
| 13 | Day Before Race | race-context | C2 | nieuw |
| 14 | Race Day | race-context | C3 | nieuw |
| 15 | Race Day Planner | race+prep+fueling | C4 | nieuw |
| 16 | Team Meeting Planner | team-feed | C5 | nieuw |
| 17 | Day Type Engine | (intelligentie) | §4 | nieuw |
| 18 | Adaptive Homepage | (intelligentie) | §4 + grondregel 7 | nieuw |
| 19 | Coach ondersteuning | coach-feed + rol | F2 | uitbreiden |
| 20 | Sparki AI observaties | `aiSignals` + AI-coach/analyse | §5 | aanwezig (verbeterd) |
| 21 | Lab | Lab-scherm | D1 | deels → afmaken |
| 22 | Feed | Feed-scherm | F1 | deels → echte data |
| 23 | Connected Apps | gekoppelde apps | E6 | uitbreiden |
| 24 | Materiaalbeheer | `youGroups` materiaal | A7 | uitbreiden |
| 25 | Recovery | `recoveryTrend`+vitals, Lab §06 | D3 + E3 | aanwezig |
| 26 | Nutrition | voeding + fueling | E5 + A4 | uitbreiden |
| 27 | Sleep | `vitals.sleep` | E4 | aanwezig |
| 28 | Goals | `goals[]` | E2 | deels → gestructureerd |
| 29 | Season Planning | `season`+`ftpHistory`+goals | C6 + D6 | uitbreiden |

**Weather Optimizer (8):** weer is in Insights een prep-item ("14° · ZW 12 km/u"). Het wordt in de prep-checklist (A5) en de race-prep (C2/C3) ondergebracht; "optimizer" (route/timing/kleding afstemmen op weer) is visie en vereist een echte weerbron — geen verzonnen data.

---

## 10. Vervolg — implementatievolgorde nog te bepalen

Dit blueprint is nu **inhoudelijk compleet**. De volgende stap (zoals afgesproken) is het samen bepalen van de **implementatievolgorde** op basis van dit complete beeld — niet vóór goedkeuring.

Het gefaseerde plan in `SPARKI_MIGRATION_AUDIT.md §6` (Fase 1 basis → Fase 2 training-experience → Fase 3 routes/groep → Fase 4 race/day-type → Fase 5 coach/ouder/social) is een **voorlopig voorstel**. We herzien en bevestigen de definitieve volgorde nadat dit blueprint is goedgekeurd.

**Harde randvoorwaarde bij elke fase:** geen bestaande Insights- of nieuwe-app-functionaliteit mag verloren gaan. Datamodel-uitbreidingen zijn additief; de cinematic UX-laag blijft leidend qua presentatie; Insights blijft leidend qua inhoud.

---

## 11. Wat al nieuw/behouden is (niet weggooien)

Bewust toegevoegd in de nieuwe app, bovenop Insights — blijft behouden:
Auth (Clerk), multi-rol (atleet/coach/ouder), JIT-provisioning, onboarding-flow, cinematic-achtergrondsysteem, feature-flags, live AI-brief + interactieve Ask Sparki, echte sessie-logging + metrics-check-in, server-side PMC (CTL/ATL/TSB).

---

*Bron-van-waarheid voor inhoud: Sparki Insights (`.migration-backup/`). Bron-van-waarheid voor presentatie/UX: nieuwe frontend (`artifacts/sparki/`). Dit blueprint verenigt beide en garandeert dat niets verloren gaat.*
