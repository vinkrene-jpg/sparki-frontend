import { useLocation } from "wouter"
import { Flag, ChevronRight, CalendarPlus } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { LayerHeading } from "@/components/sparki/train/layer-heading"
import { useRaces } from "@/hooks/use-races"
import { daysUntil } from "@/lib/race-context"
import type { Race, RacePriority } from "@/lib/race-types"

const PRIORITY_LABEL: Record<RacePriority, string> = {
  A: "A-doel",
  B: "B-wedstrijd",
  C: "C-wedstrijd",
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

function countdownLabel(dateStr: string): string {
  const d = daysUntil(dateStr)
  if (d < 0) return "geweest"
  if (d === 0) return "vandaag"
  if (d === 1) return "morgen"
  if (d < 7) return `over ${d} dagen`
  const weeks = Math.round(d / 7)
  return weeks === 1 ? "over 1 week" : `over ${weeks} weken`
}

/**
 * Wedstrijden-laag — races no longer have their own nav tab, so the training
 * page surfaces the upcoming ones here (they are the yardstick the plan builds
 * toward). Shows only real, upcoming races with a drill-in to the full race
 * worksheet; honest empty-state routes straight to adding one. Never fabricated.
 */
export function RaceLayer() {
  const { data: races, isLoading } = useRaces()
  const [, navigate] = useLocation()

  const upcoming: Race[] = (races ?? [])
    .filter((r) => daysUntil(r.raceDate) >= 0)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
    .slice(0, 3)

  return (
    <section className="flex flex-col gap-4">
      <LayerHeading
        title="Wedstrijden"
        subtitle="Je doelen op de kalender — waar het plan naartoe werkt."
      />

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-2xl border border-border bg-muted" />
      ) : upcoming.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {upcoming.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate("/races")}
              className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"
                style={{ background: "rgba(120,210,230,0.08)" }}
              >
                <Flag className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[14px] font-medium text-foreground/90">
                    {r.name}
                  </p>
                  <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    {PRIORITY_LABEL[r.priority]}
                  </span>
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  {fmtDate(r.raceDate)}
                  <span className="h-1 w-1 rounded-full bg-muted" />
                  <span className="text-accent-cyan">{countdownLabel(r.raceDate)}</span>
                  {r.location && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-muted" />
                      <span className="truncate">{r.location}</span>
                    </>
                  )}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            </button>
          ))}

          <button
            type="button"
            onClick={() => navigate("/races")}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-border py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-accent-cyan hover:text-accent-cyan"
          >
            Alle wedstrijden & voorbereiding
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate("/races")}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left transition-colors hover:border-accent-cyan"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"
            style={{ background: "rgba(120,210,230,0.06)" }}
          >
            <CalendarPlus className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground/80">
              Nog geen wedstrijd gepland
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Zet je eerste doel op de kalender — dan stemt het plan zich erop af.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </button>
      )}
    </section>
  )
}
