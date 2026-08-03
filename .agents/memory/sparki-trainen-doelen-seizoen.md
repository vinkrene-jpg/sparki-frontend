---
name: Trainen/Doelen/Seizoen-pakket
description: fase-motor (hoofddoel-anker, seizoensblokken, verlenging), ritme-doelvorm, uitslag-onbeoordeeld, voeding-fasekoppeling — lessen en contracten
---

- Fase-precedentie in `lib/training-plan.ts`: seizoensblok (season_blocks) > verlenging > derivePhase(hoofddoel-anker); hoofddoel-anker wint van eerstvolgende wedstrijd. Vijfde/zesde fasen: `onderhoud` (dip, nooit base) en `verlenging` (80%, q=0).
- **Why (F5-contract):** GET /training-plan/preview moet strikt side-effectvrij zijn — `gatherInputs` schrijft alleen met `{ notify: true }` (drie mutatiepaden). Reviewronde ving dat een read-pad stilletjes een notificatie aanmaakte; bewaak dit bij elke nieuwe gather-consument.
- Season refresh (`?refresh=1`) vernieuwt ALTIJD alleen `source="afgeleid"`; sporter-blokken nooit aanraken en hun bestaan mag refresh niet blokkeren.
- F9: hoofddoelwedstrijd zonder uitslag ⇒ vraag om uitslag+verslag én progress-verdict expliciet `niet_meetbaar` — alleen de vraag onderdrukken is niet genoeg, samenvattingen tellen anders een onbeoordeeld doel mee.
- Jeugd-fail-closed patroon: leeftijdchecks altijd `age == null || age < grens` — `age != null && age < grens` is fail-open bij onbekende leeftijd (zat op 5 voedingspaden). Ritme-weekbeeld (<14): respons volledig cijfer-vrij, bewijs met `!/\d/.test(body)`.
- Wedstrijdlabels teamImportance/ownRole zijn sporter-invoer; `/races/:id/promote` alleen omhoog, label-only, bewust géén planrefresh (schema wijzigt pas via gewone planflow met bevestiging).
- Voeding-fasekoppeling: `resolvePhaseForDate` (blok > anker > eerlijk null) + fase-tekstaccenten in `computeSessionFuelTargets` — nooit richtwaarden zelf moduleren, geen tweede voedingsmodel.
- Eindbewijs: docs/proof-evidence/TRAINEN_DOELEN_SEIZOEN_01/ (matrix + toets-SHA), 50/50 scenario's groen.
