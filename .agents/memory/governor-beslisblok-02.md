---
name: Governor Beslisblok 02 — rollenfundament
description: Waar de rollen-/organisatie-/abonnementsmodellen en rol-testfixtures leven en welke regels ze vastleggen.
---

- Modellen (SSOT, voorstel-status): `governance/role-capability-matrix-v1.json`, `organisation-membership-model-v1.json`, `subscription-depth-model-v1.json`, `club-team-feature-model-v1.json`; rapporten in `reports/governor-beslisblok-02/`.
- Kernbesluiten: hoofdtrainer/clubbeheerder/ploegleider/mechanieker = CONTEXTROLLEN op het bestaande clubmodel (nooit nieuwe platformrollen of tweede model); Club en Team = productprofielen op dezelfde tabellen; tiers delen dezelfde engines (diepte = presentatie+gating).
- Rol-testfixtures: `scripts/governor/create|remove-role-test-fixtures.sh` → api-server script. Regels: prod fail-closed, prefix `governor-fixture-`, remove eist strikte handtekening (prefix+e-maildomein+releaseGroup test, nooit alleen LIKE), create/remove onder pg_advisory_lock op ÉÉN dedicated pool-client.
- **Why:** architect-review: prefix-only delete kan bij namespace-botsing echte data cascaden; select→insert is niet race-safe zonder lock.
- **How to apply:** elk toekomstig seed/fixture-script volgt dit patroon; test bevat non-interference- + parallelle-run-scenario.
- Open René-besluit: GO↔COMPLETE-herverdeling van GO_FEATURE_KEYS (WP-09); werkpakketten WP-01…WP-10 starten niet automatisch.

## WP-R0: governor-fixtures = rol-testfundament DEV Preview
- De governor-rolfixtures zijn ook de vaste rol-testidentiteiten van de DEV Preview (incl. zelfstandige trainer en hoofdtester); admin-rechten in dev via het echte SPARKI_ADMIN_IDS-mechanisme in de development-omgeving, nooit een bypass.
- **Why:** valkuil bewezen: e2e/curl-probes zonder de dev-identiteitsheader vallen stil terug op de standaard dev-gebruiker — identiteitscontroles slagen dan tegen de verkeerde persoon.
- **How to apply:** elke in-page probe moet de dev-identiteitsheader meesturen zoals de app-fetchlaag dat doet. Dev-impersonatie en dev-routers moeten REPLIT_DEPLOYMENT weigeren ongeacht NODE_ENV. Een clubtrainer die méér sporters ziet dan zijn directe links is correct (link ∪ teamtoewijzing), geen bug.
