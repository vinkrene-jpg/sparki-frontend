# Sparki Governor Fase 1 — ChatGPT-reviewpakket

**Eindstatus:** `GOVERNOR_FASE1_INVENTORY_COMPLETE`
**Audit-commit:** `7e2f1983` · **Live publish-commit:** `68df60f9` · **Datum:** 2026-07-29
**Baselineregel nageleefd:** alleen CURRENT_AUDIT_SOURCE; géén approved-baseline.json, géén René-goedgekeurde referenties. Fase is read-only uitgevoerd: geen productcode gewijzigd, niets hersteld, niets gestart (geen fase 2, WP-A06A of WP-A07).

## Verplichte kerncijfers

| Meting | Waarde |
|---|---|
| Actuele commit-SHA | 7e2f1983 |
| Live publish-SHA | 68df60f9 |
| Routes (web) | 41 |
| Schermen | 38 web + 3 rolhomes + 10 mobiel |
| Menu-items | 47 |
| Functies (inventarisregels) | 38 in FUNCTION_INVENTORY.csv (schermniveau; componentniveau in screen-component-inventory.json) |
| Knoppen/links | niet integraal geteld — per scherm vastgelegd in inventory-JSON; volledige klikteling vergt fase-3-crawler met testaccounts (eerlijke beperking) |
| Rollen | 3 in code + admin-boolean (8 vereist) |
| Abonnementen | 3 tiers in code (5 gevraagd in opdracht) |
| Verborgen functies | 3 (/photo-lab, /privacy, /voorwaarden) |
| Verweesde routes | 1 (/photo-lab) |
| Verdwenen menu-items | 0 (na WP-A05-herstel /samen) |
| Master Plan-gaten | 12 (6 MISSING + 6 PARTIAL) |
| Rolafwijkingen | 4 |
| Abonnementsafwijkingen | 3 |
| Visuele/UX-bevindingen | 8 |
| Tekst-/contentbevindingen | 9 |
| Data-/grafiekbevindingen | 8 |
| Screenshots | 470 (8 viewports) |

## Top 20 kritieke tekortkomingen

1. GO vs COMPLETE feature-verdeling conflicteert met Master Plan (coaching onder GO_FEATURE_KEYS) — productbesluit.
2. Club/Team-abonnementen bestaan niet (opdracht ↔ Master Plan-conflict) — productbesluit.
3. 5 van 8 platformrollen ontbreken of zijn gedeeltelijk (hoofdtrainer, clubbeheerder, ploegleider, mechanieker, trainer≠coach).
4. i18n-fundament ontbreekt terwijl Master Plan het NU vereist (copy hard-coded NL, ook in LLM-prompts).
5. Desktop-zijbalk ≠ mobiele onderbalk (Wedstrijd ontbreekt desktop; Meer bestaat niet desktop).
6. /analyse desktop is licht thema — schending dark-theme-contract.
7. /privacy en /voorwaarden alleen via directe URL (juridische vindbaarheid).
8. /photo-lab verweesd (werkend, nergens gelinkt).
9. Gebruikersconfigureerbare navigatie + restore-to-V0 niet gebouwd.
10. Krachttraining (spec ready) niet gebouwd.
11. Trainer-paspoort/campus/search niet gebouwd.
12. TSS/CTL/ATL/TSB/IF zonder uitleg op hoofdschermen (3 vindplaatsen).
13. Y-assen zonder eenheidslabel in ~7 grafieken.
14. Materiaalcoach toont advies bij confidence=unknown.
15. COMPLETE-tier heeft geen eigen feature-verdeling (commercial_tiers uit).
16. Geen testaccounts per rol/abonnement → rol-/abonnementsmatrix niet live verifieerbaar.
17. Geen regressietest voor menu-verversing na rolwissel.
18. Paginatitel "Plan" ≠ menu-label "Trainen".
19. Jeugd-release-scope (release-blocking) niet integraal geverifieerd.
20. Stripe/trial niet live (bewust uitgesteld, wel commercieel blokkerend).

## Top 20 ontbrekend/verdwenen

1–6: i18n-fundament, krachttraining, trainer-paspoort, trainer-campus, trainer-search/onboarding, configureerbare navigatie.
7–11: hoofdtrainer-rol, clubbeheerder-rol, ploegleider-rol, mechanieker-rol, Club-abonnement.
12–14: Team-abonnement, landensites/EU-talen, COMPLETE-featureverdeling.
15–17: live betalen/trial, /photo-lab-ingang, privacy/voorwaarden-ingang.
18: Wedstrijd op desktop-navigatie. 19: knoppen-/linkteling (instrumentatie ontbreekt). 20: rolwissel-regressietest.
(Verdwenen-en-hersteld: /samen — geen openstaande verdwenen items gevonden.)

## René-review vereist (productbesluiten, niet automatisch herstellen)

- GO/COMPLETE-verdeling en prijsbesluit (OD_001/OD_002); Club/Team-abonnement ja/nee.
- Rollenmodel: welke van de 8 rollen echt als platformrol.
- Navigatie: desktop ↔ mobiel harmoniseren; Wedstrijd op desktop; Meer-structuur.
- /photo-lab: ingang geven of bewust archiveren.
- /analyse-thema (dark).
- Privacy/voorwaarden-vindplaats.
- Materiaalcoach-gedrag bij unknown.

## Veilig automatisch herstelbaar (na akkoord, in een latere fase)

- UitlegDots toevoegen op de 3 TE_TECHNISCH-vindplaatsen; Y-as-eenheidslabels; titel "Plan"→"Trainen"; footerlinks privacy/voorwaarden; rolwissel-regressietest toevoegen.

## Bestandsindex

- `governance/` — 7 JSONs (product-contract, role-subscription-matrix, screen-component-inventory, navigation-reachability, content-data-rules, design-rules, current-audit-source).
- `reports/` — 7 MD-rapporten + 4 CSV's + SPARKI_RENE_PRODUCTCOCKPIT.md.
- `artifacts/product-governor/fase1/7e2f1983/` — screenshots/ (470), route-crawl/route-crawl.json, evidence/_capture-log.txt.

## Stopcondities

Geen stopconditie geraakt: geen productiedata gewijzigd, geen destructieve tests, geen betalingen/uitnodigingen, geen secrets in rapportage, geen cross-user-lekkage; bij bronconflicten is CONFLICT_REQUIRES_REVIEW/SOURCE_EVIDENCE_MISSING gebruikt in plaats van gokken.
