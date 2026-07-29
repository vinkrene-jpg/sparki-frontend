# Reviewset 08 — Ploegleider en mechanieker

**Bron:** audit-commit `7e2f1983` · Status: CURRENT_AUDIT_SOURCE (PENDING_RENE_REVIEW bij twijfel).
**Vaste koers:** ploegleider/teammanager en mechanieker blijven gewenste rollen; ontbrekende werkruimtes zijn bouwgaten.

## Representatieve screenshots (max 8)
1. `mechanieker/390x844/boven.jpg` — Mechanieker-hoofdstuk (nu sporter-gericht)
2. `mechanieker/390x844/fullpage.jpg` — volledige materiaalomgeving
3. `wedstrijd-room/390x844/boven.jpg` — wedstrijd-room (ploegleiderscontext)
4. — Volgauto: mobiel scherm, geen web-screenshot; bewijs: code + tests.

## Hoofdbevindingen (max 10)
1. **PROVEN_PRESENT** — mechanieker-functionaliteit als sporter-hoofdstuk: materiaalkring, km-afgeleide slijtage, defectregistratie, materiaalcoach met foto-advies.
2. **PROVEN_PRESENT** — ploegleider-bouwstenen: volgauto (mobiel, wissel/ETA), wedstrijd-room, live locatie delen (authz per read, minor fail-closed).
3. **PROVEN_ROLE_GAP** — mechanieker is geen rol: geen eigen werkruimte over meerdere renners/fietsen heen, geen koppelmodel club↔mechanieker. Bouwgat.
4. **PROVEN_ROLE_GAP** — ploegleider is geen rol: bouwstenen bestaan maar zonder eigen ingang, rechtenprofiel of teamkoppeling. Bouwgat.
5. **PROVEN_CONTENT_PROBLEM** — materiaalcoach toont advies-samenvatting bij confidence=unknown (D-07) — botst met eerlijkheidsdoctrine.
6. **CHATGPT_PRODUCT_REVIEW_REQUIRED** — voorstel: welke bestaande bouwstenen verhuizen naar de nieuwe rol-werkruimtes en wat blijft sporter-zijde (dubbelgebruik vermijden).
7. **EVIDENCE_INSUFFICIENT** — volgauto/live-locatie niet in web-nulmeting (mobiel); bestaande tests dekken de kernregels.

## Automatische herstelkandidaten (max 5)
1. Materiaalcoach: advies onderdrukken bij confidence=unknown (eerlijke lege staat) — AUTOMATIC_REPAIR_CANDIDATE.

## Echte René-besluiten (max 3)
1. **Bouwvolgorde rollen/werkruimtes** → `rene-decisions/besluit-04-bouwvolgorde-rollen.md`.
