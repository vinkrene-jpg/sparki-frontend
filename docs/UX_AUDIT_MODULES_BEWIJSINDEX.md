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
