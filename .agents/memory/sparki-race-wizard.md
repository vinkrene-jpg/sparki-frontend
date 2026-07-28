---
name: Sparki 5-staps race-wizard
description: Architectuur, provenance-model en dev-demo-pattern van de race wizard.
---

## Wizard-architectuur

- **Component**: `artifacts/sparki/src/components/sparki/race-wizard.tsx`
- Stap 1 Basis → Stap 2 Afgeleid → Stap 3 Aanvullen → Stap 4 Voorstel → Stap 5 Samenvatting
- De wizard vervangt het AANMAKEN van een race; **BEWERKEN** gebruikt nog steeds de platte `RaceForm`.
- Integratie in `races.tsx`: `showWizard` state + `handleWizardSave` mutatie-wrapper.
- De `RaceForm` (edit) en de `RaceWizard` (create) zijn BEIDE actief — nooit verwijderen zonder overleg.

## Provenance-model

Elk formulierveld draagt een `FieldSource`:
- `"user"` — direct ingetypt
- `"calendar"` — overgenomen uit ImportFromCalendar
- `"insight"` — afgeleid via `/api/races/insight` (weer, logistiek, afstand)
- `"profile"` — uit atleetprofiel (vertreklocatie)
- `"ai_proposal"` — geaccepteerd deterministisch voorstel uit stap 4

Stap 5 (Samenvatting) groepeert alle velden per bron — **nooit** verzonnen waarden.

## API-eindpunt stap 4

`GET /api/races/wizard-proposal?raceDate=&discipline=&distanceKm=`

Deterministisch voorstel (priority / goal / preparation + rationale + confidence).
Geregistreerd vóór `/:id/intel` in `races.ts` (anders wordt "wizard-proposal" als id gelezen).

Logica:
- Priority: A als lange koers + nog geen A-doelen dit seizoen; C als ≥2 A-doelen; B anders.
- Doel: nil als ervaring onbekend; anders per exp-level en discipline.
- Voorbereiding: op basis van `daysUntil` (≤3 / ≤7 / ≤14 / ≤28 / rest).

## Dev-demo URL-parameter

`/races?step=N` opent de wizard direct op stap N met `DEMO_FORM` + `DEMO_PROVENANCE` pre-ingevuld.
Alleen actief in dev (geen server-side guard nodig — `demoStep` prop bereikt wizard via `races.tsx`).
Deze koppeling is bewust simpel gehouden: `demoStep != null ? DEMO_FORM : EMPTY_FORM`.

**Why:** Playwright/NixOS library-pad-issues maken directe browser-automatisering traag in dev;
de URL-parameter stelt screenshot-series in staat zonder buildwijzigingen.

**How to apply:** Verwijder NIET de `demoStep`-prop uit de wizard — hij heeft geen productie-effect
maar is onmisbaar voor toekomstige screenshot-validaties en UI-tests van specifieke stappen.

## Bewerken & herkomst — durable regels
- Herkomst (veld→bron) leeft in `logistics.fieldSources` (jsonb). **Why:** zonder persist is edit-verantwoording gokwerk. **How to apply:** elke schrijver van het logistics-object moet MERGEN, nooit vervangen — anders verdwijnen parkeren/navigatie/herkomst stil.
- Herkomst-reconstructie voor races zonder fieldSources moet eerlijk blijven: alleen aantoonbare bron (kalender-importregel in notities), rest = "zelf ingevuld"; nooit insight/ai raden.
- Demo-modus (`?step=N`) mag alleen in de dev-build bestaan (`import.meta.env.DEV`-gate op beide kanten); demo-seeddata mag nooit een opslagpad kunnen bereiken.
