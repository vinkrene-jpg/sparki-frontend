# DASHBOARD_01 Fase B — rol-dashboards (VOOR / NA)

Drie-lagen dashboard-skelet voor de niet-sporterrollen, gebouwd volgens
`attached_assets/DASHBOARD_01_1785683400386.md`. Elke rol landt op zijn dashboard
als eerste scherm (DSH-13a); het bestaande werkscherm blijft één doorklik
verderop bereikbaar. **Niet** gebouwd: mechanieker/soigneur/medical_staff — hun
bestaande rolstart blijft ongewijzigd.

## Bindende regels — hoe ze zijn nageleefd

- **Laag 1 = precies één visueel element** (DSH-05/20): één band met kicker + één
  groot getal/waarde + één betekenisregel + optioneel één detailregel. Geen
  tegelraster, geen getallenmuur.
- **Laag 2 = één ding met een actie boven de vouw** (DSH-06/19), getest op
  402×874. Het hoogst wegende openstaande punt met één knop.
- **Laag 3 mag onder de vouw** (doorkliklijst met signalen).
- **Lege laag = volledig weggelaten, geen boodschap** (DSH-08/21): elke laag is
  `null` als er geen echte data is; er verschijnt dan niets.
- **Rechten volgen de BESTAANDE rechtenlaag** (DSH-09/23): geen tweede
  rechtensysteem. De ouder leest alleen `access.permissions`; clubrollen lezen
  hun bestaande club-endpoints; de bezit-poort in `/rol-start/:rol` blijft
  fail-closed vóór het dashboard rendert.
- **Alleen bestaande data/endpoints** — geen nieuwe backend. Waar geen echte
  bron is, wordt de laag/kans **eerlijk weggelaten** (zie limitaties).
- **Licht en rustig** (DSH-16..18), Nederlandse copy, nooit "Sparki <werkwoord>"
  (`check-brand-copy` groen).

## Skelet

- `src/components/sparki/role-dashboard.tsx` — herbruikbaar `RoleDashboard` met
  drie optionele lagen (elke `null`/leeg ⇒ weggelaten), een werkscherm-doorklik
  en een laadtoestand. Testids: `role-dashboard`, `dashboard-laag1/2/3`,
  `dashboard-werkscherm`.

## Per rol — wat elke laag toont en uit welke bestaande bron

### 1. Zelfstandige trainer / coach — `CoachDashboard` (`/dashboard`)
Bron: `useCoachDashboard()` → `/api/coach/dashboard`.
- **Laag 1** — aantal gekoppelde sporters + spreiding readiness.
- **Laag 2** — de sporter met de hoogste prioriteit + zijn topsignaal → cockpit.
- **Laag 3** — afhakers: sporters ≥14 dagen zonder activiteit.
- **Werkscherm** — `/coach` (roster/planning, ongewijzigd).
- **Weggelaten:** openstaande facturen — er is **geen** frontend-factuurbron in
  de coach-data; niet verzonnen (DSH-08).

### 2. Hoofdtrainer — `HoofdtrainerDashboard` (`/rol-start/hoofdtrainer`)
Bron: `useClubDashboard()` + `useHoofdtrainerOverview()`.
- **Laag 1** — aantal groepen/teams + hoeveel groepen een vaste trainer hebben.
- **Laag 2** — eerstvolgende clubtraining of -wedstrijd.
- **Laag 3** — groepen zonder trainer + trainers zonder planactiviteit (30 d).
- **Werkscherm** — `/club`.

### 3. Clubbeheerder — `ClubbeheerderDashboard` (`/rol-start/owner|admin`)
Bron: `useClubDashboard()` (memberCounts/consents/signals) +
`useClubMembers()` (afgeleide `vogStatus`).
- **Laag 1** — omvang ledenbestand (leden + trainers).
- **Laag 2** — openstaande toestemmingen + VOG's die aandacht vragen (F6:
  `vogStatus` "verlopen"/"ontbreekt"); anders openstaande uitnodigingen.
- **Laag 3** — clubsignalen (afmeldingen, pakketstatus).
- **Werkscherm** — `/club/beheer`.
- **Weggelaten:** "jeugd zonder ouderkoppeling" — de frontend kent alleen
  `isYouth`, niet de ouder-koppelstatus; geen bestaande bron → eerlijk
  weggelaten, wordt in het clubbeheer zelf afgehandeld (DSH-08).

### 4. Teammanager — `TeammanagerDashboard` (`/rol-start/teammanager`)
Bron: `useClubDashboard()` + `useClubRaces()` + `useClubTrainings()`.
- **Laag 1** — aantal teams + aankomende wedstrijden.
- **Laag 2** — de eerstvolgende wedstrijd/training deze week.
- **Laag 3** — onderbezette wedstrijden (<3 beschikbare renners).
- **Werkscherm** — `/club`.

### 5. Ploegleider — `PloegleiderDashboard` (`/rol-start/ploegleider`)
Bron: `useClubRaces()` (selections/rollen/materiaal/verzamelinfo).
- **Laag 1** — eerstvolgende wedstrijd + bezetting (beschikbare renners).
- **Laag 2** — open koersdag-taken (ontbrekend verzamelpunt/-tijd/vervoer),
  anders de wedstrijd-room om de dag vast te leggen.
- **Laag 3** — renners zonder koersrol + materiaal nog niet afgevinkt.
- **Werkscherm** — `/wedstrijd-room`.

### 6. Ouder — `ParentDashboard` (`/`)
Bron: `useParentOverview()` → `/api/parent/overview`. **Rechten = exact
`access.permissions` per kind** (geen tweede rechtenlaag).
- **Laag 1** — hoe het met het kind/de kinderen gaat (welzijn, voor zover
  gedeeld: gezondheid/slaap/gevoel).
- **Laag 2** — openstaand wedstrijdbesluit (indien gedeeld) of de eerstvolgende
  planning-item.
- **Laag 3** — open ziek-/blessuremeldingen, herbevestiging vereist,
  gezondheidsstatus ≠ ok.
- **Werkscherm** — `/kinderen`.

## Routing & startscherm

- `App.tsx` — coach/parent landen op `CoachDashboard`/`ParentDashboard` in
  zowel `RoleHome` (`/`) als `DashboardPage` (`/dashboard`). Nieuwe route
  `/coach` rendert de bestaande `CoachHome`-werkomgeving.
- **`components/sparki/dev-preview.tsx`** — de DEV-preview/acceptatie-router is
  een PARALLELLE router (actief zodra `DEV_PREVIEW`/`SPARKI_ACCEPT_MODE` aan is,
  dus óók in de toetsomgeving). Die rendde op `/` en `/dashboard` nog de OUDE
  `CoachHome`/`ParentHome`. Nu gespiegeld: coach→`CoachDashboard`,
  parent→`ParentDashboard`, plus een `/coach`-tak voor de roster-werkomgeving en
  `/coach` in de dev-paginakiezer. Zo is er **geen tweede gedaante onder dezelfde
  naam** (DSH-24) — preview en productie tonen hetzelfde eerste scherm.
- `pages/rol-start.tsx` — na de bezit-poort dispatcht `/rol-start/:rol` naar het
  Fase B-dashboard voor `owner`/`admin`/`hoofdtrainer`/`teammanager`/
  `ploegleider`; overige rollen houden de bestaande ingangenlijst.
- `lib/role-start.ts` — coach-ingangen: `/dashboard` (Dashboard) + `/coach`
  (Jouw sporters) + `/invitations`.

### Root cause van de "role-dashboard=0"-meting (nu opgelost)
De eerste e2e-meting toonde overal `role-dashboard=0` omdat de toets tegen een
accept-mode build draaide waarin `DevPreview` (niet `App.tsx`) de router is; die
rendde nog de oude rol-homes. De fix zit in `dev-preview.tsx` (hierboven). Na een
herbouw (`SPARKI_ACCEPT_MODE=true vite build`) renderen alle dashboards correct.

## Verificatie (allemaal groen)

- `npx tsc -b` — schoon.
- `npm run test:navigation` — 12/12 groen (elke rol-href wijst naar een
  bestaande route, incl. `/coach`).
- `node scripts/check-brand-copy.mjs` — geen verboden merkvermeldingen.

## Schermbewijs (402×874)

`node e2e/tests/dashboard-rollen.mjs` met `DASH_ROLLEN_SHOT_DIR=voor|na` (kaal
label; de basename wordt genomen zodat een per ongeluk meegegeven pad niet
dubbel wordt gejoind — de eerder geconstateerde
`docs/proof-evidence/…/docs/proof-evidence/…`-bug). Legt per rol de startfold +
laagdetectie + databron-probes vast in `na/`.

### NA-meting (deze build, accept-mode preview op 402×874)
Alle drie de inlogbare rollen tonen nu `role-dashboard=1` met laag 1 zichtbaar in
de fold; de pagina past in 1.0 scherm (L1+L2 boven de vouw):

| rol | startpad | role-dashboard | laag1 | laag2 | laag3 | schermen | databron |
|---|---|---|---|---|---|---|---|
| Ouder | `/` | 1 | 1 | 0* | 0* | 1.0 | `/api/parent/overview` 200 |
| Zelfstandige trainer (coach) | `/` | 1 | 1 | 1 | 0* | 1.0 | `/api/coach/dashboard` 200 |
| Clubbeheerder | `/rol-start/admin` | 1 | 1 | 1 | 0* | 1.0 | `/api/clubs` 200 |

\* laag 2/3 = 0 is **correct** en géén bug: die lagen worden weggelaten (DSH-08)
omdat er voor deze testfixtures geen echte bron-data is — bij de ouder is de
planning niet gedeeld (rechtenlaag) en zijn er geen open meldingen; bij coach/
clubbeheerder geen afhakers/signalen. De lagen verschijnen zodra er wél data is.

Shots: `na/rol-parent-*.png`, `na/rol-trainer-zelfstandig-*.png`,
`na/rol-clubbeheerder-*.png` (fold + scroll).

### VOOR-meting (oude gedaante, vóór deze fix)
Vóór de `dev-preview.tsx`-fix rendeerden de startschermen de OUDE rol-homes:
coach → `CoachHome` (roster "01 · JOUW SPORTERS"), ouder → `ParentHome`
(kindkiezer + "WELZIJN & VEILIGHEID"), en `/rol-start/admin` → de oude
ingangenlijst (`rolstart-admin`, geen `role-dashboard`-testids). Dat is precies
de "tweede gedaante" die DSH-24 verbiedt en die nu vervangen is.

### Rollen met een werkende login-fixture (WP-R0 governor)
- **Ouder** — `governor-fixture-parent` (rol `parent`).
- **Zelfstandige trainer** — `governor-fixture-trainer-zelfstandig` (rol `coach`).
- **Clubbeheerder** — `governor-fixture-clubbeheerder` (rol `athlete` →
  `clubStart` → `/rol-start/…` → clubbeheerder-dashboard).

### Rollen zonder werkende login-fixture — eerlijk gedocumenteerd
- **Hoofdtrainer** — de fixture `governor-fixture-hoofdtrainer` heeft server-side
  `activeRole = coach`, dus die inlog landt op het **coach**-dashboard, niet op
  een eigen hoofdtrainer-inlog. Het `HoofdtrainerDashboard` is wél gebouwd en
  bereikbaar via `/rol-start/hoofdtrainer` voor een account dat die clubrol
  bezit; er is echter geen kant-en-klare login-fixture die daar direct op landt.
- **Teammanager** en **Ploegleider** — geen governor-login-fixture beschikbaar;
  code + routing zijn gebouwd, maar niet via een echte login vast te leggen in
  deze omgeving. Zodra een clublidmaatschap met die rol bestaat, landt het
  account via `/rol-start/:rol` op het bijbehorende dashboard.

Deze beperkingen zijn puur login-fixtures, geen ontbrekende functionaliteit:
alle zes dashboards zijn geïmplementeerd, getypeerd (tsc schoon) en via de
bestaande routing bereikbaar.
