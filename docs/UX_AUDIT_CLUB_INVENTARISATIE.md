# UX-audit — Module Club (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Route/URL
- `/club` (`App.tsx` r683, `pages/club.tsx`); `/club/beheer` (`App.tsx` r680, `pages/club-beheer.tsx`). Beide ook in `dev-preview.tsx`.
- Meer-menu: hoofdstuk "Club" onder Veelgebruikt, alleen bij lidmaatschap (`lib/core-meer.ts` r120).

## Eerste scherm
Lid: RealClubView — clublogo/naam, ledental, rolgebonden RolStartBlock (`club.tsx` r196/239-291). Geen lid: StartClubCard (club/team oprichten, 3 velden: soort, naam, plaats; r609/635) of LegacyCoachView (r484).

## Secties (verticaal, geen tabs)
Signalen (admin/owner), Jouw start, Hoofdtraineroverzicht (alleen rol hoofdtrainer), Clubtrainingen, Clubwedstrijden & selectie, Berichten, Toestemming/Delen met trainers (ouder ziet jeugd-consent, r437).

## Knoppen/acties
- Primair: "Aanmelden" training (r147), "+ Zet in mijn schema" (r182), "Bericht plaatsen" (1 veld, r408-409), wedstrijd "Beschikbaar".
- Secundair: "Afmelden", "Misschien", "Kopieer code", "Beschikbaarheid doorgeven" (r131/140/226/369), link "Beheer" → `/club/beheer` (alleen owner/admin, r283).

## `/club/beheer` (owner/admin)
Secties: signalen, rollen-uitleg, archiefmelding, Clubinstellingen (contact, kleuren, modules; 3 velden + checkboxes, `club-beheer.tsx` r116), Clubcode & QR, Nieuw lid uitnodigen (1 e-mailveld + relatietoggle, r324), Vaste locaties, Leden & rollen (zoek/filter, rol-dropdown per lid incl. medisch functietype r1207-1212), Seizoenen & teams, Clubtraining plannen (5 velden, r417/438), Clubwedstrijd aanmaken (5 velden, r466/487), Sparki Team-abonnement, Proef & limieten, Verantwoording. Uitgegrijsd: aanmelden/berichten geblokkeerd bij niet-actieve clubstatus (r181).

## Toestanden
Leeg: "Er staan nog geen clubtrainingen gepland" (r334), "Nog geen clubwedstrijden" (r347), "Nog geen clubberichten" (r390) — alle drie zichtbaar op screenshots (echte lege fixture-club). Laden: "Club wordt geladen…" (r259), "Leden worden geladen…".

## Rollen/context, mobiel/desktop
Rollen getest: `governor-fixture-athlete-adult` (lid), `governor-fixture-clubbeheerder` (admin). Club 338, organisatietype CLUB/TEAM-profielen op zelfde tabellen. Mobiel: één kolom, bottom-nav; desktop: bredere kaarten. Doodlopend: geen. Onbereikbaar: `/sprinten` verwijderd (`App.tsx` r745).

## Bewijs
- `UX_AUDIT_MODULES_SCREENSHOTS/club_lid_club_{desktop,mobiel}.png`
- `UX_AUDIT_MODULES_SCREENSHOTS/club_beheerder_club_{desktop,mobiel}.png`
- `UX_AUDIT_MODULES_SCREENSHOTS/club_beheerder_beheer_{desktop,mobiel}.png` (incl. leeg-scenario's)
- `UX_AUDIT_MODULES_SCREENSHOTS/club_beheerder_meer_{desktop,mobiel}.png` (Meer-menu)
- Codebewijs: `artifacts/sparki/src/pages/club.tsx`, `pages/club-beheer.tsx`, `lib/core-meer.ts` r120, `artifacts/api-server/src/routes/club.ts`.
