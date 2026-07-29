// Afvaldoel-touchpoints (Product Proof, taak 420) — dagadvies-been.
//
// Dit testbestand wordt aangestuurd door de api-server e2e-test
// (src/tests/afvaldoel-touchpoints.ts): die berekent de canonieke
// benoemingszin (buildSeasonGoalLine) op basis van de geseedde sporter en
// geeft hem door via SPARKI_CANONICAL_GOAL_LINE. Hier bewijzen we dat de
// echte frontend-engine (computeDayAdvice) die zin LETTERLIJK overneemt —
// byte-identiek, nooit hergeformuleerd — en zonder doel nooit iets verzint.
//
// Losstaand draaien kan ook: zonder env-variabele valt de test terug op een
// representatieve zin, zodat het contract (letterlijke overname) altijd
// bewaakt blijft.

import test from "node:test"
import assert from "node:assert/strict"
import { computeDayAdvice, type DayAdviceInput } from "./day-advice"

const CANON =
  process.env.SPARKI_CANONICAL_GOAL_LINE ??
  "Je afvaldoel (streefgewicht 72 kg) weegt hierin mee: bijsturen gebeurt via je gewone maaltijden op rustige momenten in een rustig tempo van ~0,4 kg per week. Trainingen blijven altijd volledig gevoed."

const BASE: DayAdviceInput = {
  profile: { ftp: 250, weeklyHourTarget: 8, trainingDaysPerWeek: 4, goals: null },
  metrics: { feelScore: 7, sleepQuality: 7, fatigueScore: 3 },
  load: { ctl: 50, atl: 45, tsb: 5 },
  races: [],
  weather: null,
}

test("dagadvies: canonieke serverzin wordt byte-identiek overgenomen", () => {
  const advice = computeDayAdvice({ ...BASE, seasonGoal: { line: CANON } })
  assert.ok(advice, "advies aanwezig")
  assert.ok(
    advice!.reasons.some((r) => r === CANON || r.startsWith(`${CANON} `)),
    `reden is byte-identiek (evt. + rustdag-naschrift): ${advice!.reasons.join(" | ")}`,
  )
})

test("dagadvies rustige dag: zin blijft byte-identiek als prefix", () => {
  const advice = computeDayAdvice({
    ...BASE,
    metrics: { feelScore: 2, sleepQuality: 2, fatigueScore: 8 },
    load: { ctl: 50, atl: 70, tsb: -26 },
    seasonGoal: { line: CANON },
  })
  assert.ok(advice, "advies aanwezig")
  const line = advice!.reasons.find((r) => r.includes(CANON.slice(0, 20)))
  assert.ok(line, "doelregel aanwezig op rustige dag")
  assert.ok(line!.startsWith(CANON), `canonieke zin ongewijzigd vooraan: ${line}`)
})

test("dagadvies zonder doel: nooit een verzonnen doelregel", () => {
  const advice = computeDayAdvice({ ...BASE, seasonGoal: null })
  assert.ok(advice, "advies aanwezig")
  assert.ok(
    !advice!.reasons.some((r) => r.includes("streefgewicht")),
    "geen doelregel zonder doel",
  )
})
