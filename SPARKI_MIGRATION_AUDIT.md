# SPARKI MIGRATION AUDIT

**Datum:** 22 juni 2026
**Doel:** Exact vaststellen welke functionaliteit uit **Sparki Insights** (origineel) wel en niet is overgekomen naar de **nieuwe Sparki Frontend**, plus een gefaseerd migratieplan.

**Leidend principe:** Sparki Insights is inhoudelijk leidend. De nieuwe frontend is uitsluitend de nieuwe presentatie- en UX-laag. De migratie mag geen bestaande Insights-functionaliteit laten verdwijnen.

> ⚠️ Status van deze audit: **read-only**. Er is niets verwijderd, overschreven of nieuw gebouwd. De geplande taken (#3 day-type home engine, #4 race-week/race-day) staan **on hold** tot dit auditplan is goedgekeurd.

---

## 1. Bronnen

| Rol | Project | Locatie | Stack |
|---|---|---|---|
| **Inhoudelijk leidend** | Sparki Insights (origineel) | `.migration-backup/` | Next.js 16 (App Router), React 19, Tailwind v4, lucide-react |
| **Nieuwe presentatie/UX** | Sparki Frontend | `artifacts/sparki/` | React + Vite + Wouter + TanStack Query + Tailwind v4 |
| Backend (nieuw) | API Server | `artifacts/api-server/` | Express 5, Clerk, Drizzle ORM |
| Data (nieuw) | DB schema | `lib/db/src/schema/` | PostgreSQL + Drizzle |

Belangrijk verschil van filosofie: Insights draait volledig op **één mock-databron** (`lib/sparki-data.ts`) en heeft géén auth, géén backend, géén DB. De nieuwe frontend is een **echte full-stack app** (auth via Clerk, live data via API + Postgres). Migratie betekent dus niet alleen "scherm overzetten" maar ook "mock-data omzetten naar een echt datamodel".

---

## 2. Inventarisatie — Sparki Insights (origineel)

### Modules / gebieden
- **Performance Lab** — biometrie (HRV, slaap, readiness) + performance-modeling (power curve, FTP-ontwikkeling, CTL/ATL/TSB).
- **Training Exec** — uitvoering van de dagtraining: intervalprofiel, doelzones, route + navigatie, fueling, prep-checklist.
- **Biometric Feed** — gecentraliseerde stream van AI, coach, team, club, race.
- **Athlete Profile ("You")** — identiteit, doelen, materiaal, gekoppelde apps, account/privacy.

### Routes / schermen (`.migration-backup/app/`)
- `/` (`page.tsx`) → **Home / Training Day** (rendert `training-day-home.tsx`)
- `/train` → **Workout detail** (intervallen, zones, route, fueling, prep)
- `/feed` → **Feed** (gecategoriseerde updates)
- `/lab` → **Analytics Lab** (readiness 14d, HRV, power curve, FTP-historie, seizoen CTL/ATL/TSB)
- `/you` → **Profiel & instellingen**

### Componenten (`.migration-backup/components/sparki/`)
- `sparki-core.tsx` — AI-orb/halo/reactor (ademende biometrie-visualisatie)
- `bio-radar.tsx` — 6-assige performance-radar
- `training-day-home.tsx` — volledige Home-implementatie
- `screen-shell.tsx` — gedeelde cinematic shell + bottom-nav
- `primitives.tsx` — `Sparkline`, `GaugeArc`
- `ui.tsx` — `SectionLabel`, `Delta`, `Stat`, `Divider`, `ACCENT`
- `components/ui/button.tsx` — basisknop

### Mock-data (`lib/sparki-data.ts`) — de enige databron
`athlete`, `readiness`, `vitals[]`, `powerCurve`, `recoveryTrend`, `intervals` (workout-blokken), `aiSignals[]`, `zones[]`, `target`, `route` (profiel + climbs + turn-by-turn nav), `fueling[]`, `prep[]` (checklist), `feed[]`, `ftpHistory`, `season` (CTL/ATL/TSB), `goals[]`, `youGroups[]` (atleet/setup/account).

### Feature-categorieën zoals gevraagd
- **AI-logica:** readiness-scoring (PRIMED), aiSignals (opportunity/risk/performance/recovery), executie-coaching (cadans/pacing), FTP-voorspelling (~10 dagen).
- **Training:** intervalvisualisatie, zones (Z1–Z5), compliance (98% uitvoering, IF), target power/HR/cadans.
- **Routeplanner:** elevatieprofiel, climb-directory (lengte/grade), turn-by-turn navigatielijst.
- **Groepsrit/verzamelpunt:** clubrit-meldingen + teamselectie (alleen als feed-items).
- **Race/wedstrijd:** KNWU-inschrijving + race-countdown (alleen als feed-items + goal).
- **Coach:** planaanpassingen + post-workout feedback (alleen als feed-items).
- **Ouder:** géén.
- **Onboarding:** géén (alleen "baseline ingesteld").
- **Lab/observatie:** bio-radar, power/duration-curve, TSB-modeling, FTP-historie.
- **Social/feed:** categoriefilters, AI als deelnemer, video-content.
- **Instellingen/profiel:** materiaal (fietsen/sensoren), gekoppelde apps (Garmin/Strava/Wahoo), privacy, voorkeuren.

---

## 3. Inventarisatie — Sparki Frontend (nieuw)

### Routes / schermen (`artifacts/sparki/src/`)
- `/` → `HomeRedirect`: landing (uitgelogd) of `SignedInHome` → `TrainingDayHome`
- `/sign-in`, `/sign-up` → Clerk auth *(nieuw, niet in Insights)*
- `/train` → zones + sessie-logging + workout-status
- `/feed` → filterbare stream + **Ask Sparki** (interactieve AI) *(uitgebreid)*
- `/lab` → radar, FTP-historie, HRV-trend, CTL/ATL/TSB
- `/you` → profiel, FTP-invoer, doelen (tekst), dagelijkse check-in, privacy
- `/preview` → dev-only componentenspeeltuin *(nieuw)*

### Componenten (`src/components/sparki/`)
`sparki-core`, `bio-radar`, `training-day-home`, `screen-shell`, `primitives`, `ui`, `bottom-nav` (rol-bewust), **`cinematic-scene`** *(nieuw)*, **`onboarding-flow`** *(nieuw)*, **`feature-gate`** *(nieuw)*, `error-boundary`.

### Hooks / contexts
`UserContext` (Clerk + rollen), `FeatureFlagContext`, `use-ai-brief`, `use-athlete-dashboard`, `use-athlete-extended-profile`, `use-daily-metrics`, `use-load`, `use-sessions`, `use-today-workout`, `use-ftp-history`, `use-feature-flag`.

### API-endpoints (`artifacts/api-server/src/routes/`)
- Athlete: `GET/PUT /profile`, `GET /dashboard`, `GET/POST/PUT /workouts*`, `GET/POST /sessions`, `GET/POST /metrics`, `GET /load`, `GET/POST /ftp`
- AI: `POST /ai/brief`, `POST /ai/ask`
- Auth: `POST /auth/sync`, `GET /auth/me`, `PUT /auth/me/role`
- Flags: `GET /flags`, `GET/PUT /flags/admin/*`
- Health: `GET /healthz`

### DB-schema (`lib/db/src/schema/`)
`users`, `athlete_profiles`, `athlete_metrics`, `athlete_training` (planned_workouts + sessions + ftp_history), `feature_flags`, `conversations`/`messages`. **Géén** tabellen voor: routes, fueling, prep, power-curve, feed-posts, races/events, group rides/meeting points, materiaal/gekoppelde apps.

### Toevoegingen t.o.v. Insights (nieuw, niet in origineel)
Echte auth (Clerk), multi-rol (atleet/coach/ouder), JIT-provisioning, onboarding-flow, cinematic-achtergrondsysteem, feature-flag-systeem, live AI-brief (LLM) + interactieve Ask Sparki, echte sessie-logging en metrics-check-in, PMC-berekening server-side.

---

## 4. Vergelijkingstabel

Status-legenda: **migrated** = volledig over · **partially migrated** = deels (UI of data ontbreekt) · **missing** = niet aanwezig · **conflicting** = wijkt af / botst · **obsolete** = bewust vervallen.

### 4.1 Modules
| Feature / module | In Insights | In Frontend | Status | Toelichting |
|---|---|---|---|---|
| Performance Lab | ja | ja | **partially migrated** | Power curve ontbreekt; radar/FTP/seizoen wel |
| Training Exec | ja | ja | **partially migrated** | Zones/logging wel; route/fueling/prep/intervalvisualisatie niet |
| Biometric Feed | ja | ja | **partially migrated** | UI + AI aanwezig; feed-data nog statisch (geen DB) |
| Athlete Profile (You) | ja | ja | **partially migrated** | Profiel/doelen wel; materiaal/gekoppelde apps niet |

### 4.2 Routes / schermen
| Feature / module | In Insights | In Frontend | Status | Toelichting |
|---|---|---|---|---|
| Home `/` | ja | ja | **migrated** | Refactored naar live data (readiness, vitals, radar) |
| Train `/train` | ja | ja | **partially migrated** | Mist route, fueling, prep, intervalblokken |
| Feed `/feed` | ja | ja | **partially migrated** | Stream + filters + Ask Sparki; data statisch |
| Lab `/lab` | ja | ja | **partially migrated** | Mist power/duration-curve |
| You `/you` | ja | ja | **partially migrated** | Mist materiaal + gekoppelde apps |
| Sign-in / Sign-up | nee | ja | **n.v.t. (nieuw)** | Auth bestond niet in Insights |

### 4.3 Componenten
| Component | In Insights | In Frontend | Status |
|---|---|---|---|
| sparki-core | ja | ja | **migrated** |
| bio-radar | ja | ja | **migrated** |
| training-day-home | ja | ja | **migrated** (live data) |
| screen-shell | ja | ja | **migrated** (uitgebreid: cinematic + rolswitch) |
| primitives (Sparkline/GaugeArc) | ja | ja | **migrated** |
| ui.tsx (atoms) | ja | ja | **migrated** |
| bottom-nav | ja | ja | **migrated** (rol-bewust) |
| cinematic-scene | nee | ja | **nieuw** |
| onboarding-flow | nee | ja | **nieuw** |
| feature-gate | nee | ja | **nieuw** |

### 4.4 Mock-data → live datamodel
| Insights-databron | Doel in Frontend | Status | Toelichting |
|---|---|---|---|
| `athlete` | `athlete_profiles` | **migrated** | Live |
| `readiness` | afgeleid uit metrics | **migrated** | Berekend |
| `vitals[]` | `athlete_metrics` + `load` | **migrated** | Live |
| `powerCurve` | — | **missing** | Geen bron, geen UI |
| `recoveryTrend` | metrics-trend | **partially migrated** | Readiness-trend deels |
| `intervals` (blokken) | `planned_workouts.structure` | **partially migrated** | Opgeslagen (jsonb), niet gevisualiseerd |
| `aiSignals[]` | live AI-brief (LLM) | **migrated** | Vervangen door live AI (verbeterd) |
| `zones[]` | `computeZones()` | **migrated** | Live op FTP |
| `target` | afgeleid uit workout/zones | **partially migrated** | Geen expliciet target-blok |
| `route` | — | **missing** | Geen route-tabel/UI |
| `fueling[]` | — | **missing** | Geen voedingsstrategie |
| `prep[]` (checklist) | — | **missing** | Geen prep-checklist |
| `feed[]` | feed-UI (statisch) | **partially migrated** | UI ja, geen feed-tabel |
| `ftpHistory` | `ftp_history` | **migrated** | Live |
| `season` (CTL/ATL/TSB) | `computeLoad()` | **migrated** | Live PMC |
| `goals[]` | `athlete_profiles.goals` (tekst) | **partially migrated** | Tekstveld i.p.v. gestructureerde doelen + progressie |
| `youGroups[]` (materiaal/apps/privacy) | deels privacy | **partially migrated** | Materiaal + gekoppelde apps ontbreken |

### 4.5 Functionele categorieën (zoals gevraagd)
| Categorie | In Insights | In Frontend | Status | Toelichting |
|---|---|---|---|---|
| **AI-logica** | ja | ja | **partially migrated** | Brief + Ask Sparki (verbeterd); FTP-voorspelling + in-workout coaching ontbreken |
| **Training** | ja | ja | **partially migrated** | Zones + logging; intervalvisualisatie + compliance (IF/% uitvoering) ontbreken |
| **Routeplanner** | ja | nee | **missing** | Geen route, elevatie, climbs, turn-by-turn |
| **Groepsrit / verzamelpunt / carpool** | deels (feed-items) | deels (feed-filter) | **partially migrated** | Geen echte feature in beide; alleen als feed-content |
| **Race / wedstrijd** | deels (feed + goal) | deels (feed-filter + goal-tekst) | **partially migrated** | Geen race-entiteit; race-day/-week gepland (taak #4), niet gebouwd |
| **Coach** | deels (feed) | deels (rol + nav + filter) | **partially migrated** | Geen coach-portal/dashboard |
| **Ouder** | nee | deels (rol + nav) | **nieuw (scaffolding)** | Insights had niets; nieuw heeft alleen rol-skelet |
| **Onboarding** | nee | ja | **nieuw** | Volledige onboarding-flow toegevoegd |
| **Lab / observatie** | ja | ja | **partially migrated** | Radar/FTP/seizoen wel; power curve niet |
| **Social / feed** | ja | ja | **partially migrated** | UI + AI; data statisch (geen posts/comments-tabel) |
| **Instellingen / profiel** | ja | ja | **partially migrated** | Profiel/doelen/privacy; materiaal + gekoppelde apps ontbreken |

### 4.6 Workflows
| Workflow | Status | Toelichting |
|---|---|---|
| Dagelijkse readiness-beoordeling | **migrated** | Home volledig |
| Workout-voorbereiding (intervallen → route → checklist) | **partially migrated** | Alleen zones; route + checklist + fueling ontbreken |
| Performance-review (power curve + seizoen) | **partially migrated** | Seizoen wel, power curve niet |
| Community/coach-loop | **partially migrated** | Feed + filters; geen echte coach-interactie |
| Onboarding / auth | **nieuw** | Bestond niet in Insights |

---

## 5. Samenvatting van de gaten (wat moet terug)

**Volledig ontbrekend (missing):**
1. Power/duration-curve (Lab)
2. Routeplanner: elevatieprofiel, climbs, turn-by-turn navigatie (Train)
3. Fueling/voedingsstrategie (Train)
4. Prep-checklist vóór de rit (Train)

**Deels overgekomen (partially migrated) — afmaken:**
5. Intervalblok-visualisatie (workout-structuur wel opgeslagen, niet getoond)
6. Compliance/uitvoering (IF, % uitvoering) + expliciet target-blok
7. Feed met echte data (posts/comments-tabel i.p.v. statisch)
8. Gestructureerde doelen met progressie (nu enkel tekstveld)
9. Materiaal + gekoppelde apps (Garmin/Strava/Wahoo/Komoot) in You
10. Coach: echt portal/dashboard i.p.v. alleen feed-filter
11. Race/wedstrijd: echte race-entiteit, race-day/race-week (gepland in taak #4)
12. AI: FTP-voorspelling + in-workout executie-coaching

**Bewust nieuw/verbeterd (geen actie, behouden):** auth, rollen, onboarding, cinematic-achtergrond, feature-flags, live AI-brief + Ask Sparki, echte sessie-logging/metrics.

**Conflicting:** geen harde conflicten gevonden. Wel een filosofieverschil: doelen zijn vereenvoudigd van gestructureerd (`goals[]` met datum + progressie) naar één tekstveld — zie punt 8.

**Obsolete:** mock-databron `lib/sparki-data.ts` blijft als referentie maar is functioneel vervangen door live data; ongebruikte Insights-assets (`concept-future.png`, `concept-pitwall.png`, `cyclist-hero.png`).

---

## 6. Gefaseerd migratieplan

> Elke fase levert werkende functionaliteit op zonder bestaande features te slopen. Datamodel-uitbreidingen gaan via Drizzle (`lib/db`), daarna `db push` + rebuild. De nieuwe UX-laag blijft leidend qua presentatie; Insights blijft leidend qua inhoud.

### Fase 1 — Kritische basisfunctionaliteit terugzetten
- **Power/duration-curve** terug in Lab (datamodel uit sessies/peaks + UI).
- **Intervalblok-visualisatie** op Home/Train (render `planned_workouts.structure`).
- **Expliciet target-blok** (power/HR/cadans/zone) op Train.
- **Gestructureerde doelen** met datum + progressie (vervang tekstveld; behoud backward-compat).

### Fase 2 — Training experience terugzetten
- **Fueling/voedingsstrategie** (datamodel + UI op Train).
- **Prep-checklist** vóór de rit (materiaal/weer/sensoren).
- **Compliance** (IF, % uitvoering) + post-workout vergelijking plan vs. uitvoering.
- **In-workout executie-coaching** (cadans/pacing-advies via AI).

### Fase 3 — Routeplanner / groepsritten / verzamelpunten
- **Route-entiteit**: elevatieprofiel, climbs (lengte/grade), turn-by-turn nav.
- **Groepsritten + verzamelpunten + carpool** als echte feature (niet enkel feed).
- Integratie-klaar maken voor **Komoot/Strava/Garmin**-routes.

### Fase 4 — Race day / race week / wedstrijdplanner
- **Race/event-entiteit** + inschrijving/countdown.
- **Race-week**, **dag-vóór-race**, **race-day** modes (sluit aan op de geplande day-type engine, taken #3/#4 — nu on hold).
- Decision-hierarchy homepage (emergency → race → coach → sparki → recovery → rest → general).

### Fase 5 — Coach / ouder / social / lab compleet maken
- **Coach-portal/dashboard** (atleten beheren, plannen, feedback).
- **Ouder-dashboard** (read-only inzicht).
- **Social/feed** met echte data (posts, comments, team/club/race-bronnen).
- **Lab** compleet: comparatieve power-curve, FTP-voorspelling, trendmodellen.

---

## 7. Relatie tot lopende taken
- **Taak #3 (day-type homepage engine + core days)** en **Taak #4 (race-week/race-day modes)** overlappen met **Fase 4** en de Home-redesign. Beide staan **on hold** tot dit migratieplan is goedgekeurd. Aanbeveling: Fases 1–2 (basis + training-experience terugzetten) eerst, daarna de day-type/race-werkstromen.

---

*Zie `SPARKI_MASTER_BLUEPRINT.md` voor de geconsolideerde doelarchitectuur (Insights-inhoud + nieuwe UX-laag + intelligentielaag).*
