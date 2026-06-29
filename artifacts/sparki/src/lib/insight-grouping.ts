import type { AiObservation } from "@/hooks/use-ai-memory"
import type {
  AthleteDailyMetric,
  FtpHistoryEntry,
  TrainingSession,
} from "@/lib/athlete-types"
import type { LoadData } from "@/hooks/use-load"
import { weeklyBuckets } from "@/lib/progression"

// ─────────────────────────────────────────────────────────────────────────────
// Insight → real series mapping + same-metric grouping.
//
// Every insight that talks about a measurable maatstaf is mapped to the REAL
// longitudinal series behind it, so the card can lead with data. Insights that
// have no continuous series (e.g. a race-weather note) map to `null` and the
// card simply shows no chart — never a fabricated one. Same-metric insights are
// collapsed into one card so the same explanation does not repeat (e.g. three
// near-identical HRV cards become one lead + its supporting members).
// ─────────────────────────────────────────────────────────────────────────────

export type MetricKind =
  | "hrv"
  | "rhr"
  | "sleep"
  | "recovery"
  | "ftp"
  | "fitness"
  | "volume"
  | "form"
  | "frequency"
  | "other"

export type InsightSeries = {
  /** Chronological (oldest → newest) real values. */
  values: number[]
  unit?: string
  /** Plain-Dutch one-liner describing what the chart shows. */
  caption: string
  /** True for metrics where a downward trend is the good direction (rusthart). */
  trendGoodWhenDown?: boolean
}

export type InsightSources = {
  metrics?: AthleteDailyMetric[]
  ftpHistory?: FtpHistoryEntry[]
  load?: LoadData
  sessions?: TrainingSession[]
}

export type InsightGroup = {
  key: string
  kind: MetricKind
  lead: AiObservation
  /** Lead first, then the other same-metric observations. */
  members: AiObservation[]
  series: InsightSeries | null
}

// Priority order matters: the first rule whose pattern matches wins.
const KIND_RULES: Array<{ kind: MetricKind; re: RegExp }> = [
  { kind: "hrv", re: /\bhrv\b|hartslagvariabiliteit/i },
  { kind: "rhr", re: /rusthart|rustpols|resting/i },
  { kind: "sleep", re: /slaap|sleep/i },
  { kind: "ftp", re: /\bftp\b|vermogen|wattage|\bwatt/i },
  { kind: "recovery", re: /herstel|recovery|vermoeid|fatigue|frisheid|readiness|gereed|check-?in|incheck/i },
  { kind: "form", re: /\bvorm\b|versheid|\btsb\b|\bform\b/i },
  { kind: "fitness", re: /fitheid|fitness|conditie|\bctl\b/i },
  { kind: "volume", re: /volume|belasting|\btss\b|trainingslast/i },
  { kind: "frequency", re: /frequentie|consisten|regelmaat|aantal trainingen/i },
]

/** Classify an observation to its dominant measurable maatstaf. */
export function classifyObservation(obs: AiObservation): MetricKind {
  const signalText = (obs.signals ?? [])
    .map((s) => `${s.label} ${s.kind}`)
    .join(" ")
  const haystack = `${obs.title} ${obs.category} ${signalText}`
  for (const rule of KIND_RULES) {
    if (rule.re.test(haystack)) return rule.kind
  }
  return "other"
}

// Metrics arrive newest-first from the API; reverse for a chronological series.
function chronological<T>(rows: T[] | undefined): T[] {
  return rows ? [...rows].reverse() : []
}

/** Map a metric kind to its real series, or null when there is none to chart. */
export function seriesForKind(
  kind: MetricKind,
  sources: InsightSources,
): InsightSeries | null {
  const { metrics, ftpHistory, load, sessions } = sources

  switch (kind) {
    case "hrv": {
      const values = chronological(metrics)
        .map((m) => m.hrv)
        .filter((v): v is number => v != null)
      return { values, unit: "ms", caption: "Je HRV over de laatste metingen" }
    }
    case "rhr": {
      const values = chronological(metrics)
        .map((m) => m.restingHR)
        .filter((v): v is number => v != null)
      return {
        values,
        unit: "bpm",
        caption: "Je rusthartslag over de laatste metingen",
        trendGoodWhenDown: true,
      }
    }
    case "sleep": {
      const values = chronological(metrics)
        .map((m) => (m.sleepHours != null ? Number.parseFloat(m.sleepHours) : null))
        .filter((v): v is number => v != null && Number.isFinite(v))
      return { values, unit: "u", caption: "Je slaap (uren) over de laatste nachten" }
    }
    case "recovery": {
      // Readiness proxy: daily feel-score (1–5) scaled to a 0–100 read.
      const values = chronological(metrics)
        .map((m) => m.feelScore)
        .filter((v): v is number => v != null)
        .map((v) => Math.round((v / 5) * 100))
      return { values, unit: "%", caption: "Je hersteltoestand uit je check-ins" }
    }
    case "ftp": {
      const values = [...(ftpHistory ?? [])]
        .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
        .map((h) => h.ftpWatts)
      return { values, unit: "W", caption: "Je FTP-ontwikkeling" }
    }
    case "fitness": {
      const values = (load?.chartData ?? []).map((d) => d.ctl).filter((v) => v >= 0)
      return { values, unit: "CTL", caption: "Je fitheid (CTL) over de periode" }
    }
    case "form": {
      const values = (load?.chartData ?? []).map((d) => d.tsb)
      return { values, unit: "TSB", caption: "Je vorm (TSB) over de periode" }
    }
    case "volume": {
      const values = weeklyBuckets(sessions ?? [], 6).map((b) => b.totalTss)
      return { values, unit: "TSS", caption: "Je trainingsvolume per week" }
    }
    case "frequency": {
      const values = weeklyBuckets(sessions ?? [], 6).map((b) => b.sessions)
      return { values, caption: "Aantal trainingen per week" }
    }
    default:
      return null
  }
}

/** Convenience: classify an observation and resolve its series in one call. */
export function seriesForObservation(
  obs: AiObservation,
  sources: InsightSources,
): InsightSeries | null {
  return seriesForKind(classifyObservation(obs), sources)
}

const SEVERITY_RANK: Record<AiObservation["severity"], number> = {
  urgent: 3,
  important: 2,
  watch: 1,
  info: 0,
}

const CONFIDENCE_RANK: Record<AiObservation["confidence"], number> = {
  high: 2,
  medium: 1,
  low: 0,
}

function rankObservation(o: AiObservation): number {
  return SEVERITY_RANK[o.severity] * 100 + CONFIDENCE_RANK[o.confidence] * 10
}

// Strongest observation first: severity, then confidence, then most recent.
function compareObservations(a: AiObservation, b: AiObservation): number {
  const r = rankObservation(b) - rankObservation(a)
  if (r !== 0) return r
  return b.createdAt.localeCompare(a.createdAt)
}

/**
 * Group observations so the same maatstaf is shown once. Observations that map
 * to a real metric are collapsed per kind (lead = strongest); everything else
 * stays as its own single-member group.
 */
export function groupObservations(
  observations: AiObservation[],
  sources: InsightSources,
): InsightGroup[] {
  const byKind = new Map<MetricKind, AiObservation[]>()
  const singles: InsightGroup[] = []

  for (const obs of observations) {
    const kind = classifyObservation(obs)
    if (kind === "other") {
      singles.push({
        key: `other-${obs.id}`,
        kind,
        lead: obs,
        members: [obs],
        series: null,
      })
      continue
    }
    const arr = byKind.get(kind) ?? []
    arr.push(obs)
    byKind.set(kind, arr)
  }

  const grouped: InsightGroup[] = []
  for (const [kind, arr] of byKind) {
    const members = [...arr].sort(compareObservations)
    grouped.push({
      key: `metric-${kind}`,
      kind,
      lead: members[0],
      members,
      series: seriesForKind(kind, sources),
    })
  }

  const all = [...grouped, ...singles]
  // Strongest insight first across all groups.
  all.sort((a, b) => compareObservations(a.lead, b.lead))
  return all
}

// ─────────────────────────────────────────────────────────────────────────────
// Near-duplicate prose collapse.
//
// Same-metric observations are often paraphrases of one fact ("FTP steeg van
// 262W naar 285W" vs "De FTP toont een stijgende lijn van 262W"). Listing each
// member's text in an expanded card repeats the same story many times. We
// collapse near-duplicate prose with a token-overlap measure that is robust to
// length differences, keeping the first (strongest) of each cluster.
// ─────────────────────────────────────────────────────────────────────────────

// Short Dutch function words carry no topical signal; dropping them keeps the
// overlap measure about content (numbers, maatstaf, richting) rather than glue.
const STOPWORDS = new Set([
  "van", "een", "het", "dit", "dat", "die", "met", "niet", "naar", "voor",
  "maar", "ook", "als", "dan", "wat", "wel", "nog", "per", "uit", "aan", "bij",
  "door", "over", "tot", "zijn", "was", "wordt", "worden", "heeft", "hebben",
  "deze", "daar", "hier", "omdat", "want", "dus", "the", "and",
])

function significantTokens(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u017f]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  )
}

// The figures an observation cites (watts, W/kg, dates…). Same-metric
// observations that quote the same numbers are telling the same story, even
// when the prose is rephrased — a stronger duplicate signal than words alone.
function significantNumbers(text: string): Set<string> {
  const out = new Set<string>()
  const re = /\d+(?:[.,]\d+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text || "")) !== null) out.add(m[0].replace(",", "."))
  return out
}

// Overlap coefficient = |A∩B| / min(|A|,|B|). High when the shorter set's
// content is largely contained in the larger one — exactly the paraphrase case.
function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / Math.min(a.size, b.size)
}

type TextSignature = { words: Set<string>; nums: Set<string> }

function signatureOf(o: AiObservation): TextSignature {
  const text = o.observationText || o.title
  return { words: significantTokens(text), nums: significantNumbers(text) }
}

// A candidate is a near-duplicate of a kept signature when either its content
// words overlap strongly, or (for figure-bearing notes) it quotes the same
// numbers. Both guards require ≥2 shared figures so a single shared year/value
// can never collapse two genuinely different notes.
function isNearDuplicate(a: TextSignature, b: TextSignature, wordThreshold: number): boolean {
  if (a.words.size > 0 && b.words.size > 0 && overlapCoefficient(a.words, b.words) >= wordThreshold) {
    return true
  }
  if (a.nums.size >= 2 && b.nums.size >= 2 && overlapCoefficient(a.nums, b.nums) >= 0.6) {
    return true
  }
  return false
}

/**
 * Drop observations whose prose is a near-duplicate of one already kept (same
 * story, different wording or just rephrased around the same figures). Order is
 * preserved; the first occurrence wins. `against` seeds the kept set (e.g. the
 * lead) so paraphrases of it are removed too. Texts with no meaningful content
 * are always kept (never falsely merged).
 */
export function dedupeObservationsByText(
  observations: AiObservation[],
  against: AiObservation[] = [],
  wordThreshold = 0.6,
): AiObservation[] {
  const sigs: TextSignature[] = against
    .map(signatureOf)
    .filter((s) => s.words.size > 0 || s.nums.size > 0)
  const kept: AiObservation[] = []
  for (const o of observations) {
    const sig = signatureOf(o)
    const hasContent = sig.words.size > 0 || sig.nums.size > 0
    if (hasContent && sigs.some((s) => isNearDuplicate(s, sig, wordThreshold))) {
      continue
    }
    kept.push(o)
    if (hasContent) sigs.push(sig)
  }
  return kept
}
