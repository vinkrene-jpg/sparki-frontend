# Reviewset 01 — Algemene productstructuur en navigatie

**Bron:** audit-commit `7e2f1983` · fase-1-commit `2a709b5a` · live `68df60f9` · Status: CURRENT_AUDIT_SOURCE (geen goedgekeurde baseline; bij twijfel PENDING_RENE_REVIEW).

## Representatieve screenshots (max 8)
Basis: `artifacts/product-governor/fase1/7e2f1983/screenshots/`
1. `vandaag/390x844/boven.jpg` — mobiel startscherm met onderbalk
2. `vandaag/390x844/menu-open.jpg` — mobiel Meer-menu open
3. `vandaag/1440x900/boven.jpg` — desktop met zijbalk
4. `meer/390x844/fullpage.jpg` — volledige Meer-lijst (11 hoofdstukken + systeem)
5. `train/390x844/boven.jpg` — paginatitel "Plan" onder menu-label "Trainen"
6. `races/1440x900/boven.jpg` — Wedstrijd (ontbreekt in desktop-zijbalk)
7. `privacy/390x844/boven.jpg` — juridische pagina, alleen via URL bereikbaar
8. `feed/390x844/boven.jpg` — Ontdekken (mobiel alleen via tab, desktop direct)

## Hoofdbevindingen (max 10)
1. **PROVEN_PRESENT** — 41 routes, 47 menu-items, alle 36 gecrawlde routes HTTP 200 (deep-link + refresh); 0 verdwenen menu-items (route-crawl.json).
2. **PROVEN_PRESENT** — één ScreenShell/CommercialShell-chrome met auto-Terug; menucontract bewaakt door test:navigation.
3. **REVIEW_NODIG** — desktop-zijbalk (7 items) ≠ mobiele onderbalk (5 tabs + Meer): Wedstrijd ontbreekt desktop, Meer bestaat niet desktop, Ontdekken zit mobiel anders. Geen pixelgelijkheid vereist; de vraag is of dit een LOGISCHE_APPARAATVARIANT is of ONLOGISCHE_NAVIGATIE. Deelclassificatie: Wedstrijd desktop-afwezig = **KERNFUNCTIE_ONTBREEKT** (kernbestemming onvindbaar op desktop), rest = REVIEW_NODIG.
4. **PROVEN_HIDDEN** — /photo-lab werkt maar heeft nergens een ingang (verweesd).
5. **PROVEN_HIDDEN** — /privacy en /voorwaarden alleen via directe URL; juridische vindbaarheid.
6. **PROVEN_CONTENT_PROBLEM** — paginatitel "Plan" ≠ menu-label "Trainen" (verwarrend, licht).
7. **PROVEN_MISSING** — gebruikersconfigureerbare navigatie + restore-to-V0 (Master Plan) niet gebouwd.
8. **PROVEN_PRESENT** — bereikbaarheid: 8 routes direct, 15 in 1 stap, 7 in 2 stappen; Meer-lijst lang maar gegroepeerd.
9. **CHATGPT_PRODUCT_REVIEW_REQUIRED** — is de 11-hoofdstukkenindeling (Beleven→Ontdekken→Begrijpen→Verbeteren) de juiste kapstok voor 8 rollen straks? Structuurvraag vóór rollenbouw.
10. **EVIDENCE_INSUFFICIENT** — integrale knoppen-/linkteling ontbreekt (vergt fase-3-crawler met testaccounts).

## Automatische herstelkandidaten (max 5)
1. Menu-ingang voor /photo-lab (Meer-lijst) — AUTOMATIC_REPAIR_CANDIDATE.
2. Footer-/Meer-links naar /privacy en /voorwaarden — AUTOMATIC_REPAIR_CANDIDATE.
3. Paginatitel "Plan" → "Trainen" gelijktrekken — AUTOMATIC_REPAIR_CANDIDATE.
4. Wedstrijd toevoegen aan desktop-zijbalk — veilig, maar ná besluit navigatie-eindmodel.
5. Regressietest menu-verversing na rolwissel — AUTOMATIC_REPAIR_CANDIDATE (testwerk, geen productgedrag).

## Echte René-besluiten (max 3)
1. **Navigatie-eindmodel desktop + mobiel** → `rene-decisions/besluit-02-navigatie-eindmodel.md`.
2. **Totale visuele richting** (raakt shell/chrome overal) → `rene-decisions/besluit-01-visuele-eindrichting.md`.
3. — (geen derde; hoofdstukkenindeling gaat eerst naar ChatGPT.)
