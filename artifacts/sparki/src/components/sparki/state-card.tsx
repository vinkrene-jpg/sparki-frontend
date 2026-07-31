import { useState } from "react"
import { ChevronDown, ChevronRight, ArrowRight, Zap } from "lucide-react"
import {
  useSparkiState,
  useStateCheckIn,
  type CheckInAnswer,
  type StateSignal,
  type StateMetric,
  type StateBand,
} from "@/hooks/use-sparki-state"
import { Skeleton } from "@/components/sparki/home-sections"
import { UitlegDot } from "@/components/viz/uitleg"
import { buildHerstelPresentatie } from "@/lib/commercial-shell"
import { labelSignal } from "@/lib/signal-labels"

// Generic State Engine consumer. It renders one honest Sparki toestand (the
// living Core + status + coach action + check-in + the 2–3 "Waarom?" signals)
// from the engine's /api/state contract. It knows nothing about Vandaag: any
// surface (Training, Races, Coach, Widgets, Sparki Display, …) can mount it.
//
// The optional drill-in to a fuller view is INJECTED by the host via
// `onShowDetails` — the card never imports a surface-specific context. On
// Vandaag this opens the full day-type analysis; elsewhere it can do anything,
// or be omitted (then the drill-in row simply does not render).
export type StateCardProps = {
  /** Optional host-supplied drill-in. Omit to hide the row entirely. */
  onShowDetails?: () => void
  /** Label for the drill-in row. Defaults to "Volledige analyse". */
  detailsLabel?: string
  /**
   * When true, an outstanding daily check-in ("Hoe voel je je vandaag?") is
   * hoisted to the very top of the card so it is the first thing the athlete
   * sees on opening the app. Once today's check-in is done it drops back to its
   * calm position below, letting the living Core lead again. Vandaag sets this;
   * the Core profile page leaves it off.
   */
  checkInFirst?: boolean
  /**
   * When true, the card renders NO check-in block at all (neither hoisted nor
   * calm). Vandaag sets this because the check-in lives there as a standalone
   * chip under the Momentblok (Fase 2 "De aandachtswet"); other surfaces leave
   * it off so the card keeps its own in-card check-in.
   */
  hideCheckIn?: boolean
}

// Each band gets a calm accent within the Sparki cyan→warm language.
const BAND_ACCENT: Record<StateBand, string> = {
  belastbaar: "rgba(120,210,230,1)",
  solide: "rgba(150,225,200,1)",
  wisselend: "rgba(245,205,130,0.98)",
  kwetsbaar: "rgba(245,150,130,0.98)",
}

const TONE_DOT: Record<StateSignal["tone"], string> = {
  positive: "bg-cyan-300",
  concern: "bg-amber-300",
  neutral: "bg-white/40",
}

const CHECKINS: { value: CheckInAnswer; label: string }[] = [
  { value: "fris", label: "Fris" },
  { value: "oke", label: "Oké" },
  { value: "vermoeid", label: "Vermoeid" },
]

// Tone → value colour for the glanceable metrics (cyan→warm Sparki language).
const METRIC_TONE: Record<StateMetric["tone"], string> = {
  positive: "text-cyan-300",
  concern: "text-amber-300",
  neutral: "text-white/90",
}

// Time-of-day greeting — a small, personal touch so Vandaag opens warm, not as a
// stack of dashboards.
function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return "Goedenacht"
  if (h < 12) return "Goedemorgen"
  if (h < 18) return "Goedemiddag"
  return "Goedenavond"
}

export function StateCard({
  onShowDetails,
  detailsLabel,
  checkInFirst,
  hideCheckIn,
}: StateCardProps = {}) {
  const { data: state, isLoading, isError, refetch } = useSparkiState()
  const checkIn = useStateCheckIn()
  const [showWhy, setShowWhy] = useState(false)
  const [reCheckIn, setReCheckIn] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="mx-auto h-64 w-64 rounded-full" />
        <Skeleton className="mx-auto h-5 w-3/4" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !state) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
        <p className="text-[14px] text-white/70">
          Je toestand kon nu niet worden opgehaald.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/80 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
        >
          Opnieuw proberen
        </button>
      </section>
    )
  }

  const accent = BAND_ACCENT[state.band]
  const showCheckInButtons = !state.checkInDone || reCheckIn
  const firstName = state.athleteName?.trim().split(/\s+/)[0] ?? ""
  // Only hoist when there is an outstanding check-in — once today's is recorded
  // the slim "genoteerd" line stays in its calm position below and the status leads.
  const hoistCheckIn = !hideCheckIn && !!checkInFirst && showCheckInButtons

  const checkInBlock = (
    <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <span className="inline-flex items-center gap-0.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
          Check-in van vandaag
        </p>
        <UitlegDot uitlegKey="readiness" label="Check-in van vandaag" />
      </span>
      {showCheckInButtons ? (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-white/75">
            Hoe voel je je vandaag? Je beeld wordt er direct op aangepast.
          </p>
          <div className="mt-3 flex gap-2">
            {CHECKINS.map((c) => (
              <button
                key={c.value}
                type="button"
                disabled={checkIn.isPending}
                onClick={() =>
                  checkIn.mutate(c.value, {
                    onSuccess: () => setReCheckIn(false),
                  })
                }
                className="flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/85 transition-colors hover:border-cyan-300/40 hover:text-cyan-300 disabled:opacity-50"
              >
                {c.label}
              </button>
            ))}
          </div>
          {checkIn.isError && (
            <p className="mt-2 text-[12px] text-amber-300/90">
              Opslaan lukte niet. Probeer het zo nog eens.
            </p>
          )}
        </>
      ) : (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[14px] text-white/70">
            Je check-in van vandaag staat genoteerd.
          </p>
          <button
            type="button"
            onClick={() => setReCheckIn(true)}
            className="text-[13px] text-cyan-300/80 transition-colors hover:text-cyan-300"
          >
            Aanpassen
          </button>
        </div>
      )}
    </section>
  )

  return (
    <div className="space-y-6">
      {/* ── Level 0: outstanding check-in, hoisted so it is the first thing asked
          on opening the app (Vandaag only). Drops back below once recorded. ── */}
      {hoistCheckIn && checkInBlock}

      {/* ── Level 1: status in woorden — de vorm-visual is bewust verwijderd;
          de conclusie zelf draagt het scherm. ── */}
      <section className="relative flex flex-col items-center pt-2">
        {firstName && (
          <p className="text-[14px] font-light tracking-tight text-white/70">
            {greeting()}, {firstName}.
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.24em]"
            style={{ color: accent }}
          >
            {buildHerstelPresentatie(state.band, state.confidence, state.why.length).label}
          </span>
          <span className="text-white/20">·</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            {state.movement.label}
          </span>
        </div>
        <h1 className="mt-3 max-w-sm text-balance text-center font-sans text-2xl font-light leading-tight tracking-tight text-white">
          {state.status}
        </h1>
      </section>

      {/* ── Level 1: glanceable real data — tap to drill into the full analysis ── */}
      {state.metrics.length > 0 &&
        (onShowDetails ? (
          <button
            type="button"
            onClick={onShowDetails}
            className="group w-full rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
          >
            <MetricRow metrics={state.metrics} />
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="text-[13px] text-white/55 transition-colors group-hover:text-cyan-300/80">
                {detailsLabel ?? "Bekijk de volledige analyse"}
              </span>
              <ChevronRight className="h-4 w-4 text-white/35 transition-colors group-hover:text-cyan-300/70" />
            </div>
          </button>
        ) : (
          <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
            <MetricRow metrics={state.metrics} />
          </section>
        ))}

      {/* ── Level 1: short coach action ────────────────────────────────────── */}
      {state.action && (
        <section className="rounded-2xl border border-cyan-300/15 bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-300/15 ring-1 ring-cyan-300/30">
              <Zap className="h-3.5 w-3.5 text-cyan-300" />
            </span>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
              Advies
            </p>
            <UitlegDot uitlegKey="trainingsadvies" label="Trainingsadvies" />
          </div>
          <p className="mt-2.5 text-[15px] font-medium leading-snug text-white">
            {state.action.label}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
            {state.action.reason}
          </p>
        </section>
      )}

      {/* ── Level 1: check-in — in its calm position unless hoisted to the top,
          or omitted entirely when the host renders it elsewhere (Vandaag) ── */}
      {!hideCheckIn && !hoistCheckIn && checkInBlock}

      {/* ── Level 2: "Waarom?" — the 2–3 signals behind the position ────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] backdrop-blur-md">
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          aria-expanded={showWhy}
        >
          <span className="text-[14px] font-medium text-white/85">
            Waarom dit zo is?
          </span>
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition-transform ${
              showWhy ? "rotate-180" : ""
            }`}
          />
        </button>
        {showWhy && (
          <div className="space-y-3 px-5 pb-5">
            {state.why.length > 0 && (
              <p className="text-[12px] leading-relaxed text-white/50">
                Dit weegt vandaag mee in je beeld:
              </p>
            )}
            {state.why.length > 0 ? (
              <ul className="space-y-2.5">
                {state.why.map((s, i) => (
                  <li key={`${s.kind}-${i}`} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[s.tone]}`}
                    />
                    <div>
                      <p className="text-[13px] text-white/85">{s.label}</p>
                      <p className="text-[12px] leading-relaxed text-white/55">
                        {s.reading}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-white/60">
                Er is nog te weinig data om je beeld te onderbouwen.
              </p>
            )}

            <div className="border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/40">
              Gebaseerd op {state.confidenceLabel} over jou.
              {state.missing.length > 0 && (
                <>
                  {" "}
                  Nog niet meegenomen:{" "}
                  {state.missing.map((m) => labelSignal(m)).join(", ")}.
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Level 3: host-injected drill-in ─────────────────────────────────────
          Rendered only when the glanceable metrics card above isn't already
          carrying the drill-in (i.e. no real metrics yet), so Vandaag never
          shows two routes to the same full analysis. */}
      {onShowDetails && state.metrics.length === 0 && (
        <button
          type="button"
          onClick={onShowDetails}
          className="flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-left transition-colors hover:border-cyan-300/30 hover:bg-white/[0.04]"
        >
          <span className="flex items-center gap-2 text-[14px] text-white/80">
            <ArrowRight className="h-4 w-4 text-cyan-300/70" />
            {detailsLabel ?? "Volledige analyse"}
          </span>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </button>
      )}
    </div>
  )
}

// The glanceable real-data row — the few numbers an athlete wants to see at a
// glance (Vorm / Conditie / Belasting). Real values only; the engine omits these
// entirely when no training data exists, so this never renders fabricated zeros.
function MetricRow({ metrics }: { metrics: StateMetric[] }) {
  return (
    <div className="flex items-stretch">
      {metrics.map((mtr, i) => (
        <div
          key={mtr.key}
          className={`flex-1 px-2 text-center ${
            i > 0 ? "border-l border-white/[0.07]" : ""
          }`}
        >
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
            {mtr.label}
          </p>
          <p
            className={`mt-1 font-sans text-[22px] font-light leading-none tabular-nums ${METRIC_TONE[mtr.tone]}`}
          >
            {mtr.value}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-white/45">{mtr.hint}</p>
        </div>
      ))}
    </div>
  )
}
