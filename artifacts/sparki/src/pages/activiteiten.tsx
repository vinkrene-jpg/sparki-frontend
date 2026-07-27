import { useMemo, useState } from "react"
import { Link, useLocation } from "wouter"
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
} from "lucide-react"
import { CommercialShell } from "@/components/sparki/commercial-shell"
import { DsButton, DsCard, DsState } from "@/components/ds"
import { HumorLine } from "@/components/sparki/humor-line"
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

// Relatieve datum: leidt met de beleefde ervaring ("gisteren") en valt
// terug op een korte absolute datum voor oudere ritten.
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

// Gemiddelde snelheid: opgeslagen waarde als die er is, anders echte
// wiskunde uit afstand en duur. Geen van beide aanwezig → geen chip.
function avgSpeed(s: TrainingSession): number | null {
  const stored = s.avgSpeedKph != null ? Number(s.avgSpeedKph) : NaN
  if (Number.isFinite(stored) && stored > 0) return stored
  const km =
    s.distanceKm != null && s.distanceKm !== "" ? Number(s.distanceKm) : NaN
  if (
    Number.isFinite(km) &&
    km > 0 &&
    s.durationMin != null &&
    s.durationMin > 0
  )
    return km / (s.durationMin / 60)
  return null
}

function formatKmh(v: number) {
  return `${(Math.round(v * 10) / 10).toLocaleString("nl-NL")} km/u`
}

// Eerlijke chips — alleen echte waarden, niets verzonnen.
function sessionMetrics(s: TrainingSession): Metric[] {
  const out: Metric[] = []
  if (s.durationMin != null)
    out.push({ icon: Clock, value: `${s.durationMin} min` })
  if (s.distanceKm != null && s.distanceKm !== "")
    out.push({ icon: RouteIcon, value: `${s.distanceKm} km` })
  const speed = avgSpeed(s)
  if (speed != null) out.push({ icon: Gauge, value: formatKmh(speed) })
  if (s.elevationM != null)
    out.push({ icon: Mountain, value: `${s.elevationM} hm` })
  if (s.normalizedPower != null)
    out.push({ icon: Zap, value: `${s.normalizedPower} W` })
  else if (s.avgPower != null)
    out.push({ icon: Zap, value: `${s.avgPower} W` })
  if (s.avgHR != null)
    out.push({ icon: HeartPulse, value: `${s.avgHR} bpm` })
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
      className="group flex w-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent-cyan/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-label text-accent-cyan/80 uppercase tracking-wider">
            {relativeDate(session.sessionDate)}
          </p>
          <h3 className="type-action mt-1 truncate text-white">
            {session.title?.trim() || typeLabel(session.type)}
          </h3>
          {session.title?.trim() ? (
            <p className="type-body-sm mt-0.5 truncate text-content-secondary">
              {typeLabel(session.type)}
            </p>
          ) : null}
          {/* Niet-fietsactiviteiten: eerlijk melden dat analyse beperkt is. */}
          {!isCyclingType(session.type) && (
            <p className="type-body-sm mt-0.5 truncate text-white/35">
              {unsupportedSportNote(session.type)}
            </p>
          )}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-content-secondary transition-colors group-hover:text-accent-cyan/70" />
      </div>

      {metrics.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {metrics.map((m, i) => {
            const Icon = m.icon
            return (
              <span
                key={i}
                className="flex items-center gap-1.5 type-body-sm text-white/75"
              >
                <Icon
                  className="h-3.5 w-3.5 text-content-secondary"
                  strokeWidth={1.75}
                />
                {m.value}
              </span>
            )
          })}
        </div>
      ) : (
        <p className="type-body-sm text-content-secondary">
          Nog geen meetgegevens bij deze rit.
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 type-label uppercase tracking-wider text-content-secondary">
          {sourceLabel(session.source)}
        </span>
        {session.feelScore != null ? (
          <span className="rounded-full border border-accent-cyan/20 bg-accent-cyan/[0.06] px-2 py-0.5 type-label uppercase tracking-wider text-accent-cyan/80">
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
  const [, navigate] = useLocation()
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

  const hasFilters =
    q.trim() !== "" || typeFilter != null || monthFilter != null

  return (
    <CommercialShell actief="/activiteiten">
      <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 lg:max-w-3xl lg:px-10">

        {/* Paginakop */}
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Activiteiten
            </h1>
            <p className="mt-1 type-body text-content-secondary">
              Al je ritten — wat je deed, hoe het ging.
            </p>
          </div>
          <Link
            href="/journey"
            className="type-label shrink-0 text-accent-cyan/80 hover:text-accent-cyan"
          >
            Jouw verhaal
          </Link>
        </header>

        {/* Trainingsverloop — alleen als er ritten zijn */}
        {sessions && sessions.length > 0 && (
          <section className="mb-8">
            <h2 className="type-title-card mb-3 text-white/90">
              Je ontwikkeling
            </h2>
            <p className="type-body-sm mb-4 text-content-secondary">
              Van je laatste ritten tot de afgelopen weken — zo bouw je op over
              tijd.
            </p>
            <TrainingProgression
              hideLabel
              sessions={sessions}
              chartData={load?.chartData}
              loading={isLoading || loadLoading}
            />
          </section>
        )}

        {/* Zoeken + filters: alleen bij bestaande ritten */}
        {sessions && sessions.length > 0 && (
          <section className="mb-6 flex flex-col gap-3">
            <h2 className="type-title-card text-white/90">Alle ritten</h2>

            <div className="flex flex-wrap items-center gap-2">
              {/* Zoekbalk */}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-secondary" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Zoek op titel, type of bron…"
                  className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 type-body-sm text-white/85 placeholder:text-content-secondary outline-none focus:border-accent-cyan/40"
                />
              </div>
              {/* Maandfilter */}
              <select
                value={monthFilter ?? ""}
                onChange={(e) => setMonthFilter(e.target.value || null)}
                className="rounded-xl border border-border bg-surface px-3 py-2 type-body-sm text-white/75 outline-none"
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

            {/* Release-1 typefilters: Alles + Fietsen.
                Wandelen/Hardlopen krijgen pas een eigen filter wanneer
                multisport expliciet is geactiveerd. */}
            {hasCyclingActivities && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTypeFilter(null)}
                  className={`rounded-full border px-3 py-1.5 type-label uppercase tracking-wider transition-colors ${
                    typeFilter == null
                      ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                      : "border-border bg-surface text-content-secondary hover:text-white/80"
                  }`}
                >
                  Alles
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTypeFilter(
                      typeFilter === FILTER_CYCLING ? null : FILTER_CYCLING,
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 type-label uppercase tracking-wider transition-colors ${
                    typeFilter === FILTER_CYCLING
                      ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                      : "border-border bg-surface text-content-secondary hover:text-white/80"
                  }`}
                >
                  Fietsen
                </button>
              </div>
            )}
          </section>
        )}

        {/* Inhoud: laden / fout / leeg / resultaten */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-border bg-surface"
              />
            ))}
          </div>
        ) : isError ? (
          <DsCard>
            <p className="type-body text-content-secondary">
              Je ritten konden niet geladen worden. Controleer je verbinding en
              probeer het opnieuw.
            </p>
            <DsButton
              variant="primair"
              className="mt-4"
              onClick={() => void refetch()}
            >
              Opnieuw proberen
            </DsButton>
          </DsCard>
        ) : !sessions || sessions.length === 0 ? (
          <>
            <DsState
              soort="leeg"
              titel="Nog geen ritten"
              beschrijving="Koppel je fietscomputer of Strava, dan verschijnen je ritten hier vanzelf — met al je meetgegevens."
              actie={{
                label: "Koppeling instellen",
                onClick: () => navigate("/you?focus=connections"),
              }}
            />
            <HumorLine
              context="empty_training"
              className="mt-3 text-center"
            />
          </>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 type-body text-content-secondary">
            {hasFilters
              ? "Geen ritten gevonden met deze zoekterm of filters."
              : "Geen ritten gevonden."}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {grouped.map(([key, list]) => (
              <section key={key} className="flex flex-col gap-3">
                <h3 className="type-label uppercase tracking-wider text-content-secondary">
                  {monthLabel(key)}
                  <span className="ml-2 tabular-nums text-white/25">
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
      </div>

      <SessionDetailDrawer
        session={selected}
        open={open}
        onOpenChange={setOpen}
        recentSessions={sessions ?? []}
      />
    </CommercialShell>
  )
}
