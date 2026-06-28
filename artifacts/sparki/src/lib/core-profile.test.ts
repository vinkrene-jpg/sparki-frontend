// Tests for the Core development-limiter logic in `core-profile.ts`:
//   - `deriveOntwikkelprioriteit` — names the ONE limiter (regelmaat / basis /
//     opbouwtempo / herstel) that, improved, moves the athlete most toward their
//     development goal. The ranking (gap × goal weight), the honest evidence gate,
//     the balanced ("geen duidelijke rem") threshold, and the sick/injured
//     recovery cap are subtle and easy to regress during tuning.
//   - `deriveBelastbaarheid` — its scoring formula shares the same
//     `computeLoadFactors` helper, so we lock its numbers down too to prove the
//     shared-helper refactor didn't shift the score.
//
// Both functions build on the same deterministic load/sessions factors, so a flat
// (constant) load chart + a controlled session cadence lets us pin each factor
// (rhythm / capacity / rampSafety / recovery) independently.
//
// Pure functions, no DB — run with: `pnpm --filter @workspace/sparki run test:core-profile`
// Exits non-zero on any failure.
import type { AthleteProfile, TrainingSession } from "@/lib/athlete-types"
import type { LoadData } from "@/hooks/use-load"
import type { AiObservation } from "@/hooks/use-ai-memory"
import {
  categorizeObservations,
  deriveBelastbaarheid,
  deriveOntwikkelprioriteit,
} from "./core-profile"

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

const DAY = 86_400_000

// A flat (constant) load chart. Because every point is identical:
//   - lastCtl   = ctl                → capacity  = clamp01(ctl / 70)
//   - maxRatio  = atl / ctl          → rampSafety (controlled, ≤1.3 ⇒ 1)
//   - avgTsb    = tsb                → recovery   = clamp01((tsb + 30) / 20)
// 30 daily points clears the ≥10-point honesty gate.
function flatChart(days: number, ctl: number, atl: number, tsb: number): LoadData {
  const chartData = [] as LoadData["chartData"]
  for (let i = days - 1; i >= 0; i--) {
    chartData.push({
      date: new Date(Date.now() - i * DAY).toISOString(),
      ctl,
      atl,
      tsb,
      tss: 60,
    })
  }
  return { ctl, atl, tsb, chartData }
}

let nextId = 1
function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  const id = nextId++
  return {
    id,
    clerkId: "test_user",
    sessionDate: new Date().toISOString(),
    type: "endurance",
    title: null,
    durationMin: 90,
    distanceKm: null,
    elevationM: null,
    normalizedPower: null,
    avgPower: null,
    avgHR: null,
    tss: 60,
    intensityFactor: null,
    notes: null,
    feelScore: null,
    source: "manual",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function sessionAt(daysAgo: number): TrainingSession {
  return makeSession({ sessionDate: new Date(Date.now() - daysAgo * DAY).toISOString() })
}

// 2 sessions in each of the trailing 6 weeks → perfectly even buckets → rhythm = 1.
function evenSessions(): TrainingSession[] {
  const out: TrainingSession[] = []
  for (let w = 0; w < 6; w++) {
    out.push(sessionAt(w * 7 + 1))
    out.push(sessionAt(w * 7 + 3))
  }
  return out
}

// 6 sessions all crammed into the most recent week → buckets [6,0,0,0,0,0] →
// high CV → rhythm = 0. Exactly 6 still clears the ≥6-in-window gate.
function clusteredSessions(): TrainingSession[] {
  return [1, 2, 3, 4, 5, 6].map((d) => sessionAt(d))
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
    heightCm: null,
    birthYear: null,
    discipline: null,
    goals: null,
    developmentGoal: null,
    weeklyHourTarget: null,
    trainingDaysPerWeek: null,
    healthStatus: "ok",
    zones: null,
    wkg: null,
    homeLat: null,
    homeLon: null,
    homeLabel: null,
    decorPhotoPath: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── 1. Honest evidence gate ───────────────────────────────────────────────────

scenario("ontwikkelprioriteit: too little data → honest hasData=false", () => {
  const r = deriveOntwikkelprioriteit(flatChart(5, 50, 50, 0), evenSessions(), makeProfile())
  assert(r.hasData === false, "short chart (<10 points) must fail the gate")
  assert(r.reason != null && r.reason.length > 0, "an honest plain-Dutch reason must be given")
  assert(r.key === null && r.balanced === false, "no limiter may be named without data")
  assert(r.ranked.length === 0, "no ranking may be produced without data")
})

scenario("ontwikkelprioriteit: enough chart but too few sessions → hasData=false", () => {
  // 30 chart points clears the chart gate, but only 3 in-window sessions (< 6).
  const sessions = [sessionAt(1), sessionAt(2), sessionAt(3)]
  const r = deriveOntwikkelprioriteit(flatChart(30, 50, 50, 0), sessions, makeProfile())
  assert(r.hasData === false, "fewer than 6 in-window sessions must fail the gate")
  assert(r.reason != null, "an honest reason must be given")
})

// ── 2. Each limiter wins under the right factor profile ───────────────────────

scenario("limiter: regelmaat wins when training rhythm is erratic", () => {
  // Clustered sessions ⇒ rhythm 0; everything else strong.
  const r = deriveOntwikkelprioriteit(
    flatChart(30, 80, 80, 0),
    clusteredSessions(),
    makeProfile(),
  )
  assert(r.hasData === true, "expected a real read")
  assert(r.balanced === false, "an erratic rhythm is a real limiter, not balanced")
  assert(r.key === "regelmaat", `expected regelmaat to win, got: ${r.key}`)
  assert(r.label === "Regelmaat", `expected the Regelmaat label, got: ${r.label}`)
  assert(r.ranked[0].key === "regelmaat", "ranking must lead with regelmaat")
})

scenario("limiter: basis wins when the aerobe base is thin", () => {
  // Even rhythm, controlled ramp, good form — but a very low CTL (capacity).
  const r = deriveOntwikkelprioriteit(
    flatChart(30, 14, 14, 0),
    evenSessions(),
    makeProfile(),
  )
  assert(r.key === "basis", `expected basis to win on low CTL, got: ${r.key}`)
  assert(r.label === "Aerobe basis", `expected the Aerobe basis label, got: ${r.label}`)
  assert(r.ranked[0].key === "basis", "ranking must lead with basis")
})

scenario("limiter: opbouwtempo wins when load ramps too sharply", () => {
  // atl (160) far above ctl (80) ⇒ acute:chronic ratio 2.0 ⇒ rampSafety 0.
  const r = deriveOntwikkelprioriteit(
    flatChart(30, 80, 160, 0),
    evenSessions(),
    makeProfile(),
  )
  assert(r.key === "opbouwtempo", `expected opbouwtempo to win on a sharp ramp, got: ${r.key}`)
  assert(r.label === "Opbouwtempo", `expected the Opbouwtempo label, got: ${r.label}`)
  assert(r.ranked[0].key === "opbouwtempo", "ranking must lead with opbouwtempo")
})

scenario("limiter: herstel wins when form sits deep in the negative", () => {
  // Strong rhythm/base/ramp, but a sustained deeply negative TSB ⇒ low recovery.
  const r = deriveOntwikkelprioriteit(
    flatChart(30, 80, 80, -25),
    evenSessions(),
    makeProfile(),
  )
  assert(r.key === "herstel", `expected herstel to win on poor recovery, got: ${r.key}`)
  assert(r.label === "Herstel", `expected the Herstel label, got: ${r.label}`)
  assert(r.ranked[0].key === "herstel", "ranking must lead with herstel")
})

// ── 3. Goal weights shift the winner ──────────────────────────────────────────

scenario("goal weights: granfondo flips the winner from herstel to basis", () => {
  // capacity 0.5 (gap 0.50) and recovery 0.45 (gap 0.55). Neutral ⇒ herstel wins
  // (0.55 > 0.50). Granfondo weights basis ×1.3 ⇒ 0.65 vs herstel ×1.0 ⇒ 0.55,
  // so basis takes over. Same factors, only the goal changes.
  const chart = flatChart(30, 35, 35, -21)
  const sessions = evenSessions()

  const neutral = deriveOntwikkelprioriteit(chart, sessions, makeProfile())
  assert(neutral.key === "herstel", `neutral winner should be herstel, got: ${neutral.key}`)

  const granfondo = deriveOntwikkelprioriteit(
    chart,
    sessions,
    makeProfile({ developmentGoal: "granfondo" }),
  )
  assert(
    granfondo.key === "basis",
    `granfondo goal weight should flip the winner to basis, got: ${granfondo.key}`,
  )
  assert(
    granfondo.goalRef === "Gran fondo / toertocht",
    `expected the goal reference label, got: ${granfondo.goalRef}`,
  )
})

// ── 4. Balanced ("geen duidelijke rem") branch ────────────────────────────────

scenario("balanced: no factor below threshold → honest 'geen duidelijke rem'", () => {
  // Even rhythm (1), solid CTL 70 (capacity 1), controlled ramp (1), good form (1).
  const r = deriveOntwikkelprioriteit(
    flatChart(30, 70, 70, 0),
    evenSessions(),
    makeProfile(),
  )
  assert(r.hasData === true, "expected a real read")
  assert(r.balanced === true, "all factors strong ⇒ must be balanced")
  assert(r.key === null, "no single limiter may be named when balanced")
  assert(r.label === "Geen duidelijke rem", `expected the balanced label, got: ${r.label}`)
  assert(r.ranked.length === 4, "the full ranking is still shown when balanced")
})

// ── 5. Health (sick / injured) recovery cap ───────────────────────────────────

scenario("health cap: sickness turns an otherwise balanced athlete into herstel-limited", () => {
  // Identical strong factors as the balanced case. With healthStatus ok this is
  // balanced; sickness caps recovery to 0.3 ⇒ herstel becomes the clear limiter.
  const chart = flatChart(30, 80, 80, 0)
  const sessions = evenSessions()

  const healthy = deriveOntwikkelprioriteit(chart, sessions, makeProfile())
  assert(healthy.balanced === true, "healthy athlete with strong factors must be balanced")

  const sick = deriveOntwikkelprioriteit(chart, sessions, makeProfile({ healthStatus: "sick" }))
  assert(sick.balanced === false, "the recovery cap must surface a real limiter")
  assert(sick.key === "herstel", `sickness must make herstel the limiter, got: ${sick.key}`)
  assert(sick.finding.includes("ziek"), `expected the sick-specific finding, got: ${sick.finding}`)
})

scenario("health cap: injury surfaces herstel with the injury-specific finding", () => {
  const r = deriveOntwikkelprioriteit(
    flatChart(30, 80, 80, 0),
    evenSessions(),
    makeProfile({ healthStatus: "injured" }),
  )
  assert(r.key === "herstel", `injury must make herstel the limiter, got: ${r.key}`)
  assert(
    r.finding.includes("geblesseerd"),
    `expected the injury-specific finding, got: ${r.finding}`,
  )
})

// ── 6. Belastbaarheid scoring is unchanged by the shared-helper refactor ───────
// score01 = 0.4·rhythm + 0.35·capacity + 0.25·rampSafety, then a sick/injured cap
// of 0.35, ×100 rounded. Bands: ≥70 robuust, ≥45 redelijk, else beperkt.

scenario("belastbaarheid: all factors strong → score 100 / robuust", () => {
  const b = deriveBelastbaarheid(flatChart(30, 70, 70, 0), evenSessions(), makeProfile())
  assert(b.hasData === true, "expected a real read")
  assert(b.score === 100, `expected score 100, got: ${b.score}`)
  assert(b.band === "robuust", `expected band robuust, got: ${b.band}`)
})

scenario("belastbaarheid: erratic rhythm only → score 60 / redelijk", () => {
  // rhythm 0, capacity 1, rampSafety 1 ⇒ 0.35 + 0.25 = 0.60 ⇒ 60.
  const b = deriveBelastbaarheid(flatChart(30, 80, 80, 0), clusteredSessions(), makeProfile())
  assert(b.score === 60, `expected score 60, got: ${b.score}`)
  assert(b.band === "redelijk", `expected band redelijk, got: ${b.band}`)
})

scenario("belastbaarheid: sickness caps the score to 35 / beperkt", () => {
  // All factors strong (would be 100) but the health cap holds it at 0.35 ⇒ 35.
  const b = deriveBelastbaarheid(
    flatChart(30, 80, 80, 0),
    evenSessions(),
    makeProfile({ healthStatus: "sick" }),
  )
  assert(b.score === 35, `expected the health-capped score 35, got: ${b.score}`)
  assert(b.band === "beperkt", `expected band beperkt, got: ${b.band}`)
  assert(b.healthCapped === true, "the read must be flagged as health-capped")
})

scenario("belastbaarheid: too little data → honest hasData=false", () => {
  const b = deriveBelastbaarheid(flatChart(5, 50, 50, 0), evenSessions(), makeProfile())
  assert(b.hasData === false, "short chart must fail the gate")
  assert(b.score === null && b.band === null, "no score or band may be invented")
  assert(b.reason != null && b.reason.length > 0, "an honest reason must be given")
})

// ── 7. categorizeObservations — lenses must never duplicate or lose an insight ─
// Each live observation lands in EXACTLY ONE of four lenses by precedence:
//   1. low confidence            → uncertainty
//   2. has a detected pattern    → patterns
//   3. severity needs attention  → development
//   4. otherwise (steady/info)   → strengths
// Dismissed / outdated / transient (daily_briefing, daily_n) are excluded.
// The "lead" is chosen by severity → confidence → recency.

let nextObsId = 1
function makeObservation(overrides: Partial<AiObservation> = {}): AiObservation {
  const id = nextObsId++
  return {
    id,
    sourceType: "training_analysis",
    title: `Observation ${id}`,
    summary: null,
    observationText: "",
    confidence: "medium",
    category: "general",
    severity: "info",
    detectedPattern: null,
    signals: null,
    alternativeExplanations: null,
    confidenceScore: null,
    recommendedAction: null,
    status: "new",
    createdAt: new Date(Date.now() - id * 1000).toISOString(),
    ...overrides,
  }
}

scenario("categorize: every live observation lands in exactly one lens", () => {
  const obs = [
    makeObservation({ confidence: "low", detectedPattern: "x", severity: "urgent" }), // uncertainty
    makeObservation({ confidence: "high", detectedPattern: "trend", severity: "urgent" }), // patterns
    makeObservation({ confidence: "medium", severity: "important" }), // development
    makeObservation({ confidence: "high", severity: "info" }), // strengths
    makeObservation({ confidence: "medium", severity: "watch" }), // development
    makeObservation({ confidence: "low", severity: "info" }), // uncertainty
  ]
  const r = categorizeObservations(obs)
  assert(r.total === obs.length, `total must equal live count, got ${r.total}`)
  const sum =
    r.strengths.length + r.development.length + r.patterns.length + r.uncertainty.length
  assert(sum === r.total, `buckets must sum to total: ${sum} !== ${r.total}`)

  // No observation may appear in two buckets, and none may be lost.
  const seen = new Map<number, number>()
  for (const bucket of [r.strengths, r.development, r.patterns, r.uncertainty]) {
    for (const o of bucket) seen.set(o.id, (seen.get(o.id) ?? 0) + 1)
  }
  assert(seen.size === obs.length, "every live observation must appear in some bucket")
  for (const [id, count] of seen) {
    assert(count === 1, `observation ${id} appeared in ${count} buckets (duplicated)`)
  }
})

scenario("categorize: low confidence beats a detected pattern → uncertainty", () => {
  // Low confidence + a detected pattern + needs-attention severity. Precedence
  // 1 (low confidence) must win over patterns/development.
  const o = makeObservation({ confidence: "low", detectedPattern: "trend", severity: "urgent" })
  const r = categorizeObservations([o])
  assert(r.uncertainty.length === 1, "low confidence must route to uncertainty")
  assert(r.patterns.length === 0, "a low-confidence pattern must NOT also land in patterns")
  assert(r.development.length === 0 && r.strengths.length === 0, "no other lens may receive it")
})

scenario("categorize: a detected pattern beats needs-attention → patterns", () => {
  // Not low confidence, has a pattern, urgent severity. Precedence 2 (pattern)
  // must win over development.
  const o = makeObservation({ confidence: "high", detectedPattern: "ramp", severity: "urgent" })
  const r = categorizeObservations([o])
  assert(r.patterns.length === 1, "a detected pattern must route to patterns")
  assert(r.development.length === 0, "the pattern must NOT also land in development")
})

scenario("categorize: needs-attention without a pattern → development", () => {
  for (const severity of ["watch", "important", "urgent"] as const) {
    const o = makeObservation({ confidence: "high", severity, detectedPattern: null })
    const r = categorizeObservations([o])
    assert(r.development.length === 1, `severity ${severity} must route to development`)
    assert(
      r.patterns.length === 0 && r.uncertainty.length === 0 && r.strengths.length === 0,
      `severity ${severity} must land ONLY in development`,
    )
  }
})

scenario("categorize: steady info-severity, no pattern → strengths", () => {
  const o = makeObservation({ confidence: "high", severity: "info", detectedPattern: null })
  const r = categorizeObservations([o])
  assert(r.strengths.length === 1, "an info-severity, confident, pattern-less read is a strength")
  assert(
    r.development.length === 0 && r.patterns.length === 0 && r.uncertainty.length === 0,
    "a strength must land ONLY in strengths",
  )
})

scenario("categorize: a blank-string pattern is NOT treated as a real pattern", () => {
  // detectedPattern present but empty/whitespace must fall through to development.
  const o = makeObservation({ confidence: "high", severity: "watch", detectedPattern: "   " })
  const r = categorizeObservations([o])
  assert(r.patterns.length === 0, "a whitespace pattern must not route to patterns")
  assert(r.development.length === 1, "it must fall through to development on severity")
})

scenario("categorize: dismissed / outdated / transient observations are excluded", () => {
  const obs = [
    makeObservation({ status: "dismissed" }),
    makeObservation({ status: "outdated" }),
    makeObservation({ sourceType: "daily_briefing", severity: "urgent" }),
    makeObservation({ sourceType: "daily_n", confidence: "low" }),
    makeObservation({ confidence: "high", severity: "info" }), // the only live one
  ]
  const r = categorizeObservations(obs)
  assert(r.total === 1, `only the single live observation may count, got ${r.total}`)
  assert(r.strengths.length === 1, "the live observation must be the lone strength")
  assert(
    r.development.length === 0 && r.patterns.length === 0 && r.uncertainty.length === 0,
    "excluded observations must not leak into any lens",
  )
})

scenario("categorize: a transient daily message never surfaces as the lead", () => {
  // The transient one is the most severe; it must still be excluded from lead.
  const obs = [
    makeObservation({ sourceType: "daily_briefing", severity: "urgent", confidence: "high" }),
    makeObservation({ confidence: "medium", severity: "watch" }),
  ]
  const r = categorizeObservations(obs)
  assert(r.lead != null, "a live observation must be chosen as lead")
  assert(r.lead!.sourceType !== "daily_briefing", "a transient message may never be the lead")
})

scenario("categorize: lead is chosen by severity first", () => {
  // The urgent one is low-confidence and older; severity still wins outright.
  const info = makeObservation({
    severity: "info",
    confidence: "high",
    createdAt: new Date().toISOString(),
  })
  const urgent = makeObservation({
    severity: "urgent",
    confidence: "low",
    createdAt: new Date(Date.now() - 10 * DAY).toISOString(),
  })
  const r = categorizeObservations([info, urgent])
  assert(r.lead?.id === urgent.id, "the highest severity must lead regardless of confidence/age")
})

scenario("categorize: lead breaks severity ties by confidence", () => {
  const low = makeObservation({ severity: "watch", confidence: "low" })
  const high = makeObservation({ severity: "watch", confidence: "high" })
  const r = categorizeObservations([low, high])
  assert(r.lead?.id === high.id, "equal severity must break to the higher confidence")
})

scenario("categorize: lead breaks severity+confidence ties by recency", () => {
  const older = makeObservation({
    severity: "important",
    confidence: "medium",
    createdAt: new Date(Date.now() - 5 * DAY).toISOString(),
  })
  const newer = makeObservation({
    severity: "important",
    confidence: "medium",
    createdAt: new Date().toISOString(),
  })
  const r = categorizeObservations([older, newer])
  assert(r.lead?.id === newer.id, "equal severity+confidence must break to the most recent")
})

scenario("categorize: no live observations → empty, honest result", () => {
  const r = categorizeObservations([
    makeObservation({ status: "dismissed" }),
    makeObservation({ sourceType: "daily_briefing" }),
  ])
  assert(r.total === 0, "no live observations means total 0")
  assert(r.lead === null, "no lead may be invented")
  assert(
    r.strengths.length === 0 &&
      r.development.length === 0 &&
      r.patterns.length === 0 &&
      r.uncertainty.length === 0,
    "all lenses must be empty",
  )
})

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(`\ncore-profile: ${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) {
  process.exit(1)
}
