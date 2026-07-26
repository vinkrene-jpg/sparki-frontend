// "Huidig" — 1-op-1 extractie van de echte CommercialToday (CUX_02A) uit
// artifacts/sparki/src/components/sparki/commercial-shell.tsx, met alleen:
//  - wouter vervangen door gewone <a>-elementen (geen router in de sandbox);
//  - de drie data-hooks vervangen door de gedeelde demogegevens in ./_lib.
// De opbouw, klassen, tokens en copy zijn identiek aan de app.

import "./_tokens.css"
import {
  COMMERCIAL_COPY,
  COMMERCIAL_MOBILE_NAV,
  DECOR_BACKDROP,
  SEASON_PHASES,
  bandLabel,
  bandTone,
  buildBlockBars,
  buildSeasonView,
  buildWeekStrip,
  derivePresentationState,
  formatDayHeader,
  localISODate,
  movementLabel,
  nearestUpcomingRace,
  useAthleteDashboard,
  useRaces,
  useSparkiState,
  workoutPhaseLabel,
  type BandTone,
  type PresentationState,
} from "./_lib"

function DecorBackdrop({ soft = false }: { soft?: boolean }) {
  return (
    <svg
      viewBox={DECOR_BACKDROP.viewBox}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
      className={soft ? "c-decor c-decor-soft" : "c-decor"}
    >
      {DECOR_BACKDROP.paths.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

const PILL_STYLES: Record<BandTone, { background: string; color: string }> = {
  positive: { background: "#dff3e7", color: "#14603a" },
  watch: { background: "#fdf0d5", color: "#8a4b0f" },
  concern: { background: "#fbe4e4", color: "#982828" },
}

function BandPill({ band }: { band: string | null | undefined }) {
  const label = bandLabel(band)
  const tone = bandTone(band)
  if (!label || !tone) return null
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-semibold"
      style={PILL_STYLES[tone]}
    >
      {label}
    </span>
  )
}

function CommercialShell({
  band,
  children,
}: {
  band: string | null | undefined
  children: React.ReactNode
}) {
  const isActive = (href: string) => href === "/vandaag"

  return (
    <div className="commercial-light min-h-dvh font-sans">
      <header className="flex items-center justify-between px-5 pt-5">
        <span className="text-xs font-bold tracking-[0.3em]">SPARKI</span>
        <BandPill band={band} />
      </header>

      <main className="px-5 pb-28 pt-4">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex pb-[env(safe-area-inset-bottom)]"
        style={{ background: "var(--c-card)", borderTop: "1px solid var(--c-line)" }}
        aria-label="Hoofdmenu"
      >
        {COMMERCIAL_MOBILE_NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <a
              key={item.href}
              href="#"
              onClick={(e) => e.preventDefault()}
              className="flex-1 py-3.5 text-center text-[11px]"
              style={
                active
                  ? { color: "var(--c-accent-ink)", fontWeight: 700 }
                  : { color: "var(--c-ink-soft)" }
              }
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </a>
          )
        })}
      </nav>
    </div>
  )
}

function ReadinessCard({ presentation }: { presentation: PresentationState }) {
  const { data } = useSparkiState()

  const trend = movementLabel(data.movement.label)
  return (
    <section
      className="c-card c-hero p-5"
      data-atmosphere={presentation}
      aria-label="Toestand vandaag"
    >
      <DecorBackdrop />
      <div className="relative">
        <p className="text-xl font-semibold">{data.status}</p>
        {trend && (
          <p className="mt-2 text-sm" style={{ color: "var(--c-ink-soft)" }}>
            {trend}
          </p>
        )}
        <details className="mt-3">
          <summary
            className="cursor-pointer text-sm font-semibold"
            style={{ color: "var(--c-accent-ink)" }}
          >
            Bekijk onderbouwing
          </summary>
          <ul className="mt-2 space-y-1.5">
            {data.why.map((w) => (
              <li key={w.kind} className="text-sm">
                <span className="font-medium">{w.label}:</span>{" "}
                <span style={{ color: "var(--c-ink-soft)" }}>{w.reading}</span>
              </li>
            ))}
          </ul>
          {data.missing.length > 0 && (
            <p className="mt-2 text-sm" style={{ color: "var(--c-ink-soft)" }}>
              Ontbreekt nog: {data.missing.join(", ")}
            </p>
          )}
          <p className="mt-2 text-xs" style={{ color: "var(--c-ink-soft)" }}>
            Zekerheid: {data.confidenceLabel}
          </p>
        </details>
      </div>
    </section>
  )
}

function TrainingSection() {
  const { data } = useAthleteDashboard()

  const w = data.todayWorkout
  const goal = w.structure?.rationale?.supportsGoal ?? w.planDetails?.goal ?? null
  const bars = buildBlockBars(w.structure?.blocks)

  return (
    <section className="mt-6" aria-label="Training vandaag">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{w.title}</h2>
        {w.targetDurationMin != null && (
          <span
            className="shrink-0 text-sm font-semibold"
            style={{ color: "var(--c-accent-ink)" }}
          >
            {w.targetDurationMin} min
          </span>
        )}
      </div>
      <div className="c-card c-training mt-3 p-5">
        {goal && <p className="text-sm font-semibold">Doel: {goal}</p>}
        {w.description && (
          <p
            className={`text-sm ${goal ? "mt-1.5" : ""}`}
            style={{ color: "var(--c-ink-soft)" }}
          >
            {w.description}
          </p>
        )}
        {bars.length > 0 && (
          <div className="mt-4 flex h-9 gap-1.5" aria-hidden="true">
            {bars.map((b) => (
              <div
                key={b.key}
                className="rounded-md"
                style={{
                  flexGrow: b.flex,
                  flexBasis: 0,
                  background: b.accent ? "var(--c-accent)" : "#e8eef1",
                }}
              />
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="c-btn-primary"
          >
            Training bekijken
          </a>
        </div>
      </div>
    </section>
  )
}

function WeekStrip() {
  const { data } = useAthleteDashboard()
  const week = data.weekTSS
  if (week.length === 0) return null
  const strip = buildWeekStrip(week, localISODate())

  return (
    <div className="c-card mt-3 grid grid-cols-7 overflow-hidden">
      {strip.map((d, i) => (
        <div
          key={d.date}
          className="flex flex-col items-center gap-1 px-1 py-2.5"
          style={{
            borderLeft: i > 0 ? "1px solid var(--c-line)" : undefined,
            background: d.isToday ? "#e3f6fa" : undefined,
          }}
        >
          <span
            className="text-[10px]"
            style={
              d.isToday
                ? { color: "var(--c-accent-ink)", fontWeight: 700 }
                : { color: "var(--c-ink-soft)" }
            }
          >
            {d.label}
          </span>
          <span className="num text-sm">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

function SeasonBand() {
  const dash = useAthleteDashboard()
  const races = useRaces()
  const activePhase = workoutPhaseLabel(dash.data.todayWorkout?.structure?.phase)
  const goalRace = nearestUpcomingRace(races.data, localISODate())

  const view = buildSeasonView(goalRace, activePhase)

  if (view.kind === "empty") {
    return (
      <section className="mt-8" aria-label={COMMERCIAL_COPY.seasonTitle}>
        <h2 className="text-lg font-semibold">{COMMERCIAL_COPY.seasonTitle}</h2>
        <div className="c-card c-season mt-3 p-5">
          <DecorBackdrop soft />
          <div className="relative">
            <p className="text-sm" style={{ color: "var(--c-ink-soft)" }}>
              {COMMERCIAL_COPY.seasonEmpty}
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-8" aria-label={COMMERCIAL_COPY.seasonTitle}>
      <h2 className="text-lg font-semibold">{COMMERCIAL_COPY.seasonTitle}</h2>
      <div className="c-card c-season mt-3 p-5">
        <DecorBackdrop soft />
        <div className="relative">
          {view.showPhaseBand && (
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {SEASON_PHASES.map((p) => {
                const active = p === activePhase
                return (
                  <span
                    key={p}
                    className="pb-1 text-sm"
                    style={
                      active
                        ? {
                            fontWeight: 700,
                            borderBottom: "2px solid var(--c-accent-ink)",
                          }
                        : { color: "var(--c-ink-soft)" }
                    }
                  >
                    {p}
                  </span>
                )
              })}
            </div>
          )}
          <p
            className={`text-sm ${view.showPhaseBand ? "mt-4" : ""}`}
            style={{ color: "var(--c-ink-soft)" }}
          >
            {view.line}
          </p>
          <div className="mt-3 text-right">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-sm font-semibold"
              style={{ color: "var(--c-accent-ink)" }}
            >
              Volledig plan bekijken ›
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Current() {
  const state = useSparkiState()
  const dash = useAthleteDashboard()
  const races = useRaces()
  const planWeek = dash.data.todayWorkout?.structure?.week ?? null

  const todayISO = localISODate()
  const goalRace = nearestUpcomingRace(races.data, todayISO)
  const presentation = derivePresentationState({
    band: state.data.band,
    hasTodayWorkout: dash.data.todayWorkout != null,
    goalRaceIsToday: goalRace?.raceDate === todayISO,
  })

  return (
    <CommercialShell band={state.data.band}>
      <div className="mx-auto max-w-5xl">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Vandaag</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--c-ink-soft)" }}>
          {formatDayHeader()}
          {planWeek != null ? ` · trainingsweek ${planWeek}` : ""}
        </p>

        <div className="mt-5">
          <ReadinessCard presentation={presentation} />
          <TrainingSection />
          <section className="mt-8" aria-label="Deze week">
            <h2 className="text-lg font-semibold">Deze week</h2>
            <WeekStrip />
          </section>
          <SeasonBand />
        </div>
      </div>
    </CommercialShell>
  )
}
