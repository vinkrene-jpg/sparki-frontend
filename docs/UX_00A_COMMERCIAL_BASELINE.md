# UX_00A — Commerciële UX-baseline (sporteromgeving)

**Datum:** 25 juli 2026 · **Scope:** uitsluitend SPORTER · **Aard:** één uitsluitend-lezen auditronde — geen productiecode, styling, routes, API's, database of configuratie gewijzigd; alleen dit document, de matrix-CSV en screenshots toegevoegd.

**Dit rapport bevat géén UX-goedkeuring.** Het legt de huidige staat vast met bewijs en benoemt risico's; beoordeling en besluitvorming liggen bij de opdrachtgever.

## 1. Methode & eerlijkheidsgrenzen

- Omgeving: lokale dev-omgeving met Development Preview Mode (dev-gebruiker "Lars", grotendeels lege database). Lege staten zijn daardoor ruim vertegenwoordigd — dat is representatief voor een **nieuwe** betalende gebruiker, niet voor een gevulde account.
- Screenshots: 12 stuks (6 schermen × 2 viewports: 390×844 en 1440×900) in `docs/UX_00A_EVIDENCE/`. Scherm 7 (abonnement) heeft geen sporterroute → 0 screenshots, NOT_PROVEN.
- Scrollhoogte is **niet instrumenteel gemeten** (alleen viewport-screenshots); waar inhoud aantoonbaar onder de vouw doorloopt is dat vermeld.
- Fout- en geblokkeerde toestanden zijn **niet geforceerd** (uitsluitend-lezen): niet gezien = NOT_PROVEN, geen aanname.
- Onboarding is bekeken via het dev-preview-pad `/_dev/onboarding` (eerste stap). De volledige productie-eerste-gebruik-flow met een echt nieuw account (Clerk sign-up → alle stappen) is niet doorlopen → deels NOT_PROVEN.

## 2. Bevindingen per scherm

### 2.1 Onboarding / eerste gebruik — `/_dev/onboarding`
Bewijs: `01_onboarding_mobiel.jpg`, `01_onboarding_desktop.jpg` · Code: `artifacts/sparki/src/components/sparki/onboarding-v2.tsx`, opening via `dev-preview.tsx` (`ONBOARDING_PATH`).

- Sterke, rustige eerste indruk: één boodschap ("Hoi. Jij bent dus Dylan."), één cyaan CTA "Verder". Hiërarchie en huisstijl kloppen.
- Geen voortgangsindicatie, geen duur-indicatie, geen waardepropositie op stap 1. Een nieuwe gebruiker weet niet hoeveel stappen volgen of wat het oplevert.
- Mobiel (390px): de DEV-badge overlapt het SPARKI-woordmerk — dev-only overlay, geen productieprobleem, maar vervuilt testscreenshots.
- Vervolgstappen, fout- en laadtoestanden: NOT_PROVEN (één poging, uitsluitend-lezen).

### 2.2 Vandaag — `/vandaag`
Bewijs: `02_vandaag_mobiel.jpg`, `02_vandaag_desktop.jpg` · Code: `App.tsx` r.389 (`VandaagPage`), vraagblokken o.a. `check-in-chip.tsx`, `state-card.tsx`.

- Sterkste scherm commercieel: persoonlijke status ("Je bent goed belastbaar"), advies met reden, verdieping ("Waarom dit zo is?", "Volledige analyse"). Dit ís de abonnementswaarde — maar hij wordt nergens als zodanig benoemd.
- Twee gelijktijdige vraagblokken ("Hoe voel je je?" én "SPARKI WIL WETEN — Waar wil jij als renner naartoe?") staan op desktop beide in de eerste viewport: vraagdruk in plaats van één leidend momentblok.
- Primaire actie is ambigu: vier ongeveer gelijkwaardige interactieve blokken zonder duidelijke rangorde.
- Geen zichtbare hoofdnavigatie (zie risico R2).

### 2.3 Kalender & seizoen — `/kalender`
Bewijs: `03_kalender_mobiel.jpg`, `03_kalender_desktop.jpg` · Code: `artifacts/sparki/src/pages/kalender.tsx`.

- Heldere opbouw (Aankomend → Leefagenda → Wedstrijdkalender), eerlijke lege staten, top-anchored "Terug".
- De lege staat "Nog niets gepland" stuurt weg met "Naar Trainen"/"Naar Wedstrijd" in plaats van inline plannen: ≥2 klikken en contextverlies naar het hoofddoel (training in agenda krijgen).
- Wedstrijdkalender-sectie valt op beide viewports (deels) onder de vouw; seizoensoverzicht als geheel vergt scrollen zonder ankernavigatie.

### 2.4 Activiteit & analyse — `/activiteiten`
Bewijs: `04_activiteiten_mobiel.jpg`, `04_activiteiten_desktop.jpg` · Code: `artifacts/sparki/src/pages/activiteiten.tsx` (Journey-link r.257).

- Lege staat is eerlijk en heeft één duidelijke CTA ("Koppeling instellen"). Prima hiërarchie.
- Er is géén zichtbaar pad voor handmatige bestandsupload (GPX/FIT/TCX-import bestaat wél in de Data Hub): een sporter zonder Strava/fietscomputer-koppeling ziet een doodlopend spoor.
- Rit-detail en analyse-weergave: NOT_PROVEN (geen ritdata in dev-omgeving; uitsluitend-lezen dus niet geseed).
- Engelstalig label "Journey" zichtbaar rechtsboven.

### 2.5 Routes — `/routes`
Bewijs: `05_routes_mobiel.jpg`, `05_routes_desktop.jpg` · Code: `artifacts/sparki/src/pages/routes.tsx`; nav-label in `src/lib/chapters.ts` r.96.

- Vijf duidelijke actiekaarten; "Route laten maken" logisch bovenaan; Routebibliotheek eronder (desktop: begint op ≈823px, onder de vouwrand van 900px valt de inhoud).
- Naamgeving inconsistent: route `/routes`, nav-label "Rijden" (chapters.ts), paginatitel "Navigatie-training", en op `/meer` ontbreekt een routes-tegel volledig. Drie namen + één gat voor hetzelfde hoofdstuk.

### 2.6 Functies ontdekken / in gebruik / gearchiveerd — `/meer`
Bewijs: `06_meer_functies_mobiel.jpg`, `06_meer_functies_desktop.jpg` · Code: `artifacts/sparki/src/pages/meer.tsx`.

- `/meer` is het feitelijke ontdek-oppervlak: 12 gelijkwaardige tegels + instellingen + support. Er bestaat **geen** "in gebruik"- of "gearchiveerd"-status of -beheer voor functies → dat deel is afwezig (NOT_PROVEN als bedoeld concept).
- Tegelsubtitels worden op beide viewports afgekapt ("Profiel, instellinge...", "Voeding, herstel, ...", "Jouw gegevens & her..."): ≥3 van 12 tegels.
- Engelstalige labels "Help & support" en "Admin" in een verder Nederlandse omgeving.

### 2.7 Abonnement / upgrade / entitlement — afwezig
- Geen sporterroute, -scherm of -copy gevonden voor abonnement, upgrade of pakketwaarde (routes-inventarisatie in `App.tsx` r.574–691; grep op abonnement/upgrade/entitlement raakt in de frontend alleen de admin-component `entitlements-admin.tsx` en niet-commerciële treffers).
- De entitlementslaag bestaat backend-side + admin-beheer, maar de sporter ziet nergens wat een abonnement waard is, wat hij heeft of wat er te upgraden valt. → **NOT_PROVEN/afwezig** (0 screenshots, conform limiet één poging).

## 3. Dwarsdoorsnede (alle schermen)

- **Kleuren/typografie/spacing:** consequent premium: blauw-zwarte cinematische achtergrond, cyaan accent, Inter, mono-kicker-labels, glas-kaarten. Componentvarianten (kaart, chip, CTA) zijn herkenbaar en consistent over alle 6 schermen. Sterk merk-fundament.
- **Mobiel vs. desktop:** de app rendert op desktop dezelfde `max-w-md`-kolom (≈448px; `screen-shell.tsx` r.270) gecentreerd in 1440px — ±69% van de breedte ongebruikt, identieke informatie-architectuur. Consistent, maar desktop voelt als een opgeblazen telefoon-app; juist analyse/kalender zouden van breedte profiteren.
- **Navigatie:** geen persistente navigatiebalk op welk scherm dan ook; hoofdnavigatie zit achter het menu-icoon. `BottomNav` bestaat (`bottom-nav.tsx`, 5 sporterkeuzes) maar wordt alleen op de crash-fallback gerenderd (`App.tsx` r.431). Diepere pagina's hebben wel een nette top-anchored "Terug".
- **Toestanden:** lege staten zijn overal aanwezig, eerlijk en in stijl (sterk punt). Laad-, fout- en geblokkeerde toestanden: NOT_PROVEN (niet geforceerd binnen uitsluitend-lezen).

## 4. Top-10 geprioriteerde risico's

| # | Prio | Risico | Route | Screenshot | Meting | Codepad |
|---|------|--------|-------|------------|--------|---------|
| R1 | Hoog | Geen enkele abonnements-/upgrade-/waardecommunicatie in de sporteromgeving; de geleverde intelligentie wordt nergens als productwaarde geframed | geen (afwezig) | 06_meer_functies_*.jpg (0 van 12 tegels) | 0 sporterroutes/-strings voor abonnement/upgrade; entitlement-UI alleen admin | `artifacts/sparki/src/components/sparki/entitlements-admin.tsx` (admin-only); routes `App.tsx` r.574–691 |
| R2 | Hoog | Hoofdnavigatie volledig achter menu-icoon; onderbalk alleen op crash-fallback → lage ontdekbaarheid kernfuncties, +1 klik overal | alle | 02_vandaag_mobiel.jpg (geen balk in 844px) | 0 zichtbare nav-items buiten 2 header-iconen op beide viewports | `App.tsx` r.431 (BottomNav alleen in `PageErrorFallback`); `bottom-nav.tsx`; `screen-shell.tsx` header |
| R3 | Hoog | Desktop 1440px = gecentreerde mobiele kolom; analyse-/kalenderoppervlakken krijgen geen ruimte | alle | 02–06 `_desktop.jpg` | contentkolom `max-w-md` ≈448px op 1440px = ±69% ongebruikt | `screen-shell.tsx` r.270 (`max-w-md`) |
| R4 | Hoog | Nieuwe gebruiker zonder koppeling ziet op Activiteiten een doodlopend spoor: geen handmatige upload aangeboden terwijl bestandsimport bestaat | /activiteiten | 04_activiteiten_*.jpg | lege staat bevat 1 CTA (koppeling), 0 verwijzingen naar GPX/FIT/TCX-upload | `pages/activiteiten.tsx` (lege staat); import bestaat server-side (Data Hub provider "file") |
| R5 | Midden | Kalender-lege-staat stuurt weg ("Naar Trainen"/"Naar Wedstrijd") i.p.v. inline plannen — tegen het werkblad-principe | /kalender | 03_kalender_*.jpg | hoofddoel (training in agenda) kost ≥2 klikken + contextwissel | `pages/kalender.tsx` (lege-staat-CTA's) |
| R6 | Midden | Naamgeving routes-hoofdstuk inconsistent: "Rijden" (nav) ≠ "Navigatie-training" (titel) ≠ `/routes` (URL); tegel ontbreekt op /meer | /routes, /meer | 05_routes_*.jpg + 06_meer_functies_*.jpg | 3 verschillende namen; 0 routes-tegel in 12-tegel-grid | `lib/chapters.ts` r.96 ("Rijden"); `pages/routes.tsx` (titel); `pages/meer.tsx` (grid) |
| R7 | Midden | Vandaag toont 2 gelijktijdige vraagblokken; primaire actie ambigu (4 gelijkwaardige blokken) — vraagdruk bij eerste gebruik | /vandaag | 02_vandaag_desktop.jpg | 2 inputverzoeken in eerste viewport (900px); 4 interactieve blokken zonder rangorde | `App.tsx` r.389 (`VandaagPage`); `check-in-chip.tsx`; goal-vraagkaart |
| R8 | Midden | Afgekapte tegelsubtitels op /meer op beide viewports — slordig in eerste betaalde indruk | /meer | 06_meer_functies_*.jpg | ≥3 van 12 subtitels afgekapt op 390px én 1440px | `pages/meer.tsx` (tegel-subtitels, truncatie) |
| R9 | Laag | Onboarding stap 1 zonder voortgang, duur of waardepropositie — commitment zonder vooruitzicht | /_dev/onboarding | 01_onboarding_*.jpg | 0 voortgangselementen; ±90% leeg scherm; 1 CTA | `components/sparki/onboarding-v2.tsx` |
| R10 | Laag | Engelstalige restlabels in Nederlandse sporter-UI: "Journey", "Help & support", "Admin" | /activiteiten, /meer | 04_activiteiten_desktop.jpg, 06_meer_functies_*.jpg | 3 zichtbare Engelse labels op 2 schermen | `pages/activiteiten.tsx` r.257; `pages/meer.tsx` |

**Functies "in gebruik/gearchiveerd":** als concept afwezig (geen scherm, geen status) — bewust geen risico-rang toegekend omdat onbekend is of dit gepland productgedrag is; vastgelegd als NOT_PROVEN in §2.6.

## 5. Blokkades & NOT_PROVEN-register

| Onderdeel | Status | Reden |
|-----------|--------|-------|
| Abonnement/upgrade-scherm | NOT_PROVEN (afwezig) | geen sporterroute; alleen admin-entitlementbeheer |
| Functiestatus "in gebruik/gearchiveerd" | NOT_PROVEN (afwezig) | geen scherm of status gevonden; /meer is puur ontdek-grid |
| Productie-onboarding volledig | NOT_PROVEN (deels) | alleen stap 1 via dev-preview-pad; echte sign-up-flow buiten uitsluitend-lezen-scope |
| Rit-detail & analyse | NOT_PROVEN | geen ritdata in dev-omgeving; seeden zou schrijven zijn |
| Laad-/fout-/geblokkeerde toestanden | NOT_PROVEN | niet geforceerd binnen uitsluitend-lezen |
| Exacte scrollhoogtes | NOT_PROVEN | alleen viewport-screenshots, geen DOM-meting |

## 6. Gemaakte auditbestanden

- `docs/UX_00A_COMMERCIAL_BASELINE.md` (dit rapport)
- `docs/UX_00A_SCREEN_MATRIX.csv` (14 rijen: 6 schermen × 2 viewports + abonnement 2× NOT_PROVEN)
- `docs/UX_00A_EVIDENCE/` — 12 screenshots (≤14): 01_onboarding, 02_vandaag, 03_kalender, 04_activiteiten, 05_routes, 06_meer_functies × mobiel/desktop

Git-status van deze audit: uitsluitend nieuwe bestanden onder `docs/`; `git diff --stat` op gevolgde bestanden is leeg (zie eindrapportage in de taakafronding).
