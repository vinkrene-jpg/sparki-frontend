# Reviewset 06 — Ouder en jeugd

**Bron:** audit-commit `7e2f1983` · Status: CURRENT_AUDIT_SOURCE (PENDING_RENE_REVIEW bij twijfel).
**Vaste koers:** rol ouder/verzorger blijft; gaten zijn bouw-/verificatiegaten.

## Representatieve screenshots (max 8)
1. `invitations/390x844/boven.jpg` — koppelflow (ouder↔kind loopt via dezelfde invitatielaag)
2. — ParentHome + 4-item ouder-nav: **geen screenshots** (vergt ouder-testaccount). Bewijs: code + tests.

## Hoofdbevindingen (max 10)
1. **PROVEN_PRESENT** — ouderomgeving met eigen home en navigatie; één rechtenlaag voor alle ouder-routes; onbekende leeftijd clampt naar veiligheidsminimum; onbevestigde koppeling nooit boven safety-only.
2. **PROVEN_PRESENT** — jeugdbescherming breed en fail-closed aantoonbaar in code/tests: minor-sharing fail-closed, jeugd-consent club, geen voedingsgetallen voor jeugd, RED-S-weigering (<17), media fail-closed, AI-gateway minor-gate.
3. **PROVEN_PRESENT** — deel-niveaus ouder (waaronder "niets delen") met geautomatiseerde tests.
4. **PROVEN_MISSING (verificatie)** — Master Plan jeugd-release-scope is release-blocking maar niet integraal geverifieerd tegen de plan-eisen (geen checklist-doorloop).
5. **EVIDENCE_INSUFFICIENT** — geen live ouderreis-doorloop (geen ouder-testaccount + gekoppeld minderjarig account in dev).
6. **CHATGPT_PRODUCT_REVIEW_REQUIRED** — dekt de huidige ouder-nav (4 items) de Master Plan-ouderreis volledig? Vergelijking op papier mogelijk zonder René.

## Automatische herstelkandidaten (max 5)
1. Jeugd-scope-verificatiechecklist opstellen en geautomatiseerd afdekken — AUTOMATIC_REPAIR_CANDIDATE (testwerk).
2. Ouder+minderjarige-testaccountpaar in dev — testfundament.

## Echte René-besluiten (max 3)
1. — geen; jeugdregels liggen vast (fail-closed), rest is verificatie- en bouwwerk.
