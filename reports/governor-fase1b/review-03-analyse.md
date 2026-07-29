# Reviewset 03 — Analyse, herstel, doelen en databegrip

**Bron:** audit-commit `7e2f1983` · Status: CURRENT_AUDIT_SOURCE (PENDING_RENE_REVIEW bij twijfel).

## Representatieve screenshots (max 8)
Basis: `artifacts/product-governor/fase1/7e2f1983/screenshots/`
1. `analyse/390x844/boven.jpg` — Analyse mobiel (donker)
2. `analyse/1440x900/boven.jpg` — Analyse desktop (licht — afwijkend van andere schermen)
3. `analyse/1920x1080/boven.jpg` — idem groot scherm
4. `analyse/390x844/fullpage.jpg` — scrolldiepte
5. `you/390x844/boven.jpg` — Jij/Core-profiel
6. `lichaam/390x844/boven.jpg` — herstel/gezondheid
7. `you/390x844/fullpage.jpg` — lenzen + evolutie
8. `kennis/390x844/boven.jpg` — kennis/uitleg-omgeving

## Hoofdbevindingen (max 10)
1. **PROVEN_PRESENT** — één belastingsmodel (centrale load-serie) voedt /analyse én /you; Gratis/Go/Compleet delen daarmee feitelijk één Analyse-architectuur — conform de vaste productregel.
2. **PROVEN_PRESENT** — herstel-/gezondheidsflow met raises-only status en resume-gate; doelen-engine met dedupe; readiness uit één bron.
3. **INCONSISTENTE_COMPONENTEN (feitelijk)** — /analyse gebruikt op desktop (1440/1920) een licht thema terwijl vrijwel alle andere schermen donker zijn (V-01). Dit is een **afwijking tussen schermen**; welke richting juist is = besluit-01 (totale visuele richting). Geen "moet donker"-conclusie.
4. **PROVEN_DATA_PRESENTATION_PROBLEM** — ~7 Recharts-grafieken zonder eenheidslabel op de Y-as (D-01).
5. **PROVEN_CONTENT_PROBLEM** — core-analyse-tabelheaders zonder directe uitleg (C-03); botst met "taalniveau bepaalt terminologie".
6. **PROVEN_PRESENT** — eerlijkheidsregels aantoonbaar: radar-assen zonder data zijn null+reden (nooit 0.5), Tanaka-maxHR gemarkeerd als schatting, FTP alleen als eerlijke ondergrens afgeleid.
7. **PROVEN_PRESENT** — uitleglaag (UitlegDot + registry, kort-standaard/Uitgebreid) bestaat, maar dekt de hoofdmetrics op 3 vindplaatsen niet (zie reviewset 02 + hier C-03).
8. **REVIEW_NODIG** — /you en /analyse tonen deels overlappende kerngrafieken; presentatie-dedup bestaat, maar of de verdeling Jij↔Analyse de juiste is, is een productoordeel (ChatGPT eerst).
9. **PROVEN_DATA_PRESENTATION_PROBLEM** — mobiele analyse >4 schermhoogtes (V-07-risico).
10. **EVIDENCE_INSUFFICIENT** — diepteverschillen per abonnement in Analyse niet live getest (geen tier-testaccounts); statisch: alleen performance_lab zit achter GO.

## Automatische herstelkandidaten (max 5)
1. Y-as-eenheidslabels toevoegen aan de ~7 grafieken — AUTOMATIC_REPAIR_CANDIDATE.
2. UitlegDot op core-analyse-tabelheaders — AUTOMATIC_REPAIR_CANDIDATE.
3. Sectienavigatie/inklappen op lange analyse-pagina's — na ChatGPT-review.
4. — 5. —

## Echte René-besluiten (max 3)
1. **Totale visuele richting** (licht/donker/instelbaar; /analyse-desktop is de zichtbaarste inconsistentie) → `rene-decisions/besluit-01-visuele-eindrichting.md`.
