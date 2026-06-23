import { useState } from "react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { useTrainingPlan, useGeneratePlan } from "@/hooks/use-training-plan"
import { DayDetailDrawer } from "@/components/sparki/day-detail-drawer"
import { WorkoutDetailDrawer } from "@/components/sparki/workout-detail-drawer"
import type { PlannedWorkout } from "@/lib/athlete-types"
import { Loader2, CalendarRange } from "lucide-react"

const DOW = ["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"]

function localDate(d: Date): string {
  return d.toISOString().split("T")[0]!
}

// Monday-aligned offset (JS getUTCDay: 0=Sun..6=Sat → 0=Mon..6=Sun).
function mondayIndex(dateStr: string): number {
  const day = new Date(dateStr + "T12:00:00Z").getUTCDay()
  return (day + 6) % 7
}

function zoneDot(zone: number): string {
  if (zone >= 5) return "rgba(255,140,80,0.9)"
  if (zone === 4) return "rgba(120,210,230,0.95)"
  if (zone === 3) return "rgba(255,220,100,0.7)"
  if (zone <= 1) return "rgba(255,255,255,0.25)"
  return "rgba(120,210,230,0.5)"
}

export function ThreeWeekPlan() {
  const { data: plan, isLoading } = useTrainingPlan(3)
  const generate = useGeneratePlan()

  const [dayOpen, setDayOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [workoutOpen, setWorkoutOpen] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState<number | null>(null)

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
      <SectionLabel n="00" title="Plan · 3 weken" />

      {isLoading ? (
        <div className="mt-5 flex items-center gap-2 text-[13px] text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Plan laden…
        </div>
      ) : !hasPlan ? (
        <div className="mt-5 flex flex-col items-center gap-5 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-6 py-10 text-center backdrop-blur-md">
          <SparkiCore size={40} accent={ACCENT} readiness={0.85} variant="orb" />
          <div>
            <p className="font-sans text-[15px] font-light text-white/85">
              Nog geen schema
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">
              Sparki bouwt een periodiseerd plan van 3 weken op basis van je FTP,
              wekelijkse uren en doel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => generate.mutate(undefined)}
            disabled={generate.isPending}
            className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-sans text-[13px] font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#040506" }}
          >
            {generate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Plan opbouwen…
              </>
            ) : (
              <>
                <CalendarRange className="h-4 w-4" strokeWidth={2} />
                Bouw mijn plan
              </>
            )}
          </button>
          {generate.isError && (
            <p className="text-[12px] text-red-300/70">
              {generate.error instanceof Error &&
              generate.error.message.includes("profile_incomplete")
                ? "Stel eerst je FTP en wekelijkse uren in zodat Sparki een schema kan opbouwen."
                : "Het opbouwen lukte niet. Probeer het opnieuw."}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-2.5">
          {/* DOW header */}
          <div className="grid grid-cols-7 gap-1.5 px-0.5">
            {DOW.map((d) => (
              <span
                key={d}
                className="text-center font-mono text-[9px] tracking-[0.15em] text-white/30"
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
                      <span className="font-mono text-[8px] tabular-nums text-white/35">
                        {w.targetTSS}
                      </span>
                    ) : (
                      <span className="font-mono text-[8px] text-white/20">
                        {isRest ? "rust" : ""}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          <button
            type="button"
            onClick={() => generate.mutate(undefined)}
            disabled={generate.isPending}
            className="mt-1.5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] py-2.5 font-sans text-[12px] font-medium text-white/45 transition-colors hover:border-cyan-300/25 hover:text-cyan-300/60 disabled:opacity-50"
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
    </section>
  )
}
