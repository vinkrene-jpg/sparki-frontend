// Tests for the insight grouping + series-mapping engine (`insight-grouping.ts`).
//
// The /train PatternsLayer and the /you Core lenses both render insight cards
// through this engine. Two contracts matter most and must not silently break:
//   - GROUPING: multiple same-metric observations (e.g. three HRV reads) collapse
//     into ONE card (lead + members), while non-chartable insights stay separate
//     single-member groups. This is the whole point of "minder tekst".
//   - HONESTY: a chart series is always derived from REAL sources or is absent —
//     non-metric insights map to `series: null` (no chart), and a metric with no
//     data yields an empty `values` array (the card shows "nog geen meetreeks"),
//     never a fabricated line.
//
// Pure functions, no DB — run with: `pnpm --filter @workspace/sparki run test:insight-grouping`
// Exits non-zero on any failure.
import type { AiObservation } from "@/hooks/use-ai-memory"
import type { AthleteDailyMetric, FtpHistoryEntry } from "@/lib/athlete-types"
import {
  classifyObservation,
  groupObservations,
  seriesForKind,
  type InsightSources,
} from "./insight-grouping"

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
function obs(partial: Partial<AiObservation>): AiObservation {
  return {
    id: nextId++,
    sourceType: "engine",
    title: "",
    summary: null,
    observationText: "",
    confidence: "medium",
    category: "training",
    severity: "info",
    detectedPattern: null,
    signals: null,
    alternativeExplanations: null,
    confidenceScore: null,
    recommendedAction: null,
    status: "new",
    createdAt: new Date().toISOString(),
    ...partial,
  }
}

function metric(partial: Partial<AthleteDailyMetric>): AthleteDailyMetric {
  return {
    hrv: null,
    restingHR: null,
    sleepHours: null,
    feelScore: null,
    ...partial,
  } as AthleteDailyMetric
}

// ── classifyObservation ──────────────────────────────────────────────────────

scenario("classify maps each maatstaf to its kind", () => {
  assert(
    classifyObservation(obs({ title: "Je HRV daalt deze week" })) === "hrv",
    "HRV title must classify as hrv",
  )
  assert(
    classifyObservation(obs({ title: "Je rusthartslag loopt op" })) === "rhr",
    "rusthartslag must classify as rhr",
  )
  assert(
    classifyObservation(obs({ title: "Je slaap wordt korter" })) === "sleep",
    "slaap must classify as sleep",
  )
  assert(
    classifyObservation(obs({ title: "Je FTP is gestegen" })) === "ftp",
    "FTP must classify as ftp",
  )
})

scenario("non-metric observation classifies as 'other'", () => {
  assert(
    classifyObservation(obs({ title: "Weersverwachting voor je wedstrijd", category: "race" })) ===
      "other",
    "a non-chartable note must classify as other",
  )
})

// ── grouping ─────────────────────────────────────────────────────────────────

scenario("three HRV observations collapse into ONE group", () => {
  const list = [
    obs({ title: "HRV daalt", severity: "watch" }),
    obs({ title: "HRV blijft laag", severity: "important" }),
    obs({ title: "HRV herstelt traag", severity: "info" }),
  ]
  const groups = groupObservations(list, {})
  const hrvGroups = groups.filter((g) => g.kind === "hrv")
  assert(hrvGroups.length === 1, `expected 1 HRV group, got ${hrvGroups.length}`)
  assert(
    hrvGroups[0].members.length === 3,
    `the HRV group must carry all 3 members, got ${hrvGroups[0].members.length}`,
  )
})

scenario("strongest observation leads the group", () => {
  const list = [
    obs({ title: "HRV daalt", severity: "watch", confidence: "low" }),
    obs({ title: "HRV blijft laag", severity: "important", confidence: "high" }),
  ]
  const [group] = groupObservations(list, {})
  assert(
    group.lead.title === "HRV blijft laag",
    `the most severe/confident observation must lead, got "${group.lead.title}"`,
  )
})

scenario("different metrics stay in separate groups; 'other' stays single", () => {
  const list = [
    obs({ title: "HRV daalt" }),
    obs({ title: "Je rusthartslag loopt op" }),
    obs({ title: "Weersverwachting wedstrijd", category: "race" }),
  ]
  const groups = groupObservations(list, {})
  assert(groups.length === 3, `expected 3 distinct groups, got ${groups.length}`)
  const other = groups.find((g) => g.kind === "other")
  assert(!!other && other.series === null, "an 'other' group must have no chart (null series)")
})

// ── series honesty ───────────────────────────────────────────────────────────

scenario("HRV series is real and chronological (oldest → newest)", () => {
  // API returns newest-first; the engine must reverse to chronological order.
  const sources: InsightSources = {
    metrics: [metric({ hrv: 70 }), metric({ hrv: 65 }), metric({ hrv: 60 })],
  }
  const series = seriesForKind("hrv", sources)
  assert(!!series, "hrv must yield a series object")
  assert(
    JSON.stringify(series!.values) === JSON.stringify([60, 65, 70]),
    `HRV values must be chronological, got ${JSON.stringify(series!.values)}`,
  )
})

scenario("a metric with no data yields an empty series (honest, not fabricated)", () => {
  const series = seriesForKind("hrv", { metrics: [] })
  assert(!!series, "hrv kind still returns a series shell")
  assert(series!.values.length === 0, "no metrics must yield zero values, never invented ones")
})

scenario("rusthartslag is flagged as good-when-down", () => {
  const series = seriesForKind("rhr", { metrics: [metric({ restingHR: 50 })] })
  assert(series!.trendGoodWhenDown === true, "rhr must mark a downward trend as the good direction")
})

scenario("FTP series sorts ascending by measurement date", () => {
  const ftpHistory: FtpHistoryEntry[] = [
    { ftpWatts: 250, measuredAt: "2026-03-01" },
    { ftpWatts: 240, measuredAt: "2026-01-01" },
    { ftpWatts: 245, measuredAt: "2026-02-01" },
  ] as FtpHistoryEntry[]
  const series = seriesForKind("ftp", { ftpHistory })
  assert(
    JSON.stringify(series!.values) === JSON.stringify([240, 245, 250]),
    `FTP values must be date-ascending, got ${JSON.stringify(series!.values)}`,
  )
})

scenario("'other' kind never produces a chart", () => {
  assert(seriesForKind("other", {}) === null, "other kind must map to null series")
})

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(`\ninsight-grouping: ${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) {
  process.exit(1)
}
