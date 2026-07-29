# SPARKI — Governor veilige fixes 01 (uitvoeringsverslag)

Datum: 2026-07-29 · Pakket: Governor Beslisblok 01 · Scope: uitsluitend de 9 goedgekeurde veilige fixes.

## Uitgevoerde fixes

| # | Fix | Bestanden | Resultaat |
|---|-----|-----------|-----------|
| 1 | Paginatitel "Plan" → "Trainen" op /train | `src/pages/core-plan.tsx`, `src/lib/commercial-shell.ts` (mobiel nav-label gelijkgetrokken) | Titel en nav zeggen nu allebei "Trainen" (screenshot `train-mobiel.jpg`). |
| 2 | Privacy + Voorwaarden bereikbaar via Meer | `src/lib/core-meer.ts` (groep "Beheer, instellingen & privacy" nu altijd aanwezig, ook voor coach/ouder), `src/pages/meer.tsx` (legacy-footer) | Zichtbaar onderaan Meer (screenshot `meer-mobiel-onder.jpg`). |
| 3 | Photo Lab-ingang (geen hoofdonderdeel) | `src/lib/core-meer.ts` (rij onder "Sport & materiaal"), `src/pages/meer.tsx` | Bescheiden rij in Meer. |
| 4 | UitlegDot bij TSS/CTL/ATL/TSB/IF/NP zonder context | `src/components/sparki/training-day-home.tsx` (IF, NP, TSS, CTL-kop, CTL/ATL/TSB-regel), `src/pages/train.tsx` (TSS/NP-chips), `src/pages/core-analyse.tsx` (TSS-tabelkop, CTL- en TSB-cellen) + 2 nieuwe registry-keys `intensiteitsfactor` en `genormaliseerd_vermogen` in `src/lib/uitleg-content.ts` | Elke vakterm heeft nu een uitleg-stipje uit het centrale register. |
| 5 | Eenheden op grafiek-Y-assen | `src/pages/core-analyse.tsx` (belastingsverloop + vorm: "punten"; weekvolume: "uren"; gewicht: "kg"/"W/kg"; FTP: "watt"), `src/components/viz/stream-chart.tsx` (dynamische eenheid W/bpm/opm/km/u/°C; hoogte: "m") | Alleen aslabels toegevoegd — tickwaarden, domeinen en datasets zijn byte-identiek gebleven (geen datalogica geraakt). |
| 6 | Materiaalcoach: geen stellig advies bij confidence=unknown | Nieuw `src/lib/material-advice.ts` (pure regel, fail-closed bij ontbrekende confidence) + `src/components/sparki/material-coach.tsx` (samenvatting, voor-/nadelen, risico's, alternatieven en kosten verborgen; eerlijke melding + extra-foto-vraag ervoor in de plaats) | Testbestand `src/lib/material-advice.test.ts` (4 tests, groen). |
| 7 | Regressietest menuverversing na rolwissel | `src/lib/navigation.test.ts` (+2 tests: nav-data verschilt per rol; BottomNav/MainMenu leiden items af uit `profile.activeRole` in de render) | Groen (10 tests). |
| 8 | Wedstrijd in desktop-kernnavigatie | `src/lib/commercial-shell.ts` (`COMMERCIAL_DESKTOP_NAV` + `/races`) | Zichtbaar in zijbalk (screenshot `vandaag-desktop.jpg`). |
| 9 | Desktop Meer-equivalent | `src/lib/commercial-shell.ts` (`/meer` in desktopnav — zelfde inhoud als mobiel Meer-overzicht, geen kopie van de onderbalk) + commentaar-update `commercial-shell.tsx` | Zichtbaar in zijbalk. |

Bijgewerkte tests (bestaand): `src/lib/commercial-shell.test.ts`, `src/lib/core-meer.test.ts`, `src/components/sparki/commercial-today.test.tsx`.

## Testresultaten (alle groen)

- Typecheck web (`tsc --noEmit` @workspace/sparki): OK
- Typecheck mobiel (@workspace/sparki-mobile): OK
- Typecheck API + libs (`typecheck:libs` + api-server `typecheck`): OK
- Web-productiebuild (vite build): OK (16,7s)
- Serverbuild api-server (esbuild): OK
- `navigation.test.ts`: 10/10 (incl. nieuwe rolwisseltests)
- `core-meer.test.ts`: 10/10
- `commercial-shell.test.ts`: alle scenario's OK
- `commercial-today.test.tsx`: 6/6
- `material-advice.test.ts`: 4/4 (nieuw)
- Grafiekwaarden vóór/na: identiek — er zijn uitsluitend aslabels (`label`-prop) toegevoegd, geen domain-, tick- of databerekeningen gewijzigd.
- Deep-link/refresh: alle screenshots zijn koude directe URL-loads (/train, /meer, /vandaag, /analyse) — geen crash, navigatie intact.
- Responsive: gecontroleerd op 390×844 (mobiel) en 1440×900 (desktop); zijbalk toont Wedstrijd + Meer, onderbalk toont Trainen.

## Screenshots

`artifacts/product-governor/beslisblok-01/`:
- `train-mobiel.jpg` — titel "Trainen" + onderbalk "Trainen"
- `meer-mobiel.jpg` / `meer-mobiel-onder.jpg` — Photo Lab-rij + Privacy/Voorwaarden-groep
- `vandaag-desktop.jpg` — zijbalk met Wedstrijd en Meer
- `analyse-desktop.jpg` — Y-assen met "punten"-labels

## Buiten scope gebleven (bevestigd)

Geen restyling, geen entitlements-wijzigingen, geen rolwerkruimtes, geen prijzen/Stripe, geen data- of schemawijzigingen, geen approved baseline, geen fase 2-werk.
