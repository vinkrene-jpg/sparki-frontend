// Day-advice engine — turns a no-plan day from a generic dashboard into one
// concrete, explainable recommendation. Pure and deterministic: it weighs the
// athlete's real signals (check-in readiness, current form/TSB, weekly hours,
// FTP and the nearest race) into a single session with concrete numbers and a
// "waarom" that cites each signal. Numbers are deterministic here; no prose is
// invented and nothing is shown that the data does not support.
//
// It only fills in the gaps it has data for — a missing FTP drops the watt band
// (not the advice), a missing race becomes a "build your base" note. When there
// is no check-in at all it returns null, because readiness is the core driver
// and the homepage already prompts for a check-in in that case.

import type { Race } from "@/lib/race-types"
import { daysUntil } from "@/lib/race-context"
import { computeReadiness, type Metrics } from "@/lib/readiness"

export type DayAdviceKind =
  | "rest"
  | "recovery"
  | "endurance"
  | "tempo"
  | "intervals"

export type DayAdvice = {
  kind: DayAdviceKind
  headline: string
  durationMin: number
  power: { low: number; high: number; label: string } | null
  focus: string
  reasons: string[]
  primary: { label: string; href: string }
}

type AdviceProfile = {
  ftp?: number | null
  weeklyHourTarget?: number | null
  trainingDaysPerWeek?: number | null
  goals?: string | null
} | null

type Load = { ctl: number; atl: number; tsb: number } | null

export type DayAdviceInput = {
  profile: AdviceProfile
  metrics: Metrics
  load: Load
  races: Race[] | undefined
}

// Standard Coggan power zones as a fraction of FTP — used only to translate a
// chosen intensity into a concrete watt band when an FTP is known.
const ZONE_PCT: Record<
  Exclude<DayAdviceKind, "rest">,
  { lo: number; hi: number; label: string }
> = {
  recovery: { lo: 0.46, hi: 0.55, label: "Zone 1 · herstel" },
  endurance: { lo: 0.56, hi: 0.75, label: "Zone 2 · duur" },
  tempo: { lo: 0.76, hi: 0.9, label: "Zone 3 · tempo" },
  intervals: { lo: 0.95, hi: 1.05, label: "Zone 4 · drempel" },
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function round5(n: number): number {
  return Math.round(n / 5) * 5
}

function powerBand(
  kind: DayAdviceKind,
  ftp: number | null | undefined,
): DayAdvice["power"] {
  if (kind === "rest" || !ftp) return null
  const z = ZONE_PCT[kind]
  return {
    low: Math.round(ftp * z.lo),
    high: Math.round(ftp * z.hi),
    label: z.label,
  }
}

/** Nearest upcoming race (today or later), or null. */
function nearestRace(
  races: Race[] | undefined,
): { race: Race; daysUntil: number } | null {
  if (!races || races.length === 0) return null
  let best: { race: Race; daysUntil: number } | null = null
  for (const race of races) {
    const d = daysUntil(race.raceDate)
    if (d < 0) continue
    if (!best || d < best.daysUntil) best = { race, daysUntil: d }
  }
  return best
}

function buildHeadline(kind: DayAdviceKind, dur: number): string {
  switch (kind) {
    case "rest":
      return "Neem vandaag volledige rust"
    case "recovery":
      return `Actief herstel — rustig ritje van ±${dur} min`
    case "endurance":
      return `Duurrit van ±${dur} min in zone 2`
    case "tempo":
      return `Tempotraining van ±${dur} min`
    case "intervals":
      return `Intervaltraining van ±${dur} min`
  }
}

function buildFocus(kind: DayAdviceKind): string {
  switch (kind) {
    case "rest":
      return "Slaap, eten en hydratatie. Geef je lichaam vandaag geen prikkels."
    case "recovery":
      return "Heel licht trappen, ruim onder je drempel — dit versnelt je herstel."
    case "endurance":
      return "Constant tempo, je moet comfortabel kunnen praten. Bouwt je aerobe basis."
    case "tempo":
      return "Na inrijden 2–3 blokken in zone 3 met rustige tussenstukken."
    case "intervals":
      return "Goed inrijden, daarna scherpe herhalingen met volledige rust ertussen."
  }
}

export function computeDayAdvice(input: DayAdviceInput): DayAdvice | null {
  const { profile, metrics, load, races } = input
  if (!profile) return null

  const readiness = computeReadiness(metrics)
  // Readiness (the check-in) is the core driver — without it we cannot tailor an
  // honest intensity, so we defer to the homepage's "log je check-in" prompt.
  if (!readiness || !metrics) return null

  const tsb = load?.tsb ?? null
  const race = nearestRace(races)

  // 1. Base intensity from readiness.
  let kind: DayAdviceKind
  if (readiness.score < 40) kind = "rest"
  else if (readiness.score < 55) kind = "recovery"
  else if (readiness.score < 70) kind = "endurance"
  else kind = readiness.score >= 82 ? "intervals" : "tempo"

  // 2. Form guard — deep fatigue (very negative TSB) pulls quality back a notch;
  //    being fresh opens a little room for a tempo prikkel.
  if (tsb != null) {
    if (tsb <= -25 && kind !== "rest") {
      kind = "recovery"
    } else if (tsb <= -12) {
      if (kind === "intervals") kind = "tempo"
      else if (kind === "tempo") kind = "endurance"
    } else if (tsb >= 8 && kind === "endurance" && readiness.score >= 65) {
      kind = "tempo"
    }
  }

  // 3. Race-phase framing. On a no-plan (general) day the nearest race always
  //    sits outside its race-week window, so this is base/build context: a far
  //    race means base endurance, a closer one nudges toward quality.
  let raceNote: string | null = null
  if (race) {
    const d = race.daysUntil
    const dayWord = d === 1 ? "dag" : "dagen"
    raceNote =
      d > 28
        ? `Nog ${d} ${dayWord} tot ${race.race.name} — basisperiode: bouw je duurvermogen op.`
        : `Nog ${d} ${dayWord} tot ${race.race.name} — opbouwfase: scherp je vorm aan.`
    if (
      d <= 28 &&
      kind === "endurance" &&
      readiness.score >= 68 &&
      (tsb == null || tsb > -12)
    ) {
      kind = "tempo"
    }
  }

  // 4. Duration from weekly hours spread over the planned training days.
  const weeklyMin = (profile.weeklyHourTarget ?? 0) * 60
  const days = clamp(profile.trainingDaysPerWeek ?? 4, 2, 7)
  const perSession = weeklyMin > 0 ? weeklyMin / days : 0
  let durationMin: number
  switch (kind) {
    case "rest":
      durationMin = 0
      break
    case "recovery":
      durationMin = perSession > 0 ? clamp(round5(perSession * 0.6), 30, 50) : 40
      break
    case "endurance":
      durationMin = perSession > 0 ? clamp(round5(perSession), 60, 150) : 75
      break
    case "tempo":
      durationMin = perSession > 0 ? clamp(round5(perSession), 60, 105) : 75
      break
    case "intervals":
      durationMin = perSession > 0 ? clamp(round5(perSession), 60, 90) : 70
      break
  }

  const power = powerBand(kind, profile.ftp)

  // 5. Reasons — each bullet cites a real signal so the advice is explainable.
  const reasons: string[] = []
  reasons.push(
    `Je check-in (gevoel ${metrics.feelScore ?? "–"}/5, slaap ${metrics.sleepQuality ?? "–"}/5, vermoeidheid ${metrics.fatigueScore ?? "–"}/10) geeft een readiness van ${readiness.score}% (${readiness.state}).`,
  )
  if (tsb != null) {
    const form = tsb >= 5 ? "fris" : tsb <= -15 ? "vermoeid" : "in balans"
    reasons.push(
      `Je vorm (TSB ${tsb > 0 ? "+" : ""}${tsb}) is ${form} — daar past deze intensiteit bij.`,
    )
  }
  if (profile.weeklyHourTarget) {
    reasons.push(
      kind === "rest"
        ? `Je mikt op ${profile.weeklyHourTarget} u/week — vandaag past rust in dat ritme.`
        : `Je mikt op ${profile.weeklyHourTarget} u/week, verdeeld over ~${days} dagen → vandaag ±${durationMin} min.`,
    )
  }
  if (power) {
    reasons.push(
      `Met je FTP van ${profile.ftp} W ligt ${power.label} op ${power.low}–${power.high} W.`,
    )
  } else if (kind !== "rest" && !profile.ftp) {
    reasons.push(
      "Stel je FTP in zodat Sparki hier exacte vermogenswaarden bij kan zetten.",
    )
  }
  reasons.push(raceNote ?? "Nog geen wedstrijd gepland — focus op een sterke basis.")
  if (profile.goals && profile.goals.trim()) {
    reasons.push(`Dit werkt naar je doel: ${profile.goals.trim()}.`)
  }

  const primary: DayAdvice["primary"] =
    kind === "rest"
      ? { label: "Bekijk je herstel", href: "/you" }
      : { label: "Zet dit op je plan", href: "/train" }

  return {
    kind,
    headline: buildHeadline(kind, durationMin),
    durationMin,
    power,
    focus: buildFocus(kind),
    reasons,
    primary,
  }
}
