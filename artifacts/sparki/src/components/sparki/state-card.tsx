import { useState } from "react"
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react"
import { SparkiCore } from "@/components/sparki/core/sparki-core"
import { useHomeView } from "@/contexts/HomeViewContext"
import {
  useSparkiState,
  useStateCheckIn,
  type CheckInAnswer,
  type StateSignal,
  type StateBand,
} from "@/hooks/use-sparki-state"
import { stateToCore } from "@/lib/state-to-core"
import { Skeleton } from "@/components/sparki/home-sections"

// Plain-Dutch labels for the honest "Sparki mist nog" gaps. Internal signal keys
// stay English; only the rendered string is Dutch.
const SIGNAL_LABEL_NL: Record<string, string> = {
  training_load: "trainingsbelasting",
  readiness: "check-in van vandaag",
  hrv_trend: "HRV-trend",
  resting_hr_trend: "rusthartslag",
  sleep: "slaap",
  subjective_feel: "hoe je je voelt",
  power_dev: "vermogensontwikkeling",
  feedback: "reacties op trainingen",
  health: "gezondheid",
  race_calendar: "wedstrijdkalender",
  nutrition: "voeding",
  weather: "weer",
}

const BAND_LABEL: Record<StateBand, string> = {
  belastbaar: "Belastbaar",
  solide: "Solide",
  wisselend: "Wisselend",
  kwetsbaar: "Kwetsbaar",
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

export function StateCard() {
  const { data: state, isLoading, isError, refetch } = useSparkiState()
  const checkIn = useStateCheckIn()
  const homeView = useHomeView()
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
          Sparki kon je toestand nu niet ophalen.
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
  const core = stateToCore(state)
  const showCheckInButtons = !state.checkInDone || reCheckIn

  return (
    <div className="space-y-6">
      {/* ── Level 1: the living Core ───────────────────────────────────────── */}
      <section className="relative flex flex-col items-center">
        <div className="relative h-64 w-full max-w-sm">
          <SparkiCore state={core} className="absolute inset-0 h-full w-full" />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.24em]"
            style={{ color: accent }}
          >
            {BAND_LABEL[state.band]}
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

      {/* ── Level 1: short coach action ────────────────────────────────────── */}
      {state.action && (
        <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
            Sparki adviseert
          </p>
          <p className="mt-2 text-[15px] font-medium leading-snug text-white">
            {state.action.label}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
            {state.action.reason}
          </p>
        </section>
      )}

      {/* ── Level 1: check-in (writes real daily metrics → recomputes state) ── */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
          Check-in van vandaag
        </p>
        {showCheckInButtons ? (
          <>
            <p className="mt-2 text-[14px] leading-relaxed text-white/75">
              Hoe voel je je vandaag? Sparki past je beeld er direct op aan.
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

      {/* ── Level 2: "Waarom?" — the 2–3 signals behind the position ────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] backdrop-blur-md">
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          aria-expanded={showWhy}
        >
          <span className="text-[14px] font-medium text-white/85">Waarom?</span>
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition-transform ${
              showWhy ? "rotate-180" : ""
            }`}
          />
        </button>
        {showWhy && (
          <div className="space-y-3 px-5 pb-5">
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
                Sparki heeft nog te weinig data om je beeld te onderbouwen.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/[0.06] pt-3 text-[11px] text-white/40">
              <span>Zekerheid: {state.confidenceLabel}</span>
              {state.missing.length > 0 && (
                <>
                  <span className="text-white/20">·</span>
                  <span>
                    Sparki mist nog:{" "}
                    {state.missing
                      .map((m) => SIGNAL_LABEL_NL[m] ?? m)
                      .join(", ")}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Level 3: drill-in to the full analysis (existing cards) ─────────── */}
      {homeView && (
        <button
          type="button"
          onClick={() => homeView.setView("full")}
          className="flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-left transition-colors hover:border-cyan-300/30 hover:bg-white/[0.04]"
        >
          <span className="flex items-center gap-2 text-[14px] text-white/80">
            <ArrowRight className="h-4 w-4 text-cyan-300/70" />
            Volledige analyse
          </span>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </button>
      )}
    </div>
  )
}
