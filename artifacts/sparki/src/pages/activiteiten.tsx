import { useState } from "react"
import { Link } from "wouter"
import { HumorLine } from "@/components/sparki/humor-line"
import {
  Clock,
  Route as RouteIcon,
  Mountain,
  Zap,
  HeartPulse,
  Flame,
  ChevronRight,
  Activity as ActivityIcon,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer"
import { TrainingProgression } from "@/components/sparki/training-progression"
import { useSessions } from "@/hooks/use-sessions"
import { useLoad } from "@/hooks/use-load"
import type { TrainingSession } from "@/lib/athlete-types"

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

function typeLabel(t: string) {
  return TYPE_LABELS[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1)
}

function sourceLabel(s: string) {
  return SOURCE_LABELS[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1)
}

// Relative Dutch date — leads with the lived moment ("gisteren") before falling
// back to an absolute short date for older rides.
function relativeDate(iso: string) {
  const then = new Date(iso + "T12:00:00Z").getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Gisteren"
  if (days < 7) return `${days} dagen geleden`
  return new Date(iso + "T12:00:00Z").toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

type Metric = { icon: typeof Clock; value: string }

// Honest readback only — a metric chip is shown only when the value really
// exists on the session. Sessions store aggregates; per-second curves live in
// the detail view when stream data was imported. Nothing is fabricated here.
function sessionMetrics(s: TrainingSession): Metric[] {
  const out: Metric[] = []
  if (s.durationMin != null) out.push({ icon: Clock, value: `${s.durationMin} min` })
  if (s.distanceKm != null && s.distanceKm !== "")
    out.push({ icon: RouteIcon, value: `${s.distanceKm} km` })
  if (s.elevationM != null) out.push({ icon: Mountain, value: `${s.elevationM} hm` })
  if (s.normalizedPower != null)
    out.push({ icon: Zap, value: `${s.normalizedPower} W` })
  else if (s.avgPower != null) out.push({ icon: Zap, value: `${s.avgPower} W` })
  if (s.avgHR != null) out.push({ icon: HeartPulse, value: `${s.avgHR} bpm` })
  if (s.tss != null) out.push({ icon: Flame, value: `${s.tss} TSS` })
  return out
}

function ActivityCard({
  session,
  onOpen,
}: {
  session: TrainingSession
  onOpen: () => void
}) {
  const metrics = sessionMetrics(session)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">
            {relativeDate(session.sessionDate)}
          </p>
          <h3 className="mt-1 truncate text-[15px] font-semibold text-white">
            {session.title?.trim() || typeLabel(session.type)}
          </h3>
          {session.title?.trim() ? (
            <p className="mt-0.5 truncate text-xs text-white/45">
              {typeLabel(session.type)}
            </p>
          ) : null}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-cyan-300/70" />
      </div>

      {metrics.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {metrics.map((m, i) => {
            const Icon = m.icon
            return (
              <span
                key={i}
                className="flex items-center gap-1.5 text-[13px] text-white/75"
              >
                <Icon className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
                {m.value}
              </span>
            )
          })}
        </div>
      ) : (
        <p className="text-[13px] text-white/40">
          Nog geen meetgegevens bij deze rit.
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">
          {sourceLabel(session.source)}
        </span>
        {session.feelScore != null ? (
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-300/80">
            Gevoel {session.feelScore}/5
          </span>
        ) : null}
      </div>
    </button>
  )
}

export default function ActiviteitenPage() {
  const { data: sessions, isLoading, isError, refetch } = useSessions(40)
  const { data: load, isLoading: loadLoading } = useLoad()
  const [selected, setSelected] = useState<TrainingSession | null>(null)
  const [open, setOpen] = useState(false)

  const openSession = (s: TrainingSession) => {
    setSelected(s)
    setOpen(true)
  }

  return (
    <ScreenShell section="activiteiten">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Je ritten
          </h1>
          <Link href="/journey" className="text-[11px] text-cyan-300/80 hover:text-cyan-300">
            Journey
          </Link>
        </div>
        <p className="text-sm text-white/55">
          Al je ritten — wat je deed, hoe het ging. Tik op een rit
          voor de volledige uitlezing en analyse.
        </p>
      </div>

      {sessions && sessions.length > 0 ? (
        <section>
          <h2 className="text-base font-semibold tracking-tight text-white/90">
            Je ontwikkeling
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            Van je laatste ritten tot de afgelopen weken — zo bouw je op over
            tijd, niet alleen vandaag.
          </p>
          <TrainingProgression
            hideLabel
            sessions={sessions}
            chartData={load?.chartData}
            loading={isLoading || loadLoading}
          />
        </section>
      ) : null}

      {sessions && sessions.length > 0 ? (
        <h2 className="text-base font-semibold tracking-tight text-white/90">
          Alle ritten
        </h2>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
          <p className="text-sm text-white/70">
            Je ritten konden niet geladen worden. Controleer je verbinding en
            probeer het opnieuw.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-full bg-[oklch(0.82_0.16_200)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
          <ActivityIcon
            className="mx-auto h-8 w-8 text-white/25"
            strokeWidth={1.5}
          />
          <p className="mt-3 text-sm font-medium text-white">
            Nog geen ritten
          </p>
          <p className="mt-1 text-[13px] text-white/55">
            Koppel je fietscomputer of Strava, dan verschijnen je ritten hier
            vanzelf — met al je meetgegevens.
          </p>
          <HumorLine context="empty_training" className="mx-auto mt-2 max-w-xs" />
          <Link
            href="/you?focus=connections"
            className="mt-4 inline-block rounded-full bg-[oklch(0.82_0.16_200)] px-5 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Koppeling instellen
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <ActivityCard key={s.id} session={s} onOpen={() => openSession(s)} />
          ))}
        </div>
      )}

      <SessionDetailDrawer
        session={selected}
        open={open}
        onOpenChange={setOpen}
        recentSessions={sessions ?? []}
      />
    </ScreenShell>
  )
}
