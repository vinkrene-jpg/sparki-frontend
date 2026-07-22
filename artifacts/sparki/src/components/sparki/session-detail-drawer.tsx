import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ACCENT } from "@/components/sparki/ui"
import type { TrainingSession } from "@/lib/athlete-types"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { analyzeSession, type InsightTone } from "@/lib/session-analysis"
import { useRideStory, useRideStoryFlag } from "@/hooks/use-ride-story"
import { RideStoryChapters } from "@/components/sparki/ride-story"
import { useSessionSegments, type RideSegment } from "@/hooks/use-sessions"
import { ShareRidePanel } from "@/components/sparki/share-ride"
import {
  Clock,
  Route as RouteIcon,
  Mountain,
  Gauge,
  Zap,
  HeartPulse,
  Activity,
  TrendingDown,
} from "lucide-react"

function fmtSegTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}u${String(m % 60).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")} min`
}

// Leesbaar verslag per interessant stuk van de rit (klimmen en afdalingen),
// met uitsluitend écht gemeten waarden — ontbrekende cijfers blijven weg.
function SegmentReport({ segments }: { segments: RideSegment[] }) {
  return (
    <div className="mt-6">
      <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
        ZO REED JE DE SEGMENTEN
      </span>
      <div className="mt-2 flex flex-col gap-2">
        {segments.map((seg, i) => {
          const isKlim = seg.kind === "klim"
          const facts: Array<[string, string]> = []
          if (seg.timeSec != null) facts.push(["Tijd", fmtSegTime(seg.timeSec)])
          if (seg.avgKmh != null) facts.push(["Gem.", `${seg.avgKmh} km/u`])
          if (!isKlim && seg.maxKmh != null)
            facts.push(["Top", `${seg.maxKmh} km/u`])
          if (seg.avgPowerW != null)
            facts.push(["Vermogen", `${seg.avgPowerW} W`])
          if (seg.avgHr != null) facts.push(["Hartslag", `${seg.avgHr} bpm`])
          if (isKlim && seg.vamMPerH != null)
            facts.push(["Klimtempo", `${seg.vamMPerH} m/u`])
          return (
            <div
              key={i}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isKlim ? (
                    <Mountain
                      className="h-4 w-4 shrink-0"
                      style={{ color: ACCENT }}
                      strokeWidth={1.75}
                    />
                  ) : (
                    <TrendingDown
                      className="h-4 w-4 shrink-0 text-white/50"
                      strokeWidth={1.75}
                    />
                  )}
                  <span className="text-[14px] font-medium text-white/90">
                    {seg.name}
                  </span>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-white/45">
                  {seg.lengthKm} km · {isKlim ? "+" : "−"}
                  {seg.elevationDeltaM} m · {Math.abs(seg.avgGradePct)}%
                </span>
              </div>
              {facts.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                  {facts.map(([label, value]) => (
                    <span
                      key={label}
                      className="text-[12px] tabular-nums text-white/65"
                    >
                      <span className="text-white/35">{label} </span>
                      {value}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] leading-snug text-white/40">
                  Het bestand van deze rit bevat geen tijden op dit stuk, dus
                  hier valt eerlijk gezegd niets over je tempo te zeggen.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const TONE_COLOR: Record<InsightTone, string> = {
  neutral: "rgba(255,255,255,0.4)",
  positive: ACCENT,
  caution: "rgba(255,180,90,0.9)",
}

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
  recentSessions = [],
}: {
  session: TrainingSession | null
  open: boolean
  onOpenChange: (open: boolean) => void
  recentSessions?: TrainingSession[]
}) {
  const { data: profile } = useAthleteExtendedProfile()
  // Rit-verhaal (flag `rit_verhaal`): when the story is available it replaces
  // the loose analysis + metrics blocks with the four chapters. Flag off (or
  // story unavailable) keeps the existing drawer untouched.
  const storyFlagOn = useRideStoryFlag()
  const { data: story } = useRideStory(
    storyFlagOn && open && session ? session.id : null,
  )
  // Segmentverslag: klimmen/afdalingen met echte prestatie uit het gekoppelde
  // ritbestand. Alleen tonen als ze er echt zijn — geen lege beloftes.
  const { data: segments } = useSessionSegments(
    open && session ? session.id : null,
  )
  const showStory = storyFlagOn && story != null && session?.id === story.session.id
  const analysis = session
    ? analyzeSession(session, profile, recentSessions)
    : null
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

            {showStory && story ? (
              <div className="mt-5">
                <RideStoryChapters story={story} />
              </div>
            ) : (
              <>
            {analysis && analysis.insights.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
                <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-300/70">
                  HOE DEZE RIT GING
                </span>
                <div className="mt-3 flex flex-col gap-3">
                  {analysis.insights.map((ins, i) => (
                    <div key={i}>
                      <span
                        className="font-mono text-[9px] uppercase tracking-[0.16em]"
                        style={{ color: TONE_COLOR[ins.tone] }}
                      >
                        {ins.label}
                      </span>
                      <p className="mt-0.5 text-pretty text-[13px] leading-relaxed text-white/70">
                        {ins.text}
                      </p>
                    </div>
                  ))}
                </div>
                {analysis.missing && (
                  <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
                    {analysis.missing}
                  </p>
                )}
              </div>
            ) : analysis && analysis.missing ? (
              <p className="mt-5 text-pretty text-[13px] leading-relaxed text-white/45">
                {analysis.missing}
              </p>
            ) : null}

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
              </>
            )}

            {segments != null && segments.length > 0 && (
              <SegmentReport segments={segments} />
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

            <ShareRidePanel session={session} open={open} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
