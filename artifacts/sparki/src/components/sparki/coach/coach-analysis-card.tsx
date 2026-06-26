import { useState } from "react"
import { useLocation } from "wouter"
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  HelpCircle,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react"
import { useUserProfile } from "@/contexts/UserContext"
import {
  useCoachAnalysis,
  useAnswerFollowUp,
  useCoachFeedback,
  type CoachAction,
  type CoachActionKind,
  type CoachAnalysis,
  type Confidence,
  type FollowUpQuestion,
  type IntakeSignal,
  type Personality,
} from "@/hooks/use-coach-analysis"

export type CoachCardVariant = "hero" | "card"

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
  adjust_training: "/train?focus=plan",
  rest: "/train?focus=plan",
  check_in: "/train?focus=plan",
  nutrition: "/?focus=nutrition",
  add_race: "/races",
  check_gear: "/races",
}

function signalLabel(kind: string): string {
  return SIGNAL_LABEL[kind] ?? kind
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

// Drop any lens whose text is already contained in (or contains) "wat valt op".
// The engine builds "wat valt op" from ALL observations while each lens is a
// subset, so on e.g. an all-concerns day they read identically. This keeps the
// same sentence from appearing under two headings. Honest: nothing is invented,
// only repetition is removed.
function dedupeLenses(
  watValtOp: string | null,
  lenses: { label: string; body: string | null }[],
): { label: string; body: string }[] {
  const seen: string[] = []
  if (watValtOp) seen.push(normalizeText(watValtOp))
  const out: { label: string; body: string }[] = []
  for (const l of lenses) {
    if (!l.body) continue
    const n = normalizeText(l.body)
    if (seen.some((s) => s.includes(n) || n.includes(s))) continue
    seen.push(n)
    out.push({ label: l.label, body: l.body })
  }
  return out
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

// One analysis part. Honest about gaps: a null part renders a plain "te weinig
// gegevens" line rather than being hidden or faked.
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

// When Sparki has no real read for one or more analytical lenses, it says so
// ONCE — naturally and honestly — instead of repeating an identical "te weinig
// gegevens" placeholder under every empty heading. Three apologies in a row read
// as a robotic form; one plain-Dutch line that names the gap and how it unlocks
// reads as an intelligent coach.
function InsightGapNote({ phrases }: { phrases: string[] }) {
  const list =
    phrases.length === 1
      ? phrases[0]
      : `${phrases.slice(0, -1).join(", ")} en ${phrases[phrases.length - 1]}`
  return (
    <div className="border-l border-white/10 pl-3">
      <p className="text-sm italic leading-relaxed text-white/45">
        Vandaag nog geen {list} in je gegevens. Dat scherpt vanzelf
        aan naarmate je meer ritten en check-ins logt — dan vallen trends en
        uitschieters op.
      </p>
    </div>
  )
}

// "Wat ik zie" — the raw numbers Sparki weighed, as a compact scannable table
// instead of buried in prose (numbers-in-text reads poorly). Honest: only
// present signals appear here.
function SignalsTable({ signals }: { signals: IntakeSignal[] }) {
  if (signals.length === 0) return null
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <table className="w-full border-collapse">
        <tbody>
          {signals.map((s) => (
            <tr
              key={s.kind}
              className="border-b border-white/[0.06] last:border-0"
            >
              <td className="px-3 py-2 align-top text-[13px] text-white/55">
                {signalLabel(s.kind)}
              </td>
              <td className="px-3 py-2 text-right align-top font-mono text-[13px] tabular-nums text-white/90">
                {s.value ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MissingList({ kinds }: { kinds: string[] }) {
  if (kinds.length === 0) return null
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/70">
        Wat nog ontbreekt
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

// The full explainable read. Shared by the hero overlay and the card's inline
// expander so the "waarom" content stays in one place.
function WhyContent({
  data,
  usedSignals,
  missingKinds,
}: {
  data: CoachAnalysis
  usedSignals: IntakeSignal[]
  missingKinds: string[]
}) {
  return (
    <div className="space-y-4">
      {/* Wat ik zie — eerst de cijfers, als klein tabelletje. Bij te weinig
          meetwaarden valt het honest terug op de tekstuele lezing. */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
          Wat ik zie
        </p>
        {usedSignals.length > 0 ? (
          <div className="mt-1.5">
            <SignalsTable signals={usedSignals} />
          </div>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-white/80">
            {data.advice.explainers.watIkZie}
          </p>
        )}
      </div>

      {/* Uitleg eronder — wat de cijfers betekenen, zonder getallen in de tekst. */}
      <div className="space-y-1.5 text-sm leading-relaxed text-white/75">
        <p>{data.advice.explainers.watIkDenk}</p>
        <p>{data.advice.explainers.waaromDitAdvies}</p>
        <p>{data.advice.explainers.watAlsHetAndersIs}</p>
        <p>{data.advice.explainers.watVerandertMijnAdvies}</p>
      </div>

      <MissingList kinds={missingKinds} />
      <ReasonBlock confidence={data.advice.confidence} />
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
            onClick={() => answer.mutate({ questionId: q.id, answer: o.value })}
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

function FeedbackRow() {
  const feedback = useCoachFeedback()
  return (
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
  )
}

// One plain-Dutch line on how Sparki is speaking to this athlete today, with the
// honest reason it chose that voice. Never fabricated — comes straight from the
// engine's resolved personality.
function PersonalityLine({ personality }: { personality: Personality }) {
  const basis = personality.basis
    ? personality.basis.charAt(0).toUpperCase() + personality.basis.slice(1)
    : ""
  return (
    <p className="mt-3 text-sm text-white/70">
      Sparki coacht je als{" "}
      <span className="text-cyan-200/90">{personality.label}</span>.
      {basis && <span className="text-white/45"> {basis}.</span>}
    </p>
  )
}

// Dedicated full-screen explainable-advice panel with a TOP way-back (Terug +
// Sluiten). Used by the hero so "waarom" is never a buried inline accordion.
function WhyOverlay({
  data,
  usedSignals,
  missingKinds,
  onClose,
}: {
  data: CoachAnalysis
  usedSignals: IntakeSignal[]
  missingKinds: string[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-[#05070e]/96 backdrop-blur-xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#05070e]/80 px-5 py-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-cyan-200"
        >
          <ChevronLeft className="h-4 w-4" /> Terug
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
          Waarom dit advies
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="text-white/45 transition-colors hover:text-white/80"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 py-5">
        <WhyContent
          data={data}
          usedSignals={usedSignals}
          missingKinds={missingKinds}
        />
      </div>
    </div>
  )
}

/**
 * Surfaces Sparki's deterministic daily coach analysis. On Home it renders as the
 * `hero` — leading with the personality voice, the advice + confidence, a 5-part
 * read (wat ik zie / waarom / hoe zeker / advies / wat wil ik nog weten), an
 * always-available quick check-in, a refresh trigger, and an explainable-advice
 * overlay with a top way-back. Elsewhere it renders as a compact `card`.
 * Athlete-only; renders nothing otherwise.
 */
export function CoachAnalysisCard({
  variant = "card",
}: {
  variant?: CoachCardVariant
}) {
  const { profile } = useUserProfile()
  const [showWhy, setShowWhy] = useState(false)
  const { data, isLoading, isError, refetch, isFetching } = useCoachAnalysis()

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
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-200"
        >
          <RefreshCw className="h-3 w-3" /> Opnieuw proberen
        </button>
      </section>
    )
  }

  // Aggregate the present signals Sparki weighed across all observations (deduped
  // by kind) plus everything it is missing — both shown honestly as onderbouwing.
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

  // The three optional analytical lenses. Only render the ones Sparki genuinely
  // has a read on; everything absent folds into a single honest note rather than
  // a repeated "te weinig gegevens" placeholder under each empty heading.
  const lenses = [
    { label: "Patronen", phrase: "terugkerende patronen", body: data.patronen },
    {
      label: "Beter dan verwacht",
      phrase: "meevallers",
      body: data.beterDanVerwacht,
    },
    {
      label: "Verdient aandacht",
      phrase: "aandachtspunten",
      body: data.verdientAandacht,
    },
  ]
  const dedupedLenses = dedupeLenses(data.watValtOp, lenses)
  const absentLensPhrases = lenses
    .filter((l) => !l.body)
    .map((l) => l.phrase)

  // ── Hero (Home) ────────────────────────────────────────────────────────────
  if (variant === "hero") {
    // The daily check-in lives on the State Card (the entry point to this full
    // analysis), so we never ask "hoe voel je je" a second time here.
    const otherFollowUps = data.followUps.filter((q) => q.id !== "missing_checkin")
    return (
      <>
        <section className="rounded-2xl border border-cyan-300/15 bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-300" strokeWidth={2} />
              <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
                Sparki vandaag
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-white/55 transition-colors hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-40"
              title="Opnieuw bekijken"
            >
              <RefreshCw
                className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
              />
              Ververs
            </button>
          </div>

          <PersonalityLine personality={data.personality} />

          {/* Advice headline + intensity + confidence */}
          <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-cyan-300/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200">
                {INTENSITY_LABEL[data.advice.intensity] ?? data.advice.intensity}
              </span>
              <ConfidencePill confidence={data.advice.confidence} />
            </div>
            <p className="mt-2.5 text-lg font-semibold leading-snug text-white">
              {data.advice.headline}
            </p>
          </div>

          {/* Eén korte lezing. De diepte (waarom / hoe zeker / meevallers) zit
              achter "Waarom zegt Sparki dit?" zodat dit scanbaar blijft en de
              kop niet twee keer als advies herhaald wordt. */}
          <div className="mt-4">
            <AnalysisPart label="Wat valt op" body={data.watValtOp} />
          </div>

          {/* Open vragen — alleen als Sparki echt iets wil weten */}
          {otherFollowUps.length > 0 && (
            <div className="mt-4 space-y-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                Wat ik nog wil weten
              </p>
              {otherFollowUps.map((q) => (
                <FollowUp key={q.id} q={q} />
              ))}
            </div>
          )}

          {/* Explainable advice — opens a dedicated panel, never inline */}
          <button
            type="button"
            onClick={() => setShowWhy(true)}
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/12 px-3.5 py-2.5 text-left transition-colors hover:border-cyan-300/40"
          >
            <span className="flex items-center gap-2 text-sm text-white/75">
              <HelpCircle className="h-4 w-4 text-cyan-300/80" />
              Waarom zegt Sparki dit?
            </span>
            <ChevronDown className="h-4 w-4 -rotate-90 text-white/40" />
          </button>

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

          <FeedbackRow />
        </section>

        {showWhy && (
          <WhyOverlay
            data={data}
            usedSignals={usedSignals}
            missingKinds={missingKinds}
            onClose={() => setShowWhy(false)}
          />
        )}
      </>
    )
  }

  // ── Card (Train / Inzicht / Races) ───────────────────────────────────────────
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

      {/* Eén scanbare lezing. De volledige uitsplitsing (lenzen + waarom +
          onderbouwing) zit achter "Waarom zegt Sparki dit?" zodat de kaart geen
          muur tekst is. */}
      <div className="mt-4">
        <AnalysisPart label="Wat valt op" body={data.watValtOp} />
      </div>

      {/* Why-panel toggle (inline expander) */}
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
        <div className="mt-3 space-y-4 rounded-xl border border-white/[0.08] bg-black/20 p-4">
          {(dedupedLenses.length > 0 || absentLensPhrases.length > 0) && (
            <div className="space-y-3">
              {dedupedLenses.map((l) => (
                <AnalysisPart key={l.label} label={l.label} body={l.body} />
              ))}
              {absentLensPhrases.length > 0 && (
                <InsightGapNote phrases={absentLensPhrases} />
              )}
            </div>
          )}
          <div
            className={
              dedupedLenses.length > 0 || absentLensPhrases.length > 0
                ? "border-t border-white/[0.06] pt-4"
                : ""
            }
          >
            <WhyContent
              data={data}
              usedSignals={usedSignals}
              missingKinds={missingKinds}
            />
          </div>
        </div>
      )}

      {/* Follow-up questions — only when Sparki is in doubt / missing data */}
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

      <FeedbackRow />
    </section>
  )
}
