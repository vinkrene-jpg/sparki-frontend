# UX-audit — Module Ploegleider (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Route/URL
- Geen eigen pagina. Ploegleider is een **clubcontextrol** (geen platformrol): rol-startblok op `/club` (api-server `routes/club.ts` r3821) en beheerrechten in clubcontext (`routes/club.ts` r2113).
- Verwante functionaliteit: Wedstrijd-room `/wedstrijd-room` (`App.tsx` r748, `pages/wedstrijd-room.tsx`) en Volgauto-paneel (`components/sparki/volgauto-panel.tsx`, API `routes/volgauto.ts`) — bereikbaar via route-detail, niet rolgebonden afgeschermd.

## Eerste scherm
`/club` → RealClubView met "Jouw rol: ploegleider"-startblok; actie "Vraag beheerder om selecties" bij lege selecties.

## Secties, kaarten, tabs
- `/club`: Jouw start (rolblok), Clubtrainingen, Wedstrijden & selectie, Berichten. Geen tabs.
- `/wedstrijd-room`: RoomList → per room secties "Foto's & clips", "Updates", "Dagcompilatie" (`wedstrijd-room.tsx` r550/658/769).
- Volgauto-kaart: fiets- vs autoroute, gedeelde km, splitsingen, aansluitpunten, ETA (altijd "geschat") (`volgauto-panel.tsx` r101).

## Acties en formulieren
- Primair: "+ Room maken" (3–4 velden: titel, startdatum, aantal dagen, optioneel wedstrijd; `wedstrijd-room.tsx` r258), media "Uploaden", "Maak dagcompilatie", volgauto aan/uit.
- Secundair: "Download" compilatie, "Room verwijderen", rit-update plaatsen (1 textarea, r687).

## Toestanden
- Leeg: "Nog geen wedstrijd-room" (r177), "Nog geen media voor deze dag" (r581); clubsecties leeg in fixture-club (zie screenshots).
- Fout: "Aanmaken is mislukt" (r248), "Uploaden is mislukt" (r542). Laden: "Bezig…", "Compilatie wordt gemaakt…".

## Rollen/context, mobiel/desktop
- Rol getest: `governor-fixture-ploegleider` (clubRole ploegleider, activeRole athlete). Organisatie: TESTFIXTURE Governor Club (id 338), teams 407/408.
- Mobiel: zelfde verticale opbouw, bottom-nav; desktop: zijnavigatie. Geen uitgegrijsde functies aangetroffen; geen doodlopend scherm; wedstrijd-room is alleen via directe URL bereikbaar (geen Meer-menu-ingang gevonden) → aandachtspunt bereikbaarheid.

## Bewijs
- `UX_AUDIT_MODULES_SCREENSHOTS/ploegleider_club_{desktop,mobiel}.png`
- `UX_AUDIT_MODULES_SCREENSHOTS/ploegleider_wedstrijdroom_{desktop,mobiel}.png` (leeg-scenario)
- `UX_AUDIT_MODULES_SCREENSHOTS/ploegleider_meer_{desktop,mobiel}.png`
- Codebewijs: `artifacts/sparki/src/pages/wedstrijd-room.tsx`, `artifacts/sparki/src/components/sparki/volgauto-panel.tsx`, `artifacts/api-server/src/routes/volgauto.ts`, `artifacts/api-server/src/routes/club.ts` r2113/r3821.
