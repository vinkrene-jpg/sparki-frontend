import { useState } from "react"
import { useLocation } from "wouter"
import {
  Activity,
  ChevronDown,
  HelpCircle,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import { useUserProfile } from "@/contexts/UserContext"
import {
  useCoachAnalysis,
  useAnswerFollowUp,
  useCoachFeedback,
  type CoachAction,
  type CoachActionKind,
  type Confidence,
  type FollowUpQuestion,
  type IntakeSignal,
} from "@/hooks/use-coach-analysis"

// Plain-Dutch labels for the engine's internal signal kinds (used when listing
// which signals Sparki weighed and which were missing).
const SIGNAL_LABEL: Record<string, string> = {
  training_load: "Trainingsbelasting",
  readiness: "Dagcheck-in",
  hrv_trend: "HRV-trend",
  resting_hr_trend: "Rusthartslag-trend",
  sleep: "Slaap",
  subjective_feel: "Hoe je je voelt",
  power_dev: "Vermogensontwikkeling",
  feedback: "Jouw feedback",
  health: "Gezondheid",
  race_calendar: "Wedstrijdkalender",
  nutrition: "Voeding",
  weather: "Weer",
}

const INTENSITY_LABEL: Record<string, string> = {
  rust: "Rust",
  herstel: "Herstel",
  rustig: "Rustig",
  normaal: "Normaal",
  stevig: "Stevig",
}

// Where each action takes the athlete. Kept in sync with the bottom-nav routes.
const ACTION_ROUTE: Record<CoachActionKind, string> = {
  adjust_training: "/train",
  rest: "/train",
  check_in: "/train",
  nutrition: "/lab",
  add_race: "/races",
  check_gear: "/races",
}

function signalLabel(kind: string): string {
  return SIGNAL_LABEL[kind] ?? kind
}

function ConfidencePill({ confidence }: { confidence: Confidence }) {
  const tone =
    confidence.level === "high"
      ? "border-cyan-300/40 text-cyan-200"
      : confidence.level === "medium"
        ? "border-amber-300/40 text-amber-200"
        : "border-white/20 text-white/60"
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${tone}`}
      title="Hoe zeker Sparki is — nooit 100%"
    >
      zekerheid {confidence.score}%
    </span>
  )
}

// One of the six analysis parts. Honest about gaps: a null part renders a plain
// "te weinig gegevens" line rather than being hidden or faked.
function AnalysisPart({
  label,
  body,
}: {
  label: string
  body: string | null
}) {
  return (
    <div className="border-l border-white/10 pl-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      {body ? (
        <p className="mt-1 text-sm leading-relaxed text-white/80">{body}</p>
      ) : (
        <p className="mt-1 text-sm italic leading-relaxed text-white/35">
          Hier heeft Sparki vandaag te weinig gegevens voor.
        </p>
      )}
    </div>
  )
}

function SignalList({ signals }: { signals: IntakeSignal[] }) {
  if (signals.length === 0) return null
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200/70">
        Wat Sparki meeweegt
      </p>
      <ul className="mt-1.5 space-y-1">
        {signals.map((s) => (
          <li key={s.kind} className="flex justify-between gap-3 text-xs">
            <span className="text-white/70">{signalLabel(s.kind)}</span>
            <span className="text-right text-white/45">
              {s.value ?? "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MissingList({ kinds }: { kinds: string[] }) {
  if (kinds.length === 0) return null
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/70">
        Wat Sparki nog mist
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <li
            key={k}
            className="rounded-full border border-amber-300/25 px-2 py-0.5 text-[11px] text-amber-100/70"
          >
            {signalLabel(k)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReasonBlock({ confidence }: { confidence: Confidence }) {
  return (
    <div className="space-y-2">
      {confidence.reasons.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            Waarom Sparki zo zeker is
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-white/65">
            {confidence.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {confidence.uncertainties.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            Wat de zekerheid afremt
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-white/50">
            {confidence.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FollowUp({ q }: { q: FollowUpQuestion }) {
  const answer = useAnswerFollowUp()
  return (
    <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
      <p className="text-sm font-medium text-white/85">{q.question}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/45">{q.because}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {q.options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={answer.isPending}
            onClick={() =>
              answer.mutate({ questionId: q.id, answer: o.value })
            }
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-cyan-300/50 hover:text-cyan-200 disabled:opacity-40"
          >
            {o.label}
          </button>
        ))}
      </div>
      {answer.isError && (
        <p className="mt-2 text-xs text-rose-300/80">
          Sparki kon je antwoord niet verwerken. Probeer het zo nog eens.
        </p>
      )}
    </div>
  )
}

function ActionButton({ action }: { action: CoachAction }) {
  const [, setLocation] = useLocation()
  return (
    <button
      type="button"
      onClick={() => setLocation(ACTION_ROUTE[action.kind])}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-left transition-colors hover:border-cyan-300/40 hover:bg-cyan-300/[0.05]"
    >
      <span>
        <span className="block text-sm font-medium text-white/85 group-hover:text-cyan-100">
          {action.label}
        </span>
        <span className="mt-0.5 block text-xs text-white/45">
          {action.reason}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 -rotate-90 text-white/30 group-hover:text-cyan-300/70" />
    </button>
  )
}

/**
 * Surfaces Sparki's deterministic daily coach analysis: the six-part read, the
 * advice with its confidence, an explainable "Waarom zegt Sparki dit?" panel,
 * in-app follow-up questions whose answers change the advice, and concrete next
 * steps so no insight is a dead end. Athlete-only; renders nothing otherwise.
 */
export function CoachAnalysisCard() {
  const { profile } = useUserProfile()
  const [showWhy, setShowWhy] = useState(false)
  const feedback = useCoachFeedback()
  const { data, isLoading, isError } = useCoachAnalysis()

  if (!profile || profile.activeRole !== "athlete") return null

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
        <p className="text-sm text-white/40">Sparki bekijkt je dag…</p>
      </section>
    )
  }

  if (isError || !data) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
        <p className="text-sm text-white/55">
          Sparki kon je analyse nu niet samenstellen. Probeer het later opnieuw.
        </p>
      </section>
    )
  }

  // Aggregate the present signals Sparki weighed across all observations (deduped
  // by kind) plus everything it is missing — both shown honestly in the why-panel.
  const usedByKind = new Map<string, IntakeSignal>()
  for (const o of data.observations) {
    for (const s of o.signalsUsed) {
      if (s.status === "present" && !usedByKind.has(s.kind)) {
        usedByKind.set(s.kind, s)
      }
    }
  }
  const usedSignals = [...usedByKind.values()]
  const missingKinds = [
    ...new Set([
      ...data.missing,
      ...data.observations.flatMap((o) => o.signalsMissing),
    ]),
  ]

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-300" strokeWidth={2} />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
          Sparki vandaag
        </h2>
      </div>

      {/* Advice headline + intensity + confidence */}
      <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cyan-300/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200">
            {INTENSITY_LABEL[data.advice.intensity] ?? data.advice.intensity}
          </span>
          <ConfidencePill confidence={data.advice.confidence} />
        </div>
        <p className="mt-2.5 text-base font-medium leading-snug text-white/90">
          {data.advice.headline}
        </p>
      </div>

      {/* Six-part analysis */}
      <div className="mt-4 space-y-3">
        <AnalysisPart label="Wat valt op" body={data.watValtOp} />
        <AnalysisPart label="Patronen" body={data.patronen} />
        <AnalysisPart label="Beter dan verwacht" body={data.beterDanVerwacht} />
        <AnalysisPart label="Verdient aandacht" body={data.verdientAandacht} />
        <AnalysisPart label="Waarom dit advies" body={data.waaromAdvies} />
      </div>

      {/* Why-panel toggle */}
      <button
        type="button"
        onClick={() => setShowWhy((v) => !v)}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/12 px-3.5 py-2.5 text-left transition-colors hover:border-cyan-300/40"
      >
        <span className="flex items-center gap-2 text-sm text-white/75">
          <HelpCircle className="h-4 w-4 text-cyan-300/80" />
          Waarom zegt Sparki dit?
        </span>
        <ChevronDown
          className={`h-4 w-4 text-white/40 transition-transform ${showWhy ? "rotate-180" : ""}`}
        />
      </button>

      {showWhy && (
        <div className="mt-3 space-y-3 rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <div className="space-y-1.5 text-xs leading-relaxed text-white/70">
            <p>{data.advice.explainers.watIkZie}</p>
            <p>{data.advice.explainers.watIkDenk}</p>
            <p>{data.advice.explainers.waaromDitAdvies}</p>
            <p>{data.advice.explainers.watAlsHetAndersIs}</p>
            <p>{data.advice.explainers.watVerandertMijnAdvies}</p>
          </div>
          <SignalList signals={usedSignals} />
          <MissingList kinds={missingKinds} />
          <ReasonBlock confidence={data.advice.confidence} />
        </div>
      )}

      {/* Follow-up questions (max 3) — only when Sparki is in doubt / missing data */}
      {data.followUps.length > 0 && (
        <div className="mt-4 space-y-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            Sparki wil dit nog van je weten
          </p>
          {data.followUps.map((q) => (
            <FollowUp key={q.id} q={q} />
          ))}
        </div>
      )}

      {/* Concrete next steps — no dead-end insights */}
      {data.actions.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            <Activity className="h-3 w-3" />
            Wat je nu kunt doen
          </p>
          {data.actions.map((a) => (
            <ActionButton key={a.key} action={a} />
          ))}
        </div>
      )}

      {/* Lightweight feedback so the advice tone adapts over time */}
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/[0.06] pt-3">
        <span className="mr-auto text-[11px] text-white/35">
          Klopt dit advies voor jou?
        </span>
        <button
          type="button"
          disabled={feedback.isPending}
          onClick={() => feedback.mutate("advice_followed")}
          className="flex items-center gap-1 rounded-full border border-white/12 px-2.5 py-1 text-xs text-white/65 transition-colors hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-40"
        >
          <ThumbsUp className="h-3 w-3" /> Ja
        </button>
        <button
          type="button"
          disabled={feedback.isPending}
          onClick={() => feedback.mutate("advice_ignored")}
          className="flex items-center gap-1 rounded-full border border-white/12 px-2.5 py-1 text-xs text-white/65 transition-colors hover:border-rose-300/40 hover:text-rose-200 disabled:opacity-40"
        >
          <ThumbsDown className="h-3 w-3" /> Nee
        </button>
      </div>
    </section>
  )
}
