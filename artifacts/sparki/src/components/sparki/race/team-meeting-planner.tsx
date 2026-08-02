// Team Meeting Planner (task #4, step 6). Shows the meeting point, shared carpool
// departure, the common venue-arrival target and per-rider departures. Only
// renders when the race has additional riders. All times are estimates.

import { ACCENT } from "@/components/sparki/ui"
import { EstimateTag } from "@/components/sparki/race/race-shared"
import { computeTeamPlan } from "@/lib/team-planner"
import type { Race } from "@/lib/race-types"

export function TeamMeetingPlanner({ race }: { race: Race }) {
  const plan = computeTeamPlan(race)
  if (!plan) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground">
          TEAM MEETING PLANNER
        </span>
        <span className="font-mono text-[8px] tracking-[0.18em] text-muted-foreground">
          GESCHATTE TIJDEN
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Tile label="Verzamelpunt" value={plan.meetingPoint ?? "Te bepalen"} mono={false} />
        <Tile label="Carpool vertrek" value={plan.sharedDeparture ?? "—"} estimate />
        <Tile label="Samen aankomst" value={plan.arrivalTarget ?? "—"} estimate />
      </div>

      <div className="mt-4 space-y-2">
        <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">
          PER RENNER
        </span>
        {plan.riders.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-border bg-muted px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] text-foreground/80">{r.name}</p>
              {r.startLocation && (
                <p className="truncate text-[11px] text-muted-foreground">{r.startLocation}</p>
              )}
            </div>
            <div className="flex items-center gap-2 pl-3">
              <span
                className="font-mono text-[13px] tabular-nums"
                style={{ color: r.departureTime ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}
              >
                {r.departureTime ?? "—"}
              </span>
              {r.departureTime && <EstimateTag />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  estimate = false,
  mono = true,
}: {
  label: string
  value: string
  estimate?: boolean
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-muted p-2.5 text-center">
      <span className="block font-mono text-[8px] tracking-[0.14em] text-muted-foreground">
        {label.toUpperCase()}
      </span>
      <span
        className={`mt-1 block ${mono ? "font-mono tabular-nums" : ""} text-[13px]`}
        style={{ color: value === "—" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)" }}
      >
        {value}
      </span>
      {estimate && value !== "—" && (
        <span className="mt-1 inline-block" style={{ color: ACCENT }}>
          <EstimateTag />
        </span>
      )}
    </div>
  )
}
