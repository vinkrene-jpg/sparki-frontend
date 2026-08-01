# UX-audit — Module Hoofdtrainer (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Route/URL
Geen eigen pagina. Hoofdtrainer = clubcontextrol bovenop trainer: CoachHome op `/` + extra sectie "Hoofdtraineroverzicht"/"Trainers in jouw organisatie" op `/club` (`pages/club.tsx` r252-254/303-326; API `/api/clubs/:id/hoofdtrainer/overview`, gate `hasClubRole(["hoofdtrainer"])` in `lib/club-permissions.ts` r60/91).

## Eerste scherm & secties
- `/` → CoachHome (identiek aan trainer; RoleViewSwitch toont "Hoofdtrainer" bij meerdere rollen, `coach-home.tsx` r387/411).
- `/club`: rolblok "Jouw rol: hoofdtrainer — trainingen: planning en begeleiding van de groep" met leeg-signaal "Er staat nog geen training gepland … jij of de clubbeheerder"; lijst trainers met sporteraantal + trainingen (30 d) per trainer; onderschrift: "gezondheids- of privégegevens staan hier bewust niet in" (zie screenshot — geen gezondheidsdata, conform rechtenmodel).

## Acties
Trainer-toewijzing aan teams/groepen (server-side, `routes/club.ts` r510); verder trainer-acties.

## Toestanden
Leeg: geen trainingen gepland (zichtbaar), trainers zonder sporters (0-regels zichtbaar). Geen tabs, geen wizard.

## Rollen/context, mobiel/desktop
Rol getest: `governor-fixture-hoofdtrainer` (coach + clubRole hoofdtrainer, club 338). Mobiel: zelfde secties gestapeld. Doodlopend: geen. Rechtenlek: niet waargenomen (organisatorisch overzicht zonder privédata).

## Bewijs
- `UX_AUDIT_MODULES_SCREENSHOTS/hoofdtrainer_start_{desktop,mobiel}.png`
- `UX_AUDIT_MODULES_SCREENSHOTS/hoofdtrainer_club_{desktop,mobiel}.png` (incl. leeg-scenario)
- Codebewijs: `artifacts/sparki/src/pages/club.tsx` r252-326, `artifacts/api-server/src/lib/club-permissions.ts` r60/91.
