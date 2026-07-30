# Hertest hoogtemeters — echte Twente-route rond Hengelo (Ov)

**Datum:** 2026-07-30 · **Taak:** #431 (hertest van fix uit taak #429) · **Uitgevoerd door:** agent, live tegen de draaiende dev-API.

## Waarom deze hertest

Taak #429 dempte de hm-berekening (smoothing over ±150 m wegafstand + 3 m-hysteresedrempel in
`artifacts/api-server/src/lib/gpx-parse.ts` → `summarizeTrack`) en zette een 100 m-minimumschaal
op de y-as van het hoogteprofiel (`artifacts/sparki/src/components/sparki/elevation-profile.tsx`).
De verificatie destijds was synthetisch. Vóór de fix gaf een vlakke ~48 km-lus ~400 valse hm
(SRTM-ruis naïef gesommeerd). Deze hertest gebruikt een écht, live gegenereerde route.

## Wat is getest

Live routegeneratie via hetzelfde endpoint dat de app gebruikt
(`POST /api/routes/generate`, zie `artifacts/sparki/src/hooks/use-routes.ts`), met de
route-generator + echte providerhoogtes:

- Start: Hengelo (Ov) centrum, 52.2659 N / 6.7930 E (kandidaat start bij Burgemeester Jansenplein)
- Modus: lus (`loop`), sport `cycling`, fiets `racefiets` (routingProfile `cycling-road`)
- Doelafstand: 50 km

## Resultaten (2026-07-30)

| # | Verzoek | Kandidaat | Afstand | Hoogtemeters | Klimmen | Profiel min–max |
|---|---------|-----------|---------|--------------|---------|-----------------|
| 1 | elevationPreference `any` | duurtraining-lus vanuit Burgemeester Jansenplein · 49 km | 49,28 km | **91 m** | 0 | 10–25 m (spreiding 15 m) |
| 2 | elevationPreference `flat`, seed 7 | duurtraining-lus vanuit Burgemeester Jansenplein · 49 km | 49,11 km | **106 m** | 0 | 10–27 m (spreiding 17 m) |

## Beoordeling

- **Hoogtemeters realistisch:** 91–106 hm op ~49 km rond Hengelo is in lijn met wat je in het
  licht glooiende Twentse landschap verwacht (orde tientallen tot ruim honderd hm; vergelijkbare
  Strava/Komoot-lussen rond Hengelo zitten in dezelfde orde). Geen honderden valse hm meer:
  de eerdere ~400 hm-inflatie op een vlakke lus is weg (factor ~4 gedempt).
- **Profiel oogt vlak:** het hoogteprofiel beslaat slechts 10–27 m absolute hoogte
  (spreiding ≤17 m). Met de 100 m-minimumschaal op de y-as (elevation-profile.tsx)
  rendert dit als een vrijwel vlakke lijn — geen bergprofiel-illusie.
- **Klimdetectie consistent:** 0 gedetecteerde klimmen op beide lussen, kloppend bij het vlakke terrein.
- De waarde blijft een schatting op basis van providerhoogtes (SRTM); de UI labelt dit als "(geschat)".

## Conclusie

**GESLAAGD.** De fix uit taak #429 houdt stand op een echte ~50 km-racefietslus rond Hengelo:
hoogtemeters in de realistische orde (91–106 hm, geen honderden valse meters) en een profiel
dat vlak oogt. Ruwe API-antwoorden van de hertest stonden tijdelijk in
`/tmp/route-hengelo.json` en `/tmp/route-hengelo2.json`; de kerngetallen zijn hierboven vastgelegd.
