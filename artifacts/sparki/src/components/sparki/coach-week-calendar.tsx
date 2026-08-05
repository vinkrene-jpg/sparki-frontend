// Weekkalender voor de coach-cockpit (Plannen-tab): zeven dagkolommen met de
// geplande trainingen van de sporter. Verplaatsen kan door slepen (tablet/
// desktop) of door tikken: eerst de training, dan de doeldag. Kopiëren gebruikt
// dezelfde doeldag-keuze via de bestaande herhaal-API — er bestaat géén tweede
// schrijfmechanisme naast de bestaande workout-endpoints.
//
// Alleen eigen coachtrainingen zijn verplaatsbaar; Sparki-/sportertrainingen
// staan er zichtbaar (visueel onderscheiden) maar zijn niet sleepbaar — de
// server weigert dat toch (403), dus de UI biedt die deur niet aan.

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Copy, Move, X } from "lucide-react"
import {
  useCoachWorkouts,
  useUpdateCoachWorkout,
  useRepeatCoachWorkout,
  type CoachWorkout,
} from "@/hooks/use-coach-cockpit"

function isoAddDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Maandag van de week waarin `offsetWeeks` t.o.v. vandaag valt (lokale dag). */
function mondayOf(offsetWeeks: number): Date {
  const d = new Date()
  const dow = (d.getDay() + 6) % 7 // ma=0 … zo=6
  d.setDate(d.getDate() - dow + offsetWeeks * 7)
  d.setHours(12, 0, 0, 0)
  return d
}

const DAY_NAMES = ["ma", "di", "wo", "do", "vr", "za", "zo"]

type MoveMode = { workout: CoachWorkout; kind: "verplaats" | "kopieer" } | null

export function CoachWeekCalendar({ athleteId }: { athleteId: string }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const monday = useMemo(() => mondayOf(weekOffset), [weekOffset])
  const from = isoAddDays(monday, 0)
  const to = isoAddDays(monday, 6)
  const today = isoAddDays(new Date(), 0)

  const { data, isLoading } = useCoachWorkouts(athleteId, from, to)
  const update = useUpdateCoachWorkout(athleteId)
  const repeat = useRepeatCoachWorkout(athleteId)
  const [mode, setMode] = useState<MoveMode>(null)
  const [dragId, setDragId] = useState<number | null>(null)

  const workouts = data?.workouts ?? []
  const byDate = useMemo(() => {
    const m = new Map<string, CoachWorkout[]>()
    for (const w of workouts) {
      const list = m.get(w.scheduledDate) ?? []
      list.push(w)
      m.set(w.scheduledDate, list)
    }
    return m
  }, [workouts])

  const busy = update.isPending || repeat.isPending

  function isOwn(w: CoachWorkout) {
    return w.source === "coach" && w.status !== "cancelled"
  }

  function dropOn(date: string, workout: CoachWorkout | null, kind: "verplaats" | "kopieer") {
    if (!workout || busy) return
    if (kind === "verplaats") {
      if (workout.scheduledDate !== date)
        update.mutate({ id: workout.id, scheduledDate: date })
    } else {
      repeat.mutate({ id: workout.id, dates: [date] })
    }
    setMode(null)
    setDragId(null)
  }

  const monthLabel = monday.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })

  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Weekkalender · {monthLabel}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            aria-label="Vorige week"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
            >
              Vandaag
            </button>
          )}
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label="Volgende week"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {mode && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-accent-cyan/25 bg-accent-cyan/[0.06] px-3 py-2 text-[12px] text-accent-cyan">
          {mode.kind === "verplaats" ? (
            <Move className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Copy className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">
            Tik op een dag om “{mode.workout.title}” te{" "}
            {mode.kind === "verplaats" ? "verplaatsen" : "kopiëren"}.
          </span>
          <button
            type="button"
            onClick={() => setMode(null)}
            aria-label="Annuleren"
            className="shrink-0 text-accent-cyan/70 hover:text-accent-cyan"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="mt-3 h-32 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => {
            const date = isoAddDays(monday, i)
            const items = byDate.get(date) ?? []
            const isToday = date === today
            const droppable = mode != null || dragId != null
            return (
              <div
                key={date}
                onDragOver={(e) => {
                  if (dragId != null) e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const w = workouts.find((x) => x.id === dragId) ?? null
                  if (w && isOwn(w)) dropOn(date, w, "verplaats")
                }}
                onClick={() => {
                  if (mode) dropOn(date, mode.workout, mode.kind)
                }}
                className={`min-h-[76px] rounded-xl border p-1.5 transition-colors ${
                  isToday ? "border-accent-cyan/35 bg-accent-cyan/[0.04]" : "border-border"
                } ${droppable ? "cursor-pointer hover:border-accent-cyan/45 hover:bg-accent-cyan/[0.06]" : ""}`}
              >
                <div className="flex items-baseline justify-between px-0.5">
                  <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${isToday ? "text-accent-cyan" : "text-muted-foreground"}`}>
                    {DAY_NAMES[i]}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {Number(date.slice(8, 10))}
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  {items.map((w) => {
                    const own = isOwn(w)
                    const cancelled = w.status === "cancelled"
                    return (
                      <div
                        key={w.id}
                        draggable={own && !busy}
                        onDragStart={(e) => {
                          e.stopPropagation()
                          setDragId(w.id)
                        }}
                        onDragEnd={() => setDragId(null)}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (mode) {
                            dropOn(date, mode.workout, mode.kind)
                            return
                          }
                          if (own) setMode({ workout: w, kind: "verplaats" })
                        }}
                        title={own ? "Sleep of tik om te verplaatsen" : "Niet aanpasbaar (geen eigen coachtraining)"}
                        className={`rounded-lg border px-1.5 py-1 text-[11px] leading-tight ${
                          cancelled
                            ? "border-border text-muted-foreground line-through opacity-60"
                            : own
                              ? "cursor-grab border-accent-cyan/30 bg-accent-cyan/[0.08] text-foreground/90 active:cursor-grabbing"
                              : "border-border bg-muted text-muted-foreground"
                        } ${dragId === w.id || mode?.workout.id === w.id ? "ring-1 ring-ring/50" : ""}`}
                      >
                        <span className="block truncate">{w.title}</span>
                        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                          {w.source === "coach" ? "Jij" : w.source === "sparki" || w.source === "ai" ? "Sparki" : w.source}
                          {w.targetDurationMin != null ? ` · ${w.targetDurationMin}m` : ""}
                        </span>
                        {own && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setMode({ workout: w, kind: "kopieer" })
                            }}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-accent-cyan"
                          >
                            <Copy className="h-3 w-3" /> Kopieer
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Sleep of tik je eigen trainingen om ze te verplaatsen; Sparki-trainingen
        zijn zichtbaar maar alleen door de sporter of Sparki aan te passen.
      </p>
    </div>
  )
}
