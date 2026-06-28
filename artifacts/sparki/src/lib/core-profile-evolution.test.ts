// Tests for the "Hoe is je sportprofiel veranderd" evolution trends in
// `core-profile.ts`:
//   - `deriveEvolution` — turns the real FTP-history, training-load (CTL) chart
//     and session cadence into honest up/down/flat trend cards. It is exactly the
//     kind of code where an off-by-one in the delta sign, or a slip in the 28-day
//     cadence window, would silently tell an athlete their progress is going the
//     WRONG direction. Each item also has an honesty gate (FTP needs ≥2
//     measurements, CTL needs ≥2 chart points) that must never be bypassed.
//
// The fixtures below are exact: linear FTP points and linear CTL charts make the
// first→last delta the visible, deterministic step, and the session dates are
// pinned relative to "now" so the 28-day window count is unambiguous.
//
// Pure functions, no DB — run with: `pnpm --filter @workspace/sparki run test:core-profile-evolution`
// Exits non-zero on any failure.
import type { FtpHistoryEntry, TrainingSession } from "@/lib/athlete-types"
import type { LoadData } from "@/hooks/use-load"
import { deriveEvolution } from "./core-profile"

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

let nextId = 1

// Build an FTP history from {daysAgo, watts} points. `deriveEvolution` sorts by
// measuredAt ascending internally, so the order here doesn't matter.
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

// A linear CTL chart from c0 (oldest) → c1 (newest) over `days` daily points.
// chart[0] is the oldest point and chart[last] the newest, matching how
// `deriveEvolution` reads first vs last CTL.
function ctlChart(days: number, c0: number, c1: number): LoadData {
  const chartData = [] as LoadData["chartData"]
  for (let i = days - 1; i >= 0; i--) {
    const ctl = days === 1 ? c1 : c1 - (c1 - c0) * (i / (days - 1))
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

// A list of sessions at the given ages (in days).
function sessions(daysAgo: number[]): TrainingSession[] {
  return daysAgo.map((d) => ({
    id: nextId++,
    clerkId: "test_user",
    sessionDate: new Date(Date.now() - d * DAY).toISOString(),
    type: "ride",
    title: null,
    durationMin: 60,
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
  }))
}

function item(r: ReturnType<typeof deriveEvolution>, key: string) {
  return r.items.find((i) => i.key === key)
}

// ── 1. FTP trend — direction must match the real delta ────────────────────────

scenario("FTP rising → tone 'up', positive signed change and the metingen detail", () => {
  const r = deriveEvolution(
    ftpHistory([
      { daysAgo: 60, watts: 200 },
      { daysAgo: 30, watts: 230 },
      { daysAgo: 0, watts: 260 },
    ]),
    undefined,
    undefined,
  )
  const ftp = item(r, "ftp")
  assert(ftp, "a 3-measurement rise must yield an FTP item")
  assert(ftp!.tone === "up", `a rise must read 'up', got: ${ftp!.tone}`)
  assert(ftp!.current === "260 W", `current must be the latest measurement, got: ${ftp!.current}`)
  assert(ftp!.change === "+60 W", `a +60 rise must be signed '+60 W', got: ${ftp!.change}`)
  assert(
    ftp!.detail.includes("over 3 metingen"),
    `detail must report the measurement count, got: ${ftp!.detail}`,
  )
  assert(
    ftp!.detail.includes("200 W") && ftp!.detail.includes("260 W"),
    `detail must show first→last watts, got: ${ftp!.detail}`,
  )
})

scenario("FTP falling → tone 'down' and a negative change (never flipped to growth)", () => {
  const r = deriveEvolution(
    ftpHistory([
      { daysAgo: 60, watts: 280 },
      { daysAgo: 0, watts: 250 },
    ]),
    undefined,
    undefined,
  )
  const ftp = item(r, "ftp")
  assert(ftp, "a 2-measurement decline must yield an FTP item")
  assert(ftp!.tone === "down", `a decline must read 'down', got: ${ftp!.tone}`)
  assert(ftp!.current === "250 W", `current must be the latest measurement, got: ${ftp!.current}`)
  assert(ftp!.change === "-30 W", `a -30 drop must be signed '-30 W', got: ${ftp!.change}`)
  assert(ftp!.detail.includes("over 2 metingen"), `detail must report the count, got: ${ftp!.detail}`)
})

scenario("FTP flat → tone 'flat' with the 'gelijk gebleven' change", () => {
  const r = deriveEvolution(
    ftpHistory([
      { daysAgo: 60, watts: 250 },
      { daysAgo: 0, watts: 250 },
    ]),
    undefined,
    undefined,
  )
  const ftp = item(r, "ftp")
  assert(ftp, "two equal measurements still yield an FTP item")
  assert(ftp!.tone === "flat", `an unchanged FTP must read 'flat', got: ${ftp!.tone}`)
  assert(
    ftp!.change === "gelijk gebleven",
    `a zero delta must read 'gelijk gebleven', got: ${ftp!.change}`,
  )
})

scenario("FTP gate: a single measurement → no FTP item", () => {
  const r = deriveEvolution(ftpHistory([{ daysAgo: 0, watts: 250 }]), undefined, undefined)
  assert(item(r, "ftp") === undefined, "one measurement cannot support a trend")
})

scenario("FTP uses chronological first vs last regardless of input order", () => {
  // Newest point listed first, oldest last — sorting must still pick 200→260.
  const r = deriveEvolution(
    ftpHistory([
      { daysAgo: 0, watts: 260 },
      { daysAgo: 30, watts: 230 },
      { daysAgo: 60, watts: 200 },
    ]),
    undefined,
    undefined,
  )
  const ftp = item(r, "ftp")
  assert(ftp!.tone === "up", "out-of-order input must still read the true rise as 'up'")
  assert(ftp!.change === "+60 W", `signed delta must be +60 W, got: ${ftp!.change}`)
})

// ── 2. CTL (conditie) trend — from the load chart ─────────────────────────────

scenario("CTL rising → tone 'up', positive signed change and rounded current", () => {
  const r = deriveEvolution(undefined, ctlChart(30, 40, 70), undefined)
  const ctl = item(r, "ctl")
  assert(ctl, "a rising CTL chart must yield a CTL item")
  assert(ctl!.tone === "up", `a rising CTL must read 'up', got: ${ctl!.tone}`)
  assert(ctl!.current === "70", `current must be the rounded last CTL, got: ${ctl!.current}`)
  assert(ctl!.change === "+30", `a +30 rise must be signed '+30', got: ${ctl!.change}`)
})

scenario("CTL falling → tone 'down' and a negative change (not flipped)", () => {
  const r = deriveEvolution(undefined, ctlChart(30, 80, 50), undefined)
  const ctl = item(r, "ctl")
  assert(ctl, "a falling CTL chart must yield a CTL item")
  assert(ctl!.tone === "down", `a falling CTL must read 'down', got: ${ctl!.tone}`)
  assert(ctl!.current === "50", `current must be the rounded last CTL, got: ${ctl!.current}`)
  assert(ctl!.change === "-30", `a -30 drop must be signed '-30', got: ${ctl!.change}`)
})

scenario("CTL flat → tone 'flat' with the 'stabiel' change", () => {
  const r = deriveEvolution(undefined, ctlChart(30, 55, 55), undefined)
  const ctl = item(r, "ctl")
  assert(ctl, "a flat CTL chart still yields a CTL item")
  assert(ctl!.tone === "flat", `an unchanged CTL must read 'flat', got: ${ctl!.tone}`)
  assert(ctl!.change === "stabiel", `a zero delta must read 'stabiel', got: ${ctl!.change}`)
})

scenario("CTL gate: a single chart point → no CTL item", () => {
  const r = deriveEvolution(undefined, ctlChart(1, 50, 50), undefined)
  assert(item(r, "ctl") === undefined, "one chart point cannot support a trend")
})

// ── 3. Cadence (trainingsritme) — the 28-day window + per-week figure ──────────

scenario("cadence: counts only sessions inside the 28-day window", () => {
  // Three inside (0/14/27 d) and two outside (29/40 d) → count must be 3.
  const r = deriveEvolution(undefined, undefined, sessions([0, 14, 27, 29, 40]))
  const cad = item(r, "cadence")
  assert(cad, "any sessions at all must yield a cadence item")
  assert(
    cad!.change === "3 ritten · 4 wk",
    `only the 3 in-window sessions may be counted, got: ${cad!.change}`,
  )
  // perWeek = (3 / 4).toFixed(1) = "0.8", comma-formatted.
  assert(cad!.current === "0,8/wk", `per-week figure must be 3/4=0,8, got: ${cad!.current}`)
  assert(cad!.tone === "flat", `3 in-window rides read as steady 'flat', got: ${cad!.tone}`)
})

scenario("cadence: a high in-window count reads as 'up'", () => {
  // Eight sessions all inside the window → tone 'up', 8/4 = 2,0 per week.
  const r = deriveEvolution(undefined, undefined, sessions([1, 3, 6, 9, 12, 16, 20, 24]))
  const cad = item(r, "cadence")
  assert(cad!.tone === "up", `≥8 in-window rides must read 'up', got: ${cad!.tone}`)
  assert(cad!.change === "8 ritten · 4 wk", `count must be 8, got: ${cad!.change}`)
  assert(cad!.current === "2,0/wk", `8/4 = 2,0 per week, got: ${cad!.current}`)
})

scenario("cadence: sessions exist but none recent → tone 'down', zero in window", () => {
  // History exists (so the item shows) but everything is older than 28 days.
  const r = deriveEvolution(undefined, undefined, sessions([30, 45, 60]))
  const cad = item(r, "cadence")
  assert(cad, "old sessions still surface the cadence item (history exists)")
  assert(cad!.tone === "down", `zero recent rides must read 'down', got: ${cad!.tone}`)
  assert(cad!.change === "0 ritten · 4 wk", `in-window count must be 0, got: ${cad!.change}`)
  assert(cad!.current === "0,0/wk", `0/4 = 0,0 per week, got: ${cad!.current}`)
})

scenario("cadence: no sessions at all → no cadence item", () => {
  const r = deriveEvolution(undefined, undefined, [])
  assert(item(r, "cadence") === undefined, "an empty session list yields no cadence item")
})

// ── 4. Honest-empty when nothing qualifies ────────────────────────────────────

scenario("honest-empty: too little of everything → hasAny=false, no items", () => {
  const r = deriveEvolution(
    ftpHistory([{ daysAgo: 0, watts: 250 }]), // <2 measurements
    ctlChart(1, 50, 50), // <2 chart points
    [], // no sessions
  )
  assert(r.hasAny === false, "nothing qualifying must report hasAny=false")
  assert(r.items.length === 0, "no items may be fabricated when nothing qualifies")
})

scenario("honest-empty: all inputs undefined → hasAny=false", () => {
  const r = deriveEvolution(undefined, undefined, undefined)
  assert(r.hasAny === false, "undefined inputs must be honest-empty")
  assert(r.items.length === 0, "no items from undefined inputs")
})

scenario("all three series present → hasAny=true with one item each", () => {
  const r = deriveEvolution(
    ftpHistory([
      { daysAgo: 60, watts: 200 },
      { daysAgo: 0, watts: 240 },
    ]),
    ctlChart(30, 40, 60),
    sessions([2, 8, 15]),
  )
  assert(r.hasAny === true, "real data across all three must read hasAny=true")
  assert(r.items.length === 3, `expected ftp+ctl+cadence, got ${r.items.length}`)
  assert(item(r, "ftp") && item(r, "ctl") && item(r, "cadence"), "all three keys must be present")
})

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(`\ncore-profile-evolution: ${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) {
  process.exit(1)
}
