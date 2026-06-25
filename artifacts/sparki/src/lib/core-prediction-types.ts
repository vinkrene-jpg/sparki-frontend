// Core-prediction — frontend mirror of the engine's contract.
//
// The api-server engine (engines/core-prediction) owns the truth; this is the
// read-only shape the UI relies on. Every rendered string is plain Dutch and
// comes straight from the engine — the panel never invents copy or numbers.

import type {
  StateBand,
  MovementDirection,
} from "@/hooks/use-sparki-state"

export type FramePhase = "now" | "during" | "end" | "recovery"

export type CorePredictionFrame = {
  phase: FramePhase
  label: string
  caption: string
  x: number
  y: number
  band: StateBand
  tension: number
  distortion: number
  movement: { direction: MovementDirection; label: string }
  confidence: number
  load: { ctl: number; atl: number; tsb: number }
}

export type FactorAvailability = "present" | "estimated" | "missing"

export type CorePredictionFactor = {
  key: string
  label: string
  availability: FactorAvailability
  reading: string
  impact: string
}

export type ActualFramePhase = "start" | "end" | "recovery"

export type CoreActualFrame = {
  phase: ActualFramePhase
  label: string
  status: "measured" | "estimated" | "pending"
  x: number | null
  y: number | null
  band: StateBand | null
  tension: number | null
  distortion: number | null
  movement: { direction: MovementDirection; label: string } | null
  tsb: number | null
  note: string
}

export type CorePredictionComparison = {
  executed: boolean
  plannedTss: number | null
  actualTss: number | null
  actualTssBasis: FactorAvailability
  predictedEnd: { x: number; y: number; tsb: number } | null
  actualEnd: { x: number; y: number; tsb: number } | null
  actualPath: CoreActualFrame[]
  deviations: string[]
  reboundStatus: "available" | "pending"
  reboundNote: string
}

export type CorePrediction = {
  workoutId: number
  generatedAt: string
  scheduledDate: string
  workoutTitle: string
  tss: number | null
  tssBasis: FactorAvailability
  frames: CorePredictionFrame[]
  factors: CorePredictionFactor[]
  confidence: number
  confidenceLabel: string
  headline: string
  summary: string
  predictable: boolean
  comparison: CorePredictionComparison | null
}
