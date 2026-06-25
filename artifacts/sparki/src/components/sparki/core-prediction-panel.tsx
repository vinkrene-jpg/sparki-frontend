import { useState } from "react"
import { useCorePrediction } from "@/hooks/use-core-prediction"
import { stateToCore } from "@/lib/state-to-core"
import { SparkiCore } from "@/components/sparki/core/sparki-core"
import type { SparkiState } from "@/hooks/use-sparki-state"
import type {
  CorePredictionFrame,
  CorePredictionFactor,
  CoreActualFrame,
  FactorAvailability,
} from "@/lib/core-prediction-types"
import { ACCENT } from "@/components/sparki/ui"
import {
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Loader2,
  TrendingUp,
} from "lucide-react"

// The Core-voorspelpaneel — Sparki's honest forecast of what this training does
// to the athlete's living Core. It reuses the exact same living-shape Core as
// Vandaag (no route/star/waypoint metaphor): a filmstrip of the SAME organism
// at four moments — nu → tijdens → direct na → na herstel. Every number and
// every line of copy comes from the engine; this panel only renders them. Future
// frames are hazier because the engine lowers their confidence (never 1.0), and
// stateToCore turns that into a soft edge. Missing factors are shown honestly.

// Build the Core visual for a predicted frame by reusing the shared state→core
// mapping. The frame already carries the exact fields the mapping reads, so we
// hand it a minimal SparkiState — no fabricated meaning is added here.
function frameToCore(frame: CorePredictionFrame) {
  const pseudo: SparkiState = {
    date: "",
    athleteName: "",
    x: frame.x,
    y: frame.y,
    band: frame.band,
    tension: frame.tension,
    distortion: frame.distortion,
    movement: frame.movement,
    confidence: frame.confidence,
    confidenceLabel: "",
    status: "",
    action: null,
    metrics: [],
    checkInDone: false,
    why: [],
    missing: [],
  }
  return stateToCore(pseudo)
}

// Build the Core visual for a MEASURED/ESTIMATED actual moment. Pending moments
// have no position yet (null) and render an honest placeholder instead. Real data
// gets full certainty; a coarse estimate is shown a touch hazier (lower confidence).
function actualFrameToCore(frame: CoreActualFrame) {
  if (frame.x == null || frame.y == null || frame.band == null) return null
  const pseudo: SparkiState = {
    date: "",
    athleteName: "",
    x: frame.x,
    y: frame.y,
    band: frame.band,
    tension: frame.tension ?? 0,
    distortion: frame.distortion ?? 0,
    movement: frame.movement ?? { direction: "stabiel", label: "" },
    confidence: frame.status === "estimated" ? 0.6 : 0.95,
    confidenceLabel: "",
    status: "",
    action: null,
    metrics: [],
    checkInDone: false,
    why: [],
    missing: [],
  }
  return stateToCore(pseudo)
}

const cardClass =
  "rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"

const AVAIL_DOT: Record<FactorAvailability, string> = {
  present: "rgba(120,210,230,0.95)",
  estimated: "rgba(255,200,90,0.9)",
  missing: "rgba(255,255,255,0.25)",
}

const AVAIL_LABEL: Record<FactorAvailability, string> = {
  present: "bekend",
  estimated: "geschat",
  missing: "niet beschikbaar",
}

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: ACCENT,
            boxShadow: `0 0 8px ${ACCENT}`,
          }}
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] tracking-wide text-white/45">
        {label} · {pct}%
      </span>
    </div>
  )
}

function FrameCard({ frame }: { frame: CorePredictionFrame }) {
  const visual = frameToCore(frame)
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <span className="truncate font-mono text-[8px] tracking-[0.12em] text-white/45">
        {frame.label.toUpperCase()}
      </span>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
        <SparkiCore state={visual} className="h-full w-full" />
      </div>
      <span className="w-full truncate text-center text-[10px] capitalize leading-snug text-white/55">
        {frame.band}
      </span>
      <span className="font-mono text-[8px] tabular-nums text-white/35">
        vorm {frame.load.tsb >= 0 ? "+" : ""}
        {frame.load.tsb}
      </span>
    </div>
  )
}

function ActualFrameCard({ frame }: { frame: CoreActualFrame }) {
  const visual = actualFrameToCore(frame)
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <span className="truncate font-mono text-[8px] tracking-[0.12em] text-white/45">
        {frame.label.toUpperCase()}
      </span>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
        {visual ? (
          <SparkiCore state={visual} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-3.5 w-3.5 text-white/25" />
          </div>
        )}
      </div>
      <span className="w-full truncate text-center text-[10px] capitalize leading-snug text-white/55">
        {frame.band ?? "nog niet"}
      </span>
      <span className="font-mono text-[8px] tabular-nums text-white/35">
        {frame.status === "estimated"
          ? "geschat"
          : frame.status === "pending"
            ? "—"
            : frame.tsb != null
              ? `vorm ${frame.tsb >= 0 ? "+" : ""}${frame.tsb}`
              : "gemeten"}
      </span>
    </div>
  )
}

function FactorRow({ factor }: { factor: CorePredictionFactor }) {
  const muted = factor.availability === "missing"
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: AVAIL_DOT[factor.availability] }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-[12px] ${muted ? "text-white/45" : "text-white/80"}`}
          >
            {factor.label}
          </span>
          <span className="font-mono text-[8px] tracking-[0.15em] text-white/30">
            {AVAIL_LABEL[factor.availability].toUpperCase()}
          </span>
        </div>
        <p
          className={`mt-0.5 text-pretty text-[11px] leading-relaxed ${muted ? "text-white/35" : "text-white/55"}`}
        >
          {factor.reading}
        </p>
        {factor.impact && (
          <p className="mt-0.5 text-pretty text-[11px] leading-relaxed text-white/40">
            {factor.impact}
          </p>
        )}
      </div>
    </div>
  )
}

export function CorePredictionPanel({ workoutId }: { workoutId: number }) {
  const { data: prediction, isLoading, isError } = useCorePrediction(workoutId)
  const [showFactors, setShowFactors] = useState(false)

  if (isLoading) {
    return (
      <div className={`${cardClass} flex items-center gap-3`}>
        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        <span className="text-[12px] text-white/45">
          Sparki voorspelt het effect…
        </span>
      </div>
    )
  }

  if (isError || !prediction) {
    return (
      <div className={cardClass}>
        <p className="text-[12px] leading-relaxed text-white/50">
          Sparki kon de voorspelling nu niet maken. Probeer het zo opnieuw.
        </p>
      </div>
    )
  }

  const cmp = prediction.comparison

  return (
    <div className={`${cardClass} flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <Sparkles
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: ACCENT }}
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] tracking-[0.22em] text-cyan-300/70">
            VOORSPELLING — EFFECT OP JE CORE
          </p>
          <h3 className="mt-1 text-balance font-sans text-[15px] font-light leading-snug text-white/90">
            {prediction.headline}
          </h3>
        </div>
      </div>

      {prediction.predictable ? (
        <>
          {/* Filmstrip of the living Core through the session — nu → tijdens →
              direct na → na herstel. All moments stay visible at once. */}
          <div className="grid grid-cols-4 gap-2">
            {prediction.frames.map((f) => (
              <FrameCard key={f.phase} frame={f} />
            ))}
          </div>

          {/* Plain-Dutch summary straight from the engine */}
          <p className="text-pretty text-[12.5px] leading-relaxed text-white/65">
            {prediction.summary}
          </p>

          <ConfidenceBar
            value={prediction.confidence}
            label={prediction.confidenceLabel}
          />
        </>
      ) : (
        <>
          {/* Honest "now" frame only + why Sparki can't predict yet */}
          <div className="flex items-center gap-4">
            {prediction.frames[0] && (
              <div className="h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                <SparkiCore
                  state={frameToCore(prediction.frames[0])}
                  className="h-full w-full"
                />
              </div>
            )}
            <p className="text-pretty text-[12.5px] leading-relaxed text-white/60">
              {prediction.summary}
            </p>
          </div>
        </>
      )}

      {/* Predicted-vs-actual, once the session is executed */}
      {cmp?.executed && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="h-3.5 w-3.5"
              style={{ color: ACCENT }}
              strokeWidth={2}
            />
            <span className="font-mono text-[9px] tracking-[0.2em] text-cyan-300/70">
              VOORSPELD VS. ECHT
            </span>
          </div>
          {/* Predicted Core path vs the REAL one, the same living organism at
              each moment — voorspeld bovenaan, werkelijk eronder, uitgelijnd. */}
          {cmp.actualPath?.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              <div>
                <span className="font-mono text-[8px] tracking-[0.18em] text-white/35">
                  VOORSPELD
                </span>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {prediction.frames
                    .filter((f) => f.phase !== "during")
                    .map((f) => (
                      <FrameCard key={`pred-${f.phase}`} frame={f} />
                    ))}
                </div>
              </div>
              <div>
                <span className="font-mono text-[8px] tracking-[0.18em] text-cyan-300/60">
                  WERKELIJK
                </span>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {cmp.actualPath.map((f) => (
                    <ActualFrameCard key={`act-${f.phase}`} frame={f} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="mt-2.5 flex flex-col gap-1.5">
            {cmp.deviations.map((d, i) => (
              <p
                key={i}
                className="text-pretty text-[12px] leading-relaxed text-white/65"
              >
                {d}
              </p>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2 border-t border-white/[0.06] pt-2.5">
            <TrendingUp className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
            <span className="text-[11px] leading-relaxed text-white/50">
              {cmp.reboundNote}
            </span>
          </div>
        </div>
      )}

      {/* Determining factors — honest availability behind the prediction */}
      <div className="border-t border-white/[0.07] pt-2">
        <button
          type="button"
          onClick={() => setShowFactors((v) => !v)}
          className="flex w-full items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-white/40 transition-colors hover:text-white/65"
        >
          WAAR SPARKI OP BASEERT ({prediction.factors.length})
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showFactors ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </button>
        {showFactors && (
          <div className="mt-1.5 flex flex-col divide-y divide-white/[0.05]">
            {prediction.factors.map((f) => (
              <FactorRow key={f.key} factor={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
