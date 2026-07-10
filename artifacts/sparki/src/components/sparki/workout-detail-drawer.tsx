import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ACCENT } from "@/components/sparki/ui"
import {
  TieredExplanation,
  PlainTextParagraphs,
} from "@/components/sparki/tiered-explanation"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { CorePredictionPanel } from "@/components/sparki/core-prediction-panel"
import {
  useWorkoutDetail,
  useSubmitFeedback,
  useWorkoutExplain,
  useWorkoutExplainExtended,
  useWorkoutAdjust,
  useApplyProposal,
} from "@/hooks/use-training-plan"
import type {
  WorkoutBlock,
  WorkoutFeedbackType,
  WorkoutRouteNeed,
  SparkiAdjustProposal,
} from "@/lib/athlete-types"
import {
  Bike,
  Clock,
  Gauge,
  Mountain,
  Home,
  MapPin,
  Wrench,
  HelpCircle,
  Sparkles,
  Check,
  X,
  Loader2,
} from "lucide-react"

const zoneColor: Record<number, string> = {
  1: "rgba(120,210,230,0.25)",
  2: "rgba(120,210,230,0.4)",
  3: "rgba(255,220,100,0.45)",
  4: "rgba(120,210,230,0.95)",
  5: "rgba(255,140,80,0.8)",
  6: "rgba(255,80,80,0.75)",
}

const routeNeedLabel: Record<WorkoutRouteNeed, { label: string; icon: typeof Home }> = {
  outdoor_long: { label: "Lange buitenrit — route nodig", icon: Mountain },
  outdoor: { label: "Buiten — route aanbevolen", icon: MapPin },
  indoor_ok: { label: "Binnen of buiten — vrij in te vullen", icon: Home },
  none: { label: "Geen rit", icon: Home },
}

const FEEDBACK_OPTIONS: {
  type: WorkoutFeedbackType
  label: string
  tone: "good" | "neutral" | "warn"
}[] = [
  { type: "done", label: "Gedaan", tone: "good" },
  { type: "missed", label: "Gemist", tone: "warn" },
  { type: "too_hard", label: "Te zwaar", tone: "warn" },
  { type: "too_light", label: "Te licht", tone: "neutral" },
  { type: "tired", label: "Vermoeid", tone: "warn" },
  { type: "pain", label: "Pijn / blessure", tone: "warn" },
  { type: "move", label: "Verplaatsen", tone: "neutral" },
]

// Forward-looking options for a session that hasn't happened yet. Never asks
// "hoe ging het" about a training still in the future — instead the athlete
// shapes the plan vooraf (verplaatsen / te zwaar of te licht ingepland / niet
// fit), zodat Sparki proactief bijstuurt in plaats van een formulier af te nemen.
const PLANNING_OPTIONS: {
  type: WorkoutFeedbackType
  label: string
  tone: "good" | "neutral" | "warn"
}[] = [
  { type: "move", label: "Verplaatsen", tone: "neutral" },
  { type: "too_hard", label: "Te zwaar ingepland", tone: "warn" },
  { type: "too_light", label: "Te licht ingepland", tone: "neutral" },
  { type: "pain", label: "Niet fit / blessure", tone: "warn" },
]

function SectionHead({
  n,
  title,
  icon: Icon,
}: {
  n: string
  title: string
  icon: typeof Bike
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="font-mono text-[11px] tabular-nums"
        style={{ color: ACCENT }}
      >
        {n}
      </span>
      <Icon className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
      <span className="font-mono text-[10px] tracking-[0.2em] text-white/50">
        {title.toUpperCase()}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/12 to-transparent" />
    </div>
  )
}

function BlockRow({ block }: { block: WorkoutBlock }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.05] py-2.5 last:border-0">
      <span
        className="h-3 w-1 shrink-0 rounded-full"
        style={{ background: zoneColor[block.zone] ?? "rgba(120,210,230,0.4)" }}
      />
      <span className="w-7 shrink-0 font-mono text-[11px] tabular-nums text-white/50">
        Z{block.zone}
      </span>
      <span className="flex-1 text-[13px] tracking-tight text-white/85">
        {block.label}
        {block.reps && block.reps > 1 ? (
          <span className="ml-1.5 text-white/35">×{block.reps}</span>
        ) : null}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-white/55">
        {block.durationMin}m
      </span>
      {block.targetPctFtp != null && (
        <span
          className="w-12 text-right font-mono text-[11px] tabular-nums"
          style={{ color: "rgba(120,210,230,0.7)" }}
        >
          {block.targetPctFtp}%
        </span>
      )}
    </div>
  )
}

function ExplainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/[0.05] py-3 last:border-0">
      <p className="font-mono text-[9px] tracking-[0.2em] text-white/35">
        {label.toUpperCase()}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">{value}</p>
    </div>
  )
}

function recommendationLabel(rec: SparkiAdjustProposal["recommendation"]): string {
  switch (rec) {
    case "keep":
      return "Behoud de training"
    case "adjust":
      return "Aanpassen"
    case "move":
      return "Verplaatsen"
    case "recovery":
      return "Herstel inlassen"
    case "replan_week":
      return "Week herplannen"
  }
}

export function WorkoutDetailDrawer({
  workoutId,
  open,
  onOpenChange,
}: {
  workoutId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: workout, isLoading } = useWorkoutDetail(open ? workoutId : null)
  const submitFeedback = useSubmitFeedback()
  const explain = useWorkoutExplain()
  const explainExtended = useWorkoutExplainExtended()
  const adjust = useWorkoutAdjust()
  const applyProposal = useApplyProposal()

  const [note, setNote] = useState("")
  const [explanation, setExplanation] = useState<{
    short: string
    extended: string | null
  } | null>(null)
  const [proposal, setProposal] = useState<SparkiAdjustProposal | null>(null)
  const [activeFeedback, setActiveFeedback] = useState<WorkoutFeedbackType | null>(
    null,
  )

  // Reset transient state when the drawer target changes.
  const resetTransient = () => {
    setNote("")
    setExplanation(null)
    setProposal(null)
    setActiveFeedback(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetTransient()
    onOpenChange(next)
  }

  const structure = workout?.structure ?? null

  const loadExplanation = () => {
    if (!workout) return
    explain.mutate(workout.id, {
      onSuccess: (res) => setExplanation({ short: res.short, extended: null }),
    })
  }

  // The deeper onderbouwing is the slow generation; only fetch it when the
  // athlete actually opens "Uitgebreid", so the short kernel paints fast.
  const loadExtended = () => {
    if (!workout || explanation?.extended || explainExtended.isPending) return
    explainExtended.mutate(workout.id, {
      onSuccess: (res) =>
        setExplanation((prev) =>
          prev ? { ...prev, extended: res.extended } : prev,
        ),
    })
  }

  const handleFeedback = async (type: WorkoutFeedbackType) => {
    if (!workout) return
    setActiveFeedback(type)
    setProposal(null)
    // Persist the feedback first, then ask Sparki for a proposal so the two
    // stay coordinated (no proposal shown if the feedback never saved).
    try {
      await submitFeedback.mutateAsync({
        workoutId: workout.id,
        feedbackType: type,
        note,
      })
      const res = await adjust.mutateAsync({
        workoutId: workout.id,
        feedbackType: type,
        note,
      })
      setProposal(res.proposal)
    } catch {
      // Errors surface via the mutations' isError state in the UI.
    }
  }

  const acceptProposal = () => {
    if (!workout || !proposal) return
    if (proposal.changes) {
      applyProposal.mutate(
        { id: workout.id, changes: proposal.changes },
        { onSuccess: () => setProposal(null) },
      )
    } else {
      setProposal(null)
    }
  }

  const route = structure
    ? routeNeedLabel[structure.routeNeed]
    : routeNeedLabel.none
  const RouteIcon = route.icon

  // A training in the future hasn't happened yet, so asking "hoe ging het" is
  // robotic. Sparki understands timing: an upcoming session gets forward-looking
  // plan-feedback; only a session that is today/past or done asks how it went.
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const isUpcoming =
    workout != null &&
    workout.status !== "completed" &&
    workout.scheduledDate > todayStr
  const feedbackOptions = isUpcoming ? PLANNING_OPTIONS : FEEDBACK_OPTIONS

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-white/[0.08] bg-[#05070e]/95 p-0 backdrop-blur-xl sm:max-w-md"
      >
        {isLoading || !workout ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="flex flex-col gap-7 px-6 pb-16 pt-7">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="-ml-1 flex w-fit items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-white/45 transition-colors hover:text-white/80"
              aria-label="Sluiten"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              SLUITEN
            </button>
            <SheetHeader className="space-y-2 text-left">
              <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
                {new Date(
                  workout.scheduledDate + "T12:00:00Z",
                ).toLocaleDateString("nl-NL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <SheetTitle className="text-balance font-sans text-2xl font-extralight leading-tight tracking-tight text-white">
                {workout.title}
              </SheetTitle>
              {structure && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span
                    className="rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.15em]"
                    style={{
                      background: "rgba(120,210,230,0.1)",
                      color: ACCENT,
                    }}
                  >
                    {structure.intensity.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] text-white/50">
                    {structure.phase === "recovery"
                      ? "HERSTELWEEK"
                      : `WEEK ${structure.week}`}
                  </span>
                </div>
              )}
            </SheetHeader>

            {/* Core-voorspelpaneel — effect-forecast boven elke training. */}
            <CorePredictionPanel workoutId={workout.id} />

            {/* 01 PRAKTISCH */}
            <section className="flex flex-col gap-4">
              <SectionHead n="01" title="Praktisch" icon={Bike} />
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <PracticalStat
                  icon={Clock}
                  label="Duur"
                  value={
                    workout.targetDurationMin
                      ? `${workout.targetDurationMin} min`
                      : "—"
                  }
                />
                <PracticalStat
                  icon={Gauge}
                  label="Belasting"
                  value={workout.targetTSS ? `${workout.targetTSS} TSS` : "—"}
                  accent
                />
                <PracticalStat
                  icon={Bike}
                  label="Sport"
                  value={workout.type}
                />
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5">
                <RouteIcon className="h-4 w-4 text-white/45" strokeWidth={1.75} />
                <span className="text-[12px] text-white/70">{route.label}</span>
              </div>

              {structure && structure.blocks.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[9px] tracking-[0.2em] text-white/35">
                    OPBOUW
                  </p>
                  <div className="flex flex-col">
                    {structure.blocks.map((b, i) => (
                      <BlockRow key={i} block={b} />
                    ))}
                  </div>
                </div>
              )}

              {structure && structure.equipment.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <Wrench
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35"
                    strokeWidth={1.75}
                  />
                  <p className="text-[12px] leading-relaxed text-white/55">
                    {structure.equipment.join(" · ")}
                  </p>
                </div>
              )}
            </section>

            {/* 02 UITLEG */}
            {structure && (
              <section className="flex flex-col gap-3">
                <SectionHead n="02" title="Wat & waarom vandaag" icon={Sparkles} />
                <TieredExplanation
                  short={structure.rationale.whyToday}
                  extended={
                    <div className="flex flex-col">
                      <ExplainRow
                        label="Doel"
                        value={structure.rationale.supportsGoal}
                      />
                      <ExplainRow
                        label="Wat je moet voelen"
                        value={structure.rationale.whatToFeel}
                      />
                      <ExplainRow
                        label="Te zwaar?"
                        value={structure.rationale.tooHardSigns}
                      />
                      <ExplainRow
                        label="Te licht?"
                        value={structure.rationale.tooLightSigns}
                      />
                      <ExplainRow
                        label="Veilig aanpassen"
                        value={structure.rationale.safeAdjust}
                      />
                    </div>
                  }
                />
                {structure.recoveryAdvice && (
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                    <p className="font-mono text-[9px] tracking-[0.2em] text-white/35">
                      HERSTELADVIES
                    </p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-white/70">
                      {structure.recoveryAdvice}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* 03 WAAROM? — Sparki philosophy layer */}
            <section className="flex flex-col gap-3">
              <SectionHead n="03" title="Waarom?" icon={HelpCircle} />
              {explanation ? (
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
                  <div className="mb-3 flex items-center gap-2">
                    <SparkiCore size={24} accent={ACCENT} readiness={0.9} variant="orb" />
                    <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">
                      SPARKI
                    </span>
                  </div>
                  <TieredExplanation
                    short={explanation.short}
                    hasExtended
                    extendedPending={explainExtended.isPending}
                    onExpand={loadExtended}
                    extended={
                      explanation.extended != null ? (
                        <PlainTextParagraphs text={explanation.extended} />
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={loadExplanation}
                  disabled={explain.isPending}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.15] py-4 font-sans text-[13px] font-medium text-white/55 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/70 disabled:opacity-50"
                >
                  {explain.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Bezig…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                      Laat Sparki de filosofie uitleggen
                    </>
                  )}
                </button>
              )}
              {(explain.isError || explainExtended.isError) && (
                <p className="text-[12px] text-red-300/70">
                  Sparki is even niet bereikbaar. Probeer het zo opnieuw.
                </p>
              )}
            </section>

            {/* 04 FEEDBACK → SPARKI VOORSTEL (context-aware: vooruit plannen
                bij een nog komende training, terugkijken bij een gedane). */}
            <section className="flex flex-col gap-3">
              <SectionHead
                n="04"
                title={isUpcoming ? "Past deze training?" : "Jouw feedback"}
                icon={Check}
              />
              <p className="text-[12px] leading-relaxed text-white/45">
                {isUpcoming
                  ? "Deze training komt er nog aan. Klopt er iets niet of past het beter op een andere dag? Dan stemt Sparki je plan er vast op af."
                  : "Laat weten hoe het ging — Sparki past je plan zo nodig aan."}
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={
                  isUpcoming
                    ? "Wat moet Sparki weten? (optioneel)…"
                    : "Toelichting (optioneel)…"
                }
                className="w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[13px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                {feedbackOptions.map((opt) => {
                  const active = activeFeedback === opt.type
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => handleFeedback(opt.type)}
                      disabled={adjust.isPending}
                      className="rounded-full border px-3.5 py-1.5 font-sans text-[12px] font-medium transition-colors disabled:opacity-50"
                      style={{
                        borderColor: active
                          ? "rgba(120,210,230,0.5)"
                          : "rgba(255,255,255,0.12)",
                        background: active
                          ? "rgba(120,210,230,0.12)"
                          : "transparent",
                        color: active ? ACCENT : "rgba(255,255,255,0.6)",
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              {adjust.isPending && (
                <div className="flex items-center gap-2 text-[12px] text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Voorstel wordt opgesteld…
                </div>
              )}

              {proposal && (
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
                  <div className="mb-2 flex items-center gap-2">
                    <SparkiCore size={24} accent={ACCENT} readiness={0.9} variant="orb" />
                    <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">
                      SPARKI VOORSTEL
                    </span>
                  </div>
                  <p className="font-sans text-[15px] font-light text-white/90">
                    {proposal.title}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/70">
                    {proposal.message}
                  </p>
                  <div className="mt-3 inline-flex rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] text-white/55">
                    {recommendationLabel(proposal.recommendation).toUpperCase()}
                  </div>
                  {proposal.changes && (
                    <div className="mt-4 flex gap-2.5">
                      <button
                        type="button"
                        onClick={acceptProposal}
                        disabled={applyProposal.isPending}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-sans text-[13px] font-semibold disabled:opacity-50"
                        style={{ background: ACCENT, color: "#040506" }}
                      >
                        {applyProposal.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        )}
                        Toepassen
                      </button>
                      <button
                        type="button"
                        onClick={() => setProposal(null)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] px-4 py-2.5 font-sans text-[13px] text-white/55"
                      >
                        <X className="h-4 w-4" strokeWidth={1.75} />
                        Houden
                      </button>
                    </div>
                  )}
                </div>
              )}

              {adjust.isError && (
                <p className="text-[12px] text-red-300/70">
                  Sparki kon nu geen voorstel maken. Je feedback is wel bewaard.
                </p>
              )}

              {workout.feedback.length > 0 && (
                <div className="mt-1">
                  <p className="mb-2 font-mono text-[9px] tracking-[0.2em] text-white/30">
                    EERDERE FEEDBACK
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {workout.feedback.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 text-[11px] text-white/45"
                      >
                        <span className="h-1 w-1 rounded-full bg-white/25" />
                        <span className="text-white/65">
                          {FEEDBACK_OPTIONS.find((o) => o.type === f.feedbackType)
                            ?.label ?? f.feedbackType}
                        </span>
                        {f.note && <span className="text-white/35">— {f.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function PracticalStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Bike
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-white/35">
        <Icon className="h-3 w-3" strokeWidth={1.75} />
        {label.toUpperCase()}
      </span>
      <span
        className="font-sans text-[16px] font-light capitalize tabular-nums leading-none"
        style={{
          color: accent ? ACCENT : "rgba(255,255,255,0.9)",
        }}
      >
        {value}
      </span>
    </div>
  )
}
