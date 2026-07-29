# Reviewset 02 — Sporter: Vandaag, Trainen, Kalender en Activiteiten

**Bron:** audit-commit `7e2f1983` · Status: CURRENT_AUDIT_SOURCE (PENDING_RENE_REVIEW bij twijfel).

## Representatieve screenshots (max 8)
Basis: `artifacts/product-governor/fase1/7e2f1983/screenshots/`
1. `vandaag/390x844/boven.jpg` — één leidend Momentblok (aandachtswet)
2. `vandaag/390x844/fullpage.jpg` — volledige Vandaag-opbouw
3. `train/390x844/boven.jpg` — doelkaart Trainen
4. `train/320x568/boven.jpg` — kleinste viewport, leesbaar
5. `kalender/390x844/boven.jpg` — kalender
6. `activiteiten/390x844/boven.jpg` — activiteitenlijst
7. `activiteiten/390x844/fullpage.jpg` — lengte/scrolldiepte
8. `train/1440x900/boven.jpg` — desktopvariant Trainen

## Hoofdbevindingen (max 10)
1. **PROVEN_PRESENT** — Vandaag met dagtype-detectie, één leidend momentblok, weer, coach-analyse; hiërarchie helder (V-04).
2. **PROVEN_PRESENT** — Trainen met vier-lagenopbouw (bron/doel/vandaag/patronen), plan-lifecycle, feedback-lus; doelkaart leesbaar tot 320px (V-03).
3. **PROVEN_PRESENT** — Kalender, activiteiten met maandgroepering/zoek/filters, sessiegrafieken en power-bests (alleen bij ingest-data, eerlijk leeg bij oude sessies).
4. **PROVEN_CONTENT_PROBLEM** — IF/CTL/ATL/TSB zonder UitlegDot op training-day-home (C-01) en TSS/NP op train (C-02); botst met regel "taalniveau bepaalt terminologie".
5. **PROVEN_DATA_PRESENTATION_PROBLEM** — activiteiten-/detailpagina's >4 schermhoogtes mobiel; belangrijke info diep verstopt (V-07, risico).
6. **PROVEN_CONTENT_PROBLEM** — titel "Plan" vs label "Trainen" (zie reviewset 01).
7. **PROVEN_PRESENT** — mobiele app dekt uitvoering (opname, sensoren, navigatie, val-alarm); web dekt planning/analyse. Werkverdeling = **LOGISCHE_APPARAATVARIANT**.
8. **PROVEN_MISSING** — krachttraining (Master Plan: spec ready) niet gebouwd.
9. **DEFERRED_BY_DECISION** — multisport expliciet uitgesteld; bordjes-sprinten aanwezig maar buiten kernreis.
10. **EVIDENCE_INSUFFICIENT** — doorklik-flows (bijv. workout starten → afronden → verdict) niet met testaccount doorlopen in deze nulmeting.

## Automatische herstelkandidaten (max 5)
1. UitlegDot toevoegen op IF/CTL/ATL/TSB (training-day-home) — bestaand uitleg-registry, veilig.
2. UitlegDot op TSS/NP (train) — idem.
3. Scrolldiepte: sectie-ankers/inklapbare blokken op activiteiten-detail — veilig, wel lichte UX-keuze (na ChatGPT-review).
4. Paginatitel-fix (gedeeld met reviewset 01).
5. — (krachttraining is bouwwerk, geen herstel.)

## Echte René-besluiten (max 3)
1. — geen. Sporterreis kent geen open richtingsvraag; diepte per abonnement valt onder besluit-03.
