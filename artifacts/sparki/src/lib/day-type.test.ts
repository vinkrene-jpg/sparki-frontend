// Tests for the day-type engine (blueprint §4) that drives the Vandaag home.
//
// The DayHome dispatcher detects today's DayType and renders the registered
// homepage for it. Two invariants keep Vandaag from crashing:
//   1. detectDayType only ever returns members of the DayType union.
//   2. every detectable type has a briefing in dayTypeRegistry — otherwise the
//      dispatcher would call an undefined component and render a blank crash.
// These tests also pin the detection precedence (health → race → rest → coach →
// recovery → sparki → general) that the sick/injured block visibility relies on.
//
// Pure function, no DB — run with: `pnpm --filter @workspace/sparki run test:day-type`
// Exits non-zero on any failure.
import {
  detectDayType,
  dayTypeRegistry,
  getDayTypeBriefing,
  type DayType,
  type DayTypeContext,
} from "./day-type"

type Status = "pass" | "fail"
const results: { scenario: string; status: Status; note?: string }[] = []

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function scenario(name: string, fn: () => void) {
  try {
    fn()
    results.push({ scenario: name, status: "pass" })
  } catch (e) {
    results.push({
      scenario: name,
      status: "fail",
      note: e instanceof Error ? e.message : String(e),
    })
  }
}

const base: DayTypeContext = {
  todayWorkout: null,
  hasProfile: true,
  healthStatus: "ok",
  race: null,
}

const ALL_TYPES: DayType[] = [
  "emergency",
  "race_day",
  "day_before_race",
  "race_week",
  "travel_day",
  "post_race",
  "coach_training",
  "sparki_training",
  "recovery",
  "rest",
  "general",
]

scenario("every DayType has a briefing (no undefined-component crash)", () => {
  for (const t of ALL_TYPES) {
    assert(
      typeof dayTypeRegistry[t] === "function",
      `missing briefing builder for ${t}`,
    )
    const b = getDayTypeBriefing(t, base)
    assert(!!b.title && !!b.eyebrow, `empty briefing for ${t}`)
  }
})

scenario("sick/injured always leads with emergency (health first)", () => {
  assert(
    detectDayType({ ...base, healthStatus: "sick" }) === "emergency",
    "sick should be emergency",
  )
  assert(
    detectDayType({ ...base, healthStatus: "injured" }) === "emergency",
    "injured should be emergency",
  )
  // Health outranks a planned coach workout.
  assert(
    detectDayType({
      ...base,
      healthStatus: "sick",
      todayWorkout: { type: "intervals", source: "coach" },
    }) === "emergency",
    "sick must outrank coach training",
  )
})

scenario("race context maps to its race homepage below emergency", () => {
  assert(
    detectDayType({
      ...base,
      race: { phase: "race_day", daysUntil: 0, name: "X" },
    }) === "race_day",
    "race_day phase",
  )
  assert(
    detectDayType({
      ...base,
      race: { phase: "day_before", daysUntil: 1, name: "X" },
    }) === "day_before_race",
    "day_before phase",
  )
})

scenario("explicit rest workout wins over coach/sparki", () => {
  assert(
    detectDayType({
      ...base,
      todayWorkout: { type: "rustdag", source: "coach" },
    }) === "rest",
    "rest workout should be rest even when coach-planned",
  )
})

scenario("coach source leads, else recovery, else sparki", () => {
  assert(
    detectDayType({
      ...base,
      todayWorkout: { type: "intervals", source: "coach" },
    }) === "coach_training",
    "coach source",
  )
  assert(
    detectDayType({
      ...base,
      todayWorkout: { type: "herstelrit", source: "sparki" },
    }) === "recovery",
    "non-coach recovery",
  )
  assert(
    detectDayType({
      ...base,
      todayWorkout: { type: "tempo", source: "sparki" },
    }) === "sparki_training",
    "normal sparki session",
  )
})

scenario("no workout falls back to general", () => {
  assert(detectDayType(base) === "general", "no workout should be general")
})

// ── report ──
let failed = 0
for (const r of results) {
  if (r.status === "fail") failed++
  const tag = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(`\n${results.length - failed}/${results.length} passed`)
if (failed > 0) process.exit(1)
