# Product Proof — Afvaldoel weegt overal mee (taak 418)

Eerste toepassing van de Product Proof Doctrine (`docs/SPARKI_PRODUCT_PROOF_DOCTRINE.md`).

**Belofte:** "Wie een afvaldoel instelt, ziet dat doel aantoonbaar meewegen én benoemd
worden op elke plek waar Sparki een keuze maakt."

**Datum proof:** 29 juli 2026 · **Eindscore onafhankelijke validatie: 9,3 / 10** (drempel ≥ 9,0)

## Het eerlijke productantwoord

Het afvaldoel verandert de trainingsnummers bewust NIET. Trainingen worden altijd
volledig gevoed; gewichtssturing gebeurt via gewone maaltijden op rustige momenten,
met een veilig maximum van 0,5 kg per week. "Meewegen" betekent daarom: het doel wordt
overal geconsumeerd én expliciet benoemd — met overal exact dezelfde canonieke zin.

## Architectuur van de doorvoering

- **Eén gedeelde leeslaag** — `artifacts/api-server/src/lib/season-goal.ts`:
  `computeSeasonSteering` (deterministisch stuurgetal), `buildSeasonGoalLine`
  (één canonieke Nederlandse benoemingszin: afvaldoel/aankomdoel/seizoensdoel,
  tempo of veilig-maximum-waarschuwing), `loadSeasonGoalSteering` (DB-doorvoering
  met RED-S-poort: < 17 jaar of onbekend geboortejaar ⇒ fail-closed, doel wordt
  nergens doorgevoerd).
- **Canonieke zin ook naar de frontend** — `GET /api/nutrition/season-goal` levert
  `line`; het dagadvies neemt die letterlijk over. Formuleringsdrift is daarmee
  uitgesloten.

## Dekking per keuzeplek

| Keuzeplek | Doorvoering | Benoeming |
|---|---|---|
| Voeding/fueling (`lib/fueling.ts`, session-targets) | doelregel als richtwaarde-item; richtwaarden zelf identiek mét/zonder doel | canonieke zin; jeugd bereikt dit pad nooit |
| Dagadvies (`sparki/src/lib/day-advice.ts`) | reden-regel bij elk advies; trainingskeuze bewust ongewijzigd | canonieke zin, rustdag + "Rustige dagen zoals vandaag zijn precies waar die sturing werkt." |
| Trainingsplan-engine (`lib/training-plan.ts`) | doel in goals-input van de generator; rustdag- én hersteldag-rationale; fallback-samenvatting | canonieke zin |
| Training-builder (`training-builder.tsx`) | actief seizoensdoel opent de aanbevelingsstroom (hasGoal) | via dagadvies-redenen |
| Analyse (`analyse-dashboard.ts` doelOverlays) | streefgewicht als overlay op de gewichtsgrafiek (bestond al) | uitleglaag |
| Uitleglaag (`uitleg-content.ts`) | nieuwe `seizoensdoel`-entry + UitlegDot op het Seizoensdoel-blok in Voeding | wat/waarom/hoe |

## Bewijs

1. **Deterministische tests**
   - `pnpm --filter @workspace/api-server run test:afvaldoel-doorvoering` — 10/10:
     steering-kern, canonieke zin per richting, DB-doorvoering, RED-S fail-closed
     (jeugd + onbekend geboortejaar), goalsContextLine bereikt de plangenerator.
   - `pnpm --filter @workspace/api-server run test:fueling` — 18/18, waaronder:
     doelregel benoemd voor volwassene, richtwaarden identiek mét/zonder doel,
     jeugd ziet de regel nooit.
   - `pnpm --filter @workspace/sparki run test:day-advice-seizoensdoel` — 4/4:
     letterlijke overname canonieke zin, trainingskeuze ongewijzigd, nooit een
     verzonnen doel, rustdag-framing.
2. **Praktijktest (live dev-API, geseede volwassen sporter met afvaldoel 66 kg)**
   - `GET /api/nutrition/season-goal` → `line: "Je afvaldoel (streefgewicht 66 kg)
     weegt hierin mee: bijsturen gebeurt via je gewone maaltijden op rustige
     momenten in een rustig tempo van ~0,27 kg per week. Trainingen blijven altijd
     volledig gevoed."`
   - `GET /api/nutrition/session-targets` op een dag met geplande duurrit →
     richtwaarden bevatten de afvaldoel-regel met deterministisch tempo.
3. **Poorten** — `typecheck-api` (typecheck:libs + api-server tsc) groen, sparki
   `tsc --noEmit` groen, `admin-smoke` 12/12.
4. **Onafhankelijke validatie (architect-review, twee rondes)**
   - Ronde 1: **8,3 — afgekeurd.** Drie gaten: training-builder-gate negeerde een
     puur seizoensdoel, eigen formulering in dagadvies (driftrisico), beperkte
     dekking in plan-rationales. Alle drie gerepareerd.
   - Completion-review vond nog een eerlijkheidsbug: streefgewicht zonder
     bekend huidig gewicht claimde onterecht "op gewicht/behoud". Gerepareerd:
     richting "onbekend" + eerlijk-gat-zin ("kan richting en tempo nog niet
     berekenen"), met regressietests (12/12 groen).
   - Ronde 2: betrouwbaarheid 9,4 · volledigheid 9,1 · begrijpelijkheid 9,3 ·
     relevantie 9,2 · consistentie 9,6 · praktische bruikbaarheid 9,2 →
     **eindscore 9,3 — Pass.**

## Restpunten (niet-blokkerend, uit de review)

- Eén end-to-end proof-test die in één scenario alle touchpoints op dezelfde
  `line` controleert.
- Expliciet vastleggen dat de analyse-overlay dezelfde benoemingszin toont.
