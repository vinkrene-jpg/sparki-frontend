import React from "react"
import "./Strava.css"
import {
  COMMERCIAL_COPY,
  COMMERCIAL_MOBILE_NAV,
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
} from "./_lib"

function BottomNav() {
  const isActive = (href: string) => href === "/vandaag"

  return (
    <nav className="sp-nav" aria-label="Hoofdmenu">
      {COMMERCIAL_MOBILE_NAV.map((item) => {
        const active = isActive(item.href)
        return (
          <a
            key={item.href}
            href="#"
            onClick={(e) => e.preventDefault()}
            className="sp-nav-item"
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}

function ReadinessHero() {
  const { data } = useSparkiState()
  const dash = useAthleteDashboard()
  
  const trend = movementLabel(data.movement.label)
  const bandText = bandLabel(data.band)
  const tone = bandTone(data.band)
  const isPositive = tone === "positive"

  const planWeek = dash.data.todayWorkout?.structure?.week ?? null

  return (
    <section 
      className="sp-hero" 
      style={{ backgroundImage: `url('/__mockup/images/sparki-strava-hero.png')` }}
      aria-label="Toestand vandaag"
    >
      <div className="sp-top-bar">
        <div>
          <div className="sp-brand text-lg">SPARKI</div>
          <div className="text-xs font-bold uppercase tracking-wider mt-1 opacity-80">
            {formatDayHeader()} {planWeek && `// WEEK ${planWeek}`}
          </div>
        </div>
      </div>

      <div className="sp-hero-content">
        {bandText && (
          <div className="sp-status-indicator mb-2">
            <span 
              className="sp-status-dot" 
              style={{ 
                backgroundColor: isPositive ? 'var(--sp-success)' : 'var(--sp-accent)',
                boxShadow: `0 0 12px ${isPositive ? 'var(--sp-success)' : 'var(--sp-accent)'}`
              }} 
            />
            <span style={{ color: isPositive ? 'var(--sp-success)' : 'var(--sp-accent)' }}>
              {bandText}
            </span>
          </div>
        )}
        
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">
          {data.status}
        </h1>
        
        {trend && (
          <p className="text-sm font-semibold text-[var(--sp-text-muted)] border-l-2 border-[var(--sp-border)] pl-3 py-1 mb-4">
            {trend}
          </p>
        )}

        <details className="mt-2 group">
          <summary>Verdieping & Signalen</summary>
          <div className="mt-4 p-4 bg-[var(--sp-bg)] bg-opacity-80 backdrop-blur border border-[var(--sp-border)]">
            <ul className="space-y-3">
              {data.why.map((w) => (
                <li key={w.kind} className="text-sm">
                  <div className="font-bold text-[var(--sp-text-main)] uppercase text-xs tracking-wider mb-0.5">{w.label}</div>
                  <div className="text-[var(--sp-text-muted)] leading-snug">{w.reading}</div>
                </li>
              ))}
            </ul>
            {data.missing.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--sp-border)] text-xs text-[var(--sp-text-muted)]">
                <span className="font-bold uppercase tracking-wider text-[var(--sp-accent)]">Ontbreekt:</span> {data.missing.join(", ")}
              </div>
            )}
            <div className="mt-2 text-xs font-bold text-[var(--sp-text-muted)] uppercase tracking-wider">
              Zekerheid: <span className="text-[var(--sp-text-main)]">{data.confidenceLabel}</span>
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}

function WorkoutSection() {
  const { data } = useAthleteDashboard()
  const w = data.todayWorkout

  if (!w) {
    return (
      <section className="px-4 mt-6">
        <h2 className="sp-title-caps mb-3">Training</h2>
        <div className="sp-card-neutral flex flex-col items-center justify-center py-8 text-center">
          <p className="font-bold text-lg mb-2">{COMMERCIAL_COPY.noTraining}</p>
          <a href="#" onClick={e => e.preventDefault()} className="sp-btn mt-4 max-w-[200px]">
            {COMMERCIAL_COPY.noTrainingAction}
          </a>
        </div>
      </section>
    )
  }

  const goal = w.structure?.rationale?.supportsGoal ?? w.planDetails?.goal ?? null
  const bars = buildBlockBars(w.structure?.blocks)

  return (
    <section className="px-4 mt-8" aria-label="Training vandaag">
      <h2 className="sp-title-caps mb-3">Vandaag op het programma</h2>
      
      <div className="sp-card">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h3 className="text-xl font-extrabold leading-tight mb-1">{w.title}</h3>
            {goal && <p className="text-xs font-bold uppercase tracking-wide text-[var(--sp-accent)]">{goal}</p>}
          </div>
          
          {w.targetDurationMin != null && (
            <div className="text-right shrink-0">
              <div className="sp-number-large">{w.targetDurationMin}</div>
              <div className="text-[10px] font-bold text-[var(--sp-text-muted)] uppercase tracking-widest -mt-1">Minuten</div>
            </div>
          )}
        </div>

        {w.description && (
          <p className="text-sm leading-relaxed text-[var(--sp-text-muted)] mb-5 font-medium">
            {w.description}
          </p>
        )}

        {bars.length > 0 && (
          <div className="mb-5">
            <div className="text-[10px] font-bold text-[var(--sp-text-muted)] uppercase tracking-widest mb-2">Blokken</div>
            <div className="sp-block-track" aria-hidden="true">
              {bars.map((b) => (
                <div
                  key={b.key}
                  className="sp-block-segment"
                  style={{
                    flexGrow: b.flex,
                    flexBasis: 0,
                    background: b.accent ? "var(--sp-accent)" : "var(--sp-border)",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <a href="#" onClick={(e) => e.preventDefault()} className="sp-btn">
          Start Training
        </a>
      </div>
    </section>
  )
}

function WeekLoadSection() {
  const { data } = useAthleteDashboard()
  const week = data.weekTSS
  if (week.length === 0) return null
  const strip = buildWeekStrip(week, localISODate())

  // Calculate total TSS for the week so far for a big hero number
  const totalTSS = strip.reduce((sum, d) => sum + (d.value !== "—" ? parseInt(d.value, 10) : 0), 0)

  return (
    <section className="px-4 mt-8" aria-label="Deze week">
      <div className="flex justify-between items-end mb-3">
        <h2 className="sp-title-caps">Weekbelasting</h2>
        <div className="text-right">
          <span className="text-2xl font-black">{totalTSS}</span>
          <span className="text-xs font-bold text-[var(--sp-text-muted)] ml-1">TSS</span>
        </div>
      </div>
      
      <div className="sp-week-grid">
        {strip.map((d) => (
          <div
            key={d.date}
            className={`sp-day-col ${d.isToday ? "is-today" : ""}`}
          >
            <span className="sp-day-label">{d.label}</span>
            <span className="sp-day-val">{d.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function SeasonSection() {
  const dash = useAthleteDashboard()
  const races = useRaces()
  const activePhase = workoutPhaseLabel(dash.data.todayWorkout?.structure?.phase)
  const goalRace = nearestUpcomingRace(races.data, localISODate())

  const view = buildSeasonView(goalRace, activePhase)

  if (view.kind === "empty") {
    return (
      <section className="px-4 mt-8 mb-8" aria-label={COMMERCIAL_COPY.seasonTitle}>
        <h2 className="sp-title-caps mb-3">{COMMERCIAL_COPY.seasonTitle}</h2>
        <div className="sp-card-neutral">
          <p className="text-sm font-semibold text-[var(--sp-text-muted)]">{COMMERCIAL_COPY.seasonEmpty}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 mt-8 mb-8" aria-label={COMMERCIAL_COPY.seasonTitle}>
      <h2 className="sp-title-caps mb-3">{COMMERCIAL_COPY.seasonTitle}</h2>
      
      <div className="sp-card-neutral relative overflow-hidden">
        {view.showPhaseBand && activePhase && (
          <div className="absolute top-0 right-0 bg-[var(--sp-border)] px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-[var(--sp-text-muted)]">
            Fase: <span className="text-[var(--sp-text-main)]">{activePhase}</span>
          </div>
        )}
        
        <div className="pt-2">
          {goalRace ? (
            <>
              <div className="text-[10px] font-bold text-[var(--sp-accent)] uppercase tracking-widest mb-1">Hoofddoel</div>
              <div className="text-lg font-extrabold mb-1">{goalRace.name}</div>
              <div className="text-sm font-bold text-[var(--sp-text-muted)]">{formatDayHeader(new Date(goalRace.raceDate))}</div>
            </>
          ) : (
            <p className="text-sm font-semibold text-[var(--sp-text-muted)]">{view.line}</p>
          )}
        </div>
      </div>
    </section>
  )
}

export default function Strava() {
  return (
    <div className="theme-sporty-pride">
      <ReadinessHero />
      <div className="max-w-md mx-auto w-full">
        <WorkoutSection />
        <WeekLoadSection />
        <SeasonSection />
      </div>
      <BottomNav />
    </div>
  )
}
