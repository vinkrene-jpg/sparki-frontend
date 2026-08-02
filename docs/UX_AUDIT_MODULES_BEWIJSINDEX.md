# UX-audit — Bewijsindex modules (UX_AUDIT_MODULES_01A)

Branch `main` · vaste SHA `3452844e91a095c97096c361dd86180c5782238b` · datum 01-08-2026 · rol-testidentiteiten: governor-fixtures (club 338, teams 407/408, 16 gebruikers) · methode: eigen Playwright/Chromium-run tegen de dev-server (DEV Preview + `x-dev-clerk-id`), full-page screenshots op 1440 px (desktop) en 390 px (mobiel).

**Eerlijkheidsnoten**
- DEV Preview heeft een eigen routetabel en lost de gebruiker op als head-tester; flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde Clerk-sessie.
- Soigneur en Medical Staff: geen eigen scherm en geen fixture → NIET TOETSBAAR als schermmodule (code-bewijs wel geleverd).
- Academy: bestaat alleen als contenttype, geen module.
- Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden.

## Overzichtstabel

| module | route | rol | secties | tabs | kaarten_boven_vouw | primaire_acties | formulier_velden | leeg_tabblad | rechtenlek_zichtbaar | mobiel_bewijs | desktop_bewijs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ploegleider | /club, /wedstrijd-room | governor-fixture-ploegleider | 4 (club) + 3 (room) | 0 | 2 | room maken; selecties vragen | 3–4 (room) | rooms leeg | nee | ploegleider_club_mobiel.png | ploegleider_club_desktop.png |
| Club | /club | governor-fixture-athlete-adult | 6 | 0 | 2–3 | aanmelden training; bericht plaatsen | 1 (bericht), 3 (oprichten) | trainingen/wedstrijden/berichten leeg | nee | club_lid_club_mobiel.png | club_lid_club_desktop.png |
| Club (beheer) | /club/beheer | governor-fixture-clubbeheerder | 13 | 0 | 3 | training/wedstrijd plannen; lid uitnodigen | 5+5+1+3 | locaties leeg | nee | club_beheerder_beheer_mobiel.png | club_beheerder_beheer_desktop.png |
| Team | /club/beheer (Seizoenen & teams) | governor-fixture-clubbeheerder | 4 | 0 | 2 | team aanmaken; trainer toewijzen | 2 | stafplekken onbezet | nee | team_beheer_teams_mobiel.png | team_beheer_teams_desktop.png |
| Trainer | / (CoachHome), /coach/…/cockpit | governor-fixture-trainer-1 | 3 | rolwissel (RoleViewSwitch) | 3 | cockpit openen; bulkplannen | 4–5 (bulk/workout) | geen dringende zaken | nee — jeugd toont "Deelt niet" | trainer_start_mobiel.png | trainer_start_desktop.png |
| Hoofdtrainer | / + /club (overzicht) | governor-fixture-hoofdtrainer | 7 | rolwissel | 2 | eerste training plannen | n.v.t. | trainingen/berichten leeg | nee — bewust zonder gezondheidsdata | hoofdtrainer_club_mobiel.png | hoofdtrainer_club_desktop.png |
| Mechanieker | /mechanieker | governor-fixture-mechanieker | 9 | 0 | 2 | fiets toevoegen; foto-analyse | ~5 (vergelijkingstest) | garage/uitrusting leeg | nee | mechanieker_mechanieker_mobiel.png | mechanieker_mechanieker_desktop.png |
| Soigneur | — (geen scherm) | NIET TOETSBAAR | — | — | — | — | — | — | — | — | — |
| Medical Staff | — (geen scherm) | NIET TOETSBAAR | — | — | — | — | — | — | — | — | — |
| Beheer | /admin, /admin/ops | governor-fixture-admin (dev-adminresolutie) | 12+ / 3 | 0 | 2 | Controleer nu; systeemmodus | 1–2 per tool | n.v.t. | nee | beheer_admin_mobiel.png | beheer_admin_desktop.png |
| Academy | — (alleen contenttype) | n.v.t. | — | — | — | — | — | — | — | — | — |

## Bestandslijst bewijs
Alle screenshots in `docs/UX_AUDIT_MODULES_SCREENSHOTS/` (2 breedtes per capture):
ploegleider_club, ploegleider_wedstrijdroom, ploegleider_meer, club_lid_club, club_beheerder_club, club_beheerder_beheer, club_beheerder_meer, team_beheer_teams, trainer_start, trainer_invitations, trainer_meer, hoofdtrainer_start, hoofdtrainer_club, mechanieker_mechanieker, mechanieker_meer, beheer_admin, beheer_admin_ops.

Meer-menu-bewijs: *_meer.png (ploegleider, trainer, mechanieker, clubbeheerder). Leeg-/foutscenario: lege club- en garagesecties op bovengenoemde screenshots (echte lege toestanden).

## Aanvulling 02-08-2026 (F9) — bijgewerkte stand

De oorspronkelijke bewijsindex (SHA `3452844e…`, 01-08-2026) blijft staan als vastlegging. Op **02-08-2026** zijn de tien inventarisaties nagelezen tegen main `56985d32e8909a55fb30f8c1aadf0c0460a888ff` en aangevuld met de F9-toetsing (beide regelsets: `SPARKI_BUILD_01` + `SPARKI_TELEFOON_UX_01` v1.1, nu aanwezig in `docs/product/`). Routes bleken inhoudelijk gelijk; alleen regelnummers in `App.tsx` verschoven (nu r713-885). Geen nieuwe screenshots gemaakt in deze docs-ronde; de voor/na-bundel hoort bij de herindelingsfase zelf.

### F9-gapmatrix per module (schendingen = werklijst voor herindeling)

| module | scherm | rol+omgeving zichtbaar | ≤1 primaire actie | ≤4 kaarten boven vouw | 2–4 echte tabs | weglaten i.p.v. uitgrijzen | details apart scherm | hoofdhandeling in beeld (`TUX-26`) | stappenvenster i.p.v. lang formulier (`TUX-27`) |
|---|---|---|---|---|---|---|---|---|---|
| Beheer | /admin | **NEE** (kale `<main>`, geen ScreenShell) | **NEE** (Controleer nu/Droogdraai/Uitvoeren) | **NEE** (~12 secties) | **NEE** (geen tabs) | **NEE** ("Nog opzetten" grijs) | deels (alleen health) | deels | **NEE** (opschoning/shutdown inline) |
| Beheer | /admin/ops | ja (ScreenShell) | **NEE** (modusknoppen) | ja (3 panelen) | **NEE** | ja | **NEE** (OpsLog inline) | ja | **NEE** (shutdown-bevestiging inline) |
| Club (lid) | /club | ja | **NEE** (4 acties) | **NEE** (6 secties) | **NEE** | ja | ja | **NEE** | **NEE** (bericht inline) |
| Club (beheer) | /club/beheer | ja | **NEE** (3 formulierhandelingen) | **NEE** (13 secties) | **NEE** | **NEE** (uitgegrijsd bij inactieve club) | **NEE** (leden/teams inline) | **NEE** | **NEE** (5+5 velden inline) |
| Team | /club/beheer (Seizoenen & teams) | ja | **NEE** | **NEE** (erft clubbeheer) | **NEE** | ja | **NEE** (organogram inline) | **NEE** | **NEE** |
| Trainer | / (CoachHome), /coach/…/cockpit | ja | **NEE** | **NEE** (cockpit gestapeld) | **NEE** (RoleViewSwitch ≠ tabs) | grensgeval ("Deelt niet"-kaart) | ja (cockpit/plan apart) | **NEE** | **NEE** (Bulk/WorkoutForm inline) |
| Hoofdtrainer | / + /club | ja | ja (planning) | **NEE** (~7 secties) | **NEE** | ja | ja | **NEE** | n.v.t. |
| Ploegleider | /club, /wedstrijd-room | ja | **NEE** | **NEE** (room-blokken) | grensgeval | ja | ja | **NEE** | **NEE** (room maken inline) |
| Mechanieker | /mechanieker | ja | **NEE** (5+ acties) | **NEE** (9 secties) | **NEE** | ja | ja | **NEE** | **NEE** (test/schatting inline) |
| Soigneur | — (geen scherm) | **NEE** (generieke landing) | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. |
| Medical Staff | — (geen scherm) | **NEE** (generieke landing) | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. |
| Academy | — (contenttype) | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. |

**Zwaartepunt (F9-volgorde):** clubbeheer eerst (13 secties, meeste overtredingen), dan `/club` (lid) en mechanieker (9 secties), dan beheer/admin (rol+omgeving ontbreekt + ~12 secties). Team/hoofdtrainer/ploegleider erven grotendeels van club. Soigneur/medical_staff/academy hebben geen schermindelingsgap — alleen een landings-/rolcontextgap (soigneur, medical_staff).
