// Tests for the FTP growth-range forecast in `core-profile.ts`:
//   - `deriveBandbreedte` — projects a realistic FTP growth range
//     (behoudend / verwacht / optimistisch) over the COMING ~3 months from real
//     data only. It is subtle and easy to regress: the least-squares slope, the
//     age-trainability headroom, the CTL-trend modulation, the deceleration
//     taper, and the enforced low ≤ expected ≤ high ordering all interact. Two
//     honesty gates (≥2 FTP measurements AND ≥21 days of span) must never be
//     bypassed into a fabricated band.
//
// The slopes below are exact: each FTP history is a perfectly linear set of
// points over whole weeks, so the ordinary-least-squares slope is the visible
// per-week step. That pins the band numbers deterministically.
//
// Pure functions, no DB — run with: `pnpm --filter @workspace/sparki run test:bandbreedte`
// Exits non-zero on any failure.
import type { AthleteProfile, FtpHistoryEntry } from "@/lib/athlete-types"
import type { LoadData } from "@/hooks/use-load"
import { deriveBandbreedte } from "./core-profile"

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
const THIS_YEAR = new Date().getFullYear()

let nextId = 1
// Build an FTP history from {daysAgo, watts} points. The function sorts by
// measuredAt ascending internally, so order here doesn't matter.
function ftpHistory(points: { daysAgo: number; watts: number }[]): FtpHistoryEntry[] {
  return points.map((p) => ({
    id: nextId++,
    clerkId: "test_user",
    measuredAt: new Date(Date.now() - p.daysAgo * DAY).toISOString(),
    ftpWatts: p.watts,
    testType: "ramp",
    notes: null,
    createdAt: new Date().toISOString(),
  }))
}

// A linear CTL chart from c0 → c1 over `days` daily points. Used to drive the
// conditietrend (rising/falling base) input independently of the FTP series.
function ctlChart(days: number, c0: number, c1: number): LoadData {
  const chartData = [] as LoadData["chartData"]
  for (let i = days - 1; i >= 0; i--) {
    const ctl = c1 - (c1 - c0) * (i / (days - 1))
    chartData.push({
      date: new Date(Date.now() - i * DAY).toISOString(),
      ctl,
      atl: ctl,
      tsb: 0,
      tss: 60,
    })
  }
  return { ctl: c1, atl: c1, tsb: 0, chartData }
}

function makeProfile(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    clerkId: "test_user",
    email: "test@example.com",
    displayName: "Test",
    roles: ["athlete"],
    activeRole: "athlete",
    id: 1,
    ftp: null,
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

// A clean +5 W/wk rise: 200→260 over 84 days (12 weeks), measured every 3 weeks.
const RISING = ftpHistory([
  { daysAgo: 84, watts: 200 },
  { daysAgo: 63, watts: 215 },
  { daysAgo: 42, watts: 230 },
  { daysAgo: 21, watts: 245 },
  { daysAgo: 0, watts: 260 },
])

// A clean -5 W/wk decline: 300→240 over the same window.
const FALLING = ftpHistory([
  { daysAgo: 84, watts: 300 },
  { daysAgo: 63, watts: 285 },
  { daysAgo: 42, watts: 270 },
  { daysAgo: 21, watts: 255 },
  { daysAgo: 0, watts: 240 },
])

// ── 1. Honesty gates — never invent a band ────────────────────────────────────

scenario("gate: a single FTP measurement → hasData=false, no band invented", () => {
  const b = deriveBandbreedte(ftpHistory([{ daysAgo: 0, watts: 250 }]), undefined, makeProfile())
  assert(b.hasData === false, "one measurement cannot support a slope")
  assert(
    b.low === null && b.expected === null && b.high === null && b.current === null,
    "no band numbers may be fabricated when the gate fails",
  )
  assert(b.reason != null && b.reason.length > 0, "an honest plain-Dutch reason must be given")
  assert(b.tone === "flat", "the empty read defaults to a neutral tone")
})

scenario("gate: zero/invalid FTP values are dropped before the count gate", () => {
  // One real point plus a zero and a NaN — only one valid measurement remains.
  const b = deriveBandbreedte(
    ftpHistory([
      { daysAgo: 40, watts: 0 },
      { daysAgo: 20, watts: Number.NaN },
      { daysAgo: 0, watts: 250 },
    ]),
    undefined,
    makeProfile(),
  )
  assert(b.hasData === false, "invalid values must not count toward the ≥2 gate")
  assert(b.low === null && b.expected === null && b.high === null, "no band may be invented")
})

scenario("gate: two measurements too close together (<21 days span) → hasData=false", () => {
  const b = deriveBandbreedte(
    ftpHistory([
      { daysAgo: 10, watts: 240 },
      { daysAgo: 0, watts: 250 },
    ]),
    undefined,
    makeProfile(),
  )
  assert(b.hasData === false, "a 10-day span is too short for a trustworthy slope")
  assert(
    b.low === null && b.expected === null && b.high === null,
    "no band numbers may be fabricated when the span gate fails",
  )
  assert(b.reason != null && b.reason.length > 0, "an honest reason must be given")
})

// ── 2. Rising history → tone "up" with low ≤ expected ≤ high held ──────────────

scenario("rising FTP → tone 'up' and low ≤ expected ≤ high ordering holds", () => {
  const b = deriveBandbreedte(RISING, undefined, makeProfile({ ftp: 260 }))
  assert(b.hasData === true, "a clean 12-week rise must yield a real read")
  assert(b.tone === "up", `a rising slope must read as 'up', got: ${b.tone}`)
  assert(b.headline === "Er zit groei in", `expected the growth headline, got: ${b.headline}`)
  assert(b.current === 260, `current should anchor on profile FTP, got: ${b.current}`)
  assert(
    b.low != null && b.expected != null && b.high != null,
    "a real read must populate all three band numbers",
  )
  assert(
    (b.low as number) <= (b.expected as number) && (b.expected as number) <= (b.high as number),
    `ordering low ≤ expected ≤ high violated: ${b.low}/${b.expected}/${b.high}`,
  )
  assert(
    (b.expected as number) > b.current!,
    "a rising trend's expected must sit above the current FTP",
  )
})

// ── 3. Falling history → tone "down" ──────────────────────────────────────────

scenario("falling FTP → tone 'down' with the under-pressure headline", () => {
  const b = deriveBandbreedte(FALLING, undefined, makeProfile({ ftp: 240 }))
  assert(b.hasData === true, "a clean 12-week decline must yield a real read")
  assert(b.tone === "down", `a falling slope must read as 'down', got: ${b.tone}`)
  assert(
    b.headline === "Je vorm staat onder druk",
    `expected the under-pressure headline, got: ${b.headline}`,
  )
  assert(
    (b.expected as number) < b.current!,
    "a falling trend's expected must sit below the current FTP",
  )
  assert(
    (b.low as number) <= (b.expected as number) && (b.expected as number) <= (b.high as number),
    `ordering must still hold on a decline: ${b.low}/${b.expected}/${b.high}`,
  )
})

// ── 4. Flat history → plateau headline ────────────────────────────────────────

scenario("flat FTP → 'plateau' headline and tone 'flat'", () => {
  // FTP barely moving over the window (a near-zero slope) ⇒ the band collapses
  // to a tight spread around the current value, which is the plateau branch.
  const flat = ftpHistory([
    { daysAgo: 84, watts: 250 },
    { daysAgo: 63, watts: 250 },
    { daysAgo: 42, watts: 251 },
    { daysAgo: 21, watts: 250 },
    { daysAgo: 0, watts: 251 },
  ])
  const b = deriveBandbreedte(flat, undefined, makeProfile({ ftp: 251 }))
  assert(b.hasData === true, "a flat-but-real history must still yield a read")
  assert(b.tone === "flat", `a flat slope must read as 'flat', got: ${b.tone}`)
  assert(
    b.headline === "Je zit rond een plateau",
    `expected the plateau headline, got: ${b.headline}`,
  )
})

// ── 5. Age trainability widens the optimistic end ─────────────────────────────

scenario("age: a young rider gets a wider optimistic end than a masters rider", () => {
  const young = deriveBandbreedte(RISING, undefined, makeProfile({ ftp: 260, birthYear: THIS_YEAR - 20 }))
  const masters = deriveBandbreedte(RISING, undefined, makeProfile({ ftp: 260, birthYear: THIS_YEAR - 58 }))
  assert(young.hasData && masters.hasData, "both reads must be real")
  assert(
    (young.high as number) > (masters.high as number),
    `youth headroom must widen the optimistic end: young=${young.high} vs masters=${masters.high}`,
  )
  // Age headroom only scales the optimistic end — the expected case is unchanged.
  assert(
    young.expected === masters.expected,
    `age must not move the expected case: young=${young.expected} vs masters=${masters.expected}`,
  )
  assert(
    (young.low as number) <= (young.expected as number) && (young.expected as number) <= (young.high as number),
    "ordering must still hold for the young rider",
  )
})

// ── 6. Falling CTL trend suppresses the upside ────────────────────────────────

scenario("ctl: a falling conditietrend suppresses the upside of a rising FTP", () => {
  const steady = deriveBandbreedte(RISING, undefined, makeProfile({ ftp: 260 }))
  const ctlDown = deriveBandbreedte(RISING, ctlChart(30, 80, 40), makeProfile({ ftp: 260 }))
  assert(steady.hasData && ctlDown.hasData, "both reads must be real")
  assert(
    (ctlDown.high as number) < (steady.high as number),
    `a shrinking base must lower the optimistic end: down=${ctlDown.high} vs steady=${steady.high}`,
  )
  assert(
    (ctlDown.expected as number) < (steady.expected as number),
    `a shrinking base must lower the expected case: down=${ctlDown.expected} vs steady=${steady.expected}`,
  )
  assert(
    (ctlDown.low as number) <= (ctlDown.expected as number) &&
      (ctlDown.expected as number) <= (ctlDown.high as number),
    "ordering must still hold under a falling CTL",
  )
})

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(`\ncore-profile-bandbreedte: ${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) {
  process.exit(1)
}
