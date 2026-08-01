# UX-audit — Module Trainer (trainer-werkruimte) (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Route/URL
- `/` → RoleHome → CoachHome bij `activeRole === "coach"` (`App.tsx` r431/665; `components/sparki/coach-home.tsx`).
- `/coach/athletes/:id/cockpit` (`pages/coach-cockpit.tsx`), `/coach/athletes/:id/plan` (`pages/coach-athlete-plan.tsx`), `/invitations`.
- Meer-menu coach: Profiel & account, Veelgebruikt (Vandaag, Samen, Uitnodigingen), Ondersteuning & kennis, Beheer/instellingen/privacy (`core-meer.ts` r155/168).

## Eerste scherm
CoachHome: melding "Geen dringende zaken" of prioriteitensignaal, daarna "Jouw sporters" gesorteerd op aandacht (zie screenshot). RoleViewSwitch (tab-achtige rolwissel) alleen bij meerdere rollen (`role-today.tsx` r193).

## Kaarten
AthleteCard: naam, gereedheid (Fris/Oké/Vermoeid), prioriteitspunt, ongelezen-teller, topsignaal, "COCKPIT →" (`coach-home.tsx` r97). Privacy: "Deelt niet"-kaart zonder cockpitlink (r149); team-only zonder directe link → geen cockpit (r112) — bewust "uitgegrijsd".

## Acties/formulieren
- Primair: Cockpit openen; BulkPlanner "Zelfde training voor meerdere sporters" (velden: datum, titel, duur, omschrijving + sporterselectie; r236/269/302); "Sporter uitnodigen" (r449).
- Cockpit: Signalen (accepteer/pas aan/wijs af), Planning (WorkoutForm 5 velden: datum, titel, omschrijving, duur, TSS; `coach-cockpit.tsx` r188), Sparki-voorstellen, Berichten, Context & afspraken (3 velden r621), Privénotities (1 veld r730).
- Adviesplan: "Overnemen in mijn plan" (`coach-athlete-plan.tsx` r204).

## Toestanden
Leeg: geen sporters → uitnodigen-CTA; "Geen recente activiteit"/"Gegevens ontbreken" per kaart (screenshot). Laden: pulse-skeletons (r428, cockpit r512).

## Rollen/context, mobiel/desktop
Rol getest: `governor-fixture-trainer-1` (2 gekoppelde fixture-sporters: volwassen deelt, jeugd "Deelt niet" — rechtenwerking zichtbaar, geen lek). Desktop: zijbalk Vandaag/Uitnodigen/Profiel; mobiel: bottom-nav. Doodlopend: geen. Cockpit schrijfrechten eisen directe link (team-toewijzing alleen-lezen).

## Bewijs
- `UX_AUDIT_MODULES_SCREENSHOTS/trainer_start_{desktop,mobiel}.png`
- `UX_AUDIT_MODULES_SCREENSHOTS/trainer_invitations_{desktop,mobiel}.png`
- `UX_AUDIT_MODULES_SCREENSHOTS/trainer_meer_{desktop,mobiel}.png` (Meer-menu)
- Codebewijs: `artifacts/sparki/src/components/sparki/coach-home.tsx`, `pages/coach-cockpit.tsx`, `pages/coach-athlete-plan.tsx`.
