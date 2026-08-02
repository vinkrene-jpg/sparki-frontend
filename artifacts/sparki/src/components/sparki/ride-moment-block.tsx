import { useState } from "react"
import { ChevronDown, ChevronUp, Flag, Loader2 } from "lucide-react"
import { ACCENT, SectionLabel } from "@/components/sparki/ui"
import {
  useRideMoment,
  useRideStoryFlag,
  type RaceDayPayload,
} from "@/hooks/use-ride-story"
import { RideStoryChapters, SyncStatusLine } from "@/components/sparki/ride-story"

// Momentblok (Fase 1 "De keten", chain step 2) — phase-dependent block on
// Vandaag:
//   RACEDAG    — a race is on today's calendar, no race ride received yet.
//   RIT-BINNEN — an import arrived but the analysis hasn't produced a ride yet.
//   NA-RIT     — a fresh analysed ride leads (displaces the racedag block).
//
// Honesty rules:
// - The racedag card shows ONLY real race-row fields; weather appears only
//   when location + start time are known AND the forecast really resolved.
//   No generic race advice is ever generated.
// - The story card renders only with a real fresh imported ride (no placeholder).
// - When the athlete is ziek/geblesseerd the moment is suppressed server-side
//   (the health surface leads).
// - The sync-status line (chain step 1) stays visible independently of the
//   story: when a koppeling has really synced or failed, that honest status is
//   shown even without a fresh ride. With nothing real to say, nothing renders.
// - Flag-gated end-to-end: flipping `rit_verhaal` off removes this entirely.

function RaceDayCard({ raceDay }: { raceDay: RaceDayPayload }) {
  const r = raceDay.race
  const w = raceDay.weather

  const facts: string[] = []
  if (r.startTime) facts.push(`start ${r.startTime}`)
  if (r.distanceKm) facts.push(`${Number(r.distanceKm) % 1 === 0 ? Number(r.distanceKm) : r.distanceKm} km`)
  if (r.location) facts.push(r.location)
  if (r.raceType || r.discipline) facts.push(r.raceType ?? r.discipline!)

  return (
    <div className="mt-3 rounded-2xl border border-accent-cyan bg-card p-4 backdrop-blur-md">
      <div className="flex items-start gap-2.5">
        <Flag className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
            Vandaag wedstrijd
          </span>
          <p className="mt-1 text-[15px] font-medium text-foreground/90">{r.name}</p>
          {facts.length > 0 && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {facts.join(" · ")}
            </p>
          )}
          {r.notes && (
            <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-muted-foreground">
              {r.notes}
            </p>
          )}
        </div>
      </div>

      {/* Wedstrijdplan — only when real plan data exists on the race row */}
      {(r.coachInstructions || r.course) && (
        <div className="mt-3.5 rounded-xl border border-border bg-muted p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Je wedstrijdplan
          </p>
          {r.coachInstructions && (
            <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-muted-foreground">
              {r.coachInstructions}
            </p>
          )}
          {r.course && (
            <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-muted-foreground">
              Parcours: {r.course}
            </p>
          )}
        </div>
      )}

      {/* Weer — only shown when the forecast really resolved for the location */}
      {w?.available && w.weather && (
        <div className="mt-3 rounded-xl border border-border bg-muted p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Weer bij de start{w.locationLabel ? ` — ${w.locationLabel}` : ""}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {w.weather.label}
            {w.weather.tempMaxC != null &&
              ` · ${w.weather.tempMinC != null ? `${Math.round(w.weather.tempMinC)}–` : ""}${Math.round(w.weather.tempMaxC)} °C`}
            {w.weather.windMaxKmh != null && ` · wind tot ${Math.round(w.weather.windMaxKmh)} km/u`}
            {w.weather.precipProbMaxPct != null && ` · ${w.weather.precipProbMaxPct}% kans op neerslag`}
          </p>
          {w.advisory && w.advisory.severity !== "ok" && (
            <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-[color:var(--color-warning)]">
              {w.advisory.headline} — {w.advisory.detail}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function RideMomentBlock() {
  const flagOn = useRideStoryFlag()
  const { data } = useRideMoment()
  const [open, setOpen] = useState(true)

  if (!flagOn || !data) return null

  const syncHasContent =
    data.sync.hasConnection || data.sync.lastActivity != null || data.sync.lastSync != null

  // RACEDAG — race today, no race ride received yet.
  if (!data.suppressed && data.phase === "racedag" && data.raceDay) {
    return (
      <section className="mt-2">
        <SectionLabel title="Wedstrijddag" />
        <RaceDayCard raceDay={data.raceDay} />
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Nog geen wedstrijdactiviteit ontvangen.
          </p>
          {syncHasContent && <SyncStatusLine sync={data.sync} />}
        </div>
      </section>
    )
  }

  // RIT-BINNEN — an import arrived on race day, the analysis is not ready yet.
  if (!data.suppressed && data.phase === "verwerken" && data.raceDay) {
    return (
      <section className="mt-2">
        <SectionLabel title="Wedstrijddag" />
        <RaceDayCard raceDay={data.raceDay} />
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="flex items-center gap-2 text-[12px] leading-relaxed text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: ACCENT }} />
            Je rit is binnen — de analyse wordt klaargezet.
          </p>
          {syncHasContent && <SyncStatusLine sync={data.sync} />}
        </div>
      </section>
    )
  }

  const story = !data.suppressed ? data.story : null

  if (!story) {
    if (!syncHasContent) return null
    return (
      <section className="mt-2">
        <SectionLabel title="Je koppeling" />
        <div className="mt-2">
          <SyncStatusLine sync={data.sync} />
        </div>
      </section>
    )
  }

  const s = story.session
  const dateLabel = new Date(s.sessionDate + "T12:00:00Z").toLocaleDateString(
    "nl-NL",
    { weekday: "long", day: "numeric", month: "long" },
  )

  return (
    <section className="mt-2">
      <SectionLabel title="Je rit is binnen" />
      <div className="mt-2">
        <SyncStatusLine sync={data.sync} />
      </div>

      <div className="mt-3 rounded-2xl border border-accent-cyan bg-card p-4 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
              {story.race ? "Na je wedstrijd" : "Na je rit"}
            </span>
            <span className="mt-1 block text-[15px] font-medium text-foreground/90">
              {s.title ?? "Je rit"}
              <span className="text-muted-foreground"> · {dateLabel}</span>
            </span>
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        {open && (
          <div className="mt-4">
            <RideStoryChapters story={story} />
          </div>
        )}
      </div>
    </section>
  )
}
