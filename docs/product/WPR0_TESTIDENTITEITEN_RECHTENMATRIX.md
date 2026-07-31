# WP-R0 — Vaste testidentiteiten & rechtenmatrix (DEV Preview)

Status: opgeleverd 31-07-2026. Onderdeel van `SPARKI_STRUCTURE_RECOVERY_BUILD_PLAN.md` (WP-R0).

## Herkomst
De testidentiteiten zijn de bestaande **governor-rolfixtures** (Beslisblok 02,
`artifacts/api-server/src/scripts/governor-role-fixtures.ts`), voor WP-R0 uitgebreid met:
- `governor-fixture-trainer-zelfstandig` — coach met directe koppeling, bewust GEEN clublid;
- `governor-fixture-tester` — sporter met het echte hoofdtester-mechanisme (`is_head_tester`).

Aanmaken/verwijderen: `scripts/governor/create-role-test-fixtures.sh` / `remove-role-test-fixtures.sh`
(fail-closed in productie, idempotent, alleen `governor-fixture-*`-rijen met synthetisch e-maildomein).

Alle identiteiten staan in de DEV Preview-kiezer onder **"Rollen (testfixtures)"**
(registry `lib/preview-athletes.ts`, kiezer toont echte rol/clubrol/rechten uit de database).

## Relaties (echt geseed, geen fictie in de UI)
- Club "TESTFIXTURE Governor Club" + Team A (wedstrijd) + Team B (jeugd); clubabonnement proef (25 leden / 5 trainers).
- Trainer-1 → directe link sporter-volwassen ÉN teamtoewijzing Team A (met sporter-volwassen + jeugdsporter).
- Trainer-2 → clublid zonder toewijzing en zonder links (controlegeval).
- Trainer-zelfstandig → directe link sporter-compleet (buiten de club).
- Ouder → bevestigde koppeling jeugdsporter (2012).
- Ploegleider = teammanager van beide teams; clubbeheerder = clubowner; mechanieker = clublid rol "mechanieker".
- Admin: rechten via `SPARKI_ADMIN_IDS` (development-omgevingsvariabele bevat `governor-fixture-admin`; productie onaangeraakt). Geen algemene bypass.

## Rechtenmatrix per testidentiteit (server-side gemeten, e2e 31-07-2026, commit 98644090)
| Identiteit | App-rol | Clubrol | `/api/admin/status` | `/api/coach/athletes` | `/api/parent/athletes` | Bijzonder |
|---|---|---|---|---|---|---|
| ouder (`-parent`) | parent | parent | **403** | n.v.t. | 1 kind (safety_only) | ouderstartpagina op home |
| trainer zelfstandig | coach | — | **403** | 1 sporter | n.v.t. | geen clubtoegang |
| clubtrainer (`-trainer-1`) | coach | trainer | **403** | 2 sporters (link ∪ teamtoewijzing) | n.v.t. | |
| trainer zonder scope (`-trainer-2`) | coach | trainer | **403** | 0 sporters | n.v.t. | controlegeval |
| hoofdtrainer | coach | hoofdtrainer | **403** | 0 sporters (geen directe links) | n.v.t. | org-overzicht is WP-R-vervolgwerk |
| clubbeheerder | athlete | admin (owner) | **403** | n.v.t. | n.v.t. | eigen workspace ontbreekt nog (eerlijk) |
| mechanieker | athlete | mechanieker | **403** | n.v.t. | n.v.t. | wacht op materiaal-deelbesluit |
| tester | athlete | — | **403** | n.v.t. | n.v.t. | `is_head_tester=true`, banner toont HOOFDTESTER |
| admin | athlete | — | **200** | n.v.t. | n.v.t. | via SPARKI_ADMIN_IDS (dev) |

## Bewijs
- E2e (echte kliks in de identiteitenkiezer, per identiteit: klik → herlaad → `/api/auth/me`-controle →
  banner → rechtenprobes): `e2e/tests/wp-r0-rollen.mjs`; rapport + screenshots in
  `e2e/evidence/wp-r0-rollen/` (o.a. 403-bewijs per niet-admin, admin-200, hoofdtester-vlag).
- TESTCONTEXT-banner toont per identiteit: omgeving (DEV PREVIEW), commit-SHA, identiteit, rol en
  echte rechten (ADMIN/HOOFDTESTER); "@ ONBEKEND" is opgelost (bestandsgebaseerde git-SHA-fallback in vite.config).

## Bekende beperkingen (bewust, binnen WP-R0-scope)
- Rollen zonder eigen werkomgeving (ouder-bestemmingen, clubrollen, mechanieker) tonen hun eerlijke,
  onvolledige toestand — dat herstellen is WP-R1…R8, niet R0.
- De preview-paginalijst is rolbewust voor coach en ouder; clubrollen hebben app-rol "athlete" en
  krijgen de sporterlijst inclusief Club/Club-beheer-ingangen (spiegelt de echte router).
- E2e draait om shell-timeouts in drie deelruns (`WP_R0_FILTER`); rapport wordt samengevoegd.
