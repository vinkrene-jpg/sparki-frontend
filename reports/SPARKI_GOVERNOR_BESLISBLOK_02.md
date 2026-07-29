# SPARKI GOVERNOR — BESLISBLOK 02: ROLLEN-, ORGANISATIE- EN ABONNEMENTSFUNDAMENT

Datum: 29 juli 2026 · Status: **GOVERNOR_DECISION_BLOCK_02_FOUNDATION_READY**
Scope: uitsluitend fundament (modellen, contracten, fixtures, tests, werkpakketten). Geen rolwerkruimtes, geen betaalflow, geen prijzen, geen Stripe, geen restyling, geen productiedata-migratie, geen productie-testaccounts, geen echte uitnodigingen.

## 1. Hergebruikinventaris (fase 1)

`reports/governor-beslisblok-02/REUSE_INVENTORY.md` + `.csv` — volledige inventaris per domein met statussen HERBRUIKBAAR / UITBREIDEN / FOUTIEF_GEKOPPELD / ONTBREKEND. Kern: platformrollen (athlete/coach/parent), rijk clubmodel (12 clubrollen, teams, groepen, toewijzingen, consents, abonnement, audit), coach- en ouderlagen met fail-closed consent, entitlements-laag met legacy-carve-out. FOUTIEF_GEKOPPELD: `races.team_riders` (vrije jsonb). ONTBREKEND: seizoenen, selecties, rol×team-scope voor ploegleider/mechanieker, rolwerkruimtes.

## 2. Modellen (fasen 2–5, alle als voorstel)

| Model | Machineleesbaar | Rapport |
|---|---|---|
| Rollen & bevoegdheden | `governance/role-capability-matrix-v1.json` | `ROLE_CAPABILITY_MODEL.md` + `ROLE_CAPABILITY_MATRIX.csv` (25 regels) |
| Organisatie & lidmaatschap | `governance/organisation-membership-model-v1.json` | `CLUB_TEAM_ORGANISATION_MODEL.md` |
| Abonnementsdiepte | `governance/subscription-depth-model-v1.json` | `SUBSCRIPTION_DEPTH_MODEL.md` + `SUBSCRIPTION_DEPTH_MATRIX.csv` (10 functies) |
| Club vs Team | `governance/club-team-feature-model-v1.json` | `CLUB_VS_TEAM_FEATURE_MODEL.md` |

Kernbesluiten: hoofdtrainer/clubbeheerder/ploegleider/mechanieker zijn CONTEXTROLLEN op het bestaande clubmodel (geen nieuwe platformrollen, geen tweede model); Club en Team zijn twee productprofielen op dezelfde tabellen; Gratis/Go/Compleet delen dezelfde engines met oplopende diepte; veiligheid/privacy/export/opzeggen nooit betaald.

## 3. Fixtures (fase 6)

Plan: `TEST_ACCOUNT_AND_FIXTURE_PLAN.md`. Implementatie: `artifacts/api-server/src/scripts/governor-role-fixtures.ts` + wrappers `scripts/governor/create-role-test-fixtures.sh` / `remove-role-test-fixtures.sh`.
Bewijs uitgevoerd: create → "club + 2 teams + 12 gebruikers"; tweede create idempotent (zelfde beeld); remove → 0/0; create met `NODE_ENV=production` → "GEWEIGERD" (exit 1). Alle rijen synthetisch en herkenbaar (prefix `governor-fixture-`, TESTFIXTURE-namen, `@governor-fixtures.invalid`); dev-database na afloop schoon achtergelaten (fixtures verwijderd; aanmaken kan op elk moment via het create-script).

## 4. Tests (fase 7)

Nieuw: `artifacts/api-server/src/tests/governor-role-foundation.ts` (`node ./scripts/run-test.mjs governor-role-foundation`) — **11/11 geslaagd** (incl. non-interference-check en parallelle create-runs via advisory lock): idempotentie, gekoppeld vs controlegeval, organisatie-isolatie (club A ≠ B, buitenstaander niets), einde lidmaatschap sluit op leesmoment, multi-role-unie, drie abonnementscontexten via één entitlements-engine (gratis fail-closed), ouder-link jeugd fail-closed (veiligheidsminimum), productie-poort, remove/restore.
Bestaand, opnieuw gedraaid en groen: typecheck libs + api-server (0 fouten), cross-account-isolation 19/19, coach-parent-link-isolation 13/13, links-end-isolation 3/3, entitlements 19/19, admin-smoke 12/12.
Kleine bijvangst: `SAFETY_CATEGORIES` in `lib/parent-permissions.ts` geëxporteerd (was lokaal; geen gedragswijziging).

## 5. Werkpakketten (fase 8)

`IMPLEMENTATION_SEQUENCE.md` + `work-packages/WP-01…WP-10`: trainer-fundament → hoofdtrainer → clubbeheerder+organisatie; parallel ouder/jeugd-verificatie; daarna ploegleider, mechanieker, Club-entitlements, Team-entitlements, dieptemigratie (vereist René-besluit), live E2E. Per pakket: scope, hergebruik, niet-wijzigen, API, UX, rechten, tests, bewijs, risico, stopcondities, afhankelijkheden, complexiteit.

## 6. Resterende beslissingen voor René

1. **GO ↔ COMPLETE-verdeling** (WP-09): voorstel is de vier huidige GO-keys naar Compleet en GO als praktische dagelijkse laag — pas uitvoeren na akkoord.
2. **Selectie-implementatie** (parent_team_id vs club_groups) — technische keuze in WP-05, ter bevestiging.
3. **Wanneer welke werkpakketten starten** — niets start automatisch.

## 7. Publicatie

**Niet nodig.** Dit blok wijzigt alleen governance-documenten, testfixtures en tests; er is geen productiegedrag veranderd (enige codewijziging is een export-keyword). Commit-SHA: `a886c8f1` (fundament) + review-hardening-commit met race-safe lock, strikte verwijder-handtekening en scenario 10–11.

---

## 8. Aanvullende controle (op verzoek van de Governor, 29 juli 2026)

### 8.1 Volledige lijst gewijzigde bestanden (commits a886c8f1, 5c11f377, 14b45c3c)

**Alleen documentatie (18):**
- reports/SPARKI_GOVERNOR_BESLISBLOK_02.md
- reports/governor-beslisblok-02/REUSE_INVENTORY.md, REUSE_INVENTORY.csv
- reports/governor-beslisblok-02/ROLE_CAPABILITY_MODEL.md, ROLE_CAPABILITY_MATRIX.csv
- reports/governor-beslisblok-02/CLUB_TEAM_ORGANISATION_MODEL.md
- reports/governor-beslisblok-02/SUBSCRIPTION_DEPTH_MODEL.md, SUBSCRIPTION_DEPTH_MATRIX.csv
- reports/governor-beslisblok-02/CLUB_VS_TEAM_FEATURE_MODEL.md
- reports/governor-beslisblok-02/TEST_ACCOUNT_AND_FIXTURE_PLAN.md
- reports/governor-beslisblok-02/IMPLEMENTATION_SEQUENCE.md
- reports/governor-beslisblok-02/work-packages/WP-01 t/m WP-10 (10 bestanden)
- (werkgeheugen, geen product: .agents/memory/MEMORY.md, .agents/memory/governor-beslisblok-02.md)

**Governance/config (4):**
- governance/role-capability-matrix-v1.json
- governance/organisation-membership-model-v1.json
- governance/subscription-depth-model-v1.json
- governance/club-team-feature-model-v1.json

**Testcode & testfixtures (4):**
- artifacts/api-server/src/tests/governor-role-foundation.ts (nieuwe testsuite)
- artifacts/api-server/src/scripts/governor-role-fixtures.ts (fixturescript, alleen dev/test; weigert productie)
- scripts/governor/create-role-test-fixtures.sh, remove-role-test-fixtures.sh (dunne wrappers)

**Productcode (1, minimaal):**
- artifacts/api-server/src/lib/parent-permissions.ts — uitsluitend `export` toegevoegd aan de bestaande constante `SAFETY_CATEGORIES` zodat de test die kan controleren. Geen gedragswijziging; typecheck en alle bestaande suites groen.

**Database/schema/migraties (0):**
- Geen enkele schema- of migratiewijziging. Voorgestelde uitbreidingen (organisation_kind, club_seasons, parent_team_id, rol×team-scope) staan alleen als voorstel in de modellen/werkpakketten.

### 8.2–8.5 Bevestigingen

- **Echte gebruikersdata geraakt: NEE.** Alle fixture-writes zijn beperkt tot synthetische rijen met prefix `governor-fixture-` in de ontwikkeldatabase; verwijdering eist bovendien het synthetische e-maildomein én releasegroep "test". Non-interference is als testscenario bewezen (scenario 10). De dev-database is schoon achtergelaten (fixtures verwijderd, verify 0/0).
- **Productie-entitlements gewijzigd: NEE.** Er is niets gepubliceerd; er is geen enkele write richting de productiedatabase gedaan. GO_FEATURE_KEYS en alle grants staan ongewijzigd in de code; de GO↔COMPLETE-herverdeling is uitsluitend een voorstel (WP-09, wacht op René-besluit).
- **Productie-testaccounts gemaakt: NEE.** Geen Clerk-accounts, geen uitnodigingen, geen e-mails; het fixturescript weigert hard (exit 1) bij NODE_ENV=production of REPLIT_DEPLOYMENT — uitgevoerd en getest (scenario 8 + shell-run).
- **Tweede model naast een bestaand model ontstaan: NEE.** De modellen formaliseren het bestaande stelsel: platformrollen blijven athlete/coach/parent; hoofdtrainer/clubbeheerder/ploegleider/mechanieker zijn contextrollen op het bestaande clubmodel; Club/Team zijn productprofielen op dezelfde tabellen; alle tiers lopen door dezelfde entitlements-engine. Dit "geen tweede model"-principe staat expliciet als stopconditie in elk werkpakket.

### 8.6 Alle testruns (geslaagd én mislukt)

| Test | Resultaat |
|---|---|
| typecheck libs + api-server | geslaagd (0 fouten) |
| governor-role-foundation (nieuw) | **11/11 geslaagd** — na 3 tussentijdse mislukkingen tijdens ontwikkeling: (1) buildfout ontbrekende export SAFETY_CATEGORIES → export toegevoegd; (2) scenario 6 las verkeerde veldnaam (`mode` i.p.v. `entitlementMode`) → testfout hersteld; (3) scenario 7 rekende `slaap` niet tot het veiligheidsminimum, terwijl de bestaande code die bewust wél meeneemt (backward-compatibele standaard) → testverwachting gecorrigeerd en gedocumenteerd |
| cross-account-isolation | 19/19 geslaagd |
| coach-parent-link-isolation | 13/13 geslaagd |
| links-end-isolation | 3/3 geslaagd |
| entitlements | 19/19 geslaagd |
| admin-smoke | 12/12 geslaagd |
| Eerste run bestaande suites zonder DEV_AUTH_BYPASS-env | mislukte (verwacht gedrag: suites vereisen die env, zoals hun package.json-scripts zetten); herhaald mét env → allemaal groen |
| Fixturescript prod-guard (NODE_ENV=production) | correct GEWEIGERD (exit 1) |

### 8.7 Stopcondities die bijna geraakt zijn

- **Bijna geraakt — "tweede parallel model":** de eerste architect-review wees erop dat de fixture-remove op alleen een prefix-LIKE bij een theoretische namespace-botsing echte data via cascades zou kunnen wissen ("wijziging echte gebruikersdata"). Dit is vóór afronding verholpen (strikte drieledige handtekening + advisory lock + extra testscenario's 10–11); de conditie is nooit daadwerkelijk geraakt.
- **Gemarkeerd, niet geraakt — "live prijs-/entitlementbesluit":** het GO↔COMPLETE-conflict is bewust als voorstel geparkeerd (WP-09) in plaats van uitgevoerd.
- Geen datamodelconflicten, geen destructieve migraties, geen cross-user/club-lekkage, geen onduidelijk data-eigenaarschap aangetroffen.

### 8.8 Commit-SHA's en publicatie

- `a886c8f1` — fundament (modellen, fixtures, tests, werkpakketten, rapport)
- `5c11f377` — review-hardening (advisory lock, strikte verwijder-handtekening, scenario 10–11)
- `14b45c3c` — werkgeheugen-notitie (geen product)
- Controle-addendum: zie de commit die deze sectie toevoegt.
- **Publicatie nodig: NEE** — geen productiegedrag gewijzigd.

**Eindstatus: GOVERNOR_DECISION_BLOCK_02_FOUNDATION_READY** — geen vervolgwerk gestart.
