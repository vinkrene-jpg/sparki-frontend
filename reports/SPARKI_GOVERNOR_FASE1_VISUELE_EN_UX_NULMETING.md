# Sparki Governor Fase 1 — Visuele en UX-nulmeting

**Audit-commit:** `7e2f1983` · Status: HUIDIGE_STAAT_NIET_GOEDGEKEURD (nulmeting, geen referentie)
**Bewijs:** 470 screenshots in `artifacts/product-governor/fase1/7e2f1983/screenshots/` (12 kernschermen × 8 viewports × boven/midden/onder/full-page/menu-open; 16 overige schermen × 2 viewports). Capture-log: `evidence/_capture-log.txt`.

## Viewports

320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1440×900, 1920×1080 — alle gedraaid.

## Bevindingen per classificatie

| # | Scherm | Viewport | Classificatie | Bevinding |
|---|---|---|---|---|
| V-01 | /analyse | desktop (1440×900, 1920×1080) | INCONSISTENTE_COMPONENTEN + RENE_REVIEW_NODIG | Analyse gebruikt een licht thema (witte kaarten/achtergrond) terwijl de hele app donker is; Master Plan schrijft dark theme verplicht voor. |
| V-02 | navigatie | desktop vs mobiel | RENE_REVIEW_NODIG | Desktop-zijbalk (Vandaag/Plan/Rijden/Activiteiten/Analyse/Ontdekken) ≠ mobiele onderbalk (Vandaag/Plan/Rijden/Analyse/Meer); Wedstrijd ontbreekt op desktop, Ontdekken niet direct op mobiel. |
| V-03 | /train | 320×568 | VISUEEL_GOED_GENOEG_VOOR_VERDERE_REVIEW | Doelkaart leesbaar op kleinste viewport; titel "Plan" wijkt af van menu-label "Trainen" (naamconsistentie → contentbevinding C-05). |
| V-04 | /vandaag | 390×844 | VISUEEL_GOED_GENOEG_VOOR_VERDERE_REVIEW | Eén leidend momentblok, duidelijke hiërarchie; logo overlapt DEV-badge licht (alleen dev-badge, prod n.v.t.). |
| V-05 | /meer | 390×844 | VISUEEL_GOED_GENOEG_VOOR_VERDERE_REVIEW | Duidelijke groepen; lange lijst (>2 schermhoogtes) — acceptabel voor een menupagina. |
| V-06 | /routes | 1440×900 | VISUEEL_GOED_GENOEG_VOOR_VERDERE_REVIEW | Kaart + acties boven de vouw; leverancierstekst over Garmin/Wahoo-goedkeuring is eerlijk. |
| V-07 | lange pagina's (analyse, activiteiten, you) | mobiel | BELANGRIJKE_INFO_VERSTOPT (risico) | Paginahoogtes tot >4 schermhoogtes op 320-390px; kernconclusies staan boven, maar detailgrafieken vergen veel scrollen. Volledige beoordeling per sectie = fase 3. |
| V-08 | alle | alle | HUIDIGE_STAAT_NIET_GOEDGEKEURD | Vaste eindmarkering van deze nulmeting: niets in deze set is een goedgekeurde referentie. |

## Beperkingen (eerlijk)

- Menu-open-screenshots zijn gemaakt op mobiele viewports (<1024px) via de Meer-knop; desktop-menu is een permanente zijbalk (geen aparte open-toestand).
- Rol- en abonnementsvarianten konden niet gecaptured worden (geen testaccounts; dev-Clerk). Dit hoort bij fase 3.
- Screenshots tonen de dev-omgeving (DEV-badge, dev-data van René's account). De live build is byte-vergelijkbaar op pk-sleutel na (zie WP-A05-productieverificatie).
