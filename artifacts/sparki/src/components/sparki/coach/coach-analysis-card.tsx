import { useState } from "react"
import { useLocation } from "wouter"
import { AnalysisFeedback } from "@/components/sparki/analysis-feedback"
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
import { labelSignalCapitalized } from "@/lib/signal-labels"
import { useFeatureAccess } from "@/hooks/use-feature-access"
import { UpgradeNudge } from "@/components/ds/upgrade-nudge"

export type CoachCardVariant = "hero" | "card"

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
  nutrition: "/dashboard?focus=nutrition",
  add_race: "/races",
  check_gear: "/races",
}


function ConfidencePill({ confidence }: { confidence: Confidence }) {
  const tone =
    confidence.level === "high"
      ? "border-accent-cyan/40 text-accent-cyan"
      : confidence.level === "medium"
        ? "border-amber-300/40 text-[color:var(--color-warning)]"
        : "border-border text-muted-foreground"
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${tone}`}
      title="Hoe zeker deze analyse is — nooit 100%"
    >
      zekerheid {confidence.score}%
    </span>
  )
}

// "Wat ik zie" — the raw numbers Sparki weighed, as a compact scannable table
// instead of buried in prose (numbers-in-text reads poorly). Honest: only
// present signals appear here.
function SignalsTable({ signals }: { signals: IntakeSignal[] }) {
  if (signals.length === 0) return null
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted">
      <table className="w-full border-collapse">
        <tbody>
          {signals.map((s) => (
            <tr
              key={s.kind}
              className="border-b border-border last:border-0"
            >
              <td className="px-3 py-2 align-top text-[13px] text-muted-foreground">
                {labelSignalCapitalized(s.kind)}
              </td>
              <td className="px-3 py-2 text-right align-top font-mono text-[13px] tabular-nums text-foreground/90">
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
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-warning)]">
        Wat nog ontbreekt
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <li
            key={k}
            className="rounded-full border border-amber-300/25 px-2 py-0.5 text-[11px] text-[color:var(--color-warning)]"
          >
            {labelSignalCapitalized(k)}
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
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Waarop dit is gebaseerd
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {confidence.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {confidence.uncertainties.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Wat de zekerheid afremt
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
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
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Wat ik zie
        </p>
        {usedSignals.length > 0 ? (
          <div className="mt-1.5">
            <SignalsTable signals={usedSignals} />
          </div>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">
            {data.advice.explainers.watIkZie}
          </p>
        )}
      </div>

      {/* Uitleg eronder — wat de cijfers betekenen, zonder getallen in de tekst. */}
      <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
        <p>{data.advice.explainers.watIkDenk}</p>
        <p>{data.advice.explainers.waaromDitAdvies}</p>
        <p>{data.advice.explainers.watAlsHetAndersIs}</p>
        <p>{data.advice.explainers.watVerandertMijnAdvies}</p>
      </div>

      <MissingList kinds={missingKinds} />
      <ReasonBlock confidence={data.advice.confidence} />

      {/* Verantwoording: waar deze analyse vandaan komt en wanneer die is
          berekend — elke conclusie blijft herleidbaar. */}
      {(data.engine || data.engineVersion) && (
        <p className="border-t border-border pt-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Bron: {data.engine ?? "onbekend"}
          {data.engineVersion ? ` · versie ${data.engineVersion}` : ""}
          {data.generatedAt
            ? ` · ${new Date(data.generatedAt).toLocaleString("nl-NL")}`
            : ""}
        </p>
      )}

      {/* Oordeel over deze analyse (idempotent — één oordeel per dag-analyse). */}
      <AnalysisFeedback
        subjectType="coach_analysis"
        subjectKey={`analysis:${data.date}`}
        context={{
          engine: data.engine ?? "observation",
          engineVersion: data.engineVersion,
          confidenceScore: data.advice.confidence.score / 100,
          confidenceLevel: data.advice.confidence.level,
          category: "coaching",
          missingData: missingKinds,
          computedAt: data.generatedAt,
        }}
      />
    </div>
  )
}

function FollowUp({ q }: { q: FollowUpQuestion }) {
  const answer = useAnswerFollowUp()
  return (
    <div className="rounded-xl border border-accent-cyan/15 bg-accent-cyan/[0.04] p-3">
      <p className="text-sm font-medium text-foreground/85">{q.question}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{q.because}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {q.options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={answer.isPending}
            onClick={() => answer.mutate({ questionId: q.id, answer: o.value })}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-accent-cyan/50 hover:text-accent-cyan disabled:opacity-40"
          >
            {o.label}
          </button>
        ))}
      </div>
      {answer.isError && (
        <p className="mt-2 text-xs text-[color:var(--color-negative)]">
          Je antwoord kon niet worden verwerkt. Probeer het zo nog eens.
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
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-left transition-colors hover:border-accent-cyan/40 hover:bg-accent-cyan/[0.05]"
    >
      <span>
        <span className="block text-sm font-medium text-foreground/85 group-hover:text-accent-cyan">
          {action.label}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {action.reason}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground group-hover:text-accent-cyan" />
    </button>
  )
}

function FeedbackRow() {
  const feedback = useCoachFeedback()
  return (
    <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
      <span className="mr-auto text-[11px] text-muted-foreground">
        Klopt dit advies voor jou?
      </span>
      <button
        type="button"
        disabled={feedback.isPending}
        onClick={() => feedback.mutate("advice_followed")}
        className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan disabled:opacity-40"
      >
        <ThumbsUp className="h-3 w-3" /> Ja
      </button>
      <button
        type="button"
        disabled={feedback.isPending}
        onClick={() => feedback.mutate("advice_ignored")}
        className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-rose-300/40 hover:text-[color:var(--color-negative)] disabled:opacity-40"
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
    <p className="mt-3 text-sm text-muted-foreground">
      Je wordt gecoacht als{" "}
      <span className="text-accent-cyan">{personality.label}</span>.
      {basis && <span className="text-muted-foreground"> {basis}.</span>}
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
    <div className="fixed inset-0 z-[10000] flex flex-col bg-card backdrop-blur-xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-accent-cyan"
        >
          <ChevronLeft className="h-4 w-4" /> Terug
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Waarom dit advies
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="text-muted-foreground transition-colors hover:text-foreground/80"
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

  const goAccess = useFeatureAccess("ai_observations")

  if (!profile || profile.activeRole !== "athlete") return null

  // Go-poort (taak 385): coach-observaties horen bij Sparki Go.
  if (goAccess.known && !goAccess.entitled) {
    return <UpgradeNudge feature="ai_observations" compact />
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
        <p className="text-sm text-muted-foreground">Dag wordt geanalyseerd…</p>
      </section>
    )
  }

  if (isError || !data) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
        <p className="text-sm text-muted-foreground">
          Je analyse kon nu niet worden samengesteld. Probeer het later opnieuw.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
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

  // Ontdubbeling: trend-inzichten (HRV/rusthart/slaap/FTP/CTL/vorm/frequentie)
  // horen bij de grafiek-eerst inzichtkaarten op Training en Profiel — niet hier.
  // Deze kaart blijft puur het dagadvies (de synthese), zodat hetzelfde inzicht
  // niet twee keer verschijnt. Eigenaarschap staat vast in lib/insight-ownership.

  // ── Hero (Home) ────────────────────────────────────────────────────────────
  if (variant === "hero") {
    // The daily check-in lives on the State Card (the entry point to this full
    // analysis), so we never ask "hoe voel je je" a second time here.
    const otherFollowUps = data.followUps.filter((q) => q.id !== "missing_checkin")
    return (
      <>
        <section className="rounded-2xl border border-accent-cyan/15 bg-card p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-cyan" strokeWidth={2} />
              <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Vandaag
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan disabled:opacity-40"
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
          <div className="mt-3 rounded-xl border border-accent-cyan/15 bg-accent-cyan/[0.05] p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent-cyan/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent-cyan">
                {INTENSITY_LABEL[data.advice.intensity] ?? data.advice.intensity}
              </span>
              <ConfidencePill confidence={data.advice.confidence} />
            </div>
            <p className="mt-2.5 text-lg font-semibold leading-snug text-foreground">
              {data.advice.headline}
            </p>
          </div>

          {/* Open vragen — alleen als Sparki echt iets wil weten */}
          {otherFollowUps.length > 0 && (
            <div className="mt-4 space-y-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
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
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-left transition-colors hover:border-accent-cyan/40"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4 text-accent-cyan" />
              Waarom dit advies?
            </span>
            <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
          </button>

          {/* Concrete next steps — no dead-end insights */}
          {data.actions.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
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
    <section className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent-cyan" strokeWidth={2} />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Vandaag
        </h2>
      </div>

      {/* Advice headline + intensity + confidence */}
      <div className="mt-4 rounded-xl border border-accent-cyan/15 bg-accent-cyan/[0.05] p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent-cyan/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent-cyan">
            {INTENSITY_LABEL[data.advice.intensity] ?? data.advice.intensity}
          </span>
          <ConfidencePill confidence={data.advice.confidence} />
        </div>
        <p className="mt-2.5 text-base font-medium leading-snug text-foreground/90">
          {data.advice.headline}
        </p>
      </div>

      {/* Why-panel toggle (inline expander) */}
      <button
        type="button"
        onClick={() => setShowWhy((v) => !v)}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-left transition-colors hover:border-accent-cyan/40"
      >
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <HelpCircle className="h-4 w-4 text-accent-cyan" />
          Waarom dit advies?
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${showWhy ? "rotate-180" : ""}`}
        />
      </button>

      {showWhy && (
        <div className="mt-3 space-y-4 rounded-xl border border-border bg-foreground/20 p-4">
          <WhyContent
            data={data}
            usedSignals={usedSignals}
            missingKinds={missingKinds}
          />
        </div>
      )}

      {/* Follow-up questions — only when Sparki is in doubt / missing data */}
      {data.followUps.length > 0 && (
        <div className="mt-4 space-y-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Dit is nog nodig van jou
          </p>
          {data.followUps.map((q) => (
            <FollowUp key={q.id} q={q} />
          ))}
        </div>
      )}

      {/* Concrete next steps — no dead-end insights */}
      {data.actions.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
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
