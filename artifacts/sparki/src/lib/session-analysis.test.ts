// Tests for the per-ride load analysis (`analyzeSession`). The "HOE DEZE RIT GING"
// panel is shown on both Activiteiten and Trainen, so its honesty rules must not
// silently regress: the load-vs-recent ("Belasting") insight is only allowed when
// there are at least 3 comparable peer rides, otherwise no comparison is fabricated;
// and when the trainingszone can't be read (no IF, no FTP) an honest "missing" note
// must appear.
//
// Pure function, no DB — run with: `pnpm --filter @workspace/sparki run test:session-analysis`
// Exits non-zero on any failure.
import type { TrainingSession, AthleteProfile } from "@/lib/athlete-types"
import { analyzeSession } from "./session-analysis"

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

let nextId = 1
function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  const id = nextId++
  return {
    id,
    clerkId: "test_user",
    sessionDate: "2026-06-01",
    type: "endurance",
    title: null,
    durationMin: 90,
    distanceKm: null,
    elevationM: null,
    normalizedPower: null,
    avgPower: null,
    avgHR: null,
    tss: null,
    intensityFactor: null,
    notes: null,
    feelScore: null,
    source: "manual",
    createdAt: "2026-06-01T12:00:00Z",
    updatedAt: "2026-06-01T12:00:00Z",
    ...overrides,
  }
}

function makeProfile(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    clerkId: "test_user",
    email: "test@example.com",
    displayName: "Test",
    roles: ["athlete"],
    activeRole: "athlete",
    id: 1,
    ftp: 250,
    weightKg: null,
    discipline: null,
    goals: null,
    weeklyHourTarget: null,
    trainingDaysPerWeek: null,
    healthStatus: "ok",
    zones: null,
    wkg: null,
    homeLat: null,
    homeLon: null,
    homeLabel: null,
    decorPhotoPath: null,
    createdAt: "2026-06-01T12:00:00Z",
    updatedAt: "2026-06-01T12:00:00Z",
    ...overrides,
  }
}

function belasting(a: ReturnType<typeof analyzeSession>) {
  return a.insights.find((i) => i.label === "Belasting")
}

// ── 1. Too few comparable peers → NO fabricated load comparison ──────────────

// When peers are below the threshold the comparison must NOT be fabricated, AND
// (since the trainingszone is readable here) an honest "missing context" note
// must explain that there's too little history to compare load yet.
const HISTORY_NOTE = "te weinig vergelijkbare ritten"

scenario("too few peers (0): no Belasting insight, honest missing note", () => {
  const session = makeSession({ tss: 120, intensityFactor: "0.80" })
  const a = analyzeSession(session, makeProfile(), [])
  assert(
    belasting(a) === undefined,
    "must not produce a load-vs-recent comparison with zero peers",
  )
  assert(
    a.missing != null && a.missing.includes(HISTORY_NOTE),
    `expected an honest 'too little history' note, got: ${a.missing}`,
  )
})

scenario("too few peers (2): no Belasting insight, honest missing note", () => {
  const session = makeSession({ tss: 200, intensityFactor: "0.85" })
  const peers = [
    makeSession({ tss: 60 }),
    makeSession({ tss: 65 }),
  ]
  const a = analyzeSession(session, makeProfile(), peers)
  assert(
    belasting(a) === undefined,
    "two peers is below the 3-session threshold; no comparison may be shown",
  )
  assert(
    a.missing != null && a.missing.includes(HISTORY_NOTE),
    `expected an honest 'too little history' note, got: ${a.missing}`,
  )
})

scenario("peers without TSS don't count toward the threshold", () => {
  // 4 peers present, but only 2 carry a TSS value → still below threshold.
  const session = makeSession({ tss: 150, intensityFactor: "0.80" })
  const peers = [
    makeSession({ tss: 70 }),
    makeSession({ tss: 72 }),
    makeSession({ tss: null }),
    makeSession({ tss: null }),
  ]
  const a = analyzeSession(session, makeProfile(), peers)
  assert(
    belasting(a) === undefined,
    "only comparable (TSS-bearing) peers count; 2 is below threshold",
  )
  assert(
    a.missing != null && a.missing.includes(HISTORY_NOTE),
    `expected an honest 'too little history' note, got: ${a.missing}`,
  )
})

scenario("the session itself is never counted as its own peer", () => {
  // Three "peers" but one of them IS this session → only 2 genuine peers.
  const session = makeSession({ tss: 100, intensityFactor: "0.80" })
  const peers = [
    session,
    makeSession({ tss: 80 }),
    makeSession({ tss: 85 }),
  ]
  const a = analyzeSession(session, makeProfile(), peers)
  assert(
    belasting(a) === undefined,
    "the session must be excluded from its own peer set",
  )
  assert(
    a.missing != null && a.missing.includes(HISTORY_NOTE),
    `expected an honest 'too little history' note, got: ${a.missing}`,
  )
})

scenario("ride without TSS doesn't trigger the load-history note", () => {
  // No TSS means there's nothing to compare — the history note must NOT appear
  // (that gap is about TSS data, not about peer history).
  const session = makeSession({ tss: null, intensityFactor: "0.80" })
  const a = analyzeSession(session, makeProfile(), [])
  assert(
    a.missing === null,
    `no history note when the ride has no TSS to compare, got: ${a.missing}`,
  )
})

// ── 2. Enough comparable peers → load-vs-recent insight IS produced ──────────

scenario("3 peers, heavier ride → 'zwaarder' comparison", () => {
  const session = makeSession({ tss: 200, intensityFactor: "0.85" })
  const peers = [
    makeSession({ tss: 80 }),
    makeSession({ tss: 100 }),
    makeSession({ tss: 120 }),
  ]
  const a = analyzeSession(session, makeProfile(), peers)
  const ins = belasting(a)
  assert(ins !== undefined, "3 comparable peers must unlock the comparison")
  assert(
    ins!.text.includes("200 TSS") && ins!.text.includes("zwaardere"),
    `expected a 'zwaardere' comparison, got: ${ins!.text}`,
  )
  // median of [80,100,120] = 100 → reference shown.
  assert(ins!.text.includes("100 TSS"), `expected median reference 100, got: ${ins!.text}`)
})

scenario("3 peers, lighter ride → 'lichter' comparison", () => {
  const session = makeSession({ tss: 40, intensityFactor: "0.60" })
  const peers = [
    makeSession({ tss: 90 }),
    makeSession({ tss: 100 }),
    makeSession({ tss: 110 }),
  ]
  const a = analyzeSession(session, makeProfile(), peers)
  const ins = belasting(a)
  assert(ins !== undefined, "3 comparable peers must unlock the comparison")
  assert(
    ins!.text.includes("lichter"),
    `expected a 'lichter' comparison, got: ${ins!.text}`,
  )
})

scenario("3 peers, typical ride → 'rond je gebruikelijke belasting'", () => {
  const session = makeSession({ tss: 100, intensityFactor: "0.75" })
  const peers = [
    makeSession({ tss: 95 }),
    makeSession({ tss: 100 }),
    makeSession({ tss: 105 }),
  ]
  const a = analyzeSession(session, makeProfile(), peers)
  const ins = belasting(a)
  assert(ins !== undefined, "3 comparable peers must unlock the comparison")
  assert(
    ins!.text.includes("rond je gebruikelijke belasting"),
    `expected a 'typical' comparison, got: ${ins!.text}`,
  )
})

scenario("no Belasting insight when this ride has no TSS, even with peers", () => {
  const session = makeSession({ tss: null, intensityFactor: "0.80" })
  const peers = [
    makeSession({ tss: 80 }),
    makeSession({ tss: 100 }),
    makeSession({ tss: 120 }),
  ]
  const a = analyzeSession(session, makeProfile(), peers)
  assert(
    belasting(a) === undefined,
    "without this ride's own TSS there is nothing to compare",
  )
})

// ── 3. Missing FTP / unreadable intensity → honest 'missing' note ────────────

scenario("missing FTP and no IF/power → honest missing note + no zone insight", () => {
  const session = makeSession({
    tss: 100,
    intensityFactor: null,
    avgPower: null,
    normalizedPower: null,
  })
  const profile = makeProfile({ ftp: null })
  const a = analyzeSession(session, profile, [])
  assert(a.missing != null, "an honest missing note must be present")
  assert(
    a.missing!.includes("Vul je FTP in"),
    `expected the FTP-prompt missing note, got: ${a.missing}`,
  )
  assert(
    a.insights.find((i) => i.label === "Zwaarte") === undefined,
    "no trainingszone insight may be fabricated without intensity data",
  )
})

scenario("FTP present but no power/IF → honest missing note (data, not FTP)", () => {
  const session = makeSession({
    tss: 100,
    intensityFactor: null,
    avgPower: null,
    normalizedPower: null,
  })
  const a = analyzeSession(session, makeProfile({ ftp: 250 }), [])
  assert(a.missing != null, "an honest missing note must be present")
  assert(
    a.missing!.includes("vermogens- of intensiteitsdata"),
    `expected the power-data missing note, got: ${a.missing}`,
  )
})

scenario("IF derivable from power + FTP → zone insight, no missing note", () => {
  const session = makeSession({
    tss: 100,
    intensityFactor: null,
    normalizedPower: 200, // 200 / 250 = IF 0.80
  })
  // Enough comparable history so the load-history note isn't triggered either,
  // isolating the IF-derivation behavior.
  const peers = [
    makeSession({ tss: 95 }),
    makeSession({ tss: 100 }),
    makeSession({ tss: 105 }),
  ]
  const a = analyzeSession(session, makeProfile({ ftp: 250 }), peers)
  const zone = a.insights.find((i) => i.label === "Zwaarte")
  assert(zone !== undefined, "IF should be derived from power and FTP")
  assert(zone!.text.includes("0.80"), `expected IF 0.80, got: ${zone!.text}`)
  assert(a.missing === null, "no missing note when the zone is readable")
})

scenario("null profile is handled like missing FTP", () => {
  const session = makeSession({
    tss: 100,
    intensityFactor: null,
    avgPower: null,
    normalizedPower: null,
  })
  const a = analyzeSession(session, null, [])
  assert(
    a.missing != null && a.missing.includes("Vul je FTP in"),
    `expected the FTP-prompt missing note for a null profile, got: ${a.missing}`,
  )
})

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(
  `\nsession-analysis: ${results.length - failed.length}/${results.length} passed`,
)
if (failed.length > 0) {
  process.exit(1)
}
