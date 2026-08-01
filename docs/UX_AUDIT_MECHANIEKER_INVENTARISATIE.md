# UX-audit — Module Mechanieker (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Route/URL
- Sporterpagina `/mechanieker` (`App.tsx` r733, `dev-preview.tsx` r537; `pages/mechanieker.tsx`). Meer-menu: "Sport & materiaal → Mechanieker" (Wrench, hint "Fiets & onderhoud"; `core-meer.ts` r129, `chapters.ts` r42) — athlete-only in navigatie (`chapters.ts` r123).
- Daarnaast clubcontextrol `mechanieker`: alleen materiaal-/veiligheidsvelden op trainingen/wedstrijden bewerken (`club-permissions.ts` r96; NIET in `canManageTrainings` r82; `routes/club.ts` r1796/2210). Geen eigen clubscherm; rol-startblok via `/club`.

## Eerste scherm & secties
Kop "Mechanieker" + uitleg; secties: Onderhoudssignalen, Fietsengarage (Bike3DWerkblad), Persoonlijke uitrusting, Draadloze onderdelen, Nieuwe ontwikkelingen (feed), Profploegen en hun materiaal, Vergelijkingstest, Modelschatting bij aankoop, Materiaalcoach (fotoanalyse) — alle zichtbaar op screenshot.

## Acties/formulieren
"Fiets toevoegen", "Uitrusting toevoegen", "Draadloos onderdeel", vergelijkingstest (~5 velden: categorie, merk, model, rit A, rit B; `material-test.tsx`), modelschatting (2 velden + dropdowns), "Foto toevoegen" (Materiaalcoach, chips per onderdeel), "Naar mijn activiteiten".

## Toestanden
Leeg: "Nog geen fietsen in de garage", geen uitrusting, geen draadloze onderdelen, onderhoudssignalen leeg (fixture zonder materiaal — zichtbaar). Vergelijkingstest eist ≥2 echte testritten (eerlijke uitleg i.p.v. nepdata).

## Rollen/context, mobiel/desktop
Rol getest: `governor-fixture-mechanieker` (athlete + clubRole mechanieker). Mobiel: gestapeld; desktop: zijnav + sfeerachtergrond. Doodlopend: geen. Clubrol-mechanieker heeft geen eigen scherm (alleen veldrechten) — NIET verder toetsbaar zonder training met materiaalvelden.

## Bewijs
- `UX_AUDIT_MODULES_SCREENSHOTS/mechanieker_mechanieker_{desktop,mobiel}.png` (incl. leeg-scenario's)
- `UX_AUDIT_MODULES_SCREENSHOTS/mechanieker_meer_{desktop,mobiel}.png`
- Codebewijs: `artifacts/sparki/src/pages/mechanieker.tsx`, `components/sparki/{bike-garage,material-test,material-coach,maintenance-signals,bike-3d-werkblad}.tsx`, `artifacts/api-server/src/lib/club-permissions.ts` r82/96.
