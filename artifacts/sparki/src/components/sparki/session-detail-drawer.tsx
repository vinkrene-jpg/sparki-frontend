import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ACCENT } from "@/components/sparki/ui"
import type { TrainingSession } from "@/lib/athlete-types"
import {
  Clock,
  Route as RouteIcon,
  Mountain,
  Gauge,
  Zap,
  HeartPulse,
  Activity,
} from "lucide-react"

const TYPE_LABELS: Record<string, string> = {
  endurance: "Duurtraining",
  duurtraining: "Duurtraining",
  interval: "Intervaltraining",
  intervals: "Intervaltraining",
  recovery: "Hersteltraining",
  herstel: "Hersteltraining",
  tempo: "Tempotraining",
  threshold: "Drempeltraining",
  race: "Wedstrijd",
  rest: "Rustdag",
  strength: "Krachttraining",
  other: "Training",
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Handmatig",
  sparki: "Sparki",
  strava: "Strava",
  import: "Import",
  garmin: "Garmin",
  wahoo: "Wahoo",
}

const FEEL_LABELS: Record<number, string> = {
  1: "Heel zwaar",
  2: "Zwaar",
  3: "Prima",
  4: "Goed",
  5: "Geweldig",
}

function typeLabel(t: string) {
  return TYPE_LABELS[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1)
}

function sourceLabel(s: string) {
  return SOURCE_LABELS[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1)
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-sans text-lg font-light tabular-nums text-white/90">
        {value}
      </p>
    </div>
  )
}

export function SessionDetailDrawer({
  session,
  open,
  onOpenChange,
}: {
  session: TrainingSession | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fullDate = session
    ? new Date(session.sessionDate + "T12:00:00Z").toLocaleDateString("nl-NL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : ""

  // Which real metrics do we actually have? Honest readback only.
  const metrics: Array<{ icon: typeof Clock; label: string; value: string }> =
    []
  if (session) {
    if (session.durationMin != null)
      metrics.push({
        icon: Clock,
        label: "Duur",
        value: `${session.durationMin} min`,
      })
    if (session.distanceKm != null && session.distanceKm !== "")
      metrics.push({
        icon: RouteIcon,
        label: "Afstand",
        value: `${session.distanceKm} km`,
      })
    if (session.elevationM != null)
      metrics.push({
        icon: Mountain,
        label: "Hoogtemeters",
        value: `${session.elevationM} m`,
      })
    if (session.tss != null)
      metrics.push({ icon: Activity, label: "TSS", value: `${session.tss}` })
    if (session.intensityFactor != null && session.intensityFactor !== "")
      metrics.push({
        icon: Gauge,
        label: "Intensiteit (IF)",
        value: session.intensityFactor,
      })
    if (session.avgPower != null)
      metrics.push({
        icon: Zap,
        label: "Gem. vermogen",
        value: `${session.avgPower} W`,
      })
    if (session.normalizedPower != null)
      metrics.push({
        icon: Zap,
        label: "Genormaliseerd",
        value: `${session.normalizedPower} W`,
      })
    if (session.avgHR != null)
      metrics.push({
        icon: HeartPulse,
        label: "Gem. hartslag",
        value: `${session.avgHR} bpm`,
      })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-white/10 bg-[#05070e] text-white sm:max-w-md"
      >
        {session && (
          <>
            <SheetHeader className="space-y-2 text-left">
              <span className="font-mono text-[10px] tracking-[0.22em] text-cyan-300/70">
                {fullDate}
              </span>
              <SheetTitle className="text-balance font-sans text-2xl font-extralight leading-tight tracking-tight text-white">
                {session.title ?? typeLabel(session.type)}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span
                  className="rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wide"
                  style={{
                    borderColor: "rgba(120,210,230,0.4)",
                    color: ACCENT,
                  }}
                >
                  {typeLabel(session.type)}
                </span>
                <span className="rounded-full border border-white/[0.12] px-2.5 py-1 font-mono text-[10px] tracking-wide text-white/50">
                  Bron: {sourceLabel(session.source)}
                </span>
              </div>
            </SheetHeader>

            {metrics.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {metrics.map((m) => (
                  <Metric
                    key={m.label}
                    icon={m.icon}
                    label={m.label}
                    value={m.value}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-5 text-pretty text-[13px] leading-relaxed text-white/45">
                Voor deze sessie is alleen de basis vastgelegd. Log meer details
                (duur, vermogen, hartslag) om je trainingen rijker terug te
                lezen.
              </p>
            )}

            {session.feelScore != null && (
              <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                  Hoe het voelde
                </span>
                <p className="mt-1 text-[14px] font-medium text-white/85">
                  {FEEL_LABELS[session.feelScore] ?? `${session.feelScore}/5`}
                </p>
              </div>
            )}

            {session.notes != null && session.notes.trim() !== "" && (
              <div className="mt-5">
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
                  NOTITIES
                </span>
                <p className="mt-2 whitespace-pre-line text-pretty text-[13px] leading-relaxed text-white/70">
                  {session.notes}
                </p>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
