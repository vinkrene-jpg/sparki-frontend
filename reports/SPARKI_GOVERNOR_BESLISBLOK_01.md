# SPARKI — GOVERNOR BESLISBLOK 01 (opleveringsrapport)

Datum: 2026-07-29 · Status: **GOVERNOR_DECISION_BLOCK_01_APPLIED**

## 1. Geregistreerde besluiten (RENE_APPROVED_PATTERN)

Vastgelegd in `governance/rene-approved-references.json` en `reports/SPARKI_RENE_REFERENCE_LIBRARY.md` (goedkeurder René, datum 2026-07-29, bron-commits 7e2f1983 + 4e37204c, per besluit: wat bindend is, wat géén pixelreferentie is, toegestane variatie en Master Plan-koppeling):

1. **REF-NAV-01** — apparaat-eigen navigatie met gegarandeerde kernset (Wedstrijd desktop bereikbaar, desktop Meer-equivalent, configureerbare navigatie later).
2. **REF-VIS-01** — LICHT_RUSTIG_STRAK_SPORTIEF als eindrichting; géén restyling in dit pakket; migratie later via apart gefaseerd plan.
3. **REF-ABO-01** — gedeelde functies met oplopende diepte (Gratis/Go/Compleet); veiligheid, privacy, export en opzeggen altijd gratis; prijzen + Stripe aparte beslispoort; nu geen entitlements omgebouwd.
4. **REF-ROL-01** — bouwvolgorde rollen: trainer/hoofdtrainer → clubbeheerder + ouder/jeugd → ploegleider → mechanieker → admin consolideren.

De huidige schermen blijven app-breed **CURRENT_STATE_NOT_APPROVED**; er is géén approved baseline gezet.

## 2. Uitgevoerde veilige fixes (9/9)

Volledig verslag incl. bestanden en testmatrix: `reports/SPARKI_GOVERNOR_SAFE_FIXES_01.md`. Samengevat:

1. /train heet nu overal "Trainen" (titel + nav-label).
2. Privacy en Voorwaarden staan in het Meer-overzicht (alle rollen, ook legacy-Meer).
3. Photo Lab heeft een bescheiden ingang onder Meer → Sport & materiaal.
4. UitlegDot toegevoegd bij TSS/CTL/ATL/TSB/IF/NP op de fase-1-vindplaatsen (+2 nieuwe uitleg-keys in het centrale register).
5. Eenheden op de 8 vastgestelde grafiek-Y-assen (punten/uren/kg/W-kg/watt/dynamisch/m) — alleen labels, waarden identiek.
6. Materiaalcoach verbergt stellig advies bij "Niet te beoordelen" en vraagt eerlijk om een extra foto (pure regel + tests).
7. Regressietest menuverversing na rolwissel toegevoegd aan het navigatiecontract.
8. Wedstrijd staat in de desktop-kernnavigatie.
9. Desktop heeft een Meer-equivalent in de zijbalk (zelfde inhoud als mobiel Meer, geen onderbalk-kopie).

## 3. Testresultaten

Alles groen: typechecks web/mobiel/API+libs, web-productiebuild, api-serverbuild, navigatiecontract (10 tests), core-meer (10), commercial-shell, commercial-today (6), materiaalcoach-unknown (4, nieuw). Grafiekwaarden vóór/na identiek; deep-link/refresh gecontroleerd via koude URL-loads; responsive gecontroleerd op 390×844 en 1440×900. Geen data-, rol- of abonnementswijzigingen buiten scope.

## 4. Screenshots

`artifacts/product-governor/beslisblok-01/` — train-mobiel, meer-mobiel(-onder), vandaag-desktop, analyse-desktop.

## 5. Commit & publicatie

- Commit-SHA: zie git-log op main (dit rapport is onderdeel van dezelfde commit; SHA vermeld in de chat-oplevering).
- **Publicatie nodig: ja** — de fixes zitten alleen in de ontwikkelomgeving; de live-app (https://sparki-frontend.replit.app) toont ze pas na een nieuwe publish. Publicatie is níét automatisch gestart (conform pakketregels).

## 6. Open punten

- Configureerbare navigatie: latere fase (REF-NAV-01).
- Visueel migratieplan LICHT_RUSTIG_STRAK_SPORTIEF: nog op te stellen, eigen beslispoort (REF-VIS-01).
- Prijzen + Stripe-activatie: aparte beslispoort (REF-ABO-01; bestaande taak "Stripe-testsleutels" blijft wachten op akkoord).
- Rolwerkruimte-fase 1 (trainer/hoofdtrainer): wacht op start-akkoord (REF-ROL-01).
- Geautomatiseerde ingelogde prod-validatie blijft beperkt (dev-Clerk) — eerder gemelde eerlijke beperking.

**Niets is automatisch gestart na deze oplevering; regie terug naar ChatGPT/René.**
