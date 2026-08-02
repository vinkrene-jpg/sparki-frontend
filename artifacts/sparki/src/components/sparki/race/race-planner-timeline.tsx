// Race Day Planner — logistics timeline (task #4, step 5). Renders the computed
// backward-from-start timeline. Every clock time is a labeled estimate (EST).

import { useLocation } from "wouter"
import { ACCENT } from "@/components/sparki/ui"
import { EstimateTag } from "@/components/sparki/race/race-shared"
import { computeRaceTimeline, type TimelineStep } from "@/lib/race-planner"
import type { Race } from "@/lib/race-types"

export function RacePlannerTimeline({
  race,
  steps,
  title = "Race Day Planner",
}: {
  race: Race
  /** Optional pre-computed subset; defaults to the full timeline. */
  steps?: TimelineStep[]
  title?: string
}) {
  const [, navigate] = useLocation()
  const timeline = steps ?? computeRaceTimeline(race).steps
  const missingTravel = race.logistics?.travelDurationMin == null

  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground">
          {title.toUpperCase()}
        </span>
        <span className="font-mono text-[8px] tracking-[0.18em] text-muted-foreground">
          GESCHATTE TIJDEN
        </span>
      </div>

      <ol className="mt-4 space-y-0">
        {timeline.map((step, i) => {
          const last = i === timeline.length - 1
          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* connector + dot */}
              <div className="flex flex-col items-center">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: last ? ACCENT : "rgba(255,255,255,0.25)",
                    boxShadow: last ? `0 0 10px ${ACCENT}` : "none",
                  }}
                />
                {!last && <span className="mt-1 w-px flex-1 bg-muted" />}
              </div>
              <div className="-mt-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[14px] tabular-nums"
                    style={{ color: step.time ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}
                  >
                    {step.time ?? "—"}
                  </span>
                  {step.time && step.isEstimate && <EstimateTag />}
                </div>
                <p
                  className={`text-[13px] ${last ? "font-medium text-foreground/90" : "text-muted-foreground"}`}
                >
                  {step.label}
                </p>
                {step.note && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{step.note}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {missingTravel && (
        <button
          type="button"
          onClick={() => navigate("/races")}
          className="mt-2 w-full rounded-xl border border-border py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan transition-colors hover:bg-muted"
        >
          Reistijd invullen voor exacte tijden
        </button>
      )}
    </div>
  )
}
