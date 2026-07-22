// Tests for the honest Performance Radar (Golf 22).
//
// The Lab radar previously drew fake neutral 0.5 axes when data was missing and
// scaled power on an arbitrary FTP/350. These tests pin the honest contract:
//   - missing data → level null + missingReason (never a placeholder number)
//   - power needs BOTH ftp and weight (W/kg scale 2.0–5.5)
//   - feel/consistency use a real 28-day window, not the session LIMIT
//   - levels stay within 0..1 and per-axis basis text is present
//
// Pure function, no DB — run with: `pnpm --filter @workspace/sparki run test:performance-radar`
import { computePerformanceRadar, type RadarInputs } from "./performance-radar"

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

const TODAY = "2026-07-22"

function iso(daysAgo: number): string {
  const d = new Date(TODAY + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().split("T")[0]!
}

const EMPTY: RadarInputs = {
  load: null,
  sessions: [],
  ftpWatts: null,
  weightKg: null,
  todayIso: TODAY,
}

scenario("no data at all → all six axes null with reasons, none 0.5", () => {
  const axes = computePerformanceRadar(EMPTY)
  assert(axes.length === 6, `expected 6 axes, got ${axes.length}`)
  for (const a of axes) {
    assert(a.level === null, `${a.key} should be null without data`)
    assert(a.missingReason, `${a.key} needs a missingReason`)
    assert(a.basis.length > 0, `${a.key} needs a basis`)
  }
})

scenario("load only → fitheid/vorm/herstel measurable, rest honest-missing", () => {
  const axes = computePerformanceRadar({
    ...EMPTY,
    load: { ctl: 40, atl: 50, tsb: -10 },
  })
  const byKey = Object.fromEntries(axes.map((a) => [a.key, a]))
  assert(byKey.fitness!.level === 0.5, `fitness 40/80 = 0.5, got ${byKey.fitness!.level}`)
  assert(
    Math.abs(byKey.form!.level! - ((-10 + 30) / 60)) < 1e-9,
    "form scaled from TSB",
  )
  assert(byKey.recovery!.level != null, "recovery measurable with ctl>0")
  assert(byKey.power!.level === null, "power missing without ftp/weight")
  assert(byKey.feel!.level === null, "feel missing without sessions")
  assert(byKey.consistency!.level === null, "consistency missing without sessions")
})

scenario("power axis needs BOTH ftp and weight; W/kg scale 2.0–5.5", () => {
  const noWeight = computePerformanceRadar({ ...EMPTY, ftpWatts: 250 })
  const p1 = noWeight.find((a) => a.key === "power")!
  assert(p1.level === null, "no weight → power null")
  assert(/gewicht/i.test(p1.missingReason ?? ""), "reason names the missing weight")

  const noFtp = computePerformanceRadar({ ...EMPTY, weightKg: 70 })
  const p2 = noFtp.find((a) => a.key === "power")!
  assert(p2.level === null && /FTP/.test(p2.missingReason ?? ""), "no ftp → power null")

  const both = computePerformanceRadar({ ...EMPTY, ftpWatts: 262.5, weightKg: 70 })
  const p3 = both.find((a) => a.key === "power")!
  // 3.75 W/kg → (3.75-2.0)/3.5 = 0.5
  assert(Math.abs(p3.level! - 0.5) < 1e-9, `3.75 W/kg → 0.5, got ${p3.level}`)
})

scenario("feel/consistency use the 28-day window, not the raw session list", () => {
  const sessions = [
    { sessionDate: iso(2), feelScore: 4 },
    { sessionDate: iso(10), feelScore: 2 },
    // Old sessions outside the window must NOT count:
    { sessionDate: iso(40), feelScore: 5 },
    { sessionDate: iso(55), feelScore: 5 },
  ]
  const axes = computePerformanceRadar({ ...EMPTY, sessions })
  const feel = axes.find((a) => a.key === "feel")!
  // avg(4,2)/5 = 0.6
  assert(Math.abs(feel.level! - 0.6) < 1e-9, `feel from recent only, got ${feel.level}`)
  const cons = axes.find((a) => a.key === "consistency")!
  assert(Math.abs(cons.level! - 2 / 12) < 1e-9, `2 recent sessions /12, got ${cons.level}`)
})

scenario("one feel score is not a trend → feel honest-missing", () => {
  const axes = computePerformanceRadar({
    ...EMPTY,
    sessions: [{ sessionDate: iso(3), feelScore: 5 }],
  })
  const feel = axes.find((a) => a.key === "feel")!
  assert(feel.level === null, "single score → null")
  const cons = axes.find((a) => a.key === "consistency")!
  assert(cons.level != null, "consistency still measurable from one session")
})

scenario("levels always clamp to 0..1 under extreme inputs", () => {
  const axes = computePerformanceRadar({
    load: { ctl: 300, atl: 0, tsb: 300 },
    sessions: Array.from({ length: 40 }, (_, i) => ({
      sessionDate: iso(i % 28),
      feelScore: 5,
    })),
    ftpWatts: 600,
    weightKg: 50,
    todayIso: TODAY,
  })
  for (const a of axes) {
    if (a.level != null) {
      assert(a.level >= 0 && a.level <= 1, `${a.key} out of range: ${a.level}`)
    }
  }
})

scenario("zero chronic base → herstel honest-missing (no fake full recovery)", () => {
  const axes = computePerformanceRadar({
    ...EMPTY,
    load: { ctl: 0, atl: 12, tsb: -12 },
  })
  const rec = axes.find((a) => a.key === "recovery")!
  assert(rec.level === null, "ctl=0 → recovery not measurable")
})

// ── Report ────────────────────────────────────────────────────────────────────
let failed = 0
for (const r of results) {
  const mark = r.status === "pass" ? "✓" : "✗"
  console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
  if (r.status === "fail") failed++
}
console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`)
if (failed > 0) process.exit(1)
