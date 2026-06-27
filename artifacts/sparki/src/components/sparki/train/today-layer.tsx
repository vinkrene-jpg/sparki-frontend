import { useState } from "react"
import { useTodayWorkout, useUpdateWorkout } from "@/hooks/use-today-workout"
import { useCoachAnalysis } from "@/hooks/use-coach-analysis"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { detectReadinessConflict } from "@/lib/train-intelligence"
import { LayerHeading } from "@/components/sparki/train/layer-heading"
import { WorkoutDetailDrawer } from "@/components/sparki/workout-detail-drawer"
import { CorePredictionPanel } from "@/components/sparki/core-prediction-panel"
import { LinkedRoutePreview } from "@/components/sparki/linked-route"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { missingTargets } from "@/lib/missing-input"
import { Stat, Divider, ACCENT } from "@/components/sparki/ui"
import {
  Check,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Sparkles,
} from "lucide-react"
import type { WorkoutBlock } from "@/lib/athlete-types"

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

const cardClass =
  "rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"

export function TodayLayer() {
  const { data: workout, isLoading } = useTodayWorkout()
  const { data: profile } = useAthleteExtendedProfile()
  const { data: coach } = useCoachAnalysis()
  const updateWorkout = useUpdateWorkout()
  const [detailOpen, setDetailOpen] = useState(false)
  const [showWhy, setShowWhy] = useState(false)

  const blocks: WorkoutBlock[] = workout?.structure?.blocks ?? []
  const maxBlockMin = blocks.reduce((m, b) => Math.max(m, b.durationMin), 1)
  const primaryZone = workout?.structure?.primaryZone ?? null
  const rationale = workout?.structure?.rationale ?? null
  const advice = coach?.advice
  const conflict = detectReadinessConflict({
    plannedZone: primaryZone,
    plannedType: workout?.type ?? null,
    advice,
  })
  const isPending =
    workout?.status === "planned" || workout?.status === "modified"
  const isCompleted = workout?.status === "completed"
  const markComplete = () => {
    if (workout?.id) updateWorkout.mutate({ id: workout.id, status: "completed" })
  }
  const markSkipped = () => {
    if (workout?.id) updateWorkout.mutate({ id: workout.id, status: "skipped" })
  }

  const targetZone =
    primaryZone != null && profile?.zones
      ? profile.zones.find((z) => z.zone === primaryZone)
      : null

  return (
    <section className="flex flex-col gap-4">
      <LayerHeading
        title="Vandaag"
        subtitle="Wat moet je nú doen — en waarom precies dit."
      />

      {isLoading ? (
        <div className={cardClass}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-4 h-24 w-full" />
        </div>
      ) : workout ? (
        <>
        {/* Core-voorspelpaneel — Sparki's effect-forecast boven elke training. */}
        <CorePredictionPanel workoutId={workout.id} />
        <div className={`${cardClass} flex flex-col gap-4`}>
          {/* Session header */}
          <div>
            <h3 className="text-balance font-sans text-2xl font-extralight leading-tight tracking-tight">
              {workout.title}
            </h3>
            <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
              {workout.targetDurationMin ? `${workout.targetDurationMin}m` : ""}
              {workout.targetDurationMin && workout.targetTSS ? " · " : ""}
              {workout.targetTSS ? `${workout.targetTSS} TSS` : ""}
            </p>
          </div>

          {/* Structure-driven load bars */}
          {blocks.length > 0 && (
            <div className="flex h-24 items-end gap-1">
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
                        background: zoneColor[b.zone] ?? "rgba(120,210,230,0.4)",
                        boxShadow:
                          b.zone >= 4 ? "0 0 12px rgba(120,210,230,0.5)" : "none",
                      }}
                    />
                    <span className="mt-1.5 truncate font-mono text-[7px] tracking-wider text-white/30">
                      Z{b.zone}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* WHY this session today — straight from the plan's own rationale. */}
          {rationale?.whyToday && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} strokeWidth={2} />
                <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-300/70">
                  WAAROM VANDAAG
                </span>
              </div>
              <p className="mt-2 text-pretty text-[13px] leading-relaxed text-white/70">
                {rationale.whyToday}
              </p>
              {(rationale.supportsGoal || rationale.whatToFeel) && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowWhy((v) => !v)}
                    className="mt-2 flex items-center gap-1 font-mono text-[10px] tracking-wide text-white/40 transition-colors hover:text-white/65"
                  >
                    Meer uitleg
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${showWhy ? "rotate-180" : ""}`}
                      strokeWidth={2}
                    />
                  </button>
                  {showWhy && (
                    <div className="mt-2 flex flex-col gap-2">
                      {rationale.supportsGoal && (
                        <p className="text-pretty text-[12px] leading-relaxed text-white/50">
                          <span className="text-white/35">Voor je doel: </span>
                          {rationale.supportsGoal}
                        </p>
                      )}
                      {rationale.whatToFeel && (
                        <p className="text-pretty text-[12px] leading-relaxed text-white/50">
                          <span className="text-white/35">Hoe het moet voelen: </span>
                          {rationale.whatToFeel}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Target zone (folded in from the old static "Doelzones" table). */}
          {targetZone && (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] px-3.5 py-2.5">
              <span
                className="h-3 w-1 rounded-full"
                style={{
                  background: zoneColor[targetZone.zone] ?? ACCENT,
                  boxShadow: `0 0 8px ${zoneColor[targetZone.zone] ?? ACCENT}`,
                }}
              />
              <span className="font-mono text-[11px] text-white/50">
                Z{targetZone.zone}
              </span>
              <span className="flex-1 text-[13px] text-white/80">
                {targetZone.label}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-white/55">
                {targetZone.min}–{targetZone.max}W
              </span>
            </div>
          )}

          {/* Readiness vs plan — Sparki flags a real conflict honestly. */}
          {conflict.kind === "te_zwaar_voor_herstel" && (
            <div
              className="rounded-xl border p-3.5"
              style={{
                borderColor: "rgba(255,160,90,0.3)",
                background: "rgba(255,160,90,0.06)",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className="h-3.5 w-3.5"
                  style={{ color: "rgba(255,180,90,0.95)" }}
                  strokeWidth={2}
                />
                <span className="font-sans text-[13px] font-medium text-white/85">
                  {conflict.headline}
                </span>
              </div>
              {conflict.detail && (
                <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-white/60">
                  {conflict.detail}
                </p>
              )}
              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="mt-2.5 flex items-center gap-1 font-mono text-[11px] tracking-wide text-cyan-300/75 transition-colors hover:text-cyan-300"
              >
                Pas deze sessie aan
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          )}
          {conflict.kind === "ruimte_voor_meer" && (
            <p className="text-pretty text-[12px] leading-relaxed text-cyan-300/60">
              {conflict.headline} — {conflict.detail}
            </p>
          )}

          {/* Detail + completion actions */}
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="group flex w-full items-center gap-5 border-t border-white/[0.07] pt-4 text-left"
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
              className="flex items-center gap-2 self-start rounded-full border px-4 py-2"
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
            <div className="flex gap-3">
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

          <LinkedRoutePreview plannedWorkoutId={workout.id} />
        </div>
        </>
      ) : (
        <div className={cardClass}>
          {missingTargets(["ftp", "weeklyHours"], profile).length > 0 ? (
            <MissingInputNotice
              compact
              showOrb={false}
              title="Nog geen sessie voor vandaag"
              description="Zodra je FTP en wekelijkse uren bekend zijn, verschijnt hier je dagtraining."
              targets={["ftp", "weeklyHours"]}
              profile={profile}
              returnTo="/train"
              retry="generate-plan"
            />
          ) : (
            <p className="text-pretty text-[13px] leading-relaxed text-white/55">
              Je profiel is compleet. Zodra je schema er staat — bouw het bij
              <span className="text-white/75"> “Waar komt je training vandaan” </span>
              hieronder — verschijnt hier je sessie van vandaag.
            </p>
          )}
        </div>
      )}

      <WorkoutDetailDrawer
        workoutId={workout?.id ?? null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </section>
  )
}
