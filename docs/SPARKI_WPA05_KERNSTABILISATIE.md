# SPARKI — WP-A05: Kernstabilisatie Vandaag, Plan, Analyse, Routes, Navigatie, Kalender en Shell

**Uitgevoerd:** 29 juli 2026. **Basis:** `main` @ `14ec3743` (WP-A01 t/m A04 VERIFIED_FOR_R1). Werkwijze conform opdracht: eerst read-only inventarisatie (vier onafhankelijke code-verkenningen + eigen verificatie van elk vermoeden), daarna uitsluitend gericht herstel van aantoonbare defecten. **Geen nieuwe features, geen tweede engine, geen architectuurwijziging.**

## 1. Inventarisatie (Fase 1)

Per module zijn pagina's, componenten, endpoints, databronnen, flags, fout-/lege toestanden en tests in kaart gebracht; elk verkennersvermoeden is daarna zelf in de code geverifieerd (drie vermoedens bleken géén defect — F09/F10/F12 in de CSV). Volledige classificatie: `docs/SPARKI_WPA05_DEFECTEN_EN_REGRESSIES.csv`.

**Totaal 18 bevindingen:** 7× FUNCTIONEEL_DEFECT (alle 7 hersteld) · 7× WERKT_EN_BEWEZEN · 1× WERKT_MAAR_NIET_VOLDOENDE_GETEST · 1× VERBETERIDEE_BUITEN_SCOPE · 1× VERVALLEN_OF_DUBBEL · 0× VISUELE_REGRESSIE · 0× RESPONSIVE_DEFECT · 0× DATA_OF_RECHTENRISICO.

## 2. Herstelde defecten (Fase 8)

1. **UTC-datumval (5 plekken, F01–F05).** Kalender (2×), planvenster-hook, sportpaspoort, club en geboortedatum-invoer bepaalden "vandaag" via `toISOString()` (UTC-dag). Tussen middernacht en ~02:00 NL-tijd filterde dat een dag verkeerd (bv. trainingen van vandaag verdwenen uit de kalender). Alle vijf vervangen door de bestaande, geteste `localISODate()`-helper — geen nieuwe logica.
2. **/samen uit het Meer-menu verdwenen (F06).** Regressie: het navigatiecontract (test) eist dat Samen vanuit Meer bereikbaar is; op de 5-tab-shell was Samen daardoor onbereikbaar geworden. Hoofdstuk teruggezet; `test:navigation` weer groen.
3. **routes-tabs-test kapot op nieuw import-oppervlak (F07).** `routes.tsx` kreeg een `RouteLibrarySection`-import die leaflet.css de node-test introk. Mock aangevuld (conform bestaande testdoctrine "mocks dekken het volledige import-oppervlak"); `test:routes-tabs` weer groen.

Beide testfouten bestonden al vóór deze ronde (onafhankelijk van de datumfixes) en zijn dus opgeloste regressies uit eerdere merges.

## 3. Bewust buiten scope gelaten

- **F13** — mobiele navigatie bij wegvallende locatiepermissie toont een melding maar pauzeert de engine niet expliciet; gedragswijziging = nieuwbouw, genoteerd.
- **F14** — GPX-exportbestandsnaam gebruikt de UTC-datum (alleen cosmetisch, inhoud correct).
- **F08** — `DS_NAV_STANDAARD`-default in het DS-primitief wijkt af van de commerciële nav, maar wordt nergens zonder expliciete items gebruikt (alleen DS-tests).

## 4. Testresultaten (Fase 6/TESTS)

| Poort | Resultaat |
|---|---|
| Typecheck web / mobiel / API (incl. libs) | groen |
| Serverbuild (esbuild) + productiebuild web (vite) | groen |
| Unit/regressie web: commercial-shell, core-plan, core-plan-page, aandachtswet, navigation, routes-tabs, design-system, nav-live, performance-radar, day-type, onboarding-resume, commercial-today, core-meer | 13/13 groen (navigation + routes-tabs eerst rood → hersteld → groen) |
| Accountisolatie + rollen (deze sessie, zelfde basis): cross-account, club, coach/ouder ×5, links ×2, health-endpoints | groen (WP-A04-ronde) |
| Mobiel: ride-tracker-suite + typecheck | groen |
| E2E-smoke/visuele ronde | screenshots Vandaag (1440×900 + 320×568), Kalender (390×844), Plan (768×1024), Analyse (375×667), Routes (430×932) — geen responsive defect, bottom-nav overal vrij van inhoud, witte Analyse-kaartstijl en donkere shell correct, eerlijke lege FTP-kaart |
| Lege-account/API-fout-gedrag | via bestaande eerlijke lege-/fouttoestanden (F16) + WP-A03-fixes, regressievrij |
| Browser-refresh/deep-links | routes ?view=-tabnavigatie getest (routes-tabs-suite); ScreenShell auto-Terug aanwezig op niet-nav-root pagina's |

## 5. Gewijzigde bestanden

- `artifacts/sparki/src/pages/kalender.tsx` (2× localISODate)
- `artifacts/sparki/src/hooks/use-training-plan.ts` (dateStr → localISODate)
- `artifacts/sparki/src/pages/paspoort.tsx`, `src/pages/club.tsx`, `src/components/sparki/profile-settings.tsx` (localISODate)
- `artifacts/sparki/src/lib/chapters.ts` (/samen terug in Meer)
- `artifacts/sparki/src/pages/routes-tabs.test.tsx` (mock nieuw import-oppervlak)

## 6. Stopcondities & blokkades

Geen enkele stopconditie geraakt: geen datalek, rechtenlek, dataverlies, tweede engine of herschrijving nodig; beide rode tests na één gerichte herstelpoging groen. **Resterende blokkades: geen.**

## 7. Publicatie

**Publicatie nodig: ja** — de kalender-/planvenster-datumfixes en het herstelde Meer-menu zitten in de webbundel (samen met de nog openstaande WP-A03-webfix).

## 8. Publicatie-uitkomst (aanvulling 29 juli 2026)

Gepubliceerd via publish-commit `68df60f9` naar https://sparki-frontend.replit.app; productieverificatie in `docs/SPARKI_WPA05_PRODUCTIEVERIFICATIE.md` → **VERIFIED_IN_PRODUCTION**.

## EINDSTATUS: **VERIFIED_FOR_R1**

WP-A06A/WP-A07 zijn conform de opdracht niet gestart; rapport en commit-SHA eerst terug naar René/ChatGPT.
