# DASHBOARD_01 Fase A — sporter-Dashboard: VOOR / NA (402×874)

Schermbewijs voor de hernoeming `Vandaag → Dashboard` en de drie-lagen-
opzet van het sporter-Dashboard. Vastgelegd op telefoonformaat (402×874) via
de e2e-harness (`e2e/tests/dashboard-sporter.mjs`), tegen de productiebuild.

- **VOOR**: build vóór DASHBOARD_01 (bottom-nav en kop heten nog "Vandaag").
- **NA**: deze wijziging (kop en bottom-nav heten "Dashboard"; `/dashboard`
  is de route, `/vandaag` blijft als doorverwijzing).
- Basisrepo: `df9fcb1d`.

## Wat de screenshots aantonen

| # | VOOR | NA | Bewijs |
|---|------|----|--------|
| 01 | `…-01-dashboard-fold.png` | idem | **Kop + bottom-nav: "Vandaag" → "Dashboard"** (DSH-01/02). Home-icoon actief op positie 1. |
| 02–03 | `…-scroll-1/2.png` | idem | Scrolldiepte: het scherm past binnen één vouw (schermen=1.0). |
| 04 (NA) | — | `…-04-vandaag-redirect.png` | `/vandaag?focus=nutrition` blijft bereikbaar (doorverwijzing). |
| 04/05 | `…-analyse-fold.png` | `…-05-analyse-fold.png` | Diepere analyse als **doorklik** op `/dashboard/analyse` (eigen scherm). |

De VOOR- en NA-fold verschillen op precies één punt: de schermnaam
("Vandaag" → "Dashboard") in de kop én de onderbalk. Alle overige layout is
gelijk, waardoor het before/after-verschil de hernoeming isoleert.

## Eerlijke beperkingen (geen verhulling)

1. **Geen api-server tijdens vastlegging.** De harness verwacht een draaiende
   api-server op `127.0.0.1:80`; die draaide niet (alle `/api/*` gaven 502).
   Daardoor tonen de kaarten hun **eerlijke foutstaat** ("Je toestand kon niet
   worden geladen · Opnieuw proberen") in plaats van echte State-Engine-data.
   Gevolg: de screenshots bewijzen wél de hernoeming, de navigatie en de
   fold-structuur, maar **niet** de inhoudelijke drie lagen met echte data.
   Om authentiek databewijs te maken moet de api-server draaien; dat valt
   buiten de opdracht van deze subagent (workflows starten/herstarten mag niet).
   Herhalen mét api-server: `DASH_SHOT_DIR=na node e2e/tests/dashboard-sporter.mjs`.

2. **Actief account ziet CommercialToday, niet StateDayHome.** De feature-flag
   `commercial_shell` staat globaal aan (100% rollout). Een sporter landt
   daardoor op de commerciële Dashboard-weergave (`CommercialToday`), niet op
   de drie-lagen `StateDayHome`/`DayHome`. De drie-lagen-code (L1 StateCard /
   L2 Momentblok / L3 risico's & kansen) is aanwezig en wordt gerenderd zodra
   `commercial_shell` uit staat, maar is met de huidige flag niet het scherm
   dat het QA-account te zien krijgt. Het before/after-bewijs betreft dus de
   CommercialToday-oppervlakte onder de nieuwe naam.

3. **`/vandaag`-doorverwijzing niet live geverifieerd.** Zonder api-server
   bleef de auth/profiel-laadstaat hangen, waardoor de client-side redirect
   (`VandaagRedirect` → `/dashboard` met behoud van querystring) niet
   betrouwbaar kon worden vastgelegd. De route en redirect zijn wél aanwezig in
   de productiebuild (geverifieerd in `dist/public/assets`), en `/vandaag`
   blijft een bestaande route (geen dode link). Live-verificatie van de
   redirect vereist een draaiende api-server.

## Reproductie

```bash
# Productiebuild
cd artifacts/sparki && PORT=5000 BASE_PATH=/ pnpm run build

# api-server moet draaien op 127.0.0.1:80 (buiten deze subagent-scope)

# NA (deze build)
DASH_SHOT_DIR=na node e2e/tests/dashboard-sporter.mjs

# VOOR (oude build): stash de wijziging, herbouw, en:
DASH_SHOT_DIR=voor DASH_PATH=/vandaag node e2e/tests/dashboard-sporter.mjs
```
