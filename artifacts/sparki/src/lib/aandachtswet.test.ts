// Tests for the aandachtswet engine (Fase 2 "De aandachtswet").
//
// The Vandaag state surface (StateDayHome) is driven entirely by this one pure
// engine: it decides the SINGLE leading Momentblok (§5.1), whether weather may
// ride along (§5.2 #3), whether the leskaart may ride along (§5.2 #3) and which
// single nudge wins the one-per-visit budget (§5.2 #2). A regression here would
// silently let two things lead, demote a health/overload signal, show weather
// where it isn't a decision factor, or blow the nudge budget. These tests pin
// the exact contract the surface relies on.
//
// Pure function, no DB — run with: `pnpm --filter @workspace/sparki run test:aandachtswet`
// Exits non-zero on any failure.
import {
  selectMoment,
  weatherAllowed,
  leskaartAllowed,
  pickNudge,
  type MomentSignals,
  type MomentKind,
  type NudgeSource,
} from "./aandachtswet"

type Status = "pass" | "fail"
const results: { scenario: string; status: Status; note?: string }[] = []

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function scenario(name: string, fn: () => void) {
  try {
    fn()
    results.push({ scenario: name, status: "pass" })
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    })
  }
}

// A signals object with everything "off" — the balans baseline.
function baseSignals(over: Partial<MomentSignals> = {}): MomentSignals {
  return {
    healthActive: false,
    ridePhase: null,
    hasProposal: false,
    plannedWorkoutToday: false,
    restDay: false,
    ...over,
  }
}

// ── §5.1 priority table: each rung wins in isolation ──
scenario("nothing pending → balans (calm toestand leads)", () => {
  assert(selectMoment(baseSignals()) === "balans", "expected balans")
})

scenario("rest day → herstel", () => {
  assert(
    selectMoment(baseSignals({ restDay: true })) === "herstel",
    "expected herstel",
  )
})

scenario("planned training today → voor-training", () => {
  assert(
    selectMoment(baseSignals({ plannedWorkoutToday: true })) === "voor-training",
    "expected voor-training",
  )
})

scenario("open proposal → voorstel", () => {
  assert(
    selectMoment(baseSignals({ hasProposal: true })) === "voorstel",
    "expected voorstel",
  )
})

scenario("ride processing → rit-binnen", () => {
  assert(
    selectMoment(baseSignals({ ridePhase: "verwerken" })) === "rit-binnen",
    "expected rit-binnen",
  )
})

scenario("ride analysed → na-rit", () => {
  assert(
    selectMoment(baseSignals({ ridePhase: "na-rit" })) === "na-rit",
    "expected na-rit",
  )
})

scenario("race today → racedag", () => {
  assert(
    selectMoment(baseSignals({ ridePhase: "racedag" })) === "racedag",
    "expected racedag",
  )
})

scenario("health active → health", () => {
  assert(
    selectMoment(baseSignals({ healthActive: true })) === "health",
    "expected health",
  )
})

// ── §5.1 precedence: higher priority always wins over everything below it ──
scenario("health beats every lower signal at once", () => {
  const m = selectMoment({
    healthActive: true,
    ridePhase: "racedag",
    hasProposal: true,
    plannedWorkoutToday: true,
    restDay: true,
  })
  assert(m === "health", `health must win, got ${m}`)
})

scenario("racedag beats na-rit/proposal/training when not sick", () => {
  const m = selectMoment({
    healthActive: false,
    ridePhase: "racedag",
    hasProposal: true,
    plannedWorkoutToday: true,
    restDay: true,
  })
  assert(m === "racedag", `racedag must win, got ${m}`)
})

scenario("na-rit beats proposal and planned training", () => {
  const m = selectMoment({
    healthActive: false,
    ridePhase: "na-rit",
    hasProposal: true,
    plannedWorkoutToday: true,
    restDay: false,
  })
  assert(m === "na-rit", `na-rit must win, got ${m}`)
})

scenario("proposal beats planned training and rest day", () => {
  const m = selectMoment({
    healthActive: false,
    ridePhase: null,
    hasProposal: true,
    plannedWorkoutToday: true,
    restDay: true,
  })
  assert(m === "voorstel", `voorstel must win, got ${m}`)
})

scenario("planned training beats rest day", () => {
  const m = selectMoment({
    healthActive: false,
    ridePhase: null,
    hasProposal: false,
    plannedWorkoutToday: true,
    restDay: true,
  })
  assert(m === "voor-training", `voor-training must win, got ${m}`)
})

// ── §5.2 #3 weather gate: only a real decision factor ──
scenario("weather allowed only for voor-training and racedag", () => {
  const all: MomentKind[] = [
    "health",
    "racedag",
    "na-rit",
    "rit-binnen",
    "voorstel",
    "voor-training",
    "herstel",
    "balans",
  ]
  for (const m of all) {
    const expected = m === "voor-training" || m === "racedag"
    assert(
      weatherAllowed(m) === expected,
      `weatherAllowed(${m}) expected ${expected}`,
    )
  }
})

// ── §5.2 #3 leskaart gate: only the calm learn-room moments ──
scenario("leskaart allowed only for herstel and balans", () => {
  const all: MomentKind[] = [
    "health",
    "racedag",
    "na-rit",
    "rit-binnen",
    "voorstel",
    "voor-training",
    "herstel",
    "balans",
  ]
  for (const m of all) {
    const expected = m === "herstel" || m === "balans"
    assert(
      leskaartAllowed(m) === expected,
      `leskaartAllowed(${m}) expected ${expected}`,
    )
  }
})

// weather and leskaart are mutually exclusive per moment — a moment never invites
// both a decision-weather block and a calm learn-block at once.
scenario("weather and leskaart never both allowed for one moment", () => {
  const all: MomentKind[] = [
    "health",
    "racedag",
    "na-rit",
    "rit-binnen",
    "voorstel",
    "voor-training",
    "herstel",
    "balans",
  ]
  for (const m of all) {
    assert(
      !(weatherAllowed(m) && leskaartAllowed(m)),
      `${m} must not allow both weather and leskaart`,
    )
  }
})

// ── §5.2 #2 nudge budget: at most one, highest rank wins ──
scenario("no sources → no nudge", () => {
  assert(pickNudge([]) === null, "expected null")
})

scenario("connector outranks all", () => {
  const m = pickNudge(["reminder", "engagement", "material", "connector"])
  assert(m === "connector", `expected connector, got ${m}`)
})

scenario("material outranks engagement and reminder", () => {
  const m = pickNudge(["reminder", "engagement", "material"])
  assert(m === "material", `expected material, got ${m}`)
})

scenario("engagement outranks reminder", () => {
  const m = pickNudge(["reminder", "engagement"])
  assert(m === "engagement", `expected engagement, got ${m}`)
})

scenario("single reminder → reminder", () => {
  assert(pickNudge(["reminder"]) === "reminder", "expected reminder")
})

scenario("pickNudge order-independent (rank, not input order)", () => {
  const perms: NudgeSource[][] = [
    ["connector", "material"],
    ["material", "connector"],
  ]
  for (const p of perms) {
    assert(pickNudge(p) === "connector", `expected connector for ${p.join(",")}`)
  }
})

// ── report ──
const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  const tag = r.status === "pass" ? "✓" : "✗"
  console.log(`${tag} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(
  `\naandachtswet: ${results.length - failed.length}/${results.length} passed`,
)
if (failed.length > 0) process.exit(1)
