// Pure, deterministic analyses over REAL activity streams (downsampled
// per-sample buckets from FIT/TCX/GPX ingest). Nothing here fabricates data:
// every function returns null (with an honest reason where relevant) when the
// required channel is missing. Neutral voice everywhere — conclusions, never
// "Sparki ziet…".

export type SessionStreams = {
  t: number[]
  power: Array<number | null> | null
  heartRate: Array<number | null> | null
  cadence: Array<number | null> | null
  speedKph: Array<number | null> | null
  elevationM: Array<number | null> | null
  temperatureC: Array<number | null> | null
  distanceKm: Array<number | null> | null
  speedDerived?: boolean
  sampleCount?: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function finite(vals: Array<number | null> | null | undefined): number[] {
  if (!vals) return []
  return vals.filter((v): v is number => v != null && Number.isFinite(v))
}

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null
  return xs.reduce((s, v) => s + v, 0) / xs.length
}

/** Paired (t, value) points for a channel, skipping gaps. */
function paired(
  streams: SessionStreams,
  channel: Array<number | null> | null,
): Array<{ t: number; v: number }> {
  if (!channel) return []
  const out: Array<{ t: number; v: number }> = []
  for (let i = 0; i < streams.t.length && i < channel.length; i++) {
    const v = channel[i]
    if (v != null && Number.isFinite(v)) out.push({ t: streams.t[i]!, v })
  }
  return out
}

export function hasChannel(
  streams: SessionStreams | null,
  key: keyof Pick<
    SessionStreams,
    "power" | "heartRate" | "cadence" | "speedKph" | "elevationM" | "temperatureC"
  >,
): boolean {
  return !!streams && finite(streams[key]).length >= 2
}

// ── Vermogenszones (Coggan-indeling op FTP) ──────────────────────────────────

export type ZoneBucket = {
  zone: string
  label: string
  fromW: number
  toW: number | null // null = open einde
  seconds: number
  pct: number
}

const POWER_ZONES: Array<{ zone: string; label: string; lo: number; hi: number | null }> = [
  { zone: "Z1", label: "Herstel", lo: 0, hi: 0.55 },
  { zone: "Z2", label: "Duur", lo: 0.55, hi: 0.75 },
  { zone: "Z3", label: "Tempo", lo: 0.75, hi: 0.9 },
  { zone: "Z4", label: "Drempel", lo: 0.9, hi: 1.05 },
  { zone: "Z5", label: "VO2max", lo: 1.05, hi: 1.2 },
  { zone: "Z6", label: "Anaeroob", lo: 1.2, hi: null },
]

/**
 * Time-in-zone from real power buckets against the athlete's FTP.
 * Null when there is no power channel or no usable FTP.
 */
export function powerZoneDistribution(
  streams: SessionStreams | null,
  ftp: number | null,
): ZoneBucket[] | null {
  if (!streams || !ftp || ftp <= 0) return null
  const pts = paired(streams, streams.power)
  if (pts.length < 2) return null

  // Each bucket represents the time until the next bucket (last gets median dt).
  const dts: number[] = []
  for (let i = 1; i < streams.t.length; i++) dts.push(streams.t[i]! - streams.t[i - 1]!)
  const medianDt = dts.length ? [...dts].sort((a, b) => a - b)[Math.floor(dts.length / 2)]! : 1

  const seconds = POWER_ZONES.map(() => 0)
  let total = 0
  for (const p of pts) {
    const ratio = p.v / ftp
    let idx = POWER_ZONES.findIndex(
      (z) => ratio >= z.lo && (z.hi == null || ratio < z.hi),
    )
    if (idx < 0) idx = ratio < 0 ? 0 : POWER_ZONES.length - 1
    seconds[idx]! += medianDt
    total += medianDt
  }
  if (total <= 0) return null
  return POWER_ZONES.map((z, i) => ({
    zone: z.zone,
    label: z.label,
    fromW: Math.round(z.lo * ftp),
    toW: z.hi == null ? null : Math.round(z.hi * ftp),
    seconds: Math.round(seconds[i]!),
    pct: Math.round((seconds[i]! / total) * 1000) / 10,
  }))
}

// ── Hartslagzones (op maximale hartslag) ─────────────────────────────────────

const HR_ZONES: Array<{ zone: string; label: string; lo: number; hi: number | null }> = [
  { zone: "Z1", label: "Zeer licht", lo: 0, hi: 0.6 },
  { zone: "Z2", label: "Licht", lo: 0.6, hi: 0.7 },
  { zone: "Z3", label: "Matig", lo: 0.7, hi: 0.8 },
  { zone: "Z4", label: "Zwaar", lo: 0.8, hi: 0.9 },
  { zone: "Z5", label: "Maximaal", lo: 0.9, hi: null },
]

export function hrZoneDistribution(
  streams: SessionStreams | null,
  maxHr: number | null,
): ZoneBucket[] | null {
  if (!streams || !maxHr || maxHr <= 0) return null
  const pts = paired(streams, streams.heartRate)
  if (pts.length < 2) return null
  const seconds = HR_ZONES.map(() => 0)
  let total = 0
  for (const p of pts) {
    const ratio = p.v / maxHr
    let idx = HR_ZONES.findIndex((z) => ratio >= z.lo && (z.hi == null || ratio < z.hi))
    if (idx < 0) idx = ratio < 0 ? 0 : HR_ZONES.length - 1
    seconds[idx]! += 1
    total += 1
  }
  if (total <= 0) return null
  return HR_ZONES.map((z, i) => ({
    zone: z.zone,
    label: z.label,
    fromW: Math.round(z.lo * maxHr),
    toW: z.hi == null ? null : Math.round(z.hi * maxHr),
    seconds: seconds[i]!,
    pct: Math.round((seconds[i]! / total) * 1000) / 10,
  }))
}

// ── Hartslagdrift (aerobe ontkoppeling) ──────────────────────────────────────

export type HrDrift = {
  /** % change of the power:HR ratio, first half → second half. Positive = drift. */
  driftPct: number
  firstHalfPwHr: number
  secondHalfPwHr: number
  verdict: "laag" | "matig" | "hoog"
}

/**
 * Aerobe ontkoppeling: vergelijk vermogen-per-hartslag tussen de eerste en de
 * tweede helft van de rit. Vereist ÉCHT vermogen én hartslag; anders null.
 */
export function hrDrift(streams: SessionStreams | null): HrDrift | null {
  if (!streams || !streams.power || !streams.heartRate) return null
  const n = Math.min(streams.t.length, streams.power.length, streams.heartRate.length)
  if (n < 20) return null
  const half = Math.floor(n / 2)
  const ratio = (from: number, to: number): number | null => {
    const ps: number[] = []
    const hs: number[] = []
    for (let i = from; i < to; i++) {
      const p = streams.power![i]
      const h = streams.heartRate![i]
      if (p != null && h != null && h > 60 && p > 30) {
        ps.push(p)
        hs.push(h)
      }
    }
    if (ps.length < 5) return null
    const ap = avg(ps)!
    const ah = avg(hs)!
    return ah > 0 ? ap / ah : null
  }
  const r1 = ratio(0, half)
  const r2 = ratio(half, n)
  if (r1 == null || r2 == null || r1 <= 0) return null
  const driftPct = Math.round(((r1 - r2) / r1) * 1000) / 10
  return {
    driftPct,
    firstHalfPwHr: Math.round(r1 * 100) / 100,
    secondHalfPwHr: Math.round(r2 * 100) / 100,
    verdict: driftPct < 5 ? "laag" : driftPct < 10 ? "matig" : "hoog",
  }
}

// ── Vermogensverval ──────────────────────────────────────────────────────────

export type PowerFade = {
  firstThirdW: number
  lastThirdW: number
  /** % change last third vs first third. Negative = fade. */
  fadePct: number
  verdict: "stabiel" | "licht verval" | "duidelijk verval" | "sterker einde"
}

export function powerFade(streams: SessionStreams | null): PowerFade | null {
  if (!streams || !streams.power) return null
  const pts = paired(streams, streams.power).filter((p) => p.v > 30)
  if (pts.length < 15) return null
  const third = Math.floor(pts.length / 3)
  const first = avg(pts.slice(0, third).map((p) => p.v))
  const last = avg(pts.slice(pts.length - third).map((p) => p.v))
  if (first == null || last == null || first <= 0) return null
  const fadePct = Math.round(((last - first) / first) * 1000) / 10
  return {
    firstThirdW: Math.round(first),
    lastThirdW: Math.round(last),
    fadePct,
    verdict:
      fadePct > 3
        ? "sterker einde"
        : fadePct > -5
          ? "stabiel"
          : fadePct > -12
            ? "licht verval"
            : "duidelijk verval",
  }
}

// ── Pacing (gelijkmatigheid) ─────────────────────────────────────────────────

export type Pacing = {
  avgW: number
  /** Variatiecoëfficiënt (stddev/gemiddelde) van het vermogen, in %. */
  variabilityPct: number
  verdict: "gelijkmatig" | "wisselend" | "zeer wisselend"
}

export function pacing(streams: SessionStreams | null): Pacing | null {
  if (!streams || !streams.power) return null
  const vals = finite(streams.power).filter((v) => v > 0)
  if (vals.length < 15) return null
  const mean = avg(vals)!
  if (mean <= 0) return null
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
  const cv = Math.sqrt(variance) / mean
  const variabilityPct = Math.round(cv * 1000) / 10
  return {
    avgW: Math.round(mean),
    variabilityPct,
    verdict: cv < 0.25 ? "gelijkmatig" : cv < 0.45 ? "wisselend" : "zeer wisselend",
  }
}

// ── Intervaldetectie + vergelijking met het plan ─────────────────────────────

export type DetectedInterval = {
  startSec: number
  endSec: number
  durationSec: number
  avgW: number
}

/**
 * Detecteer werkblokken: aaneengesloten stukken waar het vermogen duidelijk
 * boven het ritgemiddelde ligt (≥115%), minimaal 60 s. Deterministisch en
 * alleen uit echte data — geen blok, dan een lege lijst.
 */
export function detectIntervals(streams: SessionStreams | null): DetectedInterval[] {
  if (!streams || !streams.power) return []
  const pts = paired(streams, streams.power)
  if (pts.length < 20) return []
  const mean = avg(pts.map((p) => p.v).filter((v) => v > 0))
  if (mean == null || mean <= 0) return []
  const threshold = mean * 1.15

  const out: DetectedInterval[] = []
  let start: number | null = null
  let acc: number[] = []
  const flush = (endT: number) => {
    if (start != null && endT - start >= 60 && acc.length >= 3) {
      out.push({
        startSec: start,
        endSec: endT,
        durationSec: Math.round(endT - start),
        avgW: Math.round(avg(acc)!),
      })
    }
    start = null
    acc = []
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    if (p.v >= threshold) {
      if (start == null) start = p.t
      acc.push(p.v)
    } else if (start != null) {
      flush(p.t)
    }
  }
  if (start != null) flush(pts[pts.length - 1]!.t)
  return out
}

export type PlannedBlock = {
  kind: string // warmup | interval | recovery | steady | cooldown
  durationMin: number | null
  targetPctFtp?: number | null
  reps?: number | null
}

export type IntervalComparison = {
  plannedCount: number
  riddenCount: number
  /** Per gepland blok: gevonden reëel blok + doel vs. gereden. */
  matches: Array<{
    plannedTargetW: number | null
    riddenAvgW: number | null
    riddenDurationSec: number | null
    deltaPct: number | null
  }>
  conclusion: string
}

/**
 * Vergelijk geplande intervalblokken met de gereden blokken. Eerlijk: als het
 * plan geen intervallen bevat of er is geen vermogen, dan null.
 */
export function compareIntervalsWithPlan(
  streams: SessionStreams | null,
  blocks: PlannedBlock[] | null,
  ftp: number | null,
): IntervalComparison | null {
  if (!blocks || blocks.length === 0) return null
  const plannedIntervals = blocks.filter((b) => b.kind === "interval")
  const plannedCount = plannedIntervals.reduce(
    (s, b) => s + Math.max(1, b.reps ?? 1),
    0,
  )
  if (plannedCount === 0) return null
  const ridden = detectIntervals(streams)

  const matches: IntervalComparison["matches"] = []
  let idx = 0
  for (const b of plannedIntervals) {
    const reps = Math.max(1, b.reps ?? 1)
    const targetW =
      ftp && ftp > 0 && b.targetPctFtp != null
        ? Math.round((b.targetPctFtp / 100) * ftp)
        : null
    for (let r = 0; r < reps; r++) {
      const hit = ridden[idx]
      idx += 1
      matches.push({
        plannedTargetW: targetW,
        riddenAvgW: hit ? hit.avgW : null,
        riddenDurationSec: hit ? hit.durationSec : null,
        deltaPct:
          hit && targetW && targetW > 0
            ? Math.round(((hit.avgW - targetW) / targetW) * 1000) / 10
            : null,
      })
    }
  }

  const done = matches.filter((m) => m.riddenAvgW != null).length
  const conclusion =
    ridden.length === 0
      ? "In het vermogen zijn geen duidelijke werkblokken terug te vinden."
      : done >= plannedCount
        ? `Alle ${plannedCount} geplande blokken zijn terug te zien in het vermogen.`
        : `${done} van de ${plannedCount} geplande blokken zijn terug te zien in het vermogen.`

  return { plannedCount, riddenCount: ridden.length, matches, conclusion }
}

// ── Vergelijkbaarheid van twee sessies ───────────────────────────────────────

export type ComparabilityInput = {
  type: string | null
  durationMin: number | null
  distanceKm: number | null
  elevationM: number | null
  avgPower: number | null
  avgHr: number | null
}

export type Comparability = {
  comparable: boolean
  /** Eerlijke redenen waarom (niet) vergelijkbaar — plain Dutch. */
  reasons: string[]
}

/**
 * Twee sessies mogen alleen naast elkaar gezet worden als de vergelijking
 * eerlijk is: zelfde soort werk, vergelijkbare duur, en dezelfde meetbasis
 * (beide vermogen of beide hartslag). Anders: niet vergelijkbaar, met reden.
 */
export function assessComparability(
  a: ComparabilityInput,
  b: ComparabilityInput,
): Comparability {
  const reasons: string[] = []

  if (a.type && b.type && a.type !== b.type) {
    reasons.push(`Verschillend soort training (${a.type} vs. ${b.type}).`)
  }
  if (a.durationMin != null && b.durationMin != null) {
    const lo = Math.min(a.durationMin, b.durationMin)
    const hi = Math.max(a.durationMin, b.durationMin)
    if (lo > 0 && hi / lo > 1.35) {
      reasons.push("De duur verschilt te veel voor een eerlijke vergelijking.")
    }
  } else {
    reasons.push("Van minstens één sessie is de duur onbekend.")
  }
  const bothPower = a.avgPower != null && b.avgPower != null
  const bothHr = a.avgHr != null && b.avgHr != null
  if (!bothPower && !bothHr) {
    reasons.push(
      "Er is geen gedeelde meetbasis: niet beide sessies hebben vermogen of hartslag.",
    )
  }
  if (
    a.elevationM != null &&
    b.elevationM != null &&
    a.distanceKm != null &&
    b.distanceKm != null &&
    a.distanceKm > 0 &&
    b.distanceKm > 0
  ) {
    const climbA = a.elevationM / a.distanceKm
    const climbB = b.elevationM / b.distanceKm
    if (Math.abs(climbA - climbB) > 8) {
      reasons.push("Het terrein (hoogtemeters per kilometer) verschilt sterk.")
    }
  }

  return { comparable: reasons.length === 0, reasons }
}
