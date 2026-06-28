// Tests for the growth-range engine (`deriveBandbreedte`).
//
// The /you Ontwikkelkompas renders the realistic FTP growth range
// (behoudend / verwacht / optimistisch) and goal-referenced copy from this one
// engine output. Unlike `deriveOntwikkelprioriteit`, it had NO coverage — so a
// regression in its honest hasData gating or its goal labelling could silently
// ship a fabricated band or drop the goal from the copy. These tests pin the
// exact engine contract the page relies on:
//   - hasData=false → honest empty (fewer than 2 FTP measurements; or
//     measurements spanning <21 days).
//   - goalLabel reflects the chosen developmentGoal (null with no goal), and the
//     rendered `meaning` copy references the goal when one is set.
//   - low ≤ expected ≤ high ordering holds, and tone (up/flat/down) tracks a
//     controlled FTP slope.
//
// Pure function, no DB — run with: `pnpm --filter @workspace/sparki run test:bandbreedte`
// Exits non-zero on any failure.
import type { AthleteProfile, FtpHistoryEntry } from "@/lib/athlete-types"
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
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString().slice(0, 10)
}

let nextFtpId = 1
function makeFtp(overrides: Partial<FtpHistoryEntry> = {}): FtpHistoryEntry {
  const id = nextFtpId++
  return {
    id,
    clerkId: "test_user",
    measuredAt: isoDaysAgo(0),
    ftpWatts: 250,
    testType: "manual",
    notes: null,
    createdAt: "2026-06-01T12:00:00Z",
    ...overrides,
  }
}

// Build an FTP history from a list of watt values, evenly spaced (oldest first)
// across `spanDays` ending today. This gives exact control over both the slope
// (the value progression) and the time span (the honesty gate).
function makeFtpSeries(values: number[], spanDays = 84): FtpHistoryEntry[] {
  const n = values.length
  if (n === 1) return [makeFtp({ ftpWatts: values[0], measuredAt: isoDaysAgo(0) })]
  return values.map((v, i) => {
    const daysAgo = Math.round(spanDays - (i * spanDays) / (n - 1)) // i=0 oldest
    return makeFtp({ ftpWatts: v, measuredAt: isoDaysAgo(daysAgo) })
  })
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
    createdAt: "2026-06-01T12:00:00Z",
    updatedAt: "2026-06-01T12:00:00Z",
    ...overrides,
  }
}

// ── 1. Honesty gates → hasData=false (no fabricated band) ─────────────────────

scenario("no FTP history at all → hasData=false", () => {
  const b = deriveBandbreedte(undefined, undefined, makeProfile())
  assert(b.hasData === false, "with no measurements the engine must report hasData=false")
  assert(b.reason != null, "an honest reason must be given when hasData=false")
  assert(b.current === null && b.low === null && b.expected === null && b.high === null,
    "no band values may be invented when hasData=false")
})

scenario("only one FTP measurement → hasData=false (a slope needs two)", () => {
  const b = deriveBandbreedte(makeFtpSeries([250]), undefined, makeProfile())
  assert(b.hasData === false, "fewer than two measurements must keep hasData=false")
  assert(b.reason != null, "an honest reason must be given when hasData=false")
})

scenario("two measurements spanning <21 days → hasData=false", () => {
  // Two real measurements, but only 10 days apart — too tight for a slope.
  const b = deriveBandbreedte(makeFtpSeries([240, 250], 10), undefined, makeProfile())
  assert(b.hasData === false, "measurements <21 days apart must keep hasData=false")
  assert(b.reason != null, "an honest reason must be given when hasData=false")
})

// ── 2. goalLabel reflects the chosen developmentGoal ──────────────────────────
// Both the EMPTY and the populated result carry goalLabel; the page renders
// goal-referenced copy ("… richting <goal>") off it, so pin it exactly.

scenario("goalLabel is null when no developmentGoal is set", () => {
  const b = deriveBandbreedte(makeFtpSeries([230, 245, 250, 260, 270]), undefined, makeProfile())
  assert(b.hasData === true, "a rich, well-spread history must yield a band")
  assert(b.goalLabel === null, `no goal must leave goalLabel null, got: ${b.goalLabel}`)
})

scenario("goalLabel reflects the chosen developmentGoal, even when hasData=false", () => {
  // The goal label must survive the honest-empty path too (the page still shows it).
  const b = deriveBandbreedte(undefined, undefined, makeProfile({ developmentGoal: "granfondo" }))
  assert(b.hasData === false, "no history still gates to hasData=false")
  assert(
    b.goalLabel === "Gran fondo / toertocht",
    `granfondo goalLabel must be its label even when empty, got: ${b.goalLabel}`,
  )
})

scenario("goalLabel + meaning reference the goal when one is set", () => {
  const ftps = makeFtpSeries([230, 240, 250, 260, 270]) // rising → 'up' branch (carries the goal)
  const b = deriveBandbreedte(ftps, undefined, makeProfile({ developmentGoal: "granfondo" }))
  assert(b.hasData === true, "a rising, well-spread history must yield a band")
  assert(
    b.goalLabel === "Gran fondo / toertocht",
    `granfondo goalLabel must be its label, got: ${b.goalLabel}`,
  )
  assert(
    b.meaning.includes("Gran fondo / toertocht"),
    `the rendered meaning must reference the goal, got: ${b.meaning}`,
  )
})

// ── 3. Range ordering + tone track the controlled FTP slope ───────────────────

scenario("rising FTP → tone 'up' and low ≤ expected ≤ high", () => {
  const b = deriveBandbreedte(makeFtpSeries([230, 240, 250, 260, 270]), undefined, makeProfile())
  assert(b.hasData === true, "a rising, well-spread history must yield a band")
  assert(b.tone === "up", `rising FTP must read as tone 'up', got: ${b.tone}`)
  assert(
    b.low! <= b.expected! && b.expected! <= b.high!,
    `band must satisfy low ≤ expected ≤ high, got: ${b.low}/${b.expected}/${b.high}`,
  )
  assert(b.expected! > b.current!, "a rising slope must project growth above current")
})

scenario("flat FTP → tone 'flat' and low ≤ expected ≤ high", () => {
  const b = deriveBandbreedte(makeFtpSeries([250, 250, 250, 250, 250]), undefined, makeProfile())
  assert(b.hasData === true, "a flat, well-spread history must yield a band")
  assert(b.tone === "flat", `flat FTP must read as tone 'flat', got: ${b.tone}`)
  assert(
    b.low! <= b.expected! && b.expected! <= b.high!,
    `band must satisfy low ≤ expected ≤ high, got: ${b.low}/${b.expected}/${b.high}`,
  )
})

scenario("falling FTP → tone 'down' and low ≤ expected ≤ high", () => {
  const b = deriveBandbreedte(makeFtpSeries([270, 260, 250, 240, 230]), undefined, makeProfile())
  assert(b.hasData === true, "a falling, well-spread history must yield a band")
  assert(b.tone === "down", `falling FTP must read as tone 'down', got: ${b.tone}`)
  assert(
    b.low! <= b.expected! && b.expected! <= b.high!,
    `band must satisfy low ≤ expected ≤ high, got: ${b.low}/${b.expected}/${b.high}`,
  )
  assert(b.expected! < b.current!, "a falling slope must project below current")
})

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(`\nbandbreedte: ${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) {
  process.exit(1)
}
