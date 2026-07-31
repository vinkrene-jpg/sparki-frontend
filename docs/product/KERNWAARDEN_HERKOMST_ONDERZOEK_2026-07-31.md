# Onderzoek & herstelvoorstel — Kernwaarden, herkomst en laadstatus

Datum: 31-07-2026 · Status: ONDERZOEK — er is niets gebouwd of gewijzigd.
Input: broncode-onderzoek deze sessie (5 gerichte code-verkenningen + eigen verificatie).
NB: het document "Claude Mirror Opdracht B" is niet in de werkruimte aangetroffen
(attached_assets en docs doorzocht); dit rapport is volledig op de broncode gebaseerd.

Bindende productbesluiten (René, 31-07) zijn onderaan verwerkt in de werkpakketten:
Sportpaspoort = centrale herkomstlaag; kaarten verwijzen naar één brondefinitie;
onbekende herkomst nooit als bewezen feit; tijdens laden alleen neutrale laadstatus;
geen lege-flits of paywall-flits; Doelscenario/Wattage-lab label "Verkenning/simulatie";
géén nieuwe Analysewerkplaats zolang bestaande simulaties niet geïnventariseerd zijn
(inventaris: zie §4.3 — die is nu compleet).

---

## 1. Bron- en schermmatrix

| Waarde | Canonieke bron | Berekening / invoerpad | Herkomstveld | Onzekerheidsstatus | Schermen | Laadgedrag | Ontbrekend / conflict |
|---|---|---|---|---|---|---|---|
| **FTP** | `athlete_profiles.ftp`; historie in `ftp_history` | handmatig (`POST /api/passport/waarde` of legacy `PUT /api/athlete/profile`), onboarding-schatting (wizard), afgeleid (FTP-floor in `derived-load-backfill.ts` → voorstel/`ftp_history` `[achterhaald]`), Strava-connector (`strava.ts:126`) | `passport_value_events` (origin gemeten/handmatig/berekend/geschat + source + confidence); vlag `ftp_estimated` | ja (origin + `ftp_estimated` + stale >180d in `composePassport`) | Home `home-sections.tsx` (kop "FTP 345W"), `performance-numbers.tsx` (Kerngetallen, /you + Analyse), Sportpaspoort, workout-HUD (zones), plan-wizard, wattage-lab, core-analyse FTP-historie | gemengd: home-kop heeft `isLoading`-skeleton; `performance-numbers` toont "Je FTP is nog niet bekend" al bij `ftp == null` zónder loading-onderscheid (r.195-200) | waarde uit profiel wordt overal hard getoond, óók als paspoort "herkomst onbekend" zegt (zie §2.1) |
| **Gewicht** | `athlete_profiles.weight_kg` | handmatig / paspoort; Strava-connector schrijft zonder event | idem paspoort-events | idem | performance-numbers (kg + W/kg), Sportpaspoort, voeding/fueling, wattage-lab | zelfde patroon als FTP | zelfde bypass als FTP |
| **CTL** | `training_sessions.tss` → `computeLoadSeries` (`lib/recovery-load.ts:17-103`, EWMA 42d, 90d-warmup) | afgeleid; TSS gemeten of derived (power+FTP) | provider/externalId op sessies; geen herkomst op het EWMA-resultaat | geen expliciet onzekerheidslabel | Analyse (`core-analyse.tsx` via `lib/analyse-dashboard.ts`), Activiteiten (`TrainingProgression`), /you (`performance-numbers`), Vandaag StateCard (`/api/state`), Lab-radar, paspoort-pagina | skeletons/`LegeGrafiek`; StateCard laat rij weg bij <1 sessie (geen nep-nullen) | geen sessies in 90d → 0-en uit `computeLoad` (eerlijk leeg op UI-lagen) |
| **ATL** | idem (EWMA 7d) | idem | idem | idem | idem | idem | idem |
| **TSB** | CTL−ATL | idem | idem | **interpretatie verschilt per engine** (§3) | idem + risk-engine (`computeRiskSignal`) | idem | idem |
| **Readiness** | `athlete_daily_metrics` (feel/fatigue/sleepQuality) | `computeReadiness` — server `lib/sharing.ts:47` én client-kopie `lib/readiness.ts:27`; gemiddelde van aanwezige inputs, 0-100 | alleen `basis`-array (welke inputs meededen); geen bronveld per metriek | oordeel ontstaat al bij één enkele input, zonder onzekerheidslabel | Home ReactorReadiness-dial + StateCard, Analyse readiness-trend, Lab, coach-cockpit, sharing naar ouder/coach | skeletons; geen check-in → null + "log check-in"-prompt (geen fabricage) | conflictdetectie zit alleen in State-engine (`distortion` → band "wisselend") |
| **HRV** | `athlete_daily_metrics.hrv` | handmatige check-in; connector-ingest voorbereid maar mager | geen per-veld bron; alleen `updatedAt` | geen | Home VitalsGrid, Analyse HRV-trend, Lab | skeleton; leeg = eerlijk leeg ("Eerlijke HRV-leegte" getest) | upsert per (clerkId, datum): **laatste schrijver wint**, handmatig kan geclobberd worden |
| **Slaap** | `athlete_daily_metrics.sleep_hours` + `sleep_quality` | check-in; connectors idem | geen | geen | VitalsGrid, Analyse slaapkaart, parent-home (uren kind) | idem | idem clobber-risico; kwaliteit voedt readiness, uren niet |

---

## 2. Exacte oorzaken van de vijf gemelde symptomen

### 2.1 FTP 345 W hard getoond terwijl Sportpaspoort "herkomst onbekend" zegt
- 345 W komt uit `artifacts/api-server/src/scripts/seed-preview-athletes.ts:83` — de seed schrijft rechtstreeks in `athlete_profiles` **zonder** `passport_value_events`-rij.
- `composePassport` (`lib/passport.ts`) toont "onbekend" wanneer er wél een waarde maar géén bijpassend event is — correct gedrag van het paspoort.
- Maar consumers lezen de waarde rechtstreeks uit `athlete_profiles` via `/api/athlete/profile`/dashboard: home-kop (`home-sections.tsx:286`), Kerngetallen (`performance-numbers.tsx`), workout-HUD, plan-engine, core-prediction (`engines/core-prediction/index.ts:86`). Zij kennen het herkomstbegrip niet en presenteren het getal als feit.
- Dit raakt ook echte gebruikers, niet alleen seeds: **onboarding** (`routes/onboarding.ts:725`), de **Strava-connector** (`lib/connectors/providers/strava.ts:126`) en **profile-consistency `applyProfileFix`** schrijven kernwaarden zonder paspoort-event → "herkomst onbekend" bij legitieme data.

### 2.2 Eerst "FTP niet bekend", later wél een waarde
- Twee losse datapaden zonder gedeelde laadpoort: het snelle profiel-endpoint en de zwaardere paspoort/dashboard-queries.
- `performance-numbers.tsx:195-200` rendert "Je FTP is nog niet bekend." puur op `ftp == null`, zonder te onderscheiden of de query nog laadt. Tijdens de eerste render is de waarde altijd null → foutieve "niet bekend"-flits, daarna klapt de waarde erin. (De home-kop doet het wél goed met een skeleton, `home-sections.tsx:283`.)

### 2.3 Gebruiken Activiteiten en Analyse dezelfde CTL-/volumebron en conclusie-engine?
- **CTL/ATL/TSB: ja** — beide via `/api/athlete/load` → `computeLoadSeries` (één SSOT).
- **Weekvolume: nee** — Analyse aggregeert via `weekVolumeReeks` (`lib/analyse-dashboard.ts:90`), Activiteiten via `weeklyBuckets` (`lib/progression.ts:35`). Twee aggregaties op dezelfde data = randgeval-verschillen (weekgrenzen, afronding).
- **Conclusie/interpretatie: nee** — TSB-drempels wijken af: State-engine `engines/state/compute.ts:319` (≤ −15 vermoeid, ≥ +10 fris) vs Analyse-samenvatting `lib/analyse-dashboard.ts:487` (≤ −15 vermoeid, ≥ +5 uitgerust). Bij TSB tussen +5 en +10 zegt Analyse "uitgerust" en Vandaag niet.

### 2.4 Analyse/Lab: lege kaarten vóór entitlement-resolutie
Drie gestapelde oorzaken:
1. **Variant-flits**: `analyse-switch.tsx:17` rendert tijdens flags-laden alvast `CoreAnalysePage` (`flagsLoading || flags.commercial_shell`). Een legacy-gebruiker ziet dus kort de Core-variant die daarna omklapt naar Lab.
2. **Kaart-placeholders**: de schell rendert direct; `StatTegel` toont "—" bij `value == null` en diverse kaarten tonen skeletons terwijl de queries laden — dat oogt als "lege kaarten vóór de inhoud".
3. **Entitlement zelf flitst géén paywall**: `GoGateSwitch` (`go-gate.tsx:75`) toont tijdens `access.isLoading` een nette laadstatus ("Je toegang wordt gecontroleerd…") en `useFeatureAccess` faalt open. Wel bekend restrisico: de eenmalige `/api/flags`-403 tijdens Clerk-settling kan flags kort op "alles uit" zetten (retry bestaat al).

### 2.5 Welke kaarten tonen readiness/HRV/slaap zonder bron?
- **Geen gefabriceerde waarden gevonden**: zonder check-in is de score null en tonen ReactorReadiness/VitalsGrid een check-in-prompt; Analyse toont eerlijke leegte (getest in `core-analyse.test.tsx`).
- Wel drie zwakkere punten:
  a) readiness geeft al een vol oordeel (PRIMED/GOED/MATIG/LAAG) op basis van **één** input, zonder "op basis van …"-vermelding op de kaart (de `basis`-array bestaat server-side maar wordt niet overal getoond);
  b) `athlete_daily_metrics` heeft **geen bronveld per metriek** — je kunt op geen enkele kaart zien of HRV/slaap handmatig of uit een device komt;
  c) ingest is "laatste schrijver wint" (`ingest.ts:478` onConflictDoUpdate) — een providersync kan een handmatige invoer stil overschrijven.

---

## 3. Conflicten en duplicaties (volledig)

| # | Duplicatie/conflict | Locaties | Gevolg |
|---|---|---|---|
| D1 | `computeReadiness` dubbel (server + client-kopie) | `api-server/lib/sharing.ts:47` ↔ `sparki/lib/readiness.ts:27` | drift-risico bij drempelwijziging |
| D2 | TSB-interpretatiedrempels dubbel én afwijkend | `engines/state/compute.ts:319` ↔ `lib/analyse-dashboard.ts:487` | verschillende conclusies op zelfde data (Vandaag vs Analyse) |
| D3 | Twee week-volume-aggregaties | `lib/analyse-dashboard.ts:90` ↔ `lib/progression.ts:35` | Activiteiten en Analyse kunnen ander weekvolume tonen |
| D4 | EWMA her-implementaties (zelfde 42/7-wiskunde, losse code) | `engines/core-prediction/predict.ts`, `lib/analyse-dashboard.ts:401` (Doelscenario) | toegestaan als simulatie, maar drift-risico t.o.v. `computeLoadSeries` |
| D5 | Lab ↔ Core-Analyse: twee volledige presentaties achter flag-switch | `pages/lab.tsx` ↔ `pages/core-analyse.tsx` | dubbel onderhoud + variant-flits (§2.4.1); bewuste afbouwwave 2A |
| D6 | Schrijfpaden zonder paspoort-event | onboarding (`onboarding.ts:725`), Strava (`strava.ts:126`), profile-fix (`profile-consistency.ts:321,343`), seeds | "herkomst onbekend" ontstaat structureel opnieuw |
| D7 | Geen per-metriek herkomst + clobberende upsert in daily metrics | `data-hub/ingest.ts:476-478` | bron onzichtbaar, handmatige invoer overschrijfbaar |

Inventaris simulaties (verplicht vóór ooit een "Analysewerkplaats"): **Doelscenario** (`core-analyse.tsx:920-1002`, volume-slider → CTL/TSB-projectie, copy "verwachting… geen zekerheid"), **Wattage-lab** (`wattage-lab.tsx` + `lib/wattage-lab.ts`, haalbaarheidsoordeel, copy "schatting… geen garantie"), **Performance-radar** (`bio-radar.tsx` + `lib/performance-radar.ts`, alleen echte assen), **Core-prediction load-projectie** (server). Er bestaat géén "Analysewerkplaats"-component; bouw die dus ook niet — dit is de complete lijst.

---

## 4. Klein herstelplan — afzonderlijke werkpakketten

> Volgorde: WP-K1 → K2 → K3 zijn de kern; K4–K6 kunnen los daarna. Niets starten zonder akkoord.

### WP-K1 — Paspoort wordt écht de enige schrijfroute (herkomst-dekking)
Alle paden die kernwaarden in `athlete_profiles` schrijven, gaan via `applyValueChange` (waarde+event in één transactie): onboarding-profiel, Strava-connector (origin "berekend"/source "Strava"), profile-consistency `applyProfileFix`, seed-scripts (origin "demo/geschat").
- **Risico:** klein-middel — gemiste schrijfpaden; connector-sync mag geen extra latency/failure introduceren (event-write in dezelfde tx, fail-closed).
- **Acceptatie:** verse onboarding + Strava-koppeling + profile-fix leveren géén enkel kernveld met "herkomst onbekend" op; regressietest die elk schrijfpad afloopt en het event asserteert; bestaande paspoort-tests groen.

### WP-K2 — Kaarten tonen herkomststatus; onbekend ≠ feit
Dashboard/profiel-endpoint levert per kernwaarde de paspoortstatus mee (origin + estimated + stale). Consumers (home-kop, Kerngetallen, HUD-uitleg, plan-wizard) tonen bij origin "onbekend"/"geschat" een label ("niet bevestigd" / "geschat") — één gedeelde brondefinitie, geen tweede waarheid.
- **Risico:** klein — presentatielaag; let op HUD (geen ruis tijdens rijden: daar volstaat de uitleglaag/UitlegDot).
- **Acceptatie:** seed-gebruiker met 345 W ziet overal "345 W · herkomst niet bevestigd" (nooit kaal); paspoort en kaart zeggen hetzelfde; node-page-test per surface.

### WP-K3 — Laaddiscipline: neutrale laadstatus, geen flitsen
(a) `value == null` terwijl de query laadt mag nooit "niet bekend"-copy geven — overal skeleton tot geladen (start: `performance-numbers.tsx`); (b) `analyse-switch` wacht op flags in plaats van alvast Core te renderen (neutrale laadstatus i.p.v. variant-flits); (c) sweep over alle "nog geen …"-empty-states op dit patroon.
- **Risico:** klein — puur rendervolgorde; risico is een blijvende spinner bij query-fout (fail: toon dan eerlijke fouttekst, geen leeg).
- **Acceptatie:** met vertraagde API (throttle) verschijnt nergens "niet bekend"/verkeerde variant vóór data; e2e-check op /analyse en /you; bestaande tests groen.

### WP-K4 — Eén conclusie-engine voor belasting
TSB-labels/drempels en week-volume-aggregatie centraliseren in één gedeelde definitie (server-side, bv. uitbreiding van `recovery-load`/analyse-dashboard-contract); State-engine, Analyse en Activiteiten consumeren dezelfde.
- **Risico:** middel — Vandaag-copy kan verschuiven bij TSB +5..+10; besluit nodig welke drempel wint (voorstel: State-engine-drempels, die zijn conservatiever).
- **Acceptatie:** zelfde dataset ⇒ identiek label en identiek weekvolume op Vandaag, Analyse en Activiteiten; snapshot-test op drempelranden (−15, +5, +10).

### WP-K5 — Label "Verkenning/simulatie" op Doelscenario en Wattage-lab
Uniforme badge/kop "Verkenning · simulatie" op beide (huidige copy zegt al "schatting/verwachting", maar niet uniform en niet als vast label). Geen rekenwijziging.
- **Risico:** verwaarloosbaar.
- **Acceptatie:** beide surfaces tonen het vaste label; teksten blijven Nederlands; geen andere kaart krijgt het label onterecht.

### WP-K6 — Herkomst per dagmetriek (HRV/slaap) + merge-regel
Per-veld bron ("handmatig"/provider) op `athlete_daily_metrics` (nieuwe kolommen, non-destructieve migratie), merge-regel: handmatig wordt nooit stil overschreven door een sync; kaarten tonen bron ("via Garmin" / "zelf ingevuld") en readiness-kaart toont "op basis van: …" (basis-array bestaat al).
- **Risico:** middel — schemawijziging + ingest-gedrag; migratie non-destructief, bestaande rijen krijgen bron "onbekend" (eerlijk).
- **Acceptatie:** sync na handmatige invoer laat de handmatige waarde staan; bron zichtbaar op VitalsGrid/Analyse; ingest-tests voor beide volgordes.

**Expliciet NIET in dit plan:** een nieuwe Analysewerkplaats (besluit René; inventaris §3 is compleet, afbouw D5/Lab-duplicaat loopt al via wave 2A).
