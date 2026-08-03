# TRAINEN_DOELEN_SEIZOEN_01 — F0 Inventarisatie (geen code)

**Datum:** 03-08-2026 · **Basis-SHA:** `a5824131`

## 1. Aanroepen van het doelenwerkblad (GoalsWorksheet)

| Plaats | Wat |
|---|---|
| `artifacts/sparki/src/pages/you.tsx:1150` | render in sectie `#doelen` op /you (primaire plek — verhuist in F4) |
| `artifacts/sparki/src/components/sparki/beheer-popup.tsx:61` | `DoelenBeheerSheet` popup-wrapper |
| `artifacts/sparki/src/pages/core-analyse.tsx:1698` | opent DoelenBeheerSheet via "Beheer"/"Voeg een doel toe" |
| Deep-links `/you?focus=doelen`: `core-plan.tsx:1250`, `core-plan.tsx:1259`, `components/sparki/train/goal-layer.tsx:85`, `components/sparki/goal-context-line.tsx:40` | verwijzen in F4 naar Trainen |
| `lib/chapters.ts:47,60` ("Profiel & doelen"), `lib/zoekregister.ts:36` | navigatie/zoek — F4 hertekst |
| `hooks/use-goals.ts` | logica onder het werkblad (blijft) |

## 2. Schrijfpaden naar `athlete_goals`

| Plaats | Wat |
|---|---|
| `api-server/src/routes/goals.ts:215` | POST /api/goals — insert (sporter) |
| `api-server/src/routes/goals.ts:199` | POST met dedupeTitlePrefix — update bestaand |
| `api-server/src/routes/goals.ts:339` | PUT /api/goals/:id — update |
| `api-server/src/routes/goals.ts:383` | DELETE — soft-drop (status "dropped") |
| `api-server/src/routes/goals.ts:491` | trainervoorstel-acceptatie — insert (origin "trainervoorstel") |
| `api-server/src/lib/goals.ts:897` (`decideProposal`) | engine-update na geaccepteerd voorstel |

## 3. Lezers van `derivePhase` / fase

| Plaats | Wat |
|---|---|
| `api-server/src/lib/training-plan.ts:116` | definitie (daysAway → taper/peak/build/base) |
| `training-plan.ts:288` (`gatherInputs`) | anker = eerstvolgende wedstrijd (A eerst) — **F6 wijzigt dit naar hoofddoel** |
| `training-plan.ts:407-411` `qualityDaysFor`, `:438-442` `weekFactor`, `:508`, `:577`, `:666-676` `templateSummary`, `:752-764` `buildAiContent` | consumeren `PlanInputs.phase` |
| `lib/training/plan-generator.ts:134` (`phaseForWeek`), `:456` | eigen weekfasering binnen programma |
| `routes/ai.ts:517,591,779` → `lib/athlete-context.ts:68-73` | fase per planned_workout in AI-context |
| Frontend: `sparki/src/lib/train-intelligence.ts:82-87,118-119`, `hooks/use-training-plan.ts:382` | faselabels/taperWindow |

## 4. Plaatsen die een belastingscore verwachten

| Plaats | Wat |
|---|---|
| `api-server/src/lib/derived-load.ts` (`deriveTss`) | vermogen+FTP → TSS (SSOT; **F3 voegt hartslagmaat APART toe, nooit optellen**) |
| `api-server/src/lib/recovery-load.ts` (`computeLoad`, `computeLoadSeries`, `computeRiskSignal`) | EWMA CTL/ATL/TSB |
| `engines/ai-foundation/data-engine.ts` | aggregatie via computeLoadSeries |
| `routes/athlete.ts:517-541` (me), `:2297-2335` (load), `:1994` (sessions), `:613,706` (workouts targetTSS) | API |
| `sparki/src/lib/analyse-dashboard.ts:109-112,161,384-395` | UI-rekenkern |
| UI: `training-progression.tsx`, `commercial-shell.tsx:496,1221`, `add-training.tsx:74,194-196`, `three-week-plan.tsx:218-220,263`, `workout-detail-drawer.tsx:444`, `route-navigator.tsx:1994-2004,2086` | tonen/invoeren |
| `engines/core-prediction/predict.ts:132-134` | loadScore-weging |

## 5. Voedingslaag die trainingsdata leest

| Plaats | Wat |
|---|---|
| `routes/nutrition.ts:108-124` `summarizeDayEffort` | targetDurationMin/targetTSS + races.distanceKm |
| `routes/nutrition.ts:143-159` `buildDayFuelTargets` | 90d sessies (TSB) |
| `routes/nutrition.ts:295-312` `buildMealContext` | echte sessie of geplande workout |
| `routes/nutrition.ts:1392-1450` `/fueling-plan` | workouts+races → AI-prompt |
| `lib/nutrition-rules.ts:17-29` | log.context training_day/race_day — **kent fase niet (F12 maakt fase leesbaar)** |
| `lib/fueling.ts:117-177,251-266` | duur/targetTss/tsb → richtwaarden (SSOT blijft) |

## 6. Verklaring vooraf per fase — hergebruik vs nieuw

| Fase | Hergebruik (bestand) | Nieuw |
|---|---|---|
| F1 | `dayKindFor`/generator in `lib/training-plan.ts`; `planned_workouts` schema `lib/db/src/schema` | kolom `zone` (enum-tekst) op planned_workouts + uitvoeringskant; generator schrijft zone; migratie; bestaand blijft null |
| F2 | `athlete_profiles` schema; sessies-ingest (Data Hub); meldingenpatroon TD-17 analoog aan belastingscore-uitleg | kolom `measurement_level`; per sessie signalenregistratie (power/hr/duur ja/nee); eerlijke per-rit-melding; instel-UI |
| F3 | `lib/derived-load.ts` patroon; hartslagvelden `athlete-metrics.ts` (resting_hr/max_hr), `activity-streams.ts`; `recovery-load.ts` | `deriveHrLoad` (TRIMP-achtig) als APARTE maat + bronveld; nooit optellen bij vermogens-TSS |
| F4 | `GoalsWorksheet`, `use-goals.ts`, `goals.ts` routes, `parentGoalId` (bestaat) | verplaatsing naar /train; verplichte oude-doelkeuze in POST-pad; datumplicht hoofddoel; doorvraagladder-UI; doelvormvoorstel |
| F5 | bevestigingspatronen (bestaande sheets) | verschilscherm vóór kalenderwijziging; server-side guard |
| F6 | `derivePhase`/`gatherInputs` in `training-plan.ts` | ankerbron hoofddoel eerst, wedstrijd tweede; ritmegedrag als fallback |
| F7 | `HORIZON_DAYS` blijft; `plan-generator.ts` weekfasering | seizoenslaag (weekdoelen), gegenereerde versleepbare vormblokken, vijfde fase `onderhoud` |
| F8 | `races` schema (priority bestaat) | tweede veld eigen rol; promotielogica label-only + bevestiging |
| F9 | race-result/reflectie (naslagwerk, race-flow) | uitslagvraag na hoofddoelwedstrijd; status "onbeoordeeld" |
| F10 | doelen-schema themes/schuifbalk; jeugdregels (leeftijdsbanden-poort) | ritme-weekdoel + proxy's (max 2); <14 dagenbeeld zonder getallen; oudergelijk beeld |
| F11 | notificatieregels (reminder-delivery); planverlenging via generator | verlenging 80%→duurniveau, configureerbaar max (default 4 wk) + actieve melding |
| F12 | `lib/fueling.ts` SSOT, `nutrition.ts` leest al plan/sessies; RED-S-poort `season-goal.ts` | fase doorgeven aan fueling; inname per geplande training (a); doorklik week/blok (b); maaltijdbouwer huishouden zonder medebewoner-profielen (c) |

Geen tweede doelenmodel, plangenerator, belastingmaat of voedingsmodel.
