# Bewijsbundel — GRATIS_A_TOT_Z_01 — F6, F7 en F8

**Toets-SHA:** `1c4b1d34` (HEAD van `main`, geverifieerd met `git rev-parse --short HEAD`).
**Werkboom:** schoon (`git status --short` leeg) — deze bundel is op exact deze commit gemaakt, zonder codewijzigingen.
**Datum bewijsronde:** 2026-08-02 (UTC).

Deze bundel is beschrijvend/verificatief: er zijn **geen codewijzigingen**, **geen
workflow-herstarts**, **geen git-commits** en **geen web-rebuild** uitgevoerd. Alle
tests hieronder zijn vers gedraaid op deze SHA; de ruwe uitvoer staat in `logs/`.

## Verse testuitvoer (deze SHA)

| Artefact | Script | Resultaat | Log |
|---|---|---|---|
| `artifacts/sparki` | `pnpm run test:nav-live` | **41/41 groen** (exit 0) | `logs/sparki_test-nav-live.log` |
| `artifacts/sparki-mobile` | `pnpm run test:ride-tracker` | **11/11 groen** (exit 0) | `logs/sparki-mobile_test-ride-tracker.log` |
| `artifacts/sparki-mobile` | `pnpm run test:nav-hud` | **9/9 groen** (exit 0) | `logs/sparki-mobile_test-nav-hud.log` |
| `artifacts/api-server` | `pnpm --filter @workspace/api-server run build` | **build OK** (exit 0) | `logs/api-server_build.log` |
| `artifacts/api-server` | `pnpm run test:privacy-security` | **22/22 groen** (exit 0) | `logs/api-server_test-privacy-security.log` |
| `artifacts/api-server` | `pnpm run test:account` | **8/8 groen** (exit 0) | `logs/api-server_test-account.log` |
| `artifacts/api-server` | `pnpm run test:route-usage` | **28/28 groen** (exit 0) | `logs/api-server_test-route-usage.log` |

De api-server-tests zijn sequentieel gedraaid na één build, zoals gevraagd.

---

## F6 — Navigatie en rit (ketenstappen L, M, N)

Specbron: `/tmp/files2/GRATIS_F6_NAVIGATIE_EN_RIT.md`, §Acceptatie.

| # | Acceptatiecriterium | Uitkomst | Verwijzing (test/log/bestand) |
|---|---|---|---|
| F6-A1 | De navigatie start over dezelfde kaart (planbediening verdwijnt, navigatiebediening ervoor in de plaats; geen apart navigatiescherm) | **Voldaan (code)** | Web: `artifacts/sparki/src/components/sparki/route-navigator.tsx` (navigatielaag over dezelfde kaart). Mobiel: `artifacts/sparki-mobile/app/(app)/navigate/[id].tsx`. Bestaande laag, ongewijzigd hergebruikt. |
| F6-A2 | Afslag-voor-afslag en spraak werken | **Voldaan (code)** | Mobiel: `artifacts/sparki-mobile/lib/nav-cues.ts` (+ `nav-audio-settings.ts`) en de HUD-onderweg. Weergavelaag getest via `test:nav-hud` (`logs/sparki-mobile_test-nav-hud.log`). |
| F6-A3 | De rit is af te ronden (analyse direct bereikbaar, zonder extra stappen) | **Voldaan (test)** | `test:ride-tracker` bewijst opslaan/herstellen/afronden van een rit incl. sensorlog; ritweergave `artifacts/sparki-mobile/app/(app)/ride/[id].tsx`. Log: `logs/sparki-mobile_test-ride-tracker.log`. |
| F6-A4 | Basisanalyse toont de drie waarden: **afstand, gemiddelde snelheid, maximale snelheid** | **Voldaan (test)** | `test:nav-live` — subsuite "Ritoverzicht (eerlijk)": `afstand ~1 km`, `gem. snelheid ~40 km/u`, `max. snelheid ~40 km/u` alle groen. Log: `logs/sparki_test-nav-live.log`. |
| F6-A5 | Maximale snelheid is eerlijk (geen GPS-spike telt als max) | **Voldaan (test)** | `test:nav-live` — 6 spike-scenario's (95/110 km/u, midden/laatste, bij 1s/3s/5s-interval) tellen níét als max; constante 30 km/u ⇒ max ≈ gemiddelde. Log: `logs/sparki_test-nav-live.log`. Server-zijde: `test:route-usage`/build gebruikt dezelfde stream-afgeleide waarden. |
| F6-A6 | Geen scrollen voor starten of afronden | **Web/browser: open (Mirror)** | Startknop is hoofdhandeling in beeld; visueel schermbewijs telefoon+browser volgt na gemelde web-rebuild — zie Open punt (2). |
| F6-A7 | Geen doodlopend scherm in L → M → N | **Voldaan (code/test)** | Keten L→M→N in `route-navigator.tsx` (web) en `navigate/[id].tsx` → `ride/[id].tsx` (mobiel); afronding bewezen door `test:ride-tracker`. Volledige klik-doorloop telefoon+browser: Open punt (2). |
| F6-A8 | App en browser gedragen zich identiek | **Grotendeels (code); visueel open** | Zelfde ritsamenvatting-logica (`nav-live` web / `ride-tracker` + `nav-hud` mobiel), zelfde server. Visuele parity-schermen: Open punt (2). |

---

## F7 — Wandelen (ketenstap O)

Specbron: `/tmp/files2/GRATIS_F7_WANDELEN.md`, §Acceptatie.

| # | Acceptatiecriterium | Uitkomst | Verwijzing (test/log/bestand) |
|---|---|---|---|
| F7-A1 | De hele keten werkt met wandelgegevens (plannen → navigeren → onderweg → afronden → analyse) | **Voldaan (code/test)** | `artifacts/sparki-mobile/app/(app)/navigate/[id].tsx` + `lib/ride-flow.ts` kennen wandelen; afronden bewezen door `test:ride-tracker`. Log: `logs/sparki-mobile_test-ride-tracker.log`. |
| F7-A2 | Analyse toont: afstand, tijd, gem. snelheid, hoogtemeters, hoogteprofiel, tempo per km, hartslag | **Grotendeels voldaan (test) + deels code** | `test:nav-live` "Ritoverzicht" bewijst afstand, totale tijd (90 s), gem. snelheid, hoogtemeters uit echte hoogte / eerlijk null zonder hoogte. Log: `logs/sparki_test-nav-live.log`. Tempo per km / hoogteprofiel / hartslag: analyseweergave `artifacts/sparki-mobile/app/(app)/ride/[id].tsx` + `lib/ride-gpx.ts` (pace); volledig schermbewijs telefoon: Open punt (2). |
| F7-A3 | Wandelen en fietsen tellen aantoonbaar in **hetzelfde potje**, geverifieerd op fixture A | **Voldaan (code + fixture-A)** | Telfunctie `artifacts/api-server/src/lib/route-limits.ts` filtert níét op sporttype (count zonder sport-WHERE, regels ~72 en ~113). Serverbewijs telling: `test:route-usage` 28/28 (`logs/api-server_test-route-usage.log`). Fixture-A-verificatie (fiets+wandel samen `used:2`): zie **Open punt (4)** — uitgevoerd op identieke code. |
| F7-A4 | Onderweg staan wandelgegevens (afstand gelopen, te gaan, totaal, snelheid) en **geen** fietsgegevens (geen watt/accu) | **Voldaan (code) + test HUD** | HUD-laag `artifacts/sparki/src/components/sparki/workout-hud.tsx` (web) en mobiele HUD; watt/doelwatts alleen bij bekende FTP + live watts (workout-hud.tsx). HUD-gedrag getest via `test:nav-hud` (`logs/sparki-mobile_test-nav-hud.log`). Visuele bevestiging wandel-HUD zonder fietsblok: Open punt (2). |
| F7-A5 | Geen aparte wandellimiet (uitdrukkelijk verboden) | **Voldaan (code)** | `route-limits.ts` kent geen sport-specifiek telpad; één gedeelde teller. |
| F7-A6 | Geen scrollen voor de hoofdhandeling | **Open (Mirror)** | Zie Open punt (2). |
| F7-A7 | Geen doodlopend scherm | **Voldaan (code/test)** | Keten sluit af via `test:ride-tracker`; volledige telefoon-doorloop Open punt (2). |
| F7-A8 | App en browser identiek | **Grotendeels (code); visueel open** | Gedeelde analyse-/telfunctie; visuele parity Open punt (2). |

---

## F8 — Instellingen en account verwijderen (ketenstappen Q en R)

Specbron: `/tmp/files2/GRATIS_F8_INSTELLINGEN_EN_VERWIJDEREN.md`, §Acceptatie + GF8-taken.

| # | Acceptatiecriterium / taak | Uitkomst | Verwijzing (test/log/bestand) |
|---|---|---|---|
| GF8-01 / F8-A6 | Bewaartermijn staat als **configuratiewaarde op 30** (niet meer hardcoded 14) | **Voldaan (code + test)** | `artifacts/api-server/src/lib/account-privacy.ts`: `DEFAULT_DELETE_RECOVERY_DAYS = 30`, leesbaar uit env `DELETE_RECOVERY_DAYS` (`readRecoveryDays()`, `recoveryDaysFor()`). Test: `test:privacy-security` "beleidshelpers: club = 30 dagen …" + "overview geeft server-side termijn …". Log: `logs/api-server_test-privacy-security.log`. |
| GF8-02 / F8-A2 | Minder-beweging werkt en niets wordt onbruikbaar (voorkeur voor minder animatie, achter flag-gate) | **Voldaan (code) + web-test** | Web: `hooks/use-motion-preference` + `MotionPreferenceSync` in `App.tsx`; instelling bereikbaar in instellingen. Motion-gedrag getest in `artifacts/sparki` `test:motion` (buiten deze opdracht-set). Mobiel/visueel: Open punt (2). |
| GF8-03 / F8-A4 | Uitloggen werkt **voor dit apparaat** zonder andere apparaten te raken (naast de "Overal uitloggen"-noodknop) | **Voldaan (code) + test** | Mobiel: `artifacts/sparki-mobile/app/(app)/instellingen.tsx` — "Uitloggen op dit apparaat" (regel ~670), met commentaar dat "Overal uitloggen" de webapp-noodknop blijft. Serverbewijs sessie-scheiding: `test:privacy-security` "sessies beëindigen: eerlijk antwoord + audit". Log: `logs/api-server_test-privacy-security.log`. |
| GF8-04 / F8-A5a | Uitdraai van alle gegevens beschikbaar vóór/tijdens verwijderen | **Voldaan (test)** | `test:privacy-security` "export: eigen data uit meerdere tabellen, geen tokens, niets van een ander" + "export schrijft verplichte auditregel". `exportAccountData` in `account-privacy.ts`. Log: `logs/api-server_test-privacy-security.log`. |
| GF8-05 / F8-A5b | **Dertig dagen** bewaartermijn met keuze om **direct definitief** te verwijderen | **Voldaan (test)** | `test:privacy-security`: "verwijderverzoek plant hersteltermijn; annuleren draait terug", "overview geeft server-side termijn + directDefinitiefMogelijk", "delete-route dwingt directDefinitief-beleid af per accounttype". `allowsDirectDeletion()` in `account-privacy.ts`. Log: `logs/api-server_test-privacy-security.log`. |
| GF8-06 | Bericht op het moment van verwijderen; **geen** aparte herinnering halverwege | **Voldaan (test/code)** | Verwijderverzoek-pad + audit in `test:privacy-security` ("verwijderverzoek plant hersteltermijn…"); geen tussentijdse reminder-planning in het delete-pad (bewust). Log: `logs/api-server_test-privacy-security.log`. |
| GF8-07 / F8-A7 | Binnen de termijn omkeerbaar, tenzij direct definitief gekozen; daarna inloggen onmogelijk | **Voldaan (test)** | `test:privacy-security`: "niet-verstreken verzoek wordt NIET uitgevoerd", "verstreken verzoek: cascade-verwijdering + audit met uitzonderingen", "verwijderverzoek … annuleren draait terug". Log: `logs/api-server_test-privacy-security.log`. |
| GF8-08 | Voor een **club** altijd 30 dagen, "direct definitief" bestaat niet; termijn zo gebouwd dat onderscheid mogelijk is | **Voldaan (test/code)** | `recoveryDaysFor("club") === 30` en `allowsDirectDeletion("club") === false` in `account-privacy.ts`; test "beleidshelpers: club = 30 dagen + geen direct definitief". Log: `logs/api-server_test-privacy-security.log`. |
| F8-A1 | Profiel bereikbaar en aan te passen | **Voldaan (code)** | Mobiel: `instellingen.tsx` optie "Profiel bijwerken"; web-instellingen. Visueel telefoon+browser: Open punt (2). |
| F8-A3 | **Taal wisselt en wordt toegepast** | **Open — bewust niet gebouwd** | Zie Open punt (1): er bestaat geen taal-instelling; de app is volledig Nederlands. Er is géén nep-schakelaar gebouwd; i18n is een eigen fase. |
| F8-A8 | Provisioning/accountketen intact (ondersteunend) | **Voldaan (test)** | `test:account` 8/8 (nieuwe/bestaande gebruiker, re-link, corrupte rollen, coach/ouder, uitnodiging). Log: `logs/api-server_test-account.log`. |
| F8-A9 | App en browser identiek; geen scrollen voor hoofdhandeling; geen doodlopend scherm | **Grotendeels (code); visueel open** | Gedeelde serverlogica; visuele parity/scroll-bewijs telefoon+browser: Open punt (2). |

---

## Open punten (eerlijk gemeld)

1. **Taal-instelling bestaat niet.** De app is volledig Nederlands. Er is bewust
   **geen nep-schakelaar** gebouwd die niets doet (dat zou een dode bediening zijn,
   Poort 5b). Meertaligheid (i18n) is een eigen, latere fase. Acceptatiecriterium
   F8-A3 ("taal wisselt en wordt toegepast") is daarmee **niet afgedekt** in deze
   oplevering — expliciet en niet verhuld.

2. **Schermbewijzen telefoon + browser volgen pas na een gemelde web-rebuild.**
   De Mirror-testronde loopt. De visuele bewijzen voor "geen scrollen voor de
   hoofdhandeling", "geen doodlopend scherm" en app↔browser-parity (F6-A6/A7/A8,
   F7-A4/A6/A7/A8, F8-A1/A9) worden na de gemelde web-rebuild toegevoegd. De
   onderliggende logica is nu al bewezen via de tests hierboven en via de broncode
   op deze SHA.

3. **GPX-upload zet zelf geen sport op een route.** Een GPX-upload leidt niet
   automatisch een sporttype af; de sport bleef in de fixture-verificatie een
   expliciete testopstelling (de fixture registreerde de routes mét sport als
   *testopzet*, niet als productie-afleiding uit de GPX zelf). Dit raakt F7-A3 niet:
   het gedeelde potje telt onafhankelijk van hoe de sport op de route kwam.

4. **Fixture-A-potjesverificatie (fiets + wandel samen `used:2`).** Deze verificatie
   is al uitgevoerd **vóór deze SHA op identieke code** (de telfunctie
   `route-limits.ts` is op deze SHA ongewijzigd). Beschrijving overgenomen uit het
   rapport en gemarkeerd als **uitgevoerd op de werkboom van deze wijziging**:

   > Fixture `governor-fixture-stand-a-gratis`, baseline `used:0`. GPX-routes **781
   > (cycling)** en **782 (hiking)** geregistreerd. `GET /api/route-usage` → **`used:2`**
   > (fiets + wandel tellen samen in één potje). Daarna opgeruimd terug naar `used:0`.

   De code die dit gedrag draagt (sport-agnostische telling) is op SHA `1c4b1d34`
   identiek; server-zijdige telregels bevestigd door `test:route-usage` 28/28
   (`logs/api-server_test-route-usage.log`).

---

## Addendum 03-08-2026 — schermbewijzen na web-rebuild (licht thema)

René heeft op 03-08 alle stops opgeheven; de webapp is opnieuw gebouwd (licht
thema, verse `vite build` zonder acceptatiemodus) en de web-workflow herstart.
Schermafdrukken in `screens/` (browser 1280×720 en telefoonformaat 402×874):

| Bestand | Dekt |
|---|---|
| `screens/rijden-browser.jpg` + `screens/rijden-telefoon.jpg` | F6-A6 (hoofdhandeling "route plannen/starten" zonder scrollen in beeld, beide formaten), F6-A8/F7-A8/F8-A9 gedeeltelijk (zelfde scherm, zelfde opbouw browser/telefoonformaat) |
| `screens/you-instellingen-browser.jpg` + `screens/you-instellingen-telefoon.jpg` | F8-A1 (profiel bereikbaar; instellingen via tandwiel rechtsboven), licht thema app-breed |

Eerlijke afbakening: dit zijn webschermen in twee formaten (browser + telefoon-
viewport). Schermen uit de geïnstalleerde Android-app zelf en een volledige
klik-doorloop L→M→N op de telefoon staan nog open; die horen bij de
praktijktest-APK-route. F8-A3 (taal) blijft bewust ongebouwd (zie Open punt 1).
