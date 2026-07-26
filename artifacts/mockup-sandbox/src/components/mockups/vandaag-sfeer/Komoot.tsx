import React from "react"
import "./Komoot.css"
import {
  COMMERCIAL_COPY,
  COMMERCIAL_MOBILE_NAV,
  SEASON_PHASES,
  bandLabel,
  bandTone,
  buildBlockBars,
  buildSeasonView,
  buildWeekStrip,
  formatDayHeader,
  localISODate,
  movementLabel,
  nearestUpcomingRace,
  useAthleteDashboard,
  useRaces,
  useSparkiState,
  workoutPhaseLabel,
  type BandTone,
} from "./_lib"

const BAND_COLORS: Record<BandTone, { bg: string; text: string }> = {
  positive: { bg: "#e2eedd", text: "#1b4028" },
  watch: { bg: "#fcedcd", text: "#7a4a11" },
  concern: { bg: "#fbe4e4", text: "#982828" },
}

function TopHeader({ band }: { band: string | null | undefined }) {
  const label = bandLabel(band)
  const tone = bandTone(band)

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-5 pt-12">
      <div className="flex flex-col">
        <span className="text-[10px] font-bold tracking-[0.25em] text-white/90">
          SPARKI
        </span>
        <span className="text-white text-xl font-medium shadow-sm drop-shadow-md">
          {formatDayHeader()}
        </span>
      </div>
      {label && tone && (
        <span
          className="rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-md"
          style={{
            backgroundColor: BAND_COLORS[tone].bg,
            color: BAND_COLORS[tone].text,
          }}
        >
          {label}
        </span>
      )}
    </header>
  )
}

function Hero() {
  return (
    <div className="relative h-[42vh] w-full overflow-hidden bg-[#2d3630]">
      <img
        src="/__mockup/images/komoot-hero.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
      {/* Dark gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-transparent" />
      {/* Fade into the background color at the bottom */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f4f2ec] to-transparent" />
    </div>
  )
}

function ReadinessCard() {
  const { data } = useSparkiState()
  const trend = movementLabel(data.movement.label)

  return (
    <section className="relative z-30 -mt-20 px-4" aria-label="Toestand vandaag">
      <div className="k-card p-6 border border-white">
        <h1 className="text-2xl font-bold leading-tight" style={{ color: "var(--k-forest)" }}>
          {data.status}
        </h1>
        
        {trend && (
          <p className="mt-3 text-[15px] font-medium" style={{ color: "var(--k-accent)" }}>
            {trend}
          </p>
        )}

        <details className="mt-5 group">
          <summary className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--k-ink-soft)" }}>
            <span className="group-open:rotate-90 transition-transform duration-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
            Waarom we dit zeggen
          </summary>
          <div className="mt-4 pl-6 border-l-2 border-[var(--k-line)] space-y-4">
            <ul className="space-y-3">
              {data.why.map((w) => (
                <li key={w.kind} className="text-sm">
                  <span className="block font-semibold" style={{ color: "var(--k-forest)" }}>{w.label}</span>
                  <span style={{ color: "var(--k-ink-soft)" }}>{w.reading}</span>
                </li>
              ))}
            </ul>
            
            {(data.missing.length > 0 || data.confidenceLabel) && (
              <div className="pt-3 border-t border-[var(--k-line)]">
                {data.missing.length > 0 && (
                  <p className="text-xs" style={{ color: "var(--k-ink-soft)" }}>
                    <strong className="font-semibold">Ontbreekt nog:</strong> {data.missing.join(", ")}
                  </p>
                )}
                {data.confidenceLabel && (
                  <p className="text-xs mt-1" style={{ color: "var(--k-ink-soft)" }}>
                    <strong className="font-semibold">Zekerheid:</strong> {data.confidenceLabel}
                  </p>
                )}
              </div>
            )}
          </div>
        </details>
      </div>
    </section>
  )
}

function TrainingSection() {
  const { data } = useAthleteDashboard()
  const w = data.todayWorkout
  
  if (!w) {
    return (
      <section className="px-4 mt-6">
        <div className="k-card p-6 text-center">
          <p className="font-medium">{COMMERCIAL_COPY.noTraining}</p>
          <a href="#" onClick={e=>e.preventDefault()} className="k-btn mt-4 w-full">
            {COMMERCIAL_COPY.noTrainingAction}
          </a>
        </div>
      </section>
    )
  }

  const goal = w.structure?.rationale?.supportsGoal ?? w.planDetails?.goal ?? null
  const blocks = w.structure?.blocks
  const bars = buildBlockBars(blocks)

  // Map zone to height percentage (1 to 5)
  const zoneHeight = (zone: number) => {
    switch (zone) {
      case 1: return "30%"
      case 2: return "45%"
      case 3: return "65%"
      case 4: return "85%"
      case 5: return "100%"
      default: return "30%"
    }
  }
  
  // Map zone to warm nature colors
  const zoneColor = (zone: number) => {
    switch (zone) {
      case 1: return "#a4b5a8" // soft sage
      case 2: return "#768c7c" // moss
      case 3: return "var(--k-accent)" // terracotta
      case 4: return "#b04423" // deep terracotta
      case 5: return "#852a10" // very intense
      default: return "#a4b5a8"
    }
  }

  return (
    <section className="px-4 mt-6" aria-label="Training vandaag">
      <div className="flex items-center justify-between mb-3 px-2">
        <h2 className="text-xl font-bold" style={{ color: "var(--k-forest)" }}>Jouw rit vandaag</h2>
      </div>
      
      <div className="k-card p-1">
        {/* Top graphic block */}
        <div className="bg-[#fcfaf7] rounded-t-[20px] p-5 pb-8 border-b border-[var(--k-line)]">
          <div className="flex justify-between items-start gap-4">
            <h3 className="text-xl font-bold leading-tight" style={{ color: "var(--k-forest)" }}>{w.title}</h3>
            {w.targetDurationMin != null && (
              <div className="flex flex-col items-end shrink-0">
                <span className="text-2xl font-bold" style={{ color: "var(--k-accent)" }}>{w.targetDurationMin}</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--k-ink-soft)]">minuten</span>
              </div>
            )}
          </div>

          {bars.length > 0 && blocks && (
            <div className="mt-8 k-block-container" aria-hidden="true">
              {bars.map((b, i) => {
                const zone = blocks[i]?.zone ?? 1;
                return (
                  <div
                    key={b.key}
                    className="k-block"
                    style={{
                      flexGrow: b.flex,
                      flexBasis: 0,
                      height: zoneHeight(zone),
                      backgroundColor: zoneColor(zone),
                      opacity: b.accent ? 1 : 0.8
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Info area */}
        <div className="p-5">
          {goal && (
            <p className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--k-accent)" }}>
              {goal}
            </p>
          )}
          {w.description && (
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--k-ink)" }}>
              {w.description}
            </p>
          )}
          
          <a href="#" onClick={e=>e.preventDefault()} className="k-btn w-full mt-6">
            Bekijk volledige route & plan
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
    <section className="px-4 mt-8" aria-label="Deze week">
      <h2 className="text-lg font-bold px-2 mb-3" style={{ color: "var(--k-forest)" }}>Belasting deze week</h2>
      <div className="k-card p-4">
        <div className="flex justify-between items-end gap-1">
          {strip.map((d) => {
            const hasLoad = d.value !== "—" && d.value !== "0";
            const val = parseInt(d.value) || 0;
            const heightPx = hasLoad ? Math.max(24, Math.min(60, val * 0.5)) : 8;
            
            return (
              <div key={d.date} className="flex flex-col items-center gap-2 flex-1">
                <div 
                  className="w-full max-w-[24px] rounded-full transition-all"
                  style={{
                    height: d.isToday ? '60px' : `${heightPx}px`,
                    backgroundColor: d.isToday ? 'var(--k-accent)' : (hasLoad ? 'var(--k-forest-soft)' : 'var(--k-line)'),
                    opacity: d.isToday ? 1 : 0.4
                  }}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: d.isToday ? "var(--k-accent)" : "var(--k-ink-soft)" }}>
                  {d.label}
                </span>
                <span className="text-[13px] font-semibold" style={{ color: d.isToday ? "var(--k-ink)" : "var(--k-ink-soft)" }}>
                  {hasLoad ? d.value : "—"}
                </span>
              </div>
            )
          })}
        </div>
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

  if (view.kind === "empty") return null

  return (
    <section className="px-4 mt-8 mb-6" aria-label={COMMERCIAL_COPY.seasonTitle}>
      <h2 className="text-lg font-bold px-2 mb-3" style={{ color: "var(--k-forest)" }}>Jouw horizon</h2>
      <div className="k-card p-5 bg-[var(--k-forest)] border border-[var(--k-forest-soft)] text-white">
        <div className="flex flex-col gap-3">
          {view.showPhaseBand && (
            <div className="flex gap-4">
              {SEASON_PHASES.map((p) => {
                const active = p === activePhase
                return (
                  <span
                    key={p}
                    className="text-sm font-semibold tracking-wide uppercase"
                    style={{
                      color: active ? "var(--k-surface)" : "rgba(255,255,255,0.3)",
                      borderBottom: active ? "2px solid var(--k-accent)" : "none",
                      paddingBottom: "4px"
                    }}
                  >
                    {p}
                  </span>
                )
              })}
            </div>
          )}
          
          <div className="mt-2 p-4 bg-black/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-[var(--k-accent)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
              </div>
              <p className="text-[15px] font-medium leading-relaxed">
                {view.line}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BottomNav() {
  return (
    <nav className="k-nav fixed inset-x-0 bottom-0 z-40 flex px-2 pt-2">
      {COMMERCIAL_MOBILE_NAV.map((item) => {
        const active = item.href === "/vandaag"
        return (
          <a
            key={item.href}
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2"
          >
            <div 
              className="h-1.5 w-1.5 rounded-full transition-colors"
              style={{ backgroundColor: active ? "var(--k-accent)" : "transparent" }}
            />
            <span
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: active ? "var(--k-forest)" : "var(--k-ink-soft)",
                fontWeight: active ? 700 : 600,
              }}
            >
              {item.label}
            </span>
          </a>
        )
      })}
    </nav>
  )
}

export default function Komoot() {
  const state = useSparkiState()

  return (
    <div className="komoot-buitengevoel">
      <TopHeader band={state.data.band} />
      <Hero />
      <main>
        <ReadinessCard />
        <TrainingSection />
        <WeekStrip />
        <SeasonSection />
      </main>
      <BottomNav />
    </div>
  )
}
