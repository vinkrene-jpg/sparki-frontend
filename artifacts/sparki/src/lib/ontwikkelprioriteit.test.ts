// Tests for the development-limiter engine (`deriveOntwikkelprioriteit`).
//
// The Home (Vandaag) `OntwikkelprioriteitHomeCard` and the /you Ontwikkelkompas
// `PrioriteitCard` are BOTH driven by this one engine output. A regression in
// its gating (hasData / balanced) or its limiter selection would silently make
// the two surfaces disagree — or make Home show a limiter when it shouldn't.
// These tests pin the exact engine contract both surfaces rely on:
//   - hasData=false  → Home card renders nothing (early `return null`).
//   - balanced=true  → no limiter badge shown on either surface.
//   - each limiter (regelmaat / basis / opbouwtempo / herstel), incl. the
//     health-capped herstel path → label + key both surfaces render.
//
// Pure function, no DB — run with: `pnpm --filter @workspace/sparki run test:ontwikkelprioriteit`
// Exits non-zero on any failure.
import type { AthleteProfile, TrainingSession } from "@/lib/athlete-types"
import type { LoadData } from "@/hooks/use-load"
import { deriveOntwikkelprioriteit } from "./core-profile"

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
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString().slice(0, 10)
}

// A chart of `len` daily points (ending today) all carrying the same ctl/atl/tsb.
// The engine reads lastCtl from the final point and computes the acute:chronic
// ratio (atl/ctl) and average TSB over the trailing 14 points — so flat points
// give us exact control of every factor.
function makeChart(opts: {
  ctl: number
  atl: number
  tsb: number
  len?: number
}): LoadData["chartData"] {
  const len = opts.len ?? 20
  const out: LoadData["chartData"] = []
  for (let i = len - 1; i >= 0; i--) {
    out.push({
      date: isoDaysAgo(i),
      ctl: opts.ctl,
      atl: opts.atl,
      tsb: opts.tsb,
      tss: 50,
    })
  }
  return out
}

function makeLoad(opts: { ctl: number; atl: number; tsb: number; len?: number }): LoadData {
  return {
    ctl: opts.ctl,
    atl: opts.atl,
    tsb: opts.tsb,
    chartData: makeChart(opts),
  }
}

let nextId = 1
function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  const id = nextId++
  return {
    id,
    clerkId: "test_user",
    sessionDate: isoDaysAgo(1),
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

// Build sessions from a per-week count array (index 0 = most recent week). Each
// session is dated inside its week so the engine's weekly buckets match exactly.
// Counts must stay ≤7 per week so every session lands in its intended bucket.
function sessionsFromBuckets(buckets: number[]): TrainingSession[] {
  const out: TrainingSession[] = []
  buckets.forEach((count, wk) => {
    for (let i = 0; i < count; i++) {
      out.push(makeSession({ sessionDate: isoDaysAgo(wk * 7 + 1 + i) }))
    }
  })
  return out
}

const EVEN_BUCKETS = [3, 3, 3, 3, 3, 3] // perfectly regular rhythm → no regelmaat gap

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
    createdAt: "2026-06-01T12:00:00Z",
    updatedAt: "2026-06-01T12:00:00Z",
    ...overrides,
  }
}

// ── 1. Too little data → hasData=false (Home card renders nothing) ───────────

scenario("no load at all → hasData=false", () => {
  const p = deriveOntwikkelprioriteit(undefined, undefined, makeProfile())
  assert(p.hasData === false, "with no data the engine must report hasData=false")
  assert(p.reason != null, "an honest reason must be given when hasData=false")
})

scenario("enough chart but too few sessions in window → hasData=false", () => {
  // 20 chart points (≥10) but only 5 sessions in the 6-week window (<6 needed).
  const load = makeLoad({ ctl: 55, atl: 60, tsb: 0 })
  const sessions = sessionsFromBuckets([5, 0, 0, 0, 0, 0])
  const p = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(
    p.hasData === false,
    "fewer than 6 in-window sessions must keep the engine honest (hasData=false)",
  )
})

scenario("enough sessions but too short a chart → hasData=false", () => {
  const load = makeLoad({ ctl: 55, atl: 60, tsb: 0, len: 9 }) // <10 points
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)
  const p = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(p.hasData === false, "fewer than 10 chart points must keep hasData=false")
})

// ── 2. Balanced → no limiter badge on either surface ─────────────────────────

scenario("all factors on order → balanced, no limiter", () => {
  // Regular rhythm, solid CTL, controlled ramp (atl/ctl ≈ 1.09), fresh form.
  const load = makeLoad({ ctl: 55, atl: 60, tsb: 0 })
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)
  const p = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(p.hasData === true, "with rich data the engine has something to say")
  assert(p.balanced === true, "no single factor is a meaningful limiter here")
  assert(p.key === null, "balanced state must not name a limiter key")
  // The Home badge is gated on `!balanced` — assert there's no label to show.
  assert(
    p.label === "Geen duidelijke rem",
    `balanced label expected, got: ${p.label}`,
  )
})

// ── 3. Each limiter is selected for the right honest signal ───────────────────

scenario("irregular rhythm → regelmaat limiter", () => {
  // All sessions crammed into one week → high week-to-week variance.
  const load = makeLoad({ ctl: 55, atl: 60, tsb: 0 })
  const sessions = sessionsFromBuckets([6, 0, 0, 0, 0, 0])
  const p = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(p.hasData === true && p.balanced === false, "irregular rhythm must surface a limiter")
  assert(p.key === "regelmaat", `expected regelmaat limiter, got: ${p.key}`)
  assert(p.label === "Regelmaat", `expected 'Regelmaat' label, got: ${p.label}`)
})

scenario("thin aerobic base (low CTL) → basis limiter", () => {
  const load = makeLoad({ ctl: 14, atl: 16, tsb: 0 }) // capacity ≈ 0.2
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)
  const p = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(p.balanced === false, "a thin base must surface a limiter")
  assert(p.key === "basis", `expected basis limiter, got: ${p.key}`)
  assert(p.label === "Aerobe basis", `expected 'Aerobe basis' label, got: ${p.label}`)
})

scenario("spiky load (high acute:chronic) → opbouwtempo limiter", () => {
  const load = makeLoad({ ctl: 55, atl: 110, tsb: 0 }) // ratio 2.0 → rampSafety 0
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)
  const p = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(p.balanced === false, "a load spike must surface a limiter")
  assert(p.key === "opbouwtempo", `expected opbouwtempo limiter, got: ${p.key}`)
  assert(p.label === "Opbouwtempo", `expected 'Opbouwtempo' label, got: ${p.label}`)
})

scenario("deep negative form → herstel limiter (non-health)", () => {
  const load = makeLoad({ ctl: 55, atl: 60, tsb: -30 }) // recovery 0
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)
  const p = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(p.balanced === false, "deep-negative form must surface a limiter")
  assert(p.key === "herstel", `expected herstel limiter, got: ${p.key}`)
  assert(p.label === "Herstel", `expected 'Herstel' label, got: ${p.label}`)
  // Non-health path: finding must NOT cite an injury/illness.
  assert(
    !p.finding.includes("geblesseerd") && !p.finding.includes("ziek"),
    `non-health herstel must not cite injury/illness, got: ${p.finding}`,
  )
})

scenario("health capped (injured) → herstel limiter even with fresh form", () => {
  // Everything else perfect AND form is fresh (tsb +10), but injury caps recovery
  // to 0.3 → herstel becomes the limiter and the finding cites the injury.
  const load = makeLoad({ ctl: 55, atl: 60, tsb: 10 })
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)
  const p = deriveOntwikkelprioriteit(load, sessions, makeProfile({ healthStatus: "injured" }))
  assert(p.balanced === false, "an injury must surface herstel as the limiter")
  assert(p.key === "herstel", `expected herstel limiter under injury, got: ${p.key}`)
  assert(
    p.finding.includes("geblesseerd"),
    `health-capped herstel finding must cite the injury, got: ${p.finding}`,
  )
})

scenario("health capped (sick) → herstel limiter, finding cites illness", () => {
  const load = makeLoad({ ctl: 55, atl: 60, tsb: 10 })
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)
  const p = deriveOntwikkelprioriteit(load, sessions, makeProfile({ healthStatus: "sick" }))
  assert(p.key === "herstel", `expected herstel limiter under illness, got: ${p.key}`)
  assert(
    p.finding.includes("ziek"),
    `health-capped herstel finding must cite the illness, got: ${p.finding}`,
  )
})

// ── 4. The developmentGoal reshuffles the top limiter (goal weighting) ───────
// Same training data, different goal → a DIFFERENT honest top limiter. This pins
// the GOAL_WEIGHTS path that both the Home (Vandaag) card and the /you
// Ontwikkelkompas rely on. Without these, a regression in the goal weighting
// could silently mislead goal-setting riders while the neutral path stays green.

scenario("granfondo reshuffles the limiter to 'basis' where neutral picks 'herstel'", () => {
  // CTL 35 → basis gap 0.5; TSB -21 → herstel gap 0.55. Rhythm/opbouwtempo are
  // on order (gap 0). Neutral weighting (all 1.0) makes herstel the top gap.
  // Gran fondo emphasises the aerobe basis (weight 1.3) enough to flip the top
  // limiter to basis even though basis's raw gap is smaller.
  const load = makeLoad({ ctl: 35, atl: 35, tsb: -21 })
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)

  const neutral = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(neutral.hasData === true && neutral.balanced === false, "neutral run must surface a limiter")
  assert(neutral.key === "herstel", `neutral weighting must pick herstel, got: ${neutral.key}`)

  const granfondo = deriveOntwikkelprioriteit(
    load,
    sessions,
    makeProfile({ developmentGoal: "granfondo" }),
  )
  assert(granfondo.hasData === true && granfondo.balanced === false, "granfondo run must surface a limiter")
  assert(
    granfondo.key === "basis",
    `granfondo must reshuffle the top limiter to basis, got: ${granfondo.key}`,
  )
  assert(granfondo.label === "Aerobe basis", `expected 'Aerobe basis' label, got: ${granfondo.label}`)
  // The whole point: identical data, the goal alone changed the verdict.
  assert(
    neutral.key !== granfondo.key,
    "the goal must change the selected limiter on identical training data",
  )
})

scenario("recreatief reshuffles the limiter to 'herstel' where neutral picks 'basis'", () => {
  // CTL 35 → basis gap 0.5; TSB -19 → herstel gap 0.45. Neutral weighting makes
  // basis the top gap. Recreatief de-emphasises the aerobe basis (weight 0.8)
  // enough that herstel (weight 1.0) becomes the top limiter instead.
  const load = makeLoad({ ctl: 35, atl: 35, tsb: -19 })
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)

  const neutral = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(neutral.key === "basis", `neutral weighting must pick basis, got: ${neutral.key}`)

  const recreatief = deriveOntwikkelprioriteit(
    load,
    sessions,
    makeProfile({ developmentGoal: "recreatief" }),
  )
  assert(
    recreatief.key === "herstel",
    `recreatief must reshuffle the top limiter to herstel, got: ${recreatief.key}`,
  )
  assert(recreatief.label === "Herstel", `expected 'Herstel' label, got: ${recreatief.label}`)
  assert(
    neutral.key !== recreatief.key,
    "the goal must change the selected limiter on identical training data",
  )
})

// ── 5. goalRef is pinned to the chosen goal (drives the goal-referenced copy) ──
// Both surfaces render goal-referenced copy ("… richting <goalRef>") off this
// field, so pin it: it must equal the goal's exact label, and be null with no goal.

scenario("goalRef reflects the chosen developmentGoal (and is null when none is set)", () => {
  const load = makeLoad({ ctl: 35, atl: 35, tsb: -21 })
  const sessions = sessionsFromBuckets(EVEN_BUCKETS)

  const neutral = deriveOntwikkelprioriteit(load, sessions, makeProfile())
  assert(neutral.goalRef === null, `no goal must leave goalRef null, got: ${neutral.goalRef}`)

  const granfondo = deriveOntwikkelprioriteit(
    load,
    sessions,
    makeProfile({ developmentGoal: "granfondo" }),
  )
  assert(
    granfondo.goalRef === "Gran fondo / toertocht",
    `granfondo goalRef must be its label, got: ${granfondo.goalRef}`,
  )
  // The goal-referenced finding both surfaces render must mention the goal.
  assert(
    granfondo.finding.includes("Gran fondo / toertocht"),
    `granfondo finding must reference the goal, got: ${granfondo.finding}`,
  )

  const recreatief = deriveOntwikkelprioriteit(
    load,
    sessions,
    makeProfile({ developmentGoal: "recreatief" }),
  )
  assert(
    recreatief.goalRef === "Recreatief & fit",
    `recreatief goalRef must be its label, got: ${recreatief.goalRef}`,
  )
})

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(
  `\nontwikkelprioriteit: ${results.length - failed.length}/${results.length} passed`,
)
if (failed.length > 0) {
  process.exit(1)
}
