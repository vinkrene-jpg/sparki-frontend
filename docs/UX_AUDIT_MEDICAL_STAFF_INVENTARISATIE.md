# UX-audit — Module Medical Staff (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Vaststelling
**Geen eigen UI-module.** `medical_staff` is een clubrol met beschrijvend functietype:
- Rolenum (`routes/club.ts` r3127) + verplicht `medicalSpecialty` (arts, fysiotherapeut, diëtist, sportpsycholoog, inspanningsfysioloog, overig; r3136-3141); dropdowns in `club-beheer.tsx` r588/1021/1208-1212; organogram-templates (`organogram-templates.ts` r51).
- Rechten: `canViewConsentedData` standaard `false` (`club-permissions.ts` r107); inzage vereist expliciete toestemming per sporter; functietype geeft géén rechten (puur beschrijvend — `tests/team-organisatie.ts` r238).
- Lege toestand: `geen_toestemming` — "Je hebt nog van geen enkele sporter toestemming voor inzage" (`team-onboarding.ts` r401, `routes/club.ts` r3864).

## Toetsbaarheid
**NIET TOETSBAAR als schermmodule**: geen fixture met rol medical_staff en geen eigen route/scherm. Bewijs is code-only + de rol/functietype-dropdown zichtbaar op `UX_AUDIT_MODULES_SCREENSHOTS/club_beheerder_beheer_desktop.png`.

## Route, tabs, formulieren, toestanden
n.v.t. (geen scherm). Feitelijk aandachtspunt: rol bestaat en is toewijsbaar, maar er is geen omgeving waar deze rol iets kán zien zolang consents ontbreken; landing = generiek startscherm.
