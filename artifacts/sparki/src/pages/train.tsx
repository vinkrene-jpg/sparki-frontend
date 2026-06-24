import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { useFixParams } from "@/hooks/use-missing-input"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { useTodayWorkout, useUpdateWorkout } from "@/hooks/use-today-workout"
import { useSessions, useLogSession } from "@/hooks/use-sessions"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { missingTargets } from "@/lib/missing-input"
import { useAiBrief } from "@/hooks/use-ai-brief"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { ActivityImportPanel } from "@/components/sparki/activity-import-panel"
import { DocumentAnalysisPanel } from "@/components/sparki/document-analysis-panel"
import { RoutePanel } from "@/components/sparki/route-panel"
import { LinkedRoutePreview } from "@/components/sparki/linked-route"
import { ThreeWeekPlan } from "@/components/sparki/three-week-plan"
import { useGeneratePlan } from "@/hooks/use-training-plan"
import { WorkoutDetailDrawer } from "@/components/sparki/workout-detail-drawer"
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer"
import { TrainingPlanPanel } from "@/components/sparki/training-plan-panel"
import {
  Bike,
  Activity,
  Zap,
  Check,
  CheckCircle2,
  XCircle,
  Plus,
  ChevronRight,
  X,
} from "lucide-react"
import type { TrainingSession, WorkoutBlock } from "@/lib/athlete-types"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

const zoneColor: Record<number, string> = {
  1: "rgba(120,210,230,0.25)",
  2: "rgba(120,210,230,0.4)",
  3: "rgba(255,220,100,0.45)",
  4: "rgba(120,210,230,0.95)",
  5: "rgba(255,140,80,0.8)",
  6: "rgba(255,80,80,0.75)",
}

function LogSessionForm({ onDone }: { onDone: () => void }) {
  const logSession = useLogSession()
  const [form, setForm] = useState<{
    title: string
    type: string
    durationMin: string
    tss: string
    normalizedPower: string
    feelScore: string
    notes: string
  }>({
    title: "",
    type: "ride",
    durationMin: "",
    tss: "",
    normalizedPower: "",
    feelScore: "3",
    notes: "",
  })

  const set =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const today = new Date().toISOString().split("T")[0]!
    logSession.mutate(
      {
        sessionDate: today,
        type: form.type,
        title: form.title || null,
        durationMin: form.durationMin ? parseInt(form.durationMin) : undefined,
        tss: form.tss ? parseInt(form.tss) : undefined,
        normalizedPower: form.normalizedPower
          ? parseInt(form.normalizedPower)
          : undefined,
        feelScore: parseInt(form.feelScore),
        notes: form.notes || null,
      } as Partial<TrainingSession>,
      { onSuccess: onDone },
    )
  }

  const inputClass =
    "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
          Nieuwe sessie
        </span>
        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70"
          aria-label="Sluiten"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
          Sluiten
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <input
            className={inputClass}
            placeholder="Titel (optioneel)"
            value={form.title}
            onChange={set("title")}
          />
        </div>
        <select className={inputClass} value={form.type} onChange={set("type")}>
          <option value="ride">Rit</option>
          <option value="run">Hardlopen</option>
          <option value="swim">Zwemmen</option>
          <option value="strength">Kracht</option>
          <option value="other">Anders</option>
        </select>
        <input
          className={inputClass}
          type="number"
          placeholder="Duur (min)"
          value={form.durationMin}
          onChange={set("durationMin")}
          min={1}
          max={999}
        />
        <input
          className={inputClass}
          type="number"
          placeholder="TSS"
          value={form.tss}
          onChange={set("tss")}
          min={1}
          max={999}
        />
        <input
          className={inputClass}
          type="number"
          placeholder="NP (watt)"
          value={form.normalizedPower}
          onChange={set("normalizedPower")}
          min={50}
          max={1000}
        />
      </div>

      <div>
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          HOE VOELDE HET?
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setForm((p) => ({ ...p, feelScore: String(n) }))}
              className="flex flex-1 items-center justify-center rounded-xl border py-2.5 font-mono text-sm transition-colors"
              style={{
                borderColor:
                  form.feelScore === String(n)
                    ? "rgba(120,210,230,0.5)"
                    : "rgba(255,255,255,0.1)",
                background:
                  form.feelScore === String(n)
                    ? "rgba(120,210,230,0.12)"
                    : "transparent",
                color:
                  form.feelScore === String(n)
                    ? ACCENT
                    : "rgba(255,255,255,0.5)",
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between px-1 font-mono text-[9px] tracking-[0.15em] text-white/20">
          <span>zwaar</span>
          <span>top</span>
        </div>
      </div>

      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Notities (optioneel)"
        rows={2}
        value={form.notes}
        onChange={set("notes")}
      />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={logSession.isPending}
          className="flex-1 rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#040506" }}
        >
          {logSession.isPending ? "Opslaan…" : "Sessie opslaan"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-2xl border border-white/[0.1] px-5 py-3.5 font-sans text-[13px] text-white/50"
        >
          Annuleer
        </button>
      </div>
    </form>
  )
}

function typeIcon(type: string) {
  if (type === "ride") return Bike
  if (type === "run") return Activity
  return Zap
}

export default function TrainPage() {
  const { data: workout, isLoading: workoutLoading } = useTodayWorkout()
  const { data: profile, isLoading: profileLoading } = useAthleteExtendedProfile()
  const { data: sessions, isLoading: sessionsLoading } = useSessions(10)
  const updateWorkout = useUpdateWorkout()
  const generatePlan = useGeneratePlan()
  const aiEnabled = useFeatureFlag("ai_observations")
  const routePlannerEnabled = useFeatureFlag("route_planner")
  const autonomousTrainingEnabled = useFeatureFlag("autonomous_training")
  const { data: brief, isLoading: briefLoading } = useAiBrief(aiEnabled)
  const [showLogForm, setShowLogForm] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [openSession, setOpenSession] = useState<TrainingSession | null>(null)
  const [, navigate] = useLocation()
  const { focus } = useFixParams()
  const [planHighlight, setPlanHighlight] = useState(false)

  // When arrived here via a coach action ("Bekijk je training"), scroll straight
  // to the training plan and briefly highlight it so the navigation feels real —
  // otherwise the user lands on the coach card at the top and nothing seems to
  // have happened. The focus param is stripped afterwards so a refresh/back
  // doesn't re-trigger the auto-scroll.
  useEffect(() => {
    if (focus !== "plan") return
    const t = setTimeout(() => {
      document
        .getElementById("three-week-plan")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
      setPlanHighlight(true)
      setTimeout(() => setPlanHighlight(false), 1600)
      navigate("/train", { replace: true })
    }, 200)
    return () => clearTimeout(t)
  }, [focus, navigate])

  // Arrived via a "Log een training" CTA: open the log form and scroll to it.
  useEffect(() => {
    if (focus !== "logsession") return
    setShowLogForm(true)
    const t = setTimeout(() => {
      document
        .getElementById("log-session")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
      navigate("/train", { replace: true })
    }, 200)
    return () => clearTimeout(t)
  }, [focus, navigate])

  const isLoading = workoutLoading || profileLoading

  const blocks: WorkoutBlock[] = workout?.structure?.blocks ?? []
  const maxBlockMin = blocks.reduce(
    (m, b) => Math.max(m, b.durationMin),
    1,
  )

  const markComplete = () => {
    if (workout?.id) updateWorkout.mutate({ id: workout.id, status: "completed" })
  }
  const markSkipped = () => {
    if (workout?.id) updateWorkout.mutate({ id: workout.id, status: "skipped" })
  }

  const isPending =
    workout?.status === "planned" || workout?.status === "modified"
  const isCompleted = workout?.status === "completed"

  const dayLabel = new Date()
    .toLocaleDateString("nl-NL", { weekday: "long" })
    .toUpperCase()

  return (
    <ScreenShell section="Train">
      {/* INTRO */}
      <div className="-mt-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
          {dayLabel} · UITVOERING
        </p>
        {isLoading ? (
          <Skeleton className="mt-2 h-8 w-56" />
        ) : (
          <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
            {workout?.title ?? "Geen plan vandaag"}
          </h1>
        )}
        {workout && (
          <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
            {workout.targetDurationMin ? `${workout.targetDurationMin}m` : ""}
            {workout.targetDurationMin && workout.targetTSS ? " · " : ""}
            {workout.targetTSS ? `${workout.targetTSS} TSS` : ""}
          </p>
        )}
      </div>

      {/* 00 PLAN — 3 weken */}
      <div
        id="three-week-plan"
        className={`scroll-mt-4 rounded-3xl transition-shadow duration-500 ${
          planHighlight ? "shadow-[0_0_0_2px_rgba(120,210,230,0.5)]" : ""
        }`}
      >
        <ThreeWeekPlan />
      </div>

      {/* 01 DE SESSIE */}
      <section>
        <SectionLabel n="01" title="De sessie" />
        {isLoading ? (
          <div className="mt-5 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : workout ? (
          <>
            {/* Real structure-driven load bars (height = block duration, color = zone) */}
            {blocks.length > 0 ? (
              <div className="mt-5 flex h-24 items-end gap-1">
                {blocks.map((b, i) => {
                  const h = 0.25 + (b.durationMin / maxBlockMin) * 0.75
                  return (
                    <div
                      key={i}
                      className="flex flex-1 flex-col items-center justify-end"
                      style={{ height: "100%" }}
                      title={`${b.label} · ${b.durationMin}m · Z${b.zone}`}
                    >
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${h * 100}%`,
                          background:
                            zoneColor[b.zone] ?? "rgba(120,210,230,0.4)",
                          boxShadow:
                            b.zone >= 4
                              ? "0 0 12px rgba(120,210,230,0.5)"
                              : "none",
                        }}
                      />
                      <span className="mt-1.5 truncate font-mono text-[7px] tracking-wider text-white/30">
                        Z{b.zone}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="group mt-5 flex w-full items-center gap-5 border-t border-white/[0.07] pt-4 text-left"
            >
              <Stat label="Type" value={workout.type} />
              {workout.targetDurationMin && (
                <>
                  <Divider />
                  <Stat label="Duur" value={`${workout.targetDurationMin}m`} />
                </>
              )}
              {workout.targetTSS && (
                <>
                  <Divider />
                  <Stat label="Belasting" value={`${workout.targetTSS} TSS`} accent />
                </>
              )}
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-white/40 transition-colors group-hover:text-cyan-300/70">
                DETAIL
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
            </button>

            {isCompleted && (
              <div
                className="mt-4 flex items-center gap-2 rounded-full px-4 py-2 border"
                style={{
                  borderColor: "rgba(120,210,230,0.3)",
                  background: "rgba(120,210,230,0.08)",
                  color: ACCENT,
                }}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span className="font-mono text-[10px] tracking-[0.2em]">
                  SESSIE VOLTOOID
                </span>
              </div>
            )}

            {isPending && (
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={markComplete}
                  disabled={updateWorkout.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: ACCENT, color: "#040506" }}
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                  Klaar
                </button>
                <button
                  type="button"
                  onClick={markSkipped}
                  disabled={updateWorkout.isPending}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] px-5 py-3.5 font-sans text-[13px] font-semibold text-white/50 transition-colors hover:border-white/20 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" strokeWidth={1.75} />
                  Overslaan
                </button>
              </div>
            )}

            <LinkedRoutePreview
              plannedWorkoutId={workout.id}
              className="mt-5"
            />
          </>
        ) : (
          <div className="mt-5">
            {missingTargets(["ftp", "weeklyHours"], profile).length > 0 ? (
              <MissingInputNotice
                compact
                showOrb={false}
                title="Geen training gepland vandaag"
                description="Sparki bouwt je dagplanning op zodra je FTP en wekelijkse uren bekend zijn. Vul ze aan om je schema te activeren."
                targets={["ftp", "weeklyHours"]}
                profile={profile}
                returnTo="/train"
                retry="generate-plan"
              />
            ) : (
              <>
                <MissingInputNotice
                  compact
                  showOrb={false}
                  title="Nog geen training voor vandaag"
                  description="Je profiel is compleet, maar er staat nog geen schema klaar. Bouw je 3-wekenplan om je dagtrainingen te activeren."
                  profile={profile}
                  primary={{
                    label: generatePlan.isPending
                      ? "Plan opbouwen…"
                      : "Bouw mijn plan",
                    loading: generatePlan.isPending,
                    disabled: generatePlan.isPending,
                    // Actually build the plan here — don't just scroll to another
                    // button. Once it's built, scroll up so the user sees the
                    // freshly filled 3-week grid populate.
                    onClick: () => {
                      if (generatePlan.isPending) return
                      generatePlan.mutate(undefined, {
                        onSuccess: () => {
                          setTimeout(() => {
                            document
                              .getElementById("three-week-plan")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              })
                          }, 100)
                        },
                      })
                    },
                  }}
                />
                {generatePlan.isError && (
                  <p className="mt-3 text-[12px] text-red-300/70">
                    {generatePlan.error instanceof Error &&
                    generatePlan.error.message.includes("profile_incomplete")
                      ? "Sparki mist nog je FTP of wekelijkse uren. Vul ze aan bij je profiel."
                      : "Het opbouwen lukte niet. Probeer het opnieuw."}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* 02 DOELZONES */}
      {!profileLoading && profile?.zones && (
        <section>
          <SectionLabel n="02" title="Doelzones" />
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span
                className="font-mono text-[10px] tracking-[0.2em]"
                style={{ color: "rgba(120,210,230,0.8)" }}
              >
                TARGET · ZONE 4
              </span>
              {profile.zones[3] && (
                <p className="mt-1 font-sans text-3xl font-extralight tabular-nums">
                  {profile.zones[3].min}–{profile.zones[3].max}W
                </p>
              )}
            </div>
            {profile.ftp && (
              <div className="flex items-center gap-5 mb-1">
                <Stat label="FTP" value={`${profile.ftp}W`} accent />
                {profile.wkg && (
                  <>
                    <Divider />
                    <Stat label="W/kg" value={String(profile.wkg)} />
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col">
            {profile.zones.map((z) => {
              const color = zoneColor[z.zone] ?? "rgba(120,210,230,0.4)"
              return (
                <div
                  key={z.zone}
                  className="flex items-center gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
                  style={{ opacity: z.zone === 4 ? 1 : 0.55 }}
                >
                  <span
                    className="h-3 w-1 rounded-full"
                    style={{
                      background: color,
                      boxShadow: z.zone === 4 ? `0 0 8px ${ACCENT}` : "none",
                    }}
                  />
                  <span className="w-6 font-mono text-[11px] tabular-nums text-white/50">
                    Z{z.zone}
                  </span>
                  <span className="flex-1 text-[13px] tracking-tight text-white/85">
                    {z.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-white/55">
                    {z.min}–{z.max}W
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 03 ROUTE & NAVIGATIE (feature-flagged) */}
      {routePlannerEnabled && <RoutePanel />}

      {/* 04 TRAININGSSCHEMA (feature-flagged) */}
      {autonomousTrainingEnabled && <TrainingPlanPanel />}

      {/* 06 SPARKI UITVOERING */}
      {aiEnabled && (
        <section>
          <SectionLabel n="06" title="Sparki coaching" />
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 animate-breathe rounded-full"
              style={{
                background: `radial-gradient(circle, ${ACCENT}, transparent 70%)`,
                opacity: 0.18,
              }}
            />
            <div className="flex items-center gap-2">
              <SparkiCore size={28} accent={ACCENT} readiness={0.9} variant="orb" />
              <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">
                SPARKI
              </span>
            </div>
            {briefLoading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : brief ? (
              <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/75">
                {brief.brief}
              </p>
            ) : (
              <div className="mt-3">
                <MissingInputNotice
                  compact
                  showOrb={false}
                  title="Nog geen coaching vandaag"
                  description="Log je check-in zodat Sparki je dag persoonlijk kan begeleiden."
                  targets={["checkin"]}
                  returnTo="/train"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* 07 SESSIE LOGGEN */}
      <section id="log-session" className="scroll-mt-4">
        <SectionLabel n="07" title="Sessie loggen" />

        {!showLogForm && (
          <button
            type="button"
            onClick={() => setShowLogForm(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.15] py-4 font-sans text-[13px] font-medium text-white/50 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/60"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Sessie toevoegen
          </button>
        )}

        {showLogForm && (
          <div className="mt-4 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
            <LogSessionForm onDone={() => setShowLogForm(false)} />
          </div>
        )}

        {/* Recent sessions */}
        {!sessionsLoading && sessions && sessions.length > 0 && (
          <div className="mt-5 flex flex-col">
            <span className="mb-3 font-mono text-[10px] tracking-[0.2em] text-white/35">
              RECENTE SESSIES
            </span>
            {sessions.slice(0, 5).map((s) => {
              const Icon = typeIcon(s.type)
              const date = new Date(
                s.sessionDate + "T12:00:00Z",
              ).toLocaleDateString("nl-NL", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setOpenSession(s)}
                  className="flex w-full items-center gap-4 border-b border-white/[0.05] py-3.5 text-left transition-colors last:border-0 hover:bg-white/[0.02]"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      borderColor: "rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: ACCENT }}
                      strokeWidth={1.75}
                    />
                  </span>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-[13px] font-medium text-white/85">
                      {s.title ?? s.type.charAt(0).toUpperCase() + s.type.slice(1)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-white/35">{date}</span>
                      {s.durationMin != null && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-white/20" />
                          <span className="font-mono text-[10px] text-white/35">
                            {s.durationMin}m
                          </span>
                        </>
                      )}
                      {s.tss != null && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-white/20" />
                          <span className="font-mono text-[10px] text-white/35">
                            {s.tss} TSS
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {s.feelScore != null && (
                    <span
                      className="font-sans text-base font-light tabular-nums"
                      style={{ color: ACCENT }}
                    >
                      {s.feelScore}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* 08 ACTIVITEIT IMPORTEREN */}
      <ActivityImportPanel />

      {/* 09 WEDSTRIJDGIDS LEZEN */}
      <DocumentAnalysisPanel />

      <WorkoutDetailDrawer
        workoutId={workout?.id ?? null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <SessionDetailDrawer
        session={openSession}
        open={openSession != null}
        onOpenChange={(o) => {
          if (!o) setOpenSession(null)
        }}
      />
    </ScreenShell>
  )
}
