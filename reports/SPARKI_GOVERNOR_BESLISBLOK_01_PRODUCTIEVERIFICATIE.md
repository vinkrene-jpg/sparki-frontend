# SPARKI GOVERNOR BESLISBLOK 01 — PRODUCTIEVERIFICATIE

**Datum:** 29 juli 2026
**Productie-URL:** https://sparki-frontend.replit.app
**Eindstatus:** **VERIFIED_IN_PRODUCTION**

## Publicatie

- Eerdere publicaties faalden 2× op "image size is over the limit of 8 GiB".
  - Oorzaak 1 (opgelost 29-07 ochtend): volgelopen `.git` (7,2 GB → 519 MB).
  - Oorzaak 2 (opgelost 29-07 middag): werkmap-ballast in het deploy-image — `artifacts/api-server/dist-tests` (1,3 GB testbundels), `.cache` (732 MB), `exports` (446 MB), `attached_assets` (207 MB). Fix: `.replitignore` uitgebreid (commit `b2bb272e`).
- Geslaagde build: `b33208fa` (14:47–14:55 UTC), publish-commit `f320ddf1` (bevat Beslisblok 01-commit `bc2ed37c`).

## De 10 nacontroles

Bewijsmethode conform publicatiecontrole-doctrine: HTTP-checks + grep van de **live** productiebundle (`assets/index-C9qFXOcD.js`, opgehaald via curl) + screenshot van de live site. Ingelogde schermen zijn niet met een productie-login doorlopen (eerlijk beperkt); voor die punten geldt bundle-bewijs.

| # | Controle | Resultaat | Bewijs |
|---|----------|-----------|--------|
| 1 | Actieve live build | ✅ | Build `b33208fa` success; live bundle bevat alle Beslisblok 01-strings (zie 4–9) |
| 2 | Homepage bereikbaar | ✅ | HTTP 200 + screenshot: landingspagina rendert ("Sparki Performance Center", Get started free / Sign in) |
| 3 | `/api/healthz` | ✅ | HTTP 200, `{"status":"ok"}` |
| 4 | "Plan" → "Trainen" | ✅ | `"Trainen"` 2× in live bundle (nav-label + paginatitel) |
| 5 | Privacy/Voorwaarden/Photo Lab via Meer | ✅ | `"/privacy"`, `"/voorwaarden"`, `"/photo-lab"` + groep "Beheer, instellingen" in live bundle |
| 6 | Wedstrijd + Meer in desktop-zijbalk | ✅ | `/races` (9×) en `/meer` (4×) in live bundle |
| 7 | Uitlegstipjes TSS/CTL/ATL/TSB/IF/NP | ✅ | uitleg-keys `intensiteitsfactor` (2×) en `genormaliseerd_vermogen` (3×) in live bundle |
| 8 | Grafiek-eenheden als labels | ✅ | `punten` (7×), `W/kg` (5×) in live bundle; waarden ongewijzigd (geen rekencode geraakt) |
| 9 | Materiaalcoach: geen stellig advies bij "Niet te beoordelen" | ✅ | eerlijke vervangtekst ("Sparki kan dit op basis van deze foto('s) niet beoordelen…") 1× in live bundle |
| 10 | Geen dev-sporen / juiste sleutels / geen regressies | ✅ | `_dev/` 0×, `DevPreview` 0×; `pk_live_` aanwezig (2×, indicator live-Clerk); homepage rendert normaal desktop-breed |

## Eerlijke beperkingen

- Ingelogde schermen (Trainen-pagina, Meer-menu, grafieken, materiaalcoach-flow) zijn geverifieerd via de live productiebundle, niet via een echte productie-login. De bundle-grep is per doctrine sluitend bewijs dat de code live staat; visueel gedrag achter login is in dev al met screenshots vastgesteld (zie `reports/SPARKI_GOVERNOR_SAFE_FIXES_01.md`).
- Eerste screenshot toonde alleen het laadscherm ("Sparki wordt geladen…") — clerk-js laadde nog; tweede poging toonde de volledige landingspagina. Geen black-screen-regressie.

## Vervolg

Geen automatische vervolgstappen gestart; regie ligt bij René.
