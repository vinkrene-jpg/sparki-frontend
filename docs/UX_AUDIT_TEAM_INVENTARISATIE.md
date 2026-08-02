# UX-audit — Module Team (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Route/URL
Geen eigen pagina: TEAM is een **productprofiel + abonnementstier op het clubmodel** (`organisationType` CLUB/TEAM, `routes/club.ts` r166; tier TEAM r739). UI leeft in `/club` en `/club/beheer`.

## Zichtbare onderdelen
- `/club/beheer` sectie "Seizoenen & teams": teams aanmaken/lijst (TESTFIXTURE Team A selectie wedstrijd / Team B selectie jeugd), seizoen instellen, trainer-toewijzing per team.
- Organogram-kaarten: stafplek-templates (conceptstructuur, géén rechten; `club-beheer.tsx` r631, API `routes/club.ts` r3458/3587, `organogram-templates.ts`).
- "Sparki Team"-abonnementsblok + "Proef & limieten" in `/club/beheer` (tier-weergave).
- Rol-startblokken per teamfunctie via `/start`-API (team-onboarding, o.a. lege toestanden `niet_toegewezen`, `geen_toestemming`, `nog_niet_ingericht`; `team-onboarding.ts` r401-403).

## Acties/formulieren
Team aanmaken (naam + type), trainer koppelen (dropdown), organogram-kaart toevoegen (additief + idempotent). Signaal zichtbaar op beheer-screenshot: "Team B heeft geen trainer … wijs een trainer toe".

## Toestanden
Leeg: teams zonder trainer → signaalkaart; stafplekken onbezet → organogram-lege plekken. Fout/laden: standaard beheer-patronen.

## Rollen/context, mobiel/desktop
Rol getest: `governor-fixture-clubbeheerder`. TEAM-gate server-side (memory/tests `team-abonnement`). Mobiel/desktop identiek aan clubbeheer (één kolom vs breder). Geen tabs. Doodlopend: geen; organogram alleen bereikbaar via `/club/beheer`.

## Bewijs
- `UX_AUDIT_MODULES_SCREENSHOTS/team_beheer_teams_{desktop,mobiel}.png`
- Codebewijs: `artifacts/sparki/src/pages/club-beheer.tsx` r631+, `artifacts/api-server/src/routes/club.ts` r166/739/3458/3587, `artifacts/api-server/src/lib/organogram-templates.ts`.

## Aanvulling 02-08-2026 (F9)

> Nagelezen tegen main `56985d32e8909a55fb30f8c1aadf0c0460a888ff` (2 augustus 2026). Bestaande tekst klopt: TEAM heeft geen eigen scherm, leeft binnen `/club/beheer` (sectie Seizoenen & teams). Rol+omgeving via `ScreenShell`/`DsContextRegel`.

### F9-regelovertredingen (werklijst)
1. **Erft alle overtredingen van `/club/beheer`** (zie UX_AUDIT_CLUB, Aanvulling): de team-onderdelen zitten diep in een 13-secties-pagina en vallen ver onder de vouw (`TUX-24`/`TUX-25`).
2. **Team aanmaken + trainer koppelen + organogram-kaart** zijn drie inline formulierhandelingen (schendt "max één primaire actie" + `TUX-27`): geen stappenvenster.
3. **Geen apart teamdetailscherm** (schendt "details apart scherm"): teams, staf en organogram worden inline bewerkt.
4. Signaalkaarten ("Team B heeft geen trainer") zijn correcte lege/actietoestanden — geen uitgegrijsde beheeropties waargenomen.
