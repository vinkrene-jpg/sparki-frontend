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

## Aanvulling 02-08-2026 (F9)

> Nagelezen tegen main `56985d32e8909a55fb30f8c1aadf0c0460a888ff` (2 augustus 2026). Bestaande tekst klopt: geen eigen scherm, hoofdtrainer = CoachHome op `/` + extra sectie op `/club`. Beide gebruiken `ScreenShell`; rol+omgeving is aanwezig via `DsContextRegel` en de `RoleViewSwitch` toont "Hoofdtrainer".

### F9-regelovertredingen (werklijst)
1. **`/club` telt met de hoofdtraineroverzicht-sectie erbij ~7 secties** (schendt "max vier kaarten boven de vouw" + `TUX-24`): het overzicht "Trainers in jouw organisatie" komt bovenop de al volle clubpagina; op mobiel staat het ver onder de vouw.
2. **Geen tabs** (schendt "2–4 echte tabs"): het hoofdtraineroverzicht en de clubsecties staan gestapeld; scheiding via tabs ontbreekt.
3. **Geen eigen rolstartscherm** — conform F9 mag hier géén nieuw scherm bij, maar de herindeling moet het hoofdtraineroverzicht als eigen tab/sectie herpositioneren zodat de hoofdhandeling ("eerste training plannen") in beeld staat (`TUX-26`).
4. Eén primaire actie is hier wél haalbaar (planning); het overzicht is puur lezen. Geen uitgegrijsde beheeropties waargenomen (organisatorisch overzicht zonder privédata is correct).
