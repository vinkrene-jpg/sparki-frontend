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
