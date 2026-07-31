# Sparki — Structuurherstel-bouwplan (WP-S1 t/m WP-S10)

**Datum:** 31-07-2026 · **Status:** VOORSTEL — wacht op goedkeuring van René; er start niets automatisch.
Basis: `SPARKI_ROLE_DEVICE_INFORMATION_ARCHITECTURE_AUDIT.md` (+ rolwerkruimte-, navigatie- en uitnodigingsmodel).
Algemene regels voor élk pakket: geen parallel backend- of rechtenmodel; bestaande engines/gates blijven de enige waarheid; klein houden; per pakket eigen bewijs (tests + waar afgesproken Poort 5b-rapport); geen pagina's verwijderen zonder inventarisatiebesluit.

Omvang-schaal: S (≤ halve dag), M (± 1 dag), L (meerdere dagen).

## WP-S1 — Echte DEV-rolimpersonatie en testcontext
- **Doel:** dev-/testbewijs weer geldig maken.
- **Scope:** (1) admin-bypass loskoppelen van impersonatie: geïmpersoneerde identiteit krijgt uitsluitend de rechten die de echte rij heeft (strikte `SPARKI_ADMIN_IDS`/`isHeadTester`-poorten zoals bij de Vandaag-debugweergave app-breed doortrekken voor UI-zichtbaarheid); (2) zichtbaar "TESTCONTEXT"-label met actieve identiteit/rol; (3) dagtype-/scenario-overrides duidelijk markeren als illustratie.
- **Afhankelijkheden:** geen. **Bestanden:** `artifacts/sparki/src/lib/dev.ts`, `dev-preview.tsx`, `artifacts/api-server/src/lib/auth.ts`, `lib/flags.ts`-consumenten.
- **Risico's:** dev-gemak neemt af; tests die op de bypass leunen moeten expliciete tester-fixtures krijgen. **Migraties:** geen.
- **Acceptatie:** een geïmpersoneerde niet-admin ziet géén admin-/tester-UI; label altijd zichtbaar; bestaande suites groen. **Bewijs:** nieuwe test + screenshotpaar. **Omvang:** M.

## WP-S2 — Uitnodiging, account, rolgerichte onboarding en deeplink
- **Doel:** acht concrete flows i.p.v. één abstracte "rol-uitnodiging" (zie `SPARKI_INVITATION_MODEL.md`).
- **Scope:** landing per relatie (ouder → ouderlanding; trainer → trainerslanding; …), taakgerichte knoppen/teksten, deelopties (e-mail via Resend + Web Share/OS-deelmenu), status+acties (intrekken/opnieuw) bij verstuurde uitnodigingen.
- **Afhankelijkheden:** WP-S1 (testbaar bewijs). **Bestanden:** `routes/invitations.ts`, `pages/invitations.tsx`, `invite-accept.tsx`, onboarding-gate/-v2, `parent.ts`, `club.ts`.
- **Risico's:** bestaande open tokens moeten blijven werken (migratieloos: relatie staat al op het token). **Migraties:** hooguit kolom voor "bestemming"; liefst geen.
- **Acceptatie:** elke flow uit het model landt aantoonbaar juist; ouder komt nooit in sporteronboarding. **Bewijs:** flow-testsuite + Poort 5b. **Omvang:** L.

## WP-S3 — Navigatie per rol en apparaat
- **Doel:** één navigatieregister (SSOT) per rol; T-functies uit gebruikersnavigatie.
- **Scope:** register (labels/volgorde/rechten), onderbalk+zijbalk renderen eruit; tester-QR/admin-items alleen `/admin`; Activiteiten in sporter-onderbalk; Meer-groep "Beheer" opschonen.
- **Afhankelijkheden:** WP-S1; besluit René over onderbalkwissel. **Bestanden:** `lib/commercial-shell.ts`, `lib/core-meer.ts`, `commercial-shell.tsx`, `screen-shell.tsx`, `profile-settings.tsx`.
- **Risico's:** gewenning; deeplinks moeten blijven werken (auto-Terug-regels bewaken, zie memorylessen). **Migraties:** geen.
- **Acceptatie:** menu's mobiel/desktop uit één register; geen T-item in gebruikersnav; navigatietest groen. **Bewijs:** `test:navigation`-uitbreiding + Poort 5b. **Omvang:** M/L.

## WP-S4 — Profiel, Lichaam, account en Samen correct plaatsen
- **Doel:** Profiel = persoonlijk/account; lichaamsgegevens direct vindbaar.
- **Scope:** "Samen trainen" van Profiel naar Samen-top (besluit 30-07); Lichaam-sectie met actie **"Nieuw weegmoment"** (bestaande gewichts-API); instellingen logisch ordenen.
- **Afhankelijkheden:** WP-S3 (register). **Bestanden:** `pages/you.tsx`, `pages/samen.tsx`, `profile-settings.tsx`, `pages/lichaam.tsx`.
- **Risico's:** laag. **Migraties:** geen.
- **Acceptatie:** weegmoment in ≤2 tikken vanaf Profiel; Samen-trainen bovenaan Samen. **Bewijs:** UI-test + Poort 5b. **Omvang:** S/M.

## WP-S5 — Hulp, Privacy en Voorwaarden
- **Doel:** ondersteuning en juridisch consistent geplaatst per rol/apparaat.
- **Scope:** vaste plek in Meer/Profiel per rol; ouder-/jeugdvarianten controleren. **Afhankelijkheden:** WP-S3. **Risico's:** laag. **Migraties:** geen. **Acceptatie:** vanaf elke rol-omgeving bereikbaar. **Bewijs:** navigatietest. **Omvang:** S.

## WP-S6 — Sporter-telefoonflows: Vandaag en routeplanner
- **Doel:** telefoon-first afmaken voor de twee belangrijkste sporterflows.
- **Scope:** Vandaag mobiel begeleid (één primaire actie, details na keuze — orchestrator staat er al); routeplanner mobiel vereenvoudigd (hier landt ook het al goedgekeurde vierweergaven-werk incl. "Wedstrijd" — dat werk BLIJFT gepauzeerd tot dit WP start).
- **Afhankelijkheden:** WP-S3/S4. **Bestanden:** Vandaag-secties, `pages/routes*`. **Risico's:** routeplanner is groot — strikt bij weergavelaag blijven. **Migraties:** geen.
- **Acceptatie:** doctrine-check (één primaire actie per scherm) + praktijktest René. **Bewijs:** Poort 5b + praktijktest. **Omvang:** L.

## WP-S7 — Trainerdesktop
- **Doel:** professionele desktopwerkruimte (Sporters/Planning/Voorstellen/Uitnodigingen).
- **Scope:** zijbalk, sporterstabel met filters, cockpit/plan bereikbaar zonder deeplink-kennis, compacte mobiele kernacties. **Afhankelijkheden:** WP-S2/S3. **Bestanden:** `coach-home.tsx`, cockpitpagina's, navigatieregister. **Risico's:** geen nieuwe rechten — alles achter bestaande servergates. **Migraties:** geen. **Acceptatie:** trainerstaken zonder deeplinks uitvoerbaar; isolatie-suites groen. **Bewijs:** suites + Poort 5b. **Omvang:** L.

## WP-S8 — Club-, hoofdtrainer- en ploegleiderdesktop
- **Doel:** beheer- en organisatiewerkruimtes desktop-first.
- **Scope:** clubbeheer-dashboard, hoofdtrainer-organisatieblad, wedstrijddagweergave binnen trainersomgeving (ploegleider = functie, geen nieuwe rol). **Afhankelijkheden:** WP-S7. **Risico's:** hoofdtrainer mag nooit individuele data zien (staat al server-side vast + getest). **Migraties:** geen. **Acceptatie:** rolvandaag + kerntaken per omgeving; 403-grenzen getest. **Bewijs:** suites + Poort 5b. **Omvang:** L.

## WP-S9 — Mechaniekeromgeving
- **Doel:** minimale eigen werkruimte voor de clubrol mechanieker.
- **Scope:** Werkplaats-lijst (materiaalmeldingen van delende sporters), registratie onderhoudsactie; hernoem-besluit sportersscherm "Mechanieker"→"Materiaal". **Afhankelijkheden:** WP-S3/S8 + productbesluit René over gegevensdeling materiaal. **Migraties:** mogelijk deel-toestemming materiaal (fail-closed). **Acceptatie:** mechanieker ziet uitsluitend materiaalgegevens; fail-closed getest. **Bewijs:** nieuwe suite + Poort 5b. **Omvang:** M.

## WP-S10 — Volledige rol-/apparaatacceptatietest
- **Doel:** aantonen dat het geheel klopt.
- **Scope:** matrix rollen × apparaten × kerntaken (analoog aan de Vandaag-17-matrix) + ingelogde validatie (Clerk ticket-login) i.p.v. DEV Preview; geprioriteerde restpuntenlijst. **Afhankelijkheden:** alle vorige. **Acceptatie:** elke rol kan zijn dagelijkse taken op zijn primaire apparaat zonder deeplink-kennis; geen T-functie zichtbaar; alle isolatie-suites groen. **Bewijs:** acceptatierapport + Poort 5b. **Omvang:** M/L.

## Volgorde en pauzeregels
S1 → S2 → S3 → S4/S5 (parallel mogelijk) → S6 → S7 → S8 → S9 → S10.
Gepauzeerd tot expliciete start door René: DEV-previewherstel als los werk (zit in S1), brede routeplanner-herbouw (S6), navigatie per rol (S3), profiel-/lichaamsherindeling (S4), uitnodigings-/onboardingherbouw (S2). Veiligheidsfixes en actieve rechtenlekken mogen tussendoor, mits ze niet op structuurkeuzes wachten.
