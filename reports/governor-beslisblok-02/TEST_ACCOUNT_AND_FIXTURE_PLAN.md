# BESLISBLOK 02 — FASE 6: TESTACCOUNT- EN FIXTUREPLAN

Datum: 29 juli 2026.
Implementatie: `artifacts/api-server/src/scripts/governor-role-fixtures.ts` (echte logica, drizzle) met dunne wrappers `scripts/governor/create-role-test-fixtures.sh` en `scripts/governor/remove-role-test-fixtures.sh`.

## Garanties (allemaal geïmplementeerd en getest)

| Eis | Implementatie | Bewijs |
|---|---|---|
| Alleen dev/test/staging | `isProductionBlocked()`: weigert bij `NODE_ENV=production` of `REPLIT_DEPLOYMENT` (exit 1) | shell-run met NODE_ENV=production → "GEWEIGERD" |
| Synthetisch & herkenbaar | alle clerkIds `governor-fixture-*`, namen "TESTFIXTURE …", e-mail `@governor-fixtures.invalid`, club "TESTFIXTURE Governor Club", releaseGroup `test` | code + verify-output |
| Idempotent | vaste ids + upserts/onConflict; tweede run verandert niets (12 gebruikers, 1 club, 2 teams blijven) | dubbele create-run |
| Volledig verwijderbaar | `remove` wist alleen prefix-rijen; FK-cascades ruimen kindrijen; verify na remove = 0/0 | remove-run |
| Geen invloed op echte data | uitsluitend prefix-gefilterde writes; geen Clerk-accounts, geen echte uitnodigingen, geen e-mails | code-review van alle queries |

## Persona's (12)

| Sleutel (clerkId-suffix) | Platformrol | Clubrol | Abonnementscontext | Bijzonderheden |
|---|---|---|---|---|
| athlete-adult | athlete | member | subscription + `tier:GO`-trial | gekoppeld aan trainer-1 (accepted) |
| athlete-jeugd | athlete | member | subscription (Gratis) | geboortedatum 2012 → jeugd, ouder-link |
| athlete-compleet | athlete | — | subscription + `tier:COMPLETE`-trial | buiten club (controle) |
| parent | parent | parent | subscription | link met athlete-jeugd (accepted, fail-closed permissies = veiligheidsminimum) |
| trainer-1 | coach | trainer | subscription | toegewezen aan Team A + directe link |
| trainer-2 | coach | trainer | subscription | bewust NIET gekoppeld/toegewezen (controlegeval) |
| hoofdtrainer | coach | hoofdtrainer | subscription | |
| clubbeheerder | athlete | admin (owner van club) | subscription | |
| ploegleider | athlete | teammanager | subscription | managerClerkId op beide teams |
| mechanieker | athlete | mechanieker | subscription | |
| admin | athlete | — | legacy_unrestricted | adminrechten via SPARKI_ADMIN_IDS (env, bewust niet door script gezet) |
| outsider | athlete | — | subscription (Gratis) | geen club, geen links — isolatie-controle |

## Organisatie

- 1 club: TESTFIXTURE Governor Club (joinCode `GOVFIX01`, clubabonnement trial, max 25 leden / 5 trainers).
- 2 teams/selecties: Team A (wedstrijd), Team B (jeugd).
- Trainer-toewijzing: trainer-1 → Team A. Trainer-2 zonder toewijzing (rechten-controle).

## Abonnementscontexten

Gratis = `entitlement_mode=subscription` zonder rechten (fail-closed), Go = actieve `tier:GO`-trial (source `test`), Compleet = actieve `tier:COMPLETE`-trial. `legacy_unrestricted` alleen voor de admin-persona (bewuste carve-out). Geen Stripe, geen prijzen, geen productie-entitlementwijziging.

## Wat dit plan bewust NIET doet

Geen productie-testaccounts, geen echte Clerk-uitnodigingen, geen wijziging aan René/Dylan-data, geen rolwerkruimtes of betaalflow.
