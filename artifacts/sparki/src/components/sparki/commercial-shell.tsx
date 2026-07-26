// Commerciële lichte schil + Vandaag (flag: commercial_shell, default UIT).
// Eén responsieve AppShell voor mobiel (onderbalk) en desktop (vaste linkernav),
// naar Figma-frames 30:96 (mobiel 390×844) en 30:143 (desktop 1440×900).
//
// Dit is uitsluitend presentatie: alle data komt uit de bestaande Vandaag-hooks
// (useAthleteDashboard, useSparkiState, useRaces) — geen nieuwe datastromen,
// geen verzonnen inhoud. Er bestaat geen 0–100-gereedheidsscore in Sparki, dus
// de toestandkaart toont de echte band + statuszin van de State Engine met de
// volledige onderbouwing (signalen + wat ontbreekt) achter een uitklap.

import { Link, useLocation } from "wouter"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useSparkiState } from "@/hooks/use-sparki-state"
import { useRaces } from "@/hooks/use-races"
import {
  COMMERCIAL_ACCOUNT_NAV,
  COMMERCIAL_COPY,
  COMMERCIAL_DESKTOP_NAV,
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
  workoutPhaseLabel,
  type BandTone,
} from "@/lib/commercial-shell"

// ── Toestand-pil ─────────────────────────────────────────────────────────────
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

// ── Schil ────────────────────────────────────────────────────────────────────
function CommercialShell({
  band,
  children,
}: {
  band: string | null | undefined
  children: React.ReactNode
}) {
  const [location] = useLocation()
  const isActive = (href: string) =>
    href === "/vandaag" ? true : location.startsWith(href)

  return (
    <div className="commercial-light min-h-dvh font-sans">
      {/* Desktop — vaste linkernav met accountknop onderin */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col lg:flex"
        style={{ background: "var(--c-card)", borderRight: "1px solid var(--c-line)" }}
      >
        <div className="px-6 pt-7 text-sm font-bold tracking-[0.3em]">SPARKI</div>
        <nav className="mt-8 flex flex-col gap-1 px-3" aria-label="Hoofdmenu">
          {COMMERCIAL_DESKTOP_NAV.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm"
                style={
                  active
                    ? {
                        background: "#e3f6fa",
                        color: "var(--c-accent-ink)",
                        fontWeight: 600,
                      }
                    : { color: "var(--c-ink-soft)" }
                }
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto px-3 pb-6">
          <Link
            href={COMMERCIAL_ACCOUNT_NAV.href}
            className="block rounded-lg px-3 py-2 text-sm"
            style={{ color: "var(--c-ink-soft)" }}
          >
            {COMMERCIAL_ACCOUNT_NAV.label}
          </Link>
        </div>
      </aside>

      {/* Mobiel — kop met wordmark + toestand-pil */}
      <header className="flex items-center justify-between px-5 pt-5 lg:hidden">
        <span className="text-xs font-bold tracking-[0.3em]">SPARKI</span>
        <BandPill band={band} />
      </header>

      <main className="px-5 pb-28 pt-4 lg:ml-56 lg:px-10 lg:pb-16 lg:pt-8">
        {children}
      </main>

      {/* Mobiel — onderbalk */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ background: "var(--c-card)", borderTop: "1px solid var(--c-line)" }}
        aria-label="Hoofdmenu"
      >
        {COMMERCIAL_MOBILE_NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 py-3.5 text-center text-[11px]"
              style={
                active
                  ? { color: "var(--c-accent-ink)", fontWeight: 700 }
                  : { color: "var(--c-ink-soft)" }
              }
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

// ── Kaart-bouwstenen ─────────────────────────────────────────────────────────
function SkeletonCard({ label }: { label: string }) {
  return (
    <div className="c-card animate-pulse p-5">
      <p className="text-sm" style={{ color: "var(--c-ink-soft)" }}>
        {label}
      </p>
      <div
        className="mt-3 h-4 w-2/3 rounded"
        style={{ background: "var(--c-line)" }}
      />
    </div>
  )
}

function ErrorCard({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="c-card p-5">
      <p className="text-sm">{label}</p>
      <button type="button" className="c-btn-outline mt-3" onClick={onRetry}>
        Opnieuw proberen
      </button>
    </div>
  )
}

// ── Toestandkaart (echte State Engine, geen verzonnen score) ─────────────────
function ReadinessCard() {
  const { data, isLoading, isError, refetch } = useSparkiState()

  if (isLoading) return <SkeletonCard label="Je toestand wordt geladen…" />
  if (isError || !data)
    return (
      <ErrorCard
        label="Je toestand kon niet worden geladen."
        onRetry={() => void refetch()}
      />
    )

  // De band ("Belastbaar") staat al in de statuspil rechtsboven — de kaart
  // toont alleen de statuszin, zodat de status niet dubbel leest.
  const trend = movementLabel(data.movement.label)
  return (
    <section className="c-card p-5" aria-label="Toestand vandaag">
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
          {data.why.length === 0 && (
            <li className="text-sm" style={{ color: "var(--c-ink-soft)" }}>
              Nog geen signalen voor vandaag.
            </li>
          )}
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
    </section>
  )
}

// ── Trainingskaart ───────────────────────────────────────────────────────────
function TrainingSection() {
  const { data, isLoading, isError, refetch } = useAthleteDashboard()

  if (isLoading)
    return (
      <div className="mt-6">
        <SkeletonCard label="Je training wordt geladen…" />
      </div>
    )
  if (isError || !data)
    return (
      <div className="mt-6">
        <ErrorCard
          label="Je training kon niet worden geladen."
          onRetry={() => void refetch()}
        />
      </div>
    )

  const w = data.todayWorkout
  if (!w)
    return (
      <section className="mt-6" aria-label="Training vandaag">
        <div className="c-card p-5">
          <p className="text-base font-medium">{COMMERCIAL_COPY.noTraining}</p>
          <Link
            href={COMMERCIAL_COPY.noTrainingActionHref}
            className="c-btn-outline mt-3"
          >
            {COMMERCIAL_COPY.noTrainingAction}
          </Link>
        </div>
      </section>
    )

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
      <div className="c-card mt-3 p-5">
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
          <Link href="/train" className="c-btn-primary">
            <span className="lg:hidden">Training bekijken</span>
            <span className="hidden lg:inline">Training openen</span>
          </Link>
          <Link href="/kalender" className="c-btn-outline hidden lg:inline-flex">
            Planning aanpassen
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Deze week (echte weekbelasting uit het dashboard) ───────────────────────
function WeekStrip({ variant }: { variant: "mobile" | "desktop" }) {
  const { data } = useAthleteDashboard()
  const week = data?.weekTSS ?? []
  if (week.length === 0) {
    if (variant === "desktop")
      return (
        <p className="mt-3 text-sm" style={{ color: "var(--c-ink-soft)" }}>
          Nog geen weekbelasting bekend.
        </p>
      )
    return null
  }
  const strip = buildWeekStrip(week, localISODate())

  return (
    <div
      className={
        variant === "mobile" ? "mt-3 grid grid-cols-7 gap-1.5" : "mt-3 space-y-2"
      }
    >
      {strip.map((d) =>
        variant === "mobile" ? (
          <div
            key={d.date}
            className="c-card flex flex-col items-center gap-1 px-1 py-2.5"
            style={
              d.isToday
                ? { borderColor: "var(--c-accent-ink)", background: "#e3f6fa" }
                : undefined
            }
          >
            <span className="text-[10px]" style={{ color: "var(--c-ink-soft)" }}>
              {d.label}
            </span>
            <span className="num text-sm">{d.value}</span>
          </div>
        ) : (
          <div key={d.date} className="flex items-center justify-between text-sm">
            <span
              style={{
                color: d.isToday ? "var(--c-accent-ink)" : "var(--c-ink-soft)",
                fontWeight: d.isToday ? 700 : 400,
              }}
            >
              {d.label}
            </span>
            <span className="num">{d.value}</span>
          </div>
        ),
      )}
    </div>
  )
}

// ── Seizoen in beeld (desktop) ───────────────────────────────────────────────
function SeasonBand() {
  const dash = useAthleteDashboard()
  const races = useRaces()
  const activePhase = workoutPhaseLabel(
    dash.data?.todayWorkout?.structure?.phase,
  )
  const goalRace = nearestUpcomingRace(races.data, localISODate())

  const view = buildSeasonView(goalRace, activePhase)

  // Eerlijke lege toestand: zonder hoofddoel én zonder seizoensplan géén
  // faseband (die zou een plan suggereren dat er niet is) — alleen de melding
  // en één actie naar de bestaande wedstrijd-/doelenflow. Zichtbaar op mobiel
  // én desktop (Figma 30:96 / 30:143).
  if (view.kind === "empty") {
    return (
      <section className="mt-8" aria-label={COMMERCIAL_COPY.seasonTitle}>
        <h2 className="text-lg font-semibold">{COMMERCIAL_COPY.seasonTitle}</h2>
        <div className="c-card mt-3 p-5">
          <p className="text-sm" style={{ color: "var(--c-ink-soft)" }}>
            {COMMERCIAL_COPY.seasonEmpty}
          </p>
          <Link
            href={COMMERCIAL_COPY.seasonEmptyActionHref}
            className="c-btn-outline mt-3"
          >
            {COMMERCIAL_COPY.seasonEmptyAction}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-8" aria-label={COMMERCIAL_COPY.seasonTitle}>
      <h2 className="text-lg font-semibold">{COMMERCIAL_COPY.seasonTitle}</h2>
      <div className="c-card mt-3 p-5">
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
          <Link
            href="/train"
            className="text-sm font-semibold"
            style={{ color: "var(--c-accent-ink)" }}
          >
            Volledig plan bekijken ›
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Vandaag in de commerciële schil ──────────────────────────────────────────
export function CommercialToday() {
  const state = useSparkiState()
  const dash = useAthleteDashboard()
  const planWeek = dash.data?.todayWorkout?.structure?.week ?? null

  return (
    <CommercialShell band={state.data?.band}>
      <div className="mx-auto max-w-5xl">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Vandaag</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--c-ink-soft)" }}>
          {formatDayHeader()}
          {planWeek != null ? ` · trainingsweek ${planWeek}` : ""}
        </p>

        <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6">
          <div className="min-w-0">
            <ReadinessCard />
            <TrainingSection />
            {/* Mobiel — weekstrip onder de training */}
            <section className="mt-8 lg:hidden" aria-label="Deze week">
              <h2 className="text-lg font-semibold">Deze week</h2>
              <WeekStrip variant="mobile" />
            </section>
            <SeasonBand />
          </div>

          {/* Desktop — rechterkolom met toestand-pil en weekoverzicht */}
          <aside className="hidden lg:block">
            <div className="flex justify-end">
              <BandPill band={state.data?.band} />
            </div>
            <div className="c-card mt-3 p-5">
              <h2 className="text-base font-semibold">Deze week</h2>
              <WeekStrip variant="desktop" />
            </div>
          </aside>
        </div>
      </div>
    </CommercialShell>
  )
}
