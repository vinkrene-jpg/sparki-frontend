// Pure, deterministic composition helpers for the Training page. Everything
// here derives from REAL engine output (training-plan, load model, coach
// advice). When the evidence is thin the verdict is honestly "onbekend" with a
// `needs` list — Sparki never fabricates a judgment it cannot back up.

import type { TrainingPlanResponse, PlanInputsView } from "@/hooks/use-training-plan"
import type { LoadData } from "@/hooks/use-load"
import type { Advice } from "@/hooks/use-coach-analysis"
import { trendDir, type TrendDir } from "@/lib/progression"

// ─────────────────────────────────────────────────────────────────────────
// Layer 1 — Trainingsbron: who/what drives the schedule.
// ─────────────────────────────────────────────────────────────────────────

export type SourceKind = "coach" | "sparki" | "self" | "none"

export type TrainingSource = {
  kind: SourceKind
  label: string
  /** Plain-Dutch explanation of what Sparki does with this source. */
  detail: string
  /** Whether Sparki may build/adapt a plan for this athlete. */
  canBuild: boolean
}

export function detectSource(
  plan: TrainingPlanResponse | undefined,
  hasManualWorkout: boolean,
): TrainingSource {
  if (plan?.hasCoach) {
    return {
      kind: "coach",
      label: "Je trainer",
      detail:
        "Je trainer bepaalt je schema. Je krijgt advies, maar je trainingen worden nooit automatisch veranderd.",
      canBuild: false,
    }
  }
  if (plan?.plan && plan.mode === "autonomous") {
    return {
      kind: "sparki",
      label: "Sparki",
      detail:
        "Dit schema is opgebouwd uit je eigen cijfers en beweegt mee met hoe je traint en herstelt.",
      canBuild: true,
    }
  }
  if (hasManualWorkout) {
    return {
      kind: "self",
      label: "Je eigen invoer",
      detail:
        "Je voert je trainingen zelf in — je krijgt inzicht en berekeningen, maar er wordt niets voor je ingepland.",
      canBuild: true,
    }
  }
  return {
    kind: "none",
    label: "Nog geen bron",
    detail:
      "Er is nog geen trainingsbron. Op basis van je eigen cijfers kan er een schema voor je worden opgebouwd.",
    canBuild: true,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Layer 2 — Doel als maatlat: is the build on course for the goal?
// ─────────────────────────────────────────────────────────────────────────

export type GoalVerdict = "op_koers" | "te_zwaar" | "te_licht" | "onbekend"

export type GoalFit = {
  verdict: GoalVerdict
  headline: string
  reason: string
  /** Langere toelichting, in de UI ingeklapt achter een "Meer uitleg"-link. */
  detail?: string
  /** What Sparki still needs to judge more sharply (honest uncertainty). */
  needs: string[]
}

const PHASE_LABEL: Record<PlanInputsView["phase"], string> = {
  base: "basisfase",
  build: "opbouwfase",
  peak: "piekfase",
  taper: "afbouwfase",
}

function ctlSeriesOf(load: LoadData | undefined): number[] {
  return (load?.chartData ?? []).map((d) => d.ctl).filter((v) => v >= 0)
}

export function judgeGoalFit(args: {
  inputs: PlanInputsView | undefined
  load: LoadData | undefined
}): GoalFit {
  const { inputs, load } = args
  const race = inputs?.nextRace ?? null
  const goalLabel = race ? race.name : null

  // No goal at all → nothing to measure against.
  if (!race) {
    return {
      verdict: "onbekend",
      headline: "Voeg je eerstvolgende doel toe",
      reason: "Dan wordt elk advies daarop afgestemd.",
      detail:
        "Zonder doel of wedstrijd is er geen maatstaf voor of je training de goede kant op gaat. Met een doel weegt Sparki je opbouw, je vermoeidheid en je planning af tegen waar je naartoe wilt.",
      needs: ["een doel of wedstrijd"],
    }
  }

  const ctl = ctlSeriesOf(load)
  const hasEnough = ctl.length >= 14 && ctl.some((v) => v > 0)
  const daysAway = race.daysAway
  const weeksAway = Math.max(0, Math.round(daysAway / 7))
  const phase = inputs?.phase ?? "base"
  const phaseLabel = PHASE_LABEL[phase]
  const taperWindow = phase === "taper" || phase === "peak"

  // Race set, but not enough logged load to judge the trajectory honestly.
  if (!hasEnough) {
    return {
      verdict: "onbekend",
      headline: `Nog ${weeksAway} ${weeksAway === 1 ? "week" : "weken"} tot ${goalLabel}`,
      reason: "Nog te weinig gelogde belasting om je koers te beoordelen.",
      detail:
        "Sparki heeft minimaal twee weken aan gelogde trainingen nodig om je opbouw richting dit doel te beoordelen. Log je trainingen of koppel een platform, dan wordt je koers zichtbaar.",
      needs: ["meer gelogde trainingen om je opbouw te beoordelen"],
    }
  }

  const first = ctl[0] ?? 0
  const last = ctl[ctl.length - 1] ?? 0
  const dir: TrendDir = trendDir(first, last)
  const tsb = Math.round(load?.tsb ?? 0)

  // Deeper in the red than the build calls for (and not a planned taper dip).
  if (tsb < -20 && !taperWindow) {
    return {
      verdict: "te_zwaar",
      headline: `Je belasting loopt voor op je opbouw richting ${goalLabel}`,
      reason: `Je vermoeidheidsbalans staat op ${tsb}. Dat is dieper dan je ${phaseLabel} nu vraagt — las herstel in voordat je verder bouwt.`,
      needs: [],
    }
  }

  // Fitness sliding while there's still a long way to build.
  if (dir === "down" && !taperWindow && weeksAway > 3) {
    return {
      verdict: "te_licht",
      headline: `Je bouwt nu te weinig op voor ${goalLabel}`,
      reason: `Je fitheid zakt terwijl je nog ${weeksAway} weken te gaan hebt in je ${phaseLabel}. Met dit volume kom je waarschijnlijk te kort — voeg belasting toe of pas je plan aan.`,
      needs: [],
    }
  }

  // Flat and early in a base block with plenty of runway → too little, too soon.
  if (dir === "flat" && phase === "base" && weeksAway > 6) {
    return {
      verdict: "te_licht",
      headline: `Je opbouw richting ${goalLabel} komt nog niet op gang`,
      reason: `Je fitheid blijft vlak terwijl je nog ${weeksAway} weken in je ${phaseLabel} hebt. Dit is hét moment om rustig op te bouwen.`,
      needs: [],
    }
  }

  // On course.
  const climb = dir === "up" ? "stijgt" : "houdt stand"
  const fresh = tsb >= 0 ? "je staat fris" : "je belasting is gezond"
  return {
    verdict: "op_koers",
    headline: `Je opbouw past bij ${goalLabel}`,
    reason: `Je fitheid ${climb} en ${fresh} (balans ${tsb}). In je ${phaseLabel}, met nog ${weeksAway} ${weeksAway === 1 ? "week" : "weken"} te gaan, zit je op koers.`,
    needs: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Layer 3 — Vandaag: does today's plan match how recovered you are?
// ─────────────────────────────────────────────────────────────────────────

export type ConflictKind = "te_zwaar_voor_herstel" | "ruimte_voor_meer" | "none"

export type ReadinessConflict = {
  kind: ConflictKind
  headline: string
  detail: string
}

/** Heaviness of a planned session, from its primary zone (fallback: type). */
function plannedHardness(zone: number | null, type: string | null): "hard" | "easy" | "mid" | "rest" {
  if (type === "rest") return "rest"
  if (zone == null) return "mid"
  if (zone >= 4) return "hard"
  if (zone <= 2) return "easy"
  return "mid"
}

/** Easy/hard reading of the coach's readiness advice. */
function adviceWeight(i: Advice["intensity"]): "easy" | "mid" | "hard" {
  if (i === "rust" || i === "herstel" || i === "rustig") return "easy"
  if (i === "stevig") return "hard"
  return "mid"
}

export function detectReadinessConflict(args: {
  plannedZone: number | null
  plannedType: string | null
  advice: Advice | undefined
}): ReadinessConflict {
  const { plannedZone, plannedType, advice } = args
  if (!advice) return { kind: "none", headline: "", detail: "" }

  const planned = plannedHardness(plannedZone, plannedType)
  const want = adviceWeight(advice.intensity)

  // Planned hard, but your recovery asks for easy → real conflict.
  if (planned === "hard" && want === "easy") {
    return {
      kind: "te_zwaar_voor_herstel",
      headline: "Vandaag staat zwaarder gepland dan je herstel toelaat",
      detail: advice.explainers.waaromDitAdvies,
    }
  }

  // Planned easy/rest, but you're fresh and could do more → optional upside.
  if ((planned === "easy" || planned === "rest") && want === "hard") {
    return {
      kind: "ruimte_voor_meer",
      headline: "Je lijkt fris genoeg voor iets meer dan gepland",
      detail: advice.explainers.waaromDitAdvies,
    }
  }

  return { kind: "none", headline: "", detail: "" }
}

// ─────────────────────────────────────────────────────────────────────────
// Shared: which observations actually belong on the Training page.
// ─────────────────────────────────────────────────────────────────────────

const TRAINING_CATEGORIES = new Set([
  "training",
  "load",
  "recovery",
  "power",
  "performance",
  "fitness",
  "fatigue",
])

export function isTrainingObservation(category: string): boolean {
  return TRAINING_CATEGORIES.has(category.toLowerCase())
}
