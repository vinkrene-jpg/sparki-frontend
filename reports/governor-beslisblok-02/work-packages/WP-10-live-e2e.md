# WP-10 — Live E2E-verificatie met testrollen (dev/staging)

**Scope:** end-to-end doorlopen van alle rolreizen met de governor-fixtures in dev/staging: sporter, trainer (gekoppeld + controle), hoofdtrainer, ouder+jeugd, clubbeheerder, ploegleider, mechanieker, admin; plus Gratis/Go/Compleet-diepteverschillen en Club/Team-profielen.
**Hergebruik:** governor-role-fixtures (create/remove), governor-role-foundation-test, bestaande Playwright-aanpak (eigen scripts in /tmp; runTest raakt de dev-app), Clerk ticket-login-patroon voor ingelogde validatie.
**Niet wijzigen:** productie; geen echte accounts of uitnodigingen.
**API:** geen — verificatiepakket.
**UX:** per rol screenshotbewijs van werkruimte + geweigerde toegangen (403's zichtbaar gemaakt).
**Rechten:** elke negatieve case expliciet (trainer-2 ziet niets, buitenstaander niets, club A ≠ B, jeugd fail-closed).
**Tests:** scripted E2E-runs + bestaande isolatiesuites; resultaatmatrix rol×capability vs fase-2-matrix.
**Bewijs:** matrixrapport met per cel PASS/FAIL + screenshots.
**Risico:** fixtures hebben geen Clerk-accounts → E2E via DEV_AUTH_BYPASS of test-tickets; dat verschil eerlijk benoemen in het rapport.
**Stopcondities:** cross-user/club-lekkage gevonden (direct stoppen en melden).
**Afhankelijkheden:** alle voorgaande WP's. **Complexiteit:** M.
