# UX-audit — Module Soigneur (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Vaststelling
**Geen eigen UI-module.** `soigneur` bestaat uitsluitend als clubrol:
- Rolenum (`routes/club.ts` r3126); toewijsbaar in Leden & rollen-dropdown (`club-beheer.tsx` r1207) en in organogram-stafplekken (`team-onboarding.ts` r328).
- Rechten: berichten plaatsen toegestaan, géén trainingsbeheer, géén inzage in consent-gebonden sportdata (`club-permissions.ts` r107).
- `/start`-werkgebied: "Verzorging: ondersteuning van de renners rond trainingen en wedstrijden."
- Lege toestand zonder teamtoewijzing: `niet_toegewezen` — vraag de beheerder om teamtoewijzing (`team-onboarding.ts` r403).
- Eigen startscherm ontbreekt: valt terug op CommercialToday/StartPage (`App.tsx` r428-435).

## Toetsbaarheid
**NIET TOETSBAAR als schermmodule**: er is geen governor-fixture met rol soigneur en geen eigen route/scherm om te fotograferen. Bewijs is code-only (paden hierboven) plus de rol-dropdown zichtbaar op `UX_AUDIT_MODULES_SCREENSHOTS/club_beheerder_beheer_desktop.png` (sectie Leden & rollen).

## Route, tabs, formulieren, toestanden
n.v.t. (geen scherm). Doodlopend risico: soigneur die inlogt landt op een generiek sporter-startscherm zonder rolcontext.
