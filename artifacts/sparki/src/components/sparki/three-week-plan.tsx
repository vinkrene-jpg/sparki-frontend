import { useState } from "react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { HumorLine } from "@/components/sparki/humor-line"
import { usePlanWindow, useGeneratePlan, usePlanPreview, type PlanPreview } from "@/hooks/use-training-plan"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { DayDetailDrawer } from "@/components/sparki/day-detail-drawer"
import { WorkoutDetailDrawer } from "@/components/sparki/workout-detail-drawer"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { BuildRatingBlock } from "@/components/sparki/build-rating"
import { FtpEstimateWizard } from "@/components/sparki/ftp-estimate-wizard"
import { useRetryAction } from "@/hooks/use-missing-input"
import { isTargetSet } from "@/lib/missing-input"
import type { PlannedWorkout } from "@/lib/athlete-types"
import { Loader2, CalendarRange } from "lucide-react"

const DOW = ["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"]

// Local calendar date (YYYY-MM-DD) — built from local getters so the grid, the
// "vandaag"-highlight and the workout matching all agree with the athlete's own
// day, never a UTC-shifted day near midnight (local-date UTC off-by-one trap).
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Monday-aligned offset (JS getDay: 0=Sun..6=Sat → 0=Mon..6=Sun).
function mondayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  const day = new Date(y!, m! - 1, d!, 12).getDay()
  return (day + 6) % 7
}

// F5 (TRAINEN_DOELEN_SEIZOEN_01): bevestigingsscherm "wat verandert er" — het
// nieuwe schema komt pas op de kalender nadat de sporter dit heeft gezien en
// bevestigd: fasen met begindatums, het verschil met de huidige weken en wat
// er per week gevraagd wordt.
const PHASE_NL: Record<PlanPreview["phase"], string> = {
  base: "Basis — rustig opbouwen",
  build: "Opbouw — gericht zwaarder",
  peak: "Piek — scherpte richting je doel",
  taper: "Taper — vers aan de start",
}

function fmtDayShort(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y!, m! - 1, d!, 12).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
}

function PlanPreviewConfirm({
  preview,
  onConfirm,
  onCancel,
  confirming,
}: {
  preview: PlanPreview
  onConfirm: () => void
  onCancel: () => void
  confirming: boolean
}) {
  return (
    <div className="mt-4 rounded-2xl border border-accent-cyan/25 bg-card p-4 backdrop-blur-md">
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
        Wat verandert er
      </span>
      <p className="mt-2 text-[14px] font-light tracking-tight text-foreground">
        Fase: {PHASE_NL[preview.phase]}
      </p>
      <div className="mt-3 space-y-2">
        {preview.weeks.map((w) => {
          const cur = preview.currentWeeks.find((c) => c.weekIndex === w.weekIndex)
          const diff = cur ? Math.round((w.hours - cur.hours) * 10) / 10 : null
          return (
            <div key={w.weekIndex} className="rounded-xl border border-border bg-muted px-3 py-2">
              <p className="text-[12px] text-foreground/85">
                Week {w.weekIndex + 1} · vanaf {fmtDayShort(w.startDate)} — {w.sessions}{" "}
                {w.sessions === 1 ? "sessie" : "sessies"}, ±{w.hours} u
                {w.heaviestDay && (
                  <> · zwaarste dag: {w.heaviestDay.focus.toLowerCase()} op {fmtDayShort(w.heaviestDay.date)}</>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {cur && cur.sessions > 0
                  ? diff === 0
                    ? "Evenveel uren als er nu gepland staan."
                    : `Nu gepland: ${cur.hours} u — dat wordt ${diff! > 0 ? `${diff} u meer` : `${Math.abs(diff!)} u minder`}.`
                  : "Er staat nu niets gepland in deze week."}
              </p>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="rounded-xl bg-accent-cyan/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring hover:bg-accent-cyan/25 disabled:opacity-40"
        >
          {confirming ? "Bezig…" : "Zet op mijn kalender"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ring-1 ring-ring hover:text-foreground/70"
        >
          Toch niet
        </button>
      </div>
    </div>
  )
}

function zoneDot(zone: number): string {
  if (zone >= 5) return "rgba(255,140,80,0.9)"
  if (zone === 4) return "rgba(120,210,230,0.95)"
  if (zone === 3) return "rgba(255,220,100,0.7)"
  if (zone <= 1) return "rgba(255,255,255,0.25)"
  return "rgba(120,210,230,0.5)"
}

export function ThreeWeekPlan({
  hideLabel = false,
  hideEmptyCta = false,
  hideRegenerate = false,
}: {
  hideLabel?: boolean
  hideEmptyCta?: boolean
  hideRegenerate?: boolean
} = {}) {
  const { data: plan, isLoading } = usePlanWindow(3)
  const { data: profile } = useAthleteExtendedProfile()
  const generate = useGeneratePlan()
  const preview = usePlanPreview()
  const [previewOpen, setPreviewOpen] = useState(false)

  const [dayOpen, setDayOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [workoutOpen, setWorkoutOpen] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState<number | null>(null)
  const [ftpWizardOpen, setFtpWizardOpen] = useState(false)

  // Backend requires both FTP and weekly hours to build a plan.
  const canBuild =
    isTargetSet("ftp", profile) && isTargetSet("weeklyHours", profile)

  // When the user returns here after filling in a missing value, retry the build.
  useRetryAction("generate-plan", () => {
    if (canBuild) generate.mutate(undefined)
  })

  const today = localDate(new Date())
  const workouts: PlannedWorkout[] = plan ?? []
  const hasPlan = workouts.length > 0

  // Build 3 week-rows starting from the Monday of the current week.
  const start = new Date()
  start.setUTCHours(12, 0, 0, 0)
  const startOffset = mondayIndex(today)
  start.setUTCDate(start.getUTCDate() - startOffset)

  const weeks: { date: string; workouts: PlannedWorkout[] }[][] = []
  for (let w = 0; w < 3; w++) {
    const row: { date: string; workouts: PlannedWorkout[] }[] = []
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start)
      cur.setUTCDate(start.getUTCDate() + w * 7 + d)
      const ds = localDate(cur)
      row.push({ date: ds, workouts: workouts.filter((x) => x.scheduledDate === ds) })
    }
    weeks.push(row)
  }

  const openDay = (date: string) => {
    setSelectedDate(date)
    setDayOpen(true)
  }

  const openWorkout = (id: number) => {
    setDayOpen(false)
    setSelectedWorkout(id)
    setWorkoutOpen(true)
  }

  return (
    <section>
      {!hideLabel && <SectionLabel n="00" title="Plan · 3 weken" />}

      {isLoading ? (
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Plan laden…
          </div>
          <HumorLine context="loading" />
        </div>
      ) : !hasPlan ? (
        hideEmptyCta ? (
          <p className="mt-5 text-pretty text-[12px] leading-relaxed text-muted-foreground">
            Je plan verschijnt hier zodra het is opgebouwd — bouw het in
            de sectie hierboven.
          </p>
        ) : (
        <div className="mt-5">
          <MissingInputNotice
            title="Nog geen schema"
            description={
              canBuild
                ? "Een periodiseerd plan van 3 weken op basis van je FTP, wekelijkse uren en doel."
                : "Er zijn nog een paar gegevens nodig om je plan op te bouwen. Vul ze hieronder in — je komt daarna automatisch hier terug."
            }
            targets={["ftp", "weeklyHours", "goal"]}
            profile={profile}
            returnTo="/train"
            retry="generate-plan"
            actions={
              !isTargetSet("ftp", profile)
                ? [
                    {
                      label: "Ik weet mijn FTP niet",
                      onClick: () => setFtpWizardOpen(true),
                    },
                  ]
                : []
            }
            primary={{
              label: generate.isPending
                ? "Plan opbouwen…"
                : preview.isPending
                  ? "Voorbeeld berekenen…"
                  : "Bouw mijn plan",
              // F5: eerst laten zien wat er verandert; pas na bevestiging
              // komt er iets op de kalender.
              onClick: () =>
                preview.mutate(undefined, { onSuccess: () => setPreviewOpen(true) }),
              loading: generate.isPending || preview.isPending,
              disabled: !canBuild || generate.isPending || preview.isPending,
            }}
          />
          {previewOpen && preview.data && (
            <PlanPreviewConfirm
              preview={preview.data}
              confirming={generate.isPending}
              onConfirm={() =>
                generate.mutate(undefined, { onSuccess: () => setPreviewOpen(false) })
              }
              onCancel={() => setPreviewOpen(false)}
            />
          )}
          {preview.isError && (
            <p className="mt-3 text-center text-[12px] text-[color:var(--color-negative)]">
              Het voorbeeld berekenen lukte niet. Probeer het opnieuw.
            </p>
          )}
          {generate.isError && (
            <p className="mt-3 text-center text-[12px] text-[color:var(--color-negative)]">
              {generate.error instanceof Error &&
              generate.error.message.includes("profile_incomplete")
                ? "Je FTP of wekelijkse uren ontbreken nog. Vul ze hierboven in."
                : "Het opbouwen lukte niet. Probeer het opnieuw."}
            </p>
          )}
        </div>
        )
      ) : (
        <div className="mt-5 flex flex-col gap-2.5">
          {/* DOW header */}
          <div className="grid grid-cols-7 gap-1.5 px-0.5">
            {DOW.map((d) => (
              <span
                key={d}
                className="text-center font-mono text-[9px] tracking-[0.15em] text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </div>
          {weeks.map((row, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5">
              {row.map((cell) => {
                const w = cell.workouts[0]
                const isToday = cell.date === today
                const isPast = cell.date < today
                const isRest = !w || w.type === "rest"
                const zone = w?.structure?.primaryZone ?? 0
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => openDay(cell.date)}
                    className="flex aspect-square flex-col items-center justify-between rounded-xl border p-1.5 transition-colors"
                    style={{
                      borderColor: isToday
                        ? "rgba(120,210,230,0.5)"
                        : "rgba(255,255,255,0.07)",
                      background: isToday
                        ? "rgba(120,210,230,0.08)"
                        : w && !isRest
                          ? "rgba(255,255,255,0.03)"
                          : "transparent",
                      opacity: isPast ? 0.4 : 1,
                    }}
                  >
                    <span
                      className="font-mono text-[10px] tabular-nums"
                      style={{
                        color: isToday ? ACCENT : "rgba(255,255,255,0.55)",
                      }}
                    >
                      {Number(cell.date.slice(8, 10))}
                    </span>
                    {w && !isRest ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: zoneDot(zone),
                          boxShadow:
                            zone === 4 ? `0 0 6px ${zoneDot(zone)}` : "none",
                        }}
                      />
                    ) : (
                      <span className="h-1.5 w-1.5" />
                    )}
                    {w && w.targetTSS ? (
                      <span className="font-mono text-[8px] tabular-nums text-muted-foreground">
                        {w.targetTSS}
                      </span>
                    ) : (
                      <span className="font-mono text-[8px] text-muted-foreground">
                        {isRest ? "rust" : ""}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          {/* Sterren-beoordeling op de huidige planweek — vaste audit-input. */}
          <BuildRatingBlock
            subjectType="trainingsplan_week"
            subjectId={weeks[0]?.[0]?.date ?? null}
            question="Hoe goed past deze planweek?"
            className="mt-2"
          />
          {/* Legenda — anders zijn de gekleurde stippen betekenisloos. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-muted px-3 py-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
              Kleur = intensiteit
            </span>
            {[
              { z: 2, label: "Rustig (Z1–2)" },
              { z: 3, label: "Tempo (Z3)" },
              { z: 4, label: "Intervallen (Z4)" },
              { z: 5, label: "Vol gas (Z5+)" },
            ].map((it) => (
              <span key={it.z} className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: zoneDot(it.z) }}
                />
                <span className="text-[10px] text-muted-foreground">{it.label}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] text-muted-foreground">rust</span>
              <span className="text-[10px] text-muted-foreground">rustdag</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              Getal = belasting (TSS)
            </span>
          </div>
          {!hideRegenerate && (
            <button
              type="button"
              onClick={() => generate.mutate(undefined)}
              disabled={generate.isPending}
              className="mt-1.5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 font-sans text-[12px] font-medium text-muted-foreground transition-colors hover:border-cyan-300/25 hover:text-accent-cyan disabled:opacity-50"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Opnieuw opbouwen…
                </>
              ) : (
                <>
                  <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Plan opnieuw opbouwen
                </>
              )}
            </button>
          )}
        </div>
      )}

      <DayDetailDrawer
        date={selectedDate}
        workouts={workouts}
        open={dayOpen}
        onOpenChange={setDayOpen}
        onOpenWorkout={openWorkout}
      />
      <WorkoutDetailDrawer
        workoutId={selectedWorkout}
        open={workoutOpen}
        onOpenChange={setWorkoutOpen}
      />
      <FtpEstimateWizard
        open={ftpWizardOpen}
        onOpenChange={setFtpWizardOpen}
        weightKg={profile?.weightKg ? Number(profile.weightKg) : null}
        onSaved={() => setFtpWizardOpen(false)}
      />
    </section>
  )
}
