// Race Mode overlay (task #4, step 4). The focused full-screen surface launched
// by the single START RACE MODE action. Strips everything to the essentials: a
// live countdown to the start, the key timings and a calm "go" message. Pure
// presentation over already-resolved race data — no live feeds.

import { useEffect } from "react"
import { ACCENT } from "@/components/sparki/ui"
import { RaceCountdown, EstimateTag } from "@/components/sparki/race/race-shared"
import { computeRaceDayTimings } from "@/lib/race-planner"
import type { Race } from "@/lib/race-types"

export function RaceModeOverlay({
  race,
  daysUntil,
  onClose,
}: {
  race: Race
  daysUntil: number
  onClose: () => void
}) {
  // Lock body scroll while the overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const timings = computeRaceDayTimings(race)

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col overflow-y-auto px-6 py-8"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #0a1622 0%, #05070e 60%, #03040a 100%)",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.3em] text-accent-cyan">
            RACE MODE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-muted"
          >
            Sluiten
          </button>
        </div>

        <h2 className="mt-6 font-sans text-xl font-light tracking-tight text-foreground/90">
          {race.name}
        </h2>

        <div className="mt-4">
          <RaceCountdown race={race} daysUntil={daysUntil} />
        </div>

        <div className="mt-6 space-y-2">
          {timings.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-border bg-muted px-4 py-3"
            >
              <span className="text-[13px] text-muted-foreground">{t.label}</span>
              <span className="flex items-center gap-2">
                <span
                  className="font-mono text-[15px] tabular-nums"
                  style={{ color: t.time ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.3)" }}
                >
                  {t.time ?? "—"}
                </span>
                {t.time && t.isEstimate && <EstimateTag />}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-8 text-center">
          <p className="font-sans text-lg font-light" style={{ color: ACCENT }}>
            Sterkte — vertrouw op je voorbereiding.
          </p>
          <p className="mt-1 font-mono text-[9px] tracking-[0.3em] text-muted-foreground">
            SPARKI PERFORMANCE CENTER
          </p>
        </div>
      </div>
    </div>
  )
}
