# TRAININGSVORMEN_01 — F0 Inventarisatie en meting (TRV-23/24/25)

Datum: 2026-08-03 · Geen code gewijzigd. Elke vaststelling met pad + regelnummer; onbekend blijft onbekend.

## Zeven metingen (TRV-23)

**1. Gestructureerd trainingsobject — BESTAAT.**
`planned_workouts.structure` (jsonb) in `lib/db/src/schema/athlete-training.ts`:
`WorkoutStructure` (r578–588: phase, blocks, intensity, primaryZone, rationale) en
`WorkoutBlock` (r556–565: kind warmup/interval/recovery/steady/cooldown, durationMin,
zone 1–6, targetPctFtp, reps). Generator: `artifacts/api-server/src/lib/training/plan-generator.ts`
`buildWorkout` (r165–353). Conclusie TRV-22/TRV-24: F1 breidt DIT object uit; er komt geen tweede model.

**2. Belastingsschatting vooraf — BESTAAT.**
`planned_workouts.targetTSS` (athlete-training.ts r221), `workout_series.targetTSS` (r175);
berekening `tssFromBlocks` (plan-generator.ts r76–83), gevuld bij planopbouw (r511).
`plan_days.estDurationMin` (r330) voor niet-gecommitte horizon-dagen. De sleepvooruitblik (F4)
kan hierop bouwen; F2 hoeft geen belastingsschatting te bouwen, wel de tweede as.

**3. Workout-bibliotheek/oefeningenlijst — BESTAAT NIET (als bibliotheek).**
Geen fysieke oefeningenbibliotheek met parameterbereiken. Wel: skeleton-sjablonen
`buildSkeleton` (lib/training-plan.ts r688) en `templateSummary` (r881) — plangeneratie,
geen kiesbare vormen. Mentale Bibliotheek (6 technieken) in
`artifacts/api-server/src/engines/mental/index.ts` r123–167 — ander domein.
De mediapilot van zes oefeningen is alleen conceptueel vastgelegd
(`docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_OPEN_AFHANKELIJKHEDEN.md` r39);
`CMP-43`-oefenkaart is placeholder (`artifacts/sparki/src/components/sparki/train/today-layer.tsx` r64).

**4. Export structured workout — DEELS.**
FIT-workout-export bestaat: `buildFitWorkout` (artifacts/api-server/src/lib/race-export/index.ts r437)
en `buildFitCourse` (r359). Garmin-sync voor routes/activiteiten:
`lib/connectors/providers/device-sync.ts`. Geen .zwo/Zwift-export gevonden. Import: .fit/.gpx/.tcx
(`lib/activity-file-ingest.ts`).

**5. Niet-fietsactiviteiten — VELDEN BESTAAN, belasting gedeeltelijk.**
`training_sessions.sport` (athlete-training.ts r81) met registry `HUB_SPORTS`
(`engines/data-hub/sports.ts` r12: o.a. running, hiking, swimming, team_sport; kracht valt nu
onder team_sport-aliasing r81–88). `tss` blijft null zonder vermogen tenzij bron hem levert
(ingest r158); `hr_load` server-side berekend zonder vermogen mits HR+duur+profiel
(ingest r175, deriveHrLoad hr-load.ts r10). Kracht/baan/mobiliteit krijgen dus vaak GEEN
belastingswaarde → bevestigt de noodzaak van TRV-13/TRV-31 (belastingssoort i.p.v.
misleidend laag getal). Er bestaat géén aparte discipline "kracht/mobiliteit/techniek/baan"
in de sportregistry — F1-besluit nodig (zie open punten, soort A).

**6. Status DOELEN_01 — NIET GEBOUWD als pakket; er bestaat wél een doelenlaag.**
`lib/db/src/schema/goals.ts` (status r78, voorstellen r180) + `lib/goals.ts` voortgang/verdicts
(TRAINEN_DOELEN_SEIZOEN_01 F4/F9). De formele DOELEN_01-doelbewaking uit de wachtrij is niet
gebouwd. Conform TRV-43: afwijkingen worden vastgelegd; de doelgevolg-melding haakt op de
bestaande doelvoortgang (`niet_meetbaar`/`risico`-verdicts) zodra F5 dat nodig heeft — geen
eigen doelbenadering in dit pakket.

**7. Trainer-sporterrelatie — BESTAAT, "zonder trainer" betrouwbaar bepaalbaar.**
Directe link: `coach_athlete_links` via `hasDirectCoachLink` (lib/sharing.ts r220);
clubtoewijzing: `club_trainer_assignments` (r126, alleen zichtbaarheid).
"Sporter zonder trainer" = geen geaccepteerde link (`hasAcceptedCoachLink` sharing.ts r95);
`athlete_profiles.coaching_mode` (athlete-profiles.ts r36) is de expliciete sporterkeuze.
Let op: clubteamlid zonder individuele coach is "zonder trainer" voor TRV-19/42/43,
maar wel zichtbaar voor clubtrainers.

## Hergebruikmatrix (TRV-25, hoofdstuk 3)

| Onderdeel | Vindplaats | Status |
|---|---|---|
| Belastingsmodel TSS/CTL/ATL/TSB | `lib/recovery-load.ts` computeLoadSeries r62, computeLoad r15; engine `engines/recovery-load/index.ts` r15 | bestaat |
| KENNIS_01 | `lib/db/src/schema/knowledge.ts` r14+ (bronnen, url/doi, publicatiestatus) | bestaat |
| MEDIA_UITLEG_01 weergavelaag | `components/sparki/media-preview.tsx` r6; oefenkaart CMP-43 = placeholder (today-layer.tsx r64) | deels — speler bestaat, oefenkaart niet |
| AI_INTELLIGENCE_ENGINE_02 | `lib/ai/gateway.ts` aiMessage r26; adviesdossier `lib/db/src/schema/advice-dossiers.ts` r42–43 (confidence) | bestaat |
| DOELEN_01 doelbewaking | `lib/db/src/schema/goals.ts` r78/r180 + `lib/goals.ts` | deels — doelenlaag bestaat, formeel pakket niet |
| Werkobjectlaag (pakket 02) | `lib/db/src/schema/work-objects.ts` r14+, levenscyclus r25 | bestaat |
| PD-1 agenda / PD-2 locaties / PD-3 contacten | `life-events.ts` r12 + `club.ts` club_race_events r406 / club_locations / `contacts.ts` r1 | bestaat |
| MOBILE_UX + componentbibliotheek | web ds/: `artifacts/sparki/src/components/ds/`; mobiel: `artifacts/sparki-mobile/components/` (geen ds/-map) | bestaat (web), mobiel losse componenten |
| Marktplaats (19_PLAN_MARKTPLAATS_01) | alleen specificatie in `attached_assets/SPARKI_OPDRACHTEN_19_23_uitgepakt/`; geen code | bestaat niet in code |

## Gevolgen voor de fasering (TRV-24)

- Gestructureerd object + vooraf-belasting bestaan → F1 bouwt `training_forms` als
  bibliotheeklaag BOVEN `planned_workouts.structure` (WorkoutBlock hergebruikt als
  blokvorm van een geplaatste sessie); de sleepvooruitblik blijft in F4.
- Marktplaats bestaat niet in code → F6 publiceert "marktplaats"-zichtbaarheid als
  status + leesbaarheid, zonder prijs (TRV-95); geen eigen marktplaatsmodule bouwen.
- Oefenkaart CMP-43 bestaat niet → F9 gebruikt media-preview + bestaande kaartcomponenten;
  de oefenkaart-component wordt in de componentbibliotheek toegevoegd (TRV-71), klein en additief.

## Open punten

- **A (zelf opgelost in F1):** de sportregistry kent geen discipline kracht/mobiliteit/techniek/baan.
  De bibliotheek krijgt een eigen `discipline`-kolom (TRV-61-catalogus) los van de
  activiteiten-sportregistry; koppeling aan `training_sessions.sport` blijft via de bestaande
  registry en wordt niet verbouwd (wandelafbakening TRV-59 blijft intact).
- **A:** DOELEN_01 formeel afwezig → TRV-43-melding haakt op bestaande doelvoortgang; vastleggen gebeurt sowieso.
- **B/C:** geen.
