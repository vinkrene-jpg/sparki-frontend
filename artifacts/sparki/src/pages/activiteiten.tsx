import { useMemo, useState } from "react"
import { Link } from "wouter"
import { HumorLine } from "@/components/sparki/humor-line"
import {
  Clock,
  Route as RouteIcon,
  Mountain,
  Zap,
  HeartPulse,
  Flame,
  Gauge,
  ChevronRight,
  Search,
  Activity as ActivityIcon,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer"
import { TrainingProgression } from "@/components/sparki/training-progression"
import { useSessions } from "@/hooks/use-sessions"
import { useLoad } from "@/hooks/use-load"
import type { TrainingSession } from "@/lib/athlete-types"
import {
  typeLabel,
  sourceLabel,
  isCyclingType,
  unsupportedSportNote,
  FILTER_CYCLING,
} from "@/lib/core-activiteiten"

// Relative Dutch date — leads with the lived moment ("gisteren") before falling
// back to an absolute short date for older rides.
function relativeDate(iso: string) {
  const then = new Date(iso + "T12:00:00Z").getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Gisteren"
  if (days < 7) return `${days} dagen geleden`
  const d = new Date(iso + "T12:00:00Z")
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  })
}

type MetricItem = { icon: React.ElementType; value: string }

function sessionMetrics(s: TrainingSession): MetricItem[] {
  const out: MetricItem[] = []
  if (s.durationMin != null)
    out.push({ icon: Clock, value: `${s.durationMin} min` })
  if (s.distanceKm != null)
    out.push({ icon: RouteIcon, value: `${s.distanceKm} km` })
  if (s.elevationM != null)
    out.push({ icon: Mountain, value: `${s.elevationM} m` })
  if (s.avgPower != null)
    out.push({ icon: Zap, value: `${s.avgPower} W` })
  if (s.avgHR != null)
    out.push({ icon: HeartPulse, value: `${s.avgHR} bpm` })
  if (s.intensityFactor != null)
    out.push({ icon: Gauge, value: `IF ${Number(s.intensityFactor).toFixed(2)}` })
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
      className="group flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan">
            {relativeDate(session.sessionDate)}
          </p>
          <h3 className="mt-1 truncate text-[15px] font-semibold text-foreground">
            {session.title?.trim() || typeLabel(session.type)}
          </h3>
          {session.title?.trim() ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {typeLabel(session.type)}
            </p>
          ) : null}
          {/* Niet-fietsactiviteiten: eerlijk aangeven dat analyse beperkt is. */}
          {!isCyclingType(session.type) && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {unsupportedSportNote(session.type)}
            </p>
          )}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent-cyan" />
      </div>

      {metrics.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {metrics.map((m, i) => {
            const Icon = m.icon
            return (
              <span
                key={i}
                className="flex items-center gap-1.5 text-[13px] text-foreground/75"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                {m.value}
              </span>
            )
          })}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Nog geen meetgegevens bij deze rit.
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {sourceLabel(session.source)}
        </span>
        {session.feelScore != null ? (
          <span className="rounded-full border border-accent-cyan/20 bg-accent-cyan/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-accent-cyan">
            Gevoel {session.feelScore}/5
          </span>
        ) : null}
      </div>
    </button>
  )
}

// Maandkop op basis van de lokale kalenderdag (sessionDate is een datum
// zonder tijd; middag-UTC voorkomt datumverschuiving rond middernacht).
function monthKey(iso: string) {
  const d = new Date(iso + "T12:00:00Z")
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number)
  const label = new Date(Date.UTC(y!, (m ?? 1) - 1, 15)).toLocaleDateString(
    "nl-NL",
    { month: "long", year: "numeric" },
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function ActiviteitenPage() {
  // Volledig archief: tijd-geordend met zoeken en filters. 500 is de eerlijke
  // servergrens — meer dan genoeg voor jaren aan ritten.
  const { data: sessions, isLoading, isError, refetch } = useSessions(500)
  const { data: load, isLoading: loadLoading } = useLoad()
  const [selected, setSelected] = useState<TrainingSession | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState<string | null>(null)

  const openSession = (s: TrainingSession) => {
    setSelected(s)
    setOpen(true)
  }

  // Release-1: alleen Alles + Fietsen als filteropties.
  const hasCyclingActivities = useMemo(
    () => (sessions ?? []).some((s) => isCyclingType(s.type)),
    [sessions],
  )

  const monthOptions = useMemo(() => {
    const keys = new Set<string>()
    for (const s of sessions ?? []) keys.add(monthKey(s.sessionDate))
    return [...keys].sort().reverse()
  }, [sessions])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (sessions ?? []).filter((s) => {
      if (typeFilter === FILTER_CYCLING) {
        if (!isCyclingType(s.type)) return false
      } else if (typeFilter) {
        if (s.type.toLowerCase() !== typeFilter) return false
      }
      if (monthFilter && monthKey(s.sessionDate) !== monthFilter) return false
      if (needle) {
        const hay = [s.title ?? "", typeLabel(s.type), sourceLabel(s.source)]
          .join(" ")
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [sessions, q, typeFilter, monthFilter])

  // Tijd-geordend archief: groepering per maand, nieuwste eerst.
  const grouped = useMemo(() => {
    const map = new Map<string, TrainingSession[]>()
    for (const s of filtered) {
      const key = monthKey(s.sessionDate)
      const list = map.get(key)
      if (list) list.push(s)
      else map.set(key, [s])
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [filtered])

  const hasFilters = q.trim() !== "" || typeFilter != null || monthFilter != null

  return (
    <ScreenShell bg="/atmosphere/training-renner-mistig-bos.webp" section="activiteiten">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Je ritten
          </h1>
          <Link href="/journey" className="text-[11px] text-accent-cyan hover:text-accent-cyan">
            Jouw verhaal
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Al je ritten — wat je deed, hoe het ging. Tik op een rit
          voor de volledige uitlezing en analyse.
        </p>
      </div>

      {sessions && sessions.length > 0 ? (
        <section>
          <h2 className="text-base font-semibold tracking-tight text-foreground/90">
            Je ontwikkeling
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
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
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground/90">
            Alle ritten
          </h2>
          {/* Zoeken + filters: alleen op echte velden (titel, type, bron). */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Zoek op titel, type of bron…"
                className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-[13px] text-foreground/85 placeholder:text-muted-foreground outline-none backdrop-blur-md focus:border-accent-cyan/40"
              />
            </div>
            <select
              value={monthFilter ?? ""}
              onChange={(e) => setMonthFilter(e.target.value || null)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-foreground/75 outline-none backdrop-blur-md"
              aria-label="Filter op maand"
            >
              <option value="">Alle maanden</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          {/* Release-1 filters: Alles + Fietsen. Wandelen/Hardlopen krijgen pas
              een eigen filter wanneer multisport expliciet is geactiveerd. */}
          {hasCyclingActivities ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter(null)}
                className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                  typeFilter == null
                    ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                    : "border-border bg-card text-muted-foreground hover:text-foreground/80"
                }`}
              >
                Alles
              </button>
              <button
                type="button"
                onClick={() =>
                  setTypeFilter(typeFilter === FILTER_CYCLING ? null : FILTER_CYCLING)
                }
                className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                  typeFilter === FILTER_CYCLING
                    ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                    : "border-border bg-card text-muted-foreground hover:text-foreground/80"
                }`}
              >
                Fietsen
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-border bg-muted"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
          <p className="text-sm text-muted-foreground">
            Je ritten konden niet geladen worden. Controleer je verbinding en
            probeer het opnieuw.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-full bg-accent-cyan px-4 py-2 text-sm font-semibold text-[color:var(--color-on-accent)] transition hover:brightness-110"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center backdrop-blur-md">
          <ActivityIcon
            className="mx-auto h-8 w-8 text-muted-foreground"
            strokeWidth={1.5}
          />
          <p className="mt-3 text-sm font-medium text-foreground">
            Nog geen ritten
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Koppel je fietscomputer of Strava, dan verschijnen je ritten hier
            vanzelf — met al je meetgegevens.
          </p>
          <HumorLine context="empty_training" className="mx-auto mt-2 max-w-xs" />
          <Link
            href="/you?focus=connections"
            className="mt-4 inline-block rounded-full bg-accent-cyan px-5 py-2 text-sm font-semibold text-[color:var(--color-on-accent)] transition hover:brightness-110"
          >
            Koppeling instellen
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-[13px] text-muted-foreground backdrop-blur-md">
          {hasFilters
            ? "Geen ritten gevonden met deze zoekterm of filters."
            : "Geen ritten gevonden."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([key, list]) => (
            <section key={key} className="flex flex-col gap-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {monthLabel(key)}
                <span className="ml-2 tabular-nums text-muted-foreground">
                  {list.length} {list.length === 1 ? "rit" : "ritten"}
                </span>
              </h3>
              {list.map((s) => (
                <ActivityCard
                  key={s.id}
                  session={s}
                  onOpen={() => openSession(s)}
                />
              ))}
            </section>
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
