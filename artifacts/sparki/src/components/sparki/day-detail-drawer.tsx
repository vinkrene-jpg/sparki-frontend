import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ACCENT } from "@/components/sparki/ui"
import { AddTrainingButton } from "@/components/sparki/add-training"
import type { PlannedWorkout, WorkoutRouteNeed } from "@/lib/athlete-types"
import { Bike, Activity, Zap, Moon, ChevronRight, Gauge, Clock, X } from "lucide-react"

const routeNeedShort: Record<WorkoutRouteNeed, string> = {
  outdoor_long: "Lange buitenrit",
  outdoor: "Buiten",
  indoor_ok: "Binnen / buiten",
  none: "Rust",
}

function typeIcon(type: string) {
  if (type === "ride") return Bike
  if (type === "run") return Activity
  if (type === "rest") return Moon
  return Zap
}

const statusLabel: Record<string, string> = {
  planned: "Gepland",
  modified: "Aangepast",
  completed: "Voltooid",
  skipped: "Gemist",
}

export function DayDetailDrawer({
  date,
  workouts,
  open,
  onOpenChange,
  onOpenWorkout,
}: {
  date: string | null
  workouts: PlannedWorkout[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenWorkout: (id: number) => void
}) {
  const dayWorkouts = date
    ? workouts.filter((w) => w.scheduledDate === date)
    : []

  const totalTss = dayWorkouts.reduce((sum, w) => sum + (w.targetTSS ?? 0), 0)
  const totalMin = dayWorkouts.reduce(
    (sum, w) => sum + (w.targetDurationMin ?? 0),
    0,
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-white/[0.08] bg-[#05070e]/95 p-0 backdrop-blur-xl sm:max-w-md"
      >
        <div className="flex flex-col gap-6 px-6 pb-16 pt-7">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="-ml-1 flex w-fit items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-white/45 transition-colors hover:text-white/80"
            aria-label="Sluiten"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            SLUITEN
          </button>
          <SheetHeader className="space-y-2 text-left">
            <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
              DAGOVERZICHT
            </p>
            <SheetTitle className="font-sans text-2xl font-extralight leading-tight tracking-tight text-white">
              {date
                ? new Date(date + "T12:00:00Z").toLocaleDateString("nl-NL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })
                : ""}
            </SheetTitle>
            {dayWorkouts.length > 0 && totalMin > 0 && (
              <div className="flex items-center gap-4 pt-1">
                <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-white/50">
                  <Clock className="h-3 w-3" strokeWidth={1.75} />
                  {totalMin} min
                </span>
                <span
                  className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums"
                  style={{ color: ACCENT }}
                >
                  <Gauge className="h-3 w-3" strokeWidth={1.75} />
                  {totalTss} TSS
                </span>
              </div>
            )}
          </SheetHeader>

          {dayWorkouts.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                <Moon className="h-5 w-5 text-white/25" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] text-white/35">Niets gepland deze dag</p>
              {date && <AddTrainingButton variant="inline" contextDate={date} />}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {dayWorkouts.map((w) => {
                const Icon = typeIcon(w.type)
                const route = w.structure?.routeNeed
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onOpenWorkout(w.id)}
                    className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/25"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor: "rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <Icon
                        className="h-4.5 w-4.5"
                        style={{ color: ACCENT }}
                        strokeWidth={1.75}
                      />
                    </span>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-sans text-[15px] font-light text-white/90">
                        {w.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {w.structure?.intensity && (
                          <span className="font-mono text-[10px] tracking-wide text-cyan-300/70">
                            {w.structure.intensity}
                          </span>
                        )}
                        {w.targetDurationMin ? (
                          <>
                            <span className="h-1 w-1 rounded-full bg-white/20" />
                            <span className="font-mono text-[10px] text-white/40">
                              {w.targetDurationMin}m
                            </span>
                          </>
                        ) : null}
                        {w.targetTSS ? (
                          <>
                            <span className="h-1 w-1 rounded-full bg-white/20" />
                            <span className="font-mono text-[10px] text-white/40">
                              {w.targetTSS} TSS
                            </span>
                          </>
                        ) : null}
                        {route && route !== "none" && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-white/20" />
                            <span className="font-mono text-[10px] text-white/40">
                              {routeNeedShort[route]}
                            </span>
                          </>
                        )}
                      </div>
                      {w.status !== "planned" && (
                        <span
                          className="mt-1.5 inline-block rounded-full px-2 py-0.5 font-mono text-[8px] tracking-[0.15em]"
                          style={{
                            background:
                              w.status === "completed"
                                ? "rgba(120,210,230,0.12)"
                                : "rgba(255,255,255,0.06)",
                            color:
                              w.status === "completed"
                                ? ACCENT
                                : "rgba(255,255,255,0.5)",
                          }}
                        >
                          {(statusLabel[w.status] ?? w.status).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-cyan-300/60"
                      strokeWidth={1.75}
                    />
                  </button>
                )
              })}
              {date && <AddTrainingButton variant="inline" contextDate={date} />}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
