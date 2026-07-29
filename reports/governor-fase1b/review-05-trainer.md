# Reviewset 05 — Trainer en hoofdtrainer

**Bron:** audit-commit `7e2f1983` · Status: CURRENT_AUDIT_SOURCE (PENDING_RENE_REVIEW bij twijfel).
**Vaste koers (niet opnieuw ter discussie):** de rollen trainer én hoofdtrainer/coach blijven gewenst; ontbrekende werkruimtes zijn een **bouwgat**, geen rollenvraag.

## Representatieve screenshots (max 8)
1. `invitations/390x844/boven.jpg` — uitnodigingsflow coach↔sporter
2. `invitations/1440x900/boven.jpg` — desktopvariant
3. — CoachHome/cockpit/bulkplanner: **geen screenshots beschikbaar** (vergt coach-testaccount; nulmeting draaide als sporter/admin). Bewijs: code + bestaande tests (coach-parent-isolatietests, cockpit).

## Hoofdbevindingen (max 10)
1. **PROVEN_PRESENT** — coachrol in code: CoachHome, coach-cockpit per sporter, bulkplanner, berichten, plan-adoptie (advies → sporter-eigen planned_workouts), deel-niveaus met ouder/sporter, privé-notities.
2. **PROVEN_PRESENT** — isolatie en rechten aantoonbaar via geautomatiseerde tests (link-gate, sharing-levels, private-memory, unlink/end-isolatie).
3. **PROVEN_ROLE_GAP** — hoofdtrainer bestaat niet als rol: geen onderscheid trainer↔hoofdtrainer in rechten of interface. Bouwgat.
4. **PROVEN_MISSING** — trainer-paspoort, trainer-campus en trainer-search/onboarding (Master Plan) hebben geen enkel code-spoor.
5. **PROVEN_SUBSCRIPTION_GAP** — coaching-diepte is nu aan GO gekoppeld (GO_FEATURE_KEYS); volgens de vaste regel "abonnement bepaalt diepte" moet de trainerlaag een eigen plek in het tiermodel krijgen — afwijking gerapporteerd, verdeling zelf = besluit-03.
6. **EVIDENCE_INSUFFICIENT** — geen live doorloop van de trainerreis (geen coach-testaccount met gekoppelde sporters in dev).
7. **PROVEN_PRESENT** — inline input-acties op lege coach-oppervlakken (geen dode "ga naar X"-verwijzingen).
8. **CHATGPT_PRODUCT_REVIEW_REQUIRED** — welke bevoegdheden onderscheiden hoofdtrainer van trainer (voorstel maken op basis van Master Plan; René toetst alleen het eindvoorstel).

## Automatische herstelkandidaten (max 5)
1. Coach-testaccount + gekoppelde demosporter in dev voor live verificatie — veilig testfundament.
2. — (rolbouw is bouwwerk, geen herstel.)

## Echte René-besluiten (max 3)
1. **Bouwvolgorde werkruimtes** (trainer/hoofdtrainer vs club vs ploegleider/mechanieker eerst) → `rene-decisions/besluit-04-bouwvolgorde-rollen.md`.
