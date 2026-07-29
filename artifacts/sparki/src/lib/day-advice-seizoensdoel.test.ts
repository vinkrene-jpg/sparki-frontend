// Afvaldoel-doorvoering in het dagadvies (Product Proof, taak 418).
//
// Belofte: een ingesteld afvaldoel weegt aantoonbaar mee én wordt benoemd op
// elke plek waar Sparki een keuze maakt. Voor het dagadvies betekent dat:
//   - actief doel ⇒ altijd een reden-regel met de CANONIEKE benoemingszin
//     van de server (buildSeasonGoalLine) — overal dezelfde woorden;
//   - de sturing zit in maaltijden op rustige momenten, dus de gekozen
//     TRAINING zelf verandert er bewust niet door (volledig gevoed);
//   - geen doel ⇒ geen regel (nooit een verzonnen doel).

import test from "node:test"
import assert from "node:assert/strict"
import { computeDayAdvice, type DayAdviceInput } from "./day-advice"

// Canonieke zin zoals de server (lib/season-goal buildSeasonGoalLine) hem
// levert — het dagadvies neemt hem letterlijk over.
const CANONIEKE_LIJN =
  "Je afvaldoel (streefgewicht 72 kg) weegt hierin mee: bijsturen gebeurt via je gewone maaltijden op rustige momenten in een rustig tempo van ~0,4 kg per week. Trainingen blijven altijd volledig gevoed."

const BASE: DayAdviceInput = {
  profile: { ftp: 250, weeklyHourTarget: 8, trainingDaysPerWeek: 4, goals: null },
  metrics: { feelScore: 4, sleepQuality: 4, fatigueScore: 3 } as any,
  load: { ctl: 50, atl: 45, tsb: 5 },
  races: [],
  weather: null,
}

test("actief afvaldoel: canonieke zin wordt letterlijk benoemd", () => {
  const advice = computeDayAdvice({
    ...BASE,
    seasonGoal: { line: CANONIEKE_LIJN },
  })
  assert.ok(advice, "advies aanwezig")
  const line = advice!.reasons.find((r) => r.includes("afvaldoel"))
  assert.ok(line, `reden noemt 'afvaldoel': ${advice!.reasons.join(" | ")}`)
  assert.ok(line!.includes(CANONIEKE_LIJN), "canonieke zin letterlijk overgenomen")
  assert.ok(line!.includes("72 kg"), "streefgewicht genoemd")
  assert.ok(line!.includes("volledig gevoed"), "legt uit hoe het doel stuurt")
})

test("doel verandert de trainingskeuze zelf niet (volledig gevoed)", () => {
  const zonder = computeDayAdvice(BASE)
  const met = computeDayAdvice({
    ...BASE,
    seasonGoal: { line: CANONIEKE_LIJN },
  })
  assert.equal(met!.kind, zonder!.kind, "zelfde soort training")
  assert.equal(met!.durationMin, zonder!.durationMin, "zelfde duur")
  assert.deepEqual(met!.power, zonder!.power, "zelfde vermogensband")
})

test("zonder doel geen doel-regel (nooit verzonnen)", () => {
  const advice = computeDayAdvice(BASE)
  assert.ok(
    !advice!.reasons.some((r) => r.includes("streefgewicht")),
    "geen verzonnen doelregel",
  )
})

test("rustige dag benoemt dat de sturing juist dáár werkt", () => {
  const advice = computeDayAdvice({
    ...BASE,
    metrics: { feelScore: 2, sleepQuality: 2, fatigueScore: 8 } as any,
    load: { ctl: 50, atl: 70, tsb: -26 },
    seasonGoal: { line: CANONIEKE_LIJN },
  })
  assert.ok(advice, "advies aanwezig")
  assert.ok(
    advice!.kind === "rest" || advice!.kind === "recovery",
    `rustige dag verwacht, kreeg ${advice!.kind}`,
  )
  const line = advice!.reasons.find((r) => r.includes("afvaldoel"))
  assert.ok(
    line && line.includes("Rustige dagen zoals vandaag"),
    `rustdag-framing: ${line}`,
  )
})
