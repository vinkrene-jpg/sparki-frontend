# UX-audit — Module Academy (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Vaststelling (opdracht: alleen bestaan vaststellen)
Er bestaat **geen Academy-module/route**. Wel bestaat "academy" als **contenttype** in de Intel-/kennislaag:
- Seed-items met `kind: "academy"` (masterclasses FTP, Zone 2, herstel, weerbaarheid): `artifacts/api-server/src/lib/intel-seed.ts`.
- Typedefinitie: `artifacts/sparki/src/lib/intel-types.ts`; weergave via `AcademyBody` in `artifacts/sparki/src/components/sparki/intel-reader.tsx` (binnen `/kennis`-omgeving, flag `knowledge_base`).
- Geen route `/academy`, geen Meer-menu-ingang, geen eigen navigatie.

## Toetsbaarheid
Schermaudit n.v.t. (geen module). Er is conform stopregels **niets gebouwd**. Voor MEDIA_UITLEG_01 F8 is dit de vastgestelde herbruikbare basis (route + Help-code, zie F0-inventarisatie).
