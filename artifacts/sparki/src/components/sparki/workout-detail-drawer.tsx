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
  useWorkoutHistory,
  useLinkWorkoutSession,
  useCancelWorkout,
} from "@/hooks/use-training-plan"
import { useSessions } from "@/hooks/use-sessions"
import type {
  WorkoutBlock,
  WorkoutCompletion,
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
  History,
  Link2,
  Unlink,
  Ban,
  HeartPulse,
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

// The plan engine tags every block with a kind. Warming-up and cooling-down are
// their own phases; everything else (intervals, herstel tussendoor, tempo) is
// the hoofddeel. Grouping keeps their real order so a coach/athlete instantly
// sees "opbouw → werk → uitrijden" instead of one undifferentiated list.
function groupBlocks(blocks: WorkoutBlock[]): {
  warmup: WorkoutBlock[]
  main: WorkoutBlock[]
  cooldown: WorkoutBlock[]
} {
  const warmup: WorkoutBlock[] = []
  const main: WorkoutBlock[] = []
  const cooldown: WorkoutBlock[] = []
  for (const b of blocks) {
    if (b.kind === "warmup") warmup.push(b)
    else if (b.kind === "cooldown") cooldown.push(b)
    else main.push(b)
  }
  return { warmup, main, cooldown }
}

function blocksTotalMin(blocks: WorkoutBlock[]): number {
  return blocks.reduce(
    (sum, b) => sum + b.durationMin * (b.reps && b.reps > 1 ? b.reps : 1),
    0,
  )
}

function BlockGroup({
  label,
  blocks,
}: {
  label: string
  blocks: WorkoutBlock[]
}) {
  if (blocks.length === 0) return null
  const total = blocksTotalMin(blocks)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[9px] tracking-[0.2em] text-white/45">
          {label.toUpperCase()}
        </span>
        {total > 0 && (
          <span className="font-mono text-[9px] tabular-nums text-white/30">
            {total}m
          </span>
        )}
      </div>
      <div className="flex flex-col">
        {blocks.map((b, i) => (
          <BlockRow key={i} block={b} />
        ))}
      </div>
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
  const linkSession = useLinkWorkoutSession()
  const cancelWorkout = useCancelWorkout()

  const [note, setNote] = useState("")
  const [rpe, setRpe] = useState<number | null>(null)
  const [completion, setCompletion] = useState<WorkoutCompletion | null>(null)
  const [deviationReason, setDeviationReason] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [explanation, setExplanation] = useState<{
    short: string
    extended: string | null
  } | null>(null)
  const [proposal, setProposal] = useState<SparkiAdjustProposal | null>(null)
  const [activeFeedback, setActiveFeedback] = useState<WorkoutFeedbackType | null>(
    null,
  )

  const history = useWorkoutHistory(open ? workoutId : null, showHistory)
  // Same-day activities for handmatig koppelen.
  const { data: recentSessions } = useSessions(30)

  // Reset transient state when the drawer target changes.
  const resetTransient = () => {
    setNote("")
    setRpe(null)
    setCompletion(null)
    setDeviationReason("")
    setShowHistory(false)
    setConfirmCancel(false)
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
        rpe,
        completion,
        deviationReason,
      })
      const res = await adjust.mutateAsync({
        workoutId: workout.id,
        feedbackType: type,
        note,
        rpe,
        completion,
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

  const route =
    (structure ? routeNeedLabel[structure.routeNeed] : routeNeedLabel.none) ??
    routeNeedLabel.none
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

              {structure && structure.blocks.length > 0 && (() => {
                const groups = groupBlocks(structure.blocks)
                // Only split into fases when there is an explicit warming-up or
                // cooling-down to distinguish — otherwise a single "Hoofddeel"
                // label adds noise, so fall back to the plain OPBOUW list.
                const showGroups =
                  groups.warmup.length > 0 || groups.cooldown.length > 0
                if (!showGroups) {
                  return (
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
                  )
                }
                return (
                  <div className="flex flex-col gap-3">
                    <BlockGroup label="Warming-up" blocks={groups.warmup} />
                    <BlockGroup label="Hoofddeel" blocks={groups.main} />
                    <BlockGroup label="Cooling-down" blocks={groups.cooldown} />
                  </div>
                )
              })()}

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
                      Filosofie uitleggen
                    </>
                  )}
                </button>
              )}
              {(explain.isError || explainExtended.isError) && (
                <p className="text-[12px] text-red-300/70">
                  Even niet bereikbaar. Probeer het zo opnieuw.
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
                  ? "Deze training komt er nog aan. Klopt er iets niet of past het beter op een andere dag? Dan wordt je plan er vast op afgestemd."
                  : "Laat weten hoe het ging — je plan wordt zo nodig aangepast."}
              </p>
              {!isUpcoming && (
                <div className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.2em] text-white/40">
                      <HeartPulse className="h-3 w-3" strokeWidth={1.75} />
                      HOE ZWAAR VOELDE HET? (RPE 1–10, OPTIONEEL)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRpe(rpe === n ? null : n)}
                          aria-pressed={rpe === n}
                          className="h-7 w-7 rounded-full border font-mono text-[11px] tabular-nums transition-colors"
                          style={{
                            borderColor:
                              rpe === n
                                ? "rgba(120,210,230,0.5)"
                                : "rgba(255,255,255,0.1)",
                            background:
                              rpe === n ? "rgba(120,210,230,0.12)" : "transparent",
                            color: rpe === n ? ACCENT : "rgba(255,255,255,0.5)",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 font-mono text-[9px] tracking-[0.2em] text-white/40">
                      AFGEMAAKT? (OPTIONEEL)
                    </p>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: "volledig", label: "Volledig" },
                          { value: "gedeeltelijk", label: "Gedeeltelijk" },
                          { value: "niet", label: "Niet" },
                        ] as { value: WorkoutCompletion; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setCompletion(
                              completion === opt.value ? null : opt.value,
                            )
                          }
                          aria-pressed={completion === opt.value}
                          className="rounded-full border px-3 py-1 font-sans text-[12px] transition-colors"
                          style={{
                            borderColor:
                              completion === opt.value
                                ? "rgba(120,210,230,0.5)"
                                : "rgba(255,255,255,0.1)",
                            background:
                              completion === opt.value
                                ? "rgba(120,210,230,0.12)"
                                : "transparent",
                            color:
                              completion === opt.value
                                ? ACCENT
                                : "rgba(255,255,255,0.55)",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(completion === "gedeeltelijk" || completion === "niet") && (
                    <input
                      value={deviationReason}
                      onChange={(e) => setDeviationReason(e.target.value)}
                      placeholder="Waarom anders dan gepland? (optioneel)…"
                      className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 font-sans text-[13px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
                    />
                  )}
                </div>
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={
                  isUpcoming
                    ? "Wat is goed om te weten? (optioneel)…"
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
                      aria-pressed={active}
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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] text-white/55">
                      {recommendationLabel(proposal.recommendation).toUpperCase()}
                    </span>
                    {proposal.confidence != null && (
                      <span className="inline-flex rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] text-white/45">
                        ZEKERHEID {Math.round(proposal.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  {proposal.basis && proposal.basis.length > 0 && (
                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
                      <p className="mb-1.5 font-mono text-[9px] tracking-[0.2em] text-white/35">
                        WAAROM DIT VOORSTEL
                      </p>
                      <ul className="flex flex-col gap-1">
                        {proposal.basis.map((b, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-[12px] leading-relaxed text-white/60"
                          >
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cyan-300/50" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
                  Er kon nu geen voorstel worden gemaakt. Je feedback is wel bewaard.
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
                        {f.rpe != null && (
                          <span className="font-mono tabular-nums text-white/40">
                            RPE {f.rpe}
                          </span>
                        )}
                        {f.completion && (
                          <span className="text-white/40">{f.completion}</span>
                        )}
                        {f.note && <span className="text-white/35">— {f.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 05 UITVOERING — gekoppelde activiteit (koppel/ontkoppel). */}
            {!isUpcoming && (
              <section className="flex flex-col gap-3">
                <SectionHead n="05" title="Uitvoering" icon={Link2} />
                {workout.sessionId != null ? (
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-cyan-300/70" strokeWidth={2} />
                      <span className="text-[12px] text-white/70">
                        Gekoppeld aan activiteit #{workout.sessionId}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        linkSession.mutate({ id: workout.id, sessionId: null })
                      }
                      disabled={linkSession.isPending}
                      className="flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 font-sans text-[11px] text-white/55 transition-colors hover:text-white/80 disabled:opacity-50"
                    >
                      <Unlink className="h-3 w-3" strokeWidth={1.75} />
                      Ontkoppel
                    </button>
                  </div>
                ) : (
                  (() => {
                    const sameDay = (recentSessions ?? []).filter(
                      (s) => s.sessionDate === workout.scheduledDate,
                    )
                    if (sameDay.length === 0) {
                      return (
                        <p className="text-[12px] leading-relaxed text-white/40">
                          Nog geen activiteit gekoppeld. Zodra er een rit van{" "}
                          {new Date(
                            workout.scheduledDate + "T12:00:00Z",
                          ).toLocaleDateString("nl-NL", {
                            day: "numeric",
                            month: "long",
                          })}{" "}
                          binnenkomt, wordt die automatisch gekoppeld — of koppel
                          hier zelf zodra die er is.
                        </p>
                      )
                    }
                    return (
                      <div className="flex flex-col gap-2">
                        <p className="text-[12px] text-white/45">
                          Activiteiten van dezelfde dag — koppel de juiste:
                        </p>
                        {sameDay.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              linkSession.mutate({
                                id: workout.id,
                                sessionId: s.id,
                              })
                            }
                            disabled={linkSession.isPending}
                            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-left transition-colors hover:border-cyan-300/30 disabled:opacity-50"
                          >
                            <span className="text-[12px] text-white/75">
                              {s.title ?? s.type}
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-white/45">
                              {s.durationMin != null ? `${s.durationMin} min` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )
                  })()
                )}
                {linkSession.isError && (
                  <p className="text-[12px] text-red-300/70">
                    Koppelen is niet gelukt. Controleer of de activiteit op
                    dezelfde dag valt.
                  </p>
                )}
              </section>
            )}

            {/* 06 HISTORIE & BEHEER */}
            <section className="flex flex-col gap-3">
              <SectionHead n="06" title="Historie & beheer" icon={History} />
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-fit items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-white/45 transition-colors hover:text-white/80"
              >
                <History className="h-3.5 w-3.5" strokeWidth={1.75} />
                {showHistory ? "VERBERG WIJZIGINGEN" : "TOON WIJZIGINGEN"}
              </button>
              {showHistory && (
                <div className="flex flex-col gap-1.5">
                  {history.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                  ) : (history.data?.changes ?? []).length === 0 ? (
                    <p className="text-[12px] text-white/40">
                      Nog geen wijzigingen geregistreerd.
                    </p>
                  ) : (
                    (history.data?.changes ?? []).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-2 text-[11px] leading-relaxed text-white/45"
                      >
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-white/25" />
                        <span>
                          <span className="font-mono text-[10px] text-white/35">
                            {new Date(c.createdAt).toLocaleDateString("nl-NL", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>{" "}
                          <span className="text-white/65">{c.action}</span>
                          {c.reason && (
                            <span className="text-white/40"> — {c.reason}</span>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {workout.source !== "coach" &&
                workout.status !== "cancelled" &&
                workout.status !== "completed" && (
                  <div className="mt-1">
                    {confirmCancel ? (
                      <div className="flex items-center gap-2.5">
                        <span className="text-[12px] text-white/55">
                          Training echt annuleren?
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            cancelWorkout.mutate(workout.id, {
                              onSuccess: () => setConfirmCancel(false),
                            })
                          }
                          disabled={cancelWorkout.isPending}
                          className="rounded-full border border-red-300/30 px-3 py-1 font-sans text-[12px] text-red-300/80 disabled:opacity-50"
                        >
                          {cancelWorkout.isPending ? "Bezig…" : "Ja, annuleer"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmCancel(false)}
                          className="rounded-full border border-white/[0.12] px-3 py-1 font-sans text-[12px] text-white/55"
                        >
                          Nee
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(true)}
                        className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-white/35 transition-colors hover:text-red-300/70"
                      >
                        <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
                        TRAINING ANNULEREN
                      </button>
                    )}
                    {cancelWorkout.isError && (
                      <p className="mt-1.5 text-[12px] text-red-300/70">
                        Annuleren is niet gelukt. Probeer het opnieuw.
                      </p>
                    )}
                  </div>
                )}
              {workout.status === "cancelled" && (
                <p className="text-[12px] text-white/40">
                  Deze training is geannuleerd en telt nergens meer mee.
                </p>
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
