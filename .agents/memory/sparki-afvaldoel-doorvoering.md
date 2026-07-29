---
name: Afvaldoel-doorvoering (seizoensdoel overal benoemd)
description: Hoe het voedings-seizoensdoel overal meeweegt — canonieke zin, RED-S-poort, eerlijk-onbekend
---

# Afvaldoel-doorvoering

**Regel:** het afvaldoel verandert trainingsnummers NOOIT (trainingen altijd
volledig gevoed; sturing via gewone maaltijden op rustige momenten, max 0,5
kg/wk). "Meewegen" = overal geconsumeerd + benoemd met ÉÉN canonieke zin.

**Why:** het doel werd opgeslagen maar was onzichtbaar in keuzes; het eerlijke
productantwoord is benoemen, niet nummers verbuigen (RED-S-veiligheid).

**How to apply:**
- Gedeelde leeslaag `api-server/src/lib/season-goal.ts`: `loadSeasonGoalSteering`
  (RED-S-poort: <17 of geen geboortejaar ⇒ null, fail-closed) +
  `buildSeasonGoalLine` = de ENIGE formulering. Nieuwe consumenten gebruiken
  deze — nooit eigen zinnen bouwen (frontend-eigen formulering is driftrisico).
- Ontbrekend huidig gewicht ⇒ richting "onbekend" + eerlijk-gat-zin, NOOIT
  "behoud"/"op gewicht" (dat zou een onterecht bereikt doel claimen).
- Frontend krijgt de canonieke zin via `GET /api/nutrition/season-goal` veld
  `line`; day-advice `SeasonGoalSignal = { line }` neemt hem letterlijk over.
- training-builder `hasGoal` moet een puur seizoensdoel meenemen, anders blijft
  het doel onzichtbaar in de aanbevelingsstroom.
- Dev-bypass `x-dev-clerk-id` werkt alleen voor GESEEDE atleten; onbekende id
  valt stil terug op `dev_qa_athlete` — praktijktests dus tegen die user.

- Drift-bewaking: api-server `test:afvaldoel-touchpoints` asserteert byte-identieke
  `line` op ALLE touchpoints (season-goal GET, session-targets-item, rust/herstel-
  rationales via buildSkeleton met A-race-opener, dagadvies) + jeugd fail-closed.
  Het dagadvies-been draait de echte sparki-engine in eigen omgeving: spawn via
  `pnpm run test:day-advice-canonical` (cwd sparki) met de zin in
  SPARKI_CANONICAL_GOAL_LINE — nooit sparki-src in de api-server-typecheck trekken.

**Proof-aanpak die werkte:** deterministische tests per keuzeplek + live
praktijktest + onafhankelijke architect-review in twee rondes (eerste ronde
levert concrete gaten; repareren en her-scoren). Rapport-stijl: zie
`docs/PROOF_AFVALDOEL_DOORVOERING.md`.
