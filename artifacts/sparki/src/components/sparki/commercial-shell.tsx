// Commerciële schil + Vandaag (flag: commercial_shell, default UIT) — op de
// centrale designsysteem-fundering (donker, premium, rustig; Figma-node 15:6,
// tokens/typografie/componenten uit docs/SPARKI_DESIGN_SYSTEM.md).
//
// Dit is uitsluitend presentatie: alle data komt uit de bestaande Vandaag-hooks
// (useAthleteDashboard, useSparkiState, useRaces) — geen nieuwe datastromen,
// geen verzonnen inhoud. Er bestaat geen 0–100-gereedheidsscore in Sparki, dus
// het scherm toont de echte band + statuszin van de State Engine met de
// volledige onderbouwing (signalen + wat ontbreekt) achter een uitklap.
//
// Inhoudshiërarchie (vast, van boven naar beneden):
//   1. sfeerkop — wielerfoto (decoratief, aria-hidden, donkere contrastlaag),
//      SPARKI-woordmerk en korte dagcontext;
//   2. de dominante coachboodschap (echte State-Engine-zin, data-atmosphere);
//   3. weeknavigatie via DsWeek (echte weekbelasting, geen verzonnen dagtypes);
//   4. training van vandaag (echte data of eerlijke lege toestand);
//   5. herstel & gereedheid (alleen echte waarden, onderbouwing uitklapbaar);
//   6. maximaal één primaire actie (in de trainingskaart, 44px).
// Mentale training komt op dit scherm niet voor (geen sterren-invuller).

import type { ReactNode } from "react"
import { Link, useLocation } from "wouter"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useSparkiState } from "@/hooks/use-sparki-state"
import { useRaces } from "@/hooks/use-races"
import { cn } from "@/lib/utils"
import {
  DsButton,
  DsCard,
  DsCardTitel,
  DsMobileNav,
  DsState,
  DsStatus,
  DsWeek,
  IconActiviteiten,
  IconChevron,
  IconHome,
  IconMenu,
  IconPlan,
  IconRijden,
  type DsNavItem,
  type LucideIcon,
} from "@/components/ds"
import {
  COMMERCIAL_ACCOUNT_NAV,
  COMMERCIAL_COPY,
  COMMERCIAL_DESKTOP_NAV,
  COMMERCIAL_MOBILE_NAV,
  SEASON_PHASES,
  bandLabel,
  bandStatusSoort,
  buildBlockBars,
  buildCoachMessage,
  buildSeasonView,
  buildWeekDays,
  derivePresentationState,
  formatDayHeader,
  localISODate,
  nearestUpcomingRace,
  trainingPrimaryLabel,
  workoutPhaseLabel,
  type PresentationState,
} from "@/lib/commercial-shell"

// Eén krachtige wielerfoto als sfeerlaag — de rustige, mistige rijder uit de
// conceptronde (donker, premium, past bij de Core-richting). Puur decoratief:
// alt="" + aria-hidden, met een donkere contrastlaag zodat tekst nooit op een
// druk fotodeel staat. Bestand: public/vandaag-sfeer.jpg (85 kB).
const HERO_FOTO = "/vandaag-sfeer.jpg"

// Sfeertint per presentatietoestand (CUX_02A) — uitsluitend tokenkleuren op
// lage alpha; kleur beweert nooit méér dan de tekst. Kwetsbaar (recovery) en
// onduidelijk (neutral) blijven het neutrale kaartoppervlak — bewust géén
// alarm-/roodtint in deze laag.
const ATMOSFEER_TINT: Record<PresentationState, string> = {
  ready: "bg-positive/[0.06]",
  training: "bg-accent-cyan/[0.06]",
  race: "bg-accent-cyan/[0.09]",
  recovery: "bg-surface",
  neutral: "bg-surface",
}

const MOBILE_NAV_ICONS: Record<string, LucideIcon> = {
  "/vandaag": IconHome,
  "/train": IconPlan,
  "/routes": IconRijden,
  "/activiteiten": IconActiviteiten,
  "/meer": IconMenu,
}

const MOBILE_NAV_ITEMS: DsNavItem[] = COMMERCIAL_MOBILE_NAV.map((item) => ({
  href: item.href,
  label: item.label,
  icon: MOBILE_NAV_ICONS[item.href] ?? IconMenu,
}))

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"

// ── Schil ────────────────────────────────────────────────────────────────────
// Gedeeld door alle Core-schermen in de commerciële schil (Vandaag, Plan,
// Activiteiten, Meer): vaste desktopnav + mobiele onderbalk. `actief` is het
// navigatiepad van het huidige scherm; alleen dat item krijgt de actieve
// markering. (/meer staat bewust niet in de desktopnav — daar is dan geen
// item actief, wat klopt: desktop bereikt die inhoud via losse navigatie.)
export function CommercialShell({
  actief,
  children,
}: {
  actief: string
  children: ReactNode
}) {
  const [, navigate] = useLocation()
  const isActive = (href: string) => href === actief

  return (
    <div className="min-h-dvh bg-app font-sans text-white">
      {/* Desktop — vaste linkernav met accountknop onderin */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-app-deep/80 backdrop-blur lg:flex">
        <div className="type-wordmark px-6 pt-7">SPARKI</div>
        <nav className="mt-8 flex flex-col gap-1 px-3" aria-label="Hoofdmenu">
          {COMMERCIAL_DESKTOP_NAV.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center rounded-lg px-3 type-action transition-colors",
                  FOCUS_RING,
                  active
                    ? "bg-surface-strong font-semibold text-accent-cyan"
                    : "text-white/60 hover:bg-surface hover:text-white/85",
                )}
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
            className={cn(
              "flex min-h-11 items-center rounded-lg px-3 type-action text-white/60 transition-colors hover:bg-surface hover:text-white/85",
              FOCUS_RING,
            )}
          >
            {COMMERCIAL_ACCOUNT_NAV.label}
          </Link>
        </div>
      </aside>

      <main className="pb-28 lg:ml-56 lg:pb-16">{children}</main>

      {/* Mobiel — onderbalk via het centrale designsysteem */}
      <div className="lg:hidden">
        <DsMobileNav
          items={MOBILE_NAV_ITEMS}
          actiefPad={actief}
          onNavigeer={(href) => navigate(href)}
        />
      </div>
    </div>
  )
}

// ── Kaart-bouwstenen ─────────────────────────────────────────────────────────
function SkeletonCard({ label }: { label: string }) {
  return (
    <DsCard className="mt-3">
      <p className="type-body text-content-secondary">{label}</p>
      <div
        className="mt-3 h-4 w-2/3 rounded bg-control motion-safe:animate-pulse"
        aria-hidden="true"
      />
    </DsCard>
  )
}

// ── 1+2 — Sfeerkop met foto, dagcontext en de dominante coachboodschap ──────
function HeroVandaag({
  presentation,
  planWeek,
}: {
  presentation: PresentationState
  planWeek: number | null
}) {
  return (
    <header className="relative overflow-hidden bg-app">
      <img
        src={HERO_FOTO}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-[50%_70%]"
      />
      {/* Donkere contrastlaag: foto ondersteunt, hindert tekst nooit. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-app/60 via-app/75 to-app"
      />
      <div className="relative mx-auto w-full max-w-2xl px-5 pb-8 pt-6 lg:max-w-3xl lg:px-10 lg:pt-10">
        <p className="type-wordmark lg:hidden">SPARKI</p>
        <h1 className="type-display mt-8 lg:mt-2">Vandaag</h1>
        <p className="type-body mt-1 text-content-secondary">
          {formatDayHeader()}
          {planWeek != null ? ` · trainingsweek ${planWeek}` : ""}
        </p>
        <CoachBoodschap presentation={presentation} />
      </div>
    </header>
  )
}

// De dominante coachboodschap — de echte State-Engine-zin, groot en rustig.
// CUX_02A: dit is het ene dominante element; de sfeertint (data-atmosphere)
// volgt de deterministische presentatietoestand, de tekst blijft leidend.
// Laad- en fouttoestand dragen bewust géén data-atmosphere.
function CoachBoodschap({ presentation }: { presentation: PresentationState }) {
  const { data, isLoading, isError, refetch } = useSparkiState()

  if (isLoading) {
    return (
      <div className="mt-8 rounded-card border border-border bg-surface p-card backdrop-blur">
        <p className="type-body text-content-secondary">
          {COMMERCIAL_COPY.stateLoading}
        </p>
        <div
          className="mt-3 h-5 w-3/4 rounded bg-control motion-safe:animate-pulse"
          aria-hidden="true"
        />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <DsState
        className="mt-8"
        soort="nietBeschikbaar"
        titel={COMMERCIAL_COPY.stateError}
        actie={{ label: COMMERCIAL_COPY.retry, onClick: () => void refetch() }}
      />
    )
  }

  // Dedupe-herschrijving (alleen het bekende dubbele paar) leeft in de pure
  // lib — hier alleen consumeren: hoofdzin + hoogstens één aanvullende regel.
  const { headline, subline } = buildCoachMessage(
    data.status,
    data.movement.label,
  )
  return (
    <section
      aria-label="Coachboodschap"
      data-atmosphere={presentation}
      className={cn(
        "mt-8 rounded-card border border-border p-card backdrop-blur",
        ATMOSFEER_TINT[presentation],
      )}
    >
      <p className="type-title-insight text-white/95">{headline}</p>
      {subline && (
        <p className="type-body mt-2 text-content-secondary">{subline}</p>
      )}
    </section>
  )
}

// ── 3 — Weeknavigatie (DsWeek, echte weekbelasting) ─────────────────────────
// Eerlijke statusafleiding in buildWeekDays: belasting of geplande training
// vandaag → "training", anders "leeg"; "herstel" wordt nooit verzonnen. Bij een
// dashboardfout toont de trainingssectie de ene eerlijke foutmelding — deze
// sectie verdwijnt dan (geen dubbele foutkaarten, geen fallbackdata).
function WeekSection() {
  const { data, isLoading, isError } = useAthleteDashboard()

  if (isError) return null

  return (
    <section className="mt-8" aria-label={COMMERCIAL_COPY.weekTitle}>
      <h2 className="type-title-card text-white/90">
        {COMMERCIAL_COPY.weekTitle}
      </h2>
      {isLoading || !data ? (
        <div
          className="mt-3 h-16 rounded-card border border-border bg-surface motion-safe:animate-pulse"
          aria-hidden="true"
        />
      ) : data.weekTSS.length === 0 ? (
        <DsState
          className="mt-3"
          soort="leeg"
          titel={COMMERCIAL_COPY.weekEmpty}
        />
      ) : (
        <DsWeek
          className="mt-3"
          dagen={buildWeekDays(
            data.weekTSS,
            localISODate(),
            data.todayWorkout != null,
          )}
        />
      )}
    </section>
  )
}

// ── 4 — Training van vandaag (+ 6: de ene primaire actie) ───────────────────
function TrainingSection() {
  const { data, isLoading, isError, refetch } = useAthleteDashboard()
  const [, navigate] = useLocation()

  if (isLoading) {
    return (
      <section className="mt-8" aria-label={COMMERCIAL_COPY.trainingTitle}>
        <h2 className="type-title-card text-white/90">
          {COMMERCIAL_COPY.trainingTitle}
        </h2>
        <SkeletonCard label={COMMERCIAL_COPY.trainingLoading} />
      </section>
    )
  }
  if (isError || !data) {
    return (
      <section className="mt-8" aria-label={COMMERCIAL_COPY.trainingTitle}>
        <h2 className="type-title-card text-white/90">
          {COMMERCIAL_COPY.trainingTitle}
        </h2>
        <DsState
          className="mt-3"
          soort="nietBeschikbaar"
          titel={COMMERCIAL_COPY.trainingError}
          actie={{
            label: COMMERCIAL_COPY.retry,
            onClick: () => void refetch(),
          }}
        />
      </section>
    )
  }

  const w = data.todayWorkout
  if (!w) {
    return (
      <section className="mt-8" aria-label={COMMERCIAL_COPY.trainingTitle}>
        <h2 className="type-title-card text-white/90">
          {COMMERCIAL_COPY.trainingTitle}
        </h2>
        <DsState
          className="mt-3"
          soort="leeg"
          titel={COMMERCIAL_COPY.noTraining}
          actie={{
            label: COMMERCIAL_COPY.noTrainingAction,
            onClick: () => navigate(COMMERCIAL_COPY.noTrainingActionHref),
          }}
        />
      </section>
    )
  }

  const goal = w.structure?.rationale?.supportsGoal ?? w.planDetails?.goal ?? null
  const bars = buildBlockBars(w.structure?.blocks)
  // Rustdag: zelfde knop en zelfde route, alleen een eerlijke tekst.
  const primary = trainingPrimaryLabel(w.type)

  return (
    <section className="mt-8" aria-label={COMMERCIAL_COPY.trainingTitle}>
      <h2 className="type-title-card text-white/90">
        {COMMERCIAL_COPY.trainingTitle}
      </h2>
      <DsCard className="mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <DsCardTitel>{w.title}</DsCardTitel>
          {w.targetDurationMin != null && (
            <span className="num shrink-0 type-action text-accent-cyan">
              {w.targetDurationMin} min
            </span>
          )}
        </div>
        {goal && (
          <p className="type-body mt-2 font-medium text-white/90">
            Doel: {goal}
          </p>
        )}
        {w.description && (
          <p
            className={cn(
              "type-body text-content-secondary",
              goal ? "mt-1.5" : "mt-2",
            )}
          >
            {w.description}
          </p>
        )}
        {bars.length > 0 && (
          <div className="mt-4 flex h-9 gap-1.5" aria-hidden="true">
            {bars.map((b) => (
              <div
                key={b.key}
                className={cn(
                  "rounded-md",
                  b.accent ? "bg-accent-cyan" : "bg-control",
                )}
                style={{ flexGrow: b.flex, flexBasis: 0 }}
              />
            ))}
          </div>
        )}
        {/* 6 — maximaal één primaire actie op het hele scherm. */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <DsButton
            variant="primair"
            onClick={() => navigate(COMMERCIAL_COPY.trainingHref)}
          >
            <span className="lg:hidden">{primary.mobile}</span>
            <span className="hidden lg:inline">{primary.desktop}</span>
          </DsButton>
          <DsButton
            variant="secundair"
            className="hidden lg:inline-flex"
            onClick={() => navigate(COMMERCIAL_COPY.trainingSecondaryHref)}
          >
            {COMMERCIAL_COPY.trainingSecondary}
          </DsButton>
        </div>
      </DsCard>
    </section>
  )
}

// ── 5 — Herstel & gereedheid (alleen echte waarden) ─────────────────────────
// Bij een fout in de State-hook draagt de coachboodschap bovenin de ene
// eerlijke foutmelding mét herstelactie; deze sectie verdwijnt dan volledig —
// er worden nooit oude of verzonnen herstelwaarden getoond.
function HerstelSection() {
  const { data, isLoading, isError } = useSparkiState()

  if (isLoading) {
    return (
      <section className="mt-8" aria-label={COMMERCIAL_COPY.herstelTitle}>
        <h2 className="type-title-card text-white/90">
          {COMMERCIAL_COPY.herstelTitle}
        </h2>
        <SkeletonCard label={COMMERCIAL_COPY.stateLoading} />
      </section>
    )
  }
  if (isError || !data) return null

  const soort = bandStatusSoort(data.band)
  const label = bandLabel(data.band)

  return (
    <section className="mt-8" aria-label={COMMERCIAL_COPY.herstelTitle}>
      <h2 className="type-title-card text-white/90">
        {COMMERCIAL_COPY.herstelTitle}
      </h2>
      <DsCard className="mt-3">
        {label && soort && <DsStatus status={soort}>{label}</DsStatus>}
        <details className="group mt-3">
          <summary
            className={cn(
              "flex min-h-11 cursor-pointer list-none items-center gap-1.5 type-action text-accent-cyan [&::-webkit-details-marker]:hidden",
              FOCUS_RING,
            )}
          >
            <IconChevron
              className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
              aria-hidden="true"
            />
            {COMMERCIAL_COPY.onderbouwing}
          </summary>
          <ul className="mt-1 space-y-1.5">
            {data.why.map((w) => (
              <li key={w.kind} className="type-body">
                <span className="font-medium text-white/90">{w.label}:</span>{" "}
                <span className="text-content-secondary">{w.reading}</span>
              </li>
            ))}
            {data.why.length === 0 && (
              <li className="type-body text-content-secondary">
                {COMMERCIAL_COPY.geenSignalen}
              </li>
            )}
          </ul>
          {data.missing.length > 0 && (
            <p className="type-body mt-2 text-content-secondary">
              Ontbreekt nog: {data.missing.join(", ")}
            </p>
          )}
          <p className="type-body-sm mt-2 text-content-secondary">
            Zekerheid: {data.confidenceLabel}
          </p>
        </details>
      </DsCard>
    </section>
  )
}

// ── Seizoen in beeld ─────────────────────────────────────────────────────────
function SeasonBand() {
  const dash = useAthleteDashboard()
  const races = useRaces()
  const [, navigate] = useLocation()
  // Zelfde fouteerlijkheid als in CommercialToday: bij een dashboardfout
  // nooit een stale fase uit de cache tonen.
  const activePhase = workoutPhaseLabel(
    dash.isError ? null : dash.data?.todayWorkout?.structure?.phase,
  )
  const goalRace = nearestUpcomingRace(races.data, localISODate())

  const view = buildSeasonView(goalRace, activePhase)

  // Eerlijke lege toestand: zonder hoofddoel én zonder seizoensplan géén
  // faseband (die zou een plan suggereren dat er niet is) — alleen de melding
  // en één actie naar de bestaande wedstrijd-/doelenflow.
  if (view.kind === "empty") {
    return (
      <section className="mt-8" aria-label={COMMERCIAL_COPY.seasonTitle}>
        <h2 className="type-title-card text-white/90">
          {COMMERCIAL_COPY.seasonTitle}
        </h2>
        <DsState
          className="mt-3"
          soort="leeg"
          titel={COMMERCIAL_COPY.seasonEmpty}
          actie={{
            label: COMMERCIAL_COPY.seasonEmptyAction,
            onClick: () => navigate(COMMERCIAL_COPY.seasonEmptyActionHref),
          }}
        />
      </section>
    )
  }

  return (
    <section className="mt-8" aria-label={COMMERCIAL_COPY.seasonTitle}>
      <h2 className="type-title-card text-white/90">
        {COMMERCIAL_COPY.seasonTitle}
      </h2>
      <DsCard className="mt-3">
        {view.showPhaseBand && (
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {SEASON_PHASES.map((p) => {
              const active = p === activePhase
              return (
                <span
                  key={p}
                  className={cn(
                    "type-body pb-1",
                    active
                      ? "border-b-2 border-accent-cyan font-semibold text-white"
                      : "text-white/50",
                  )}
                >
                  {p}
                </span>
              )
            })}
          </div>
        )}
        <p
          className={cn(
            "type-body text-content-secondary",
            view.showPhaseBand && "mt-4",
          )}
        >
          {view.line}
        </p>
        <div className="mt-3 flex justify-end">
          <DsButton variant="tekst" onClick={() => navigate("/train")}>
            {COMMERCIAL_COPY.seasonPlanLink}
            <IconChevron aria-hidden="true" />
          </DsButton>
        </div>
      </DsCard>
    </section>
  )
}

// ── Vandaag in de commerciële schil ──────────────────────────────────────────
export function CommercialToday() {
  const state = useSparkiState()
  const dash = useAthleteDashboard()
  const races = useRaces()

  // Fouteerlijkheid: react-query kan isError combineren met eerder gecachete
  // data. Bij een fout in een bron mag ook geen oude (stale) waarde van die
  // bron meer meesturen — alles hieronder rekent daarom uitsluitend met
  // vertrouwde (niet-fout) data.
  const dashTrusted = dash.isError ? undefined : dash.data
  const stateTrusted = state.isError ? undefined : state.data
  const planWeek = dashTrusted?.todayWorkout?.structure?.week ?? null

  // CUX_02A: presentatietoestand deterministisch uit bestaande viewdata —
  // dezelfde hooks, geen nieuwe datastromen. Ontbrekende data blijft neutraal.
  const todayISO = localISODate()
  const goalRace = nearestUpcomingRace(races.data, todayISO)
  const presentation = derivePresentationState({
    band: stateTrusted?.band ?? null,
    hasTodayWorkout: dashTrusted?.todayWorkout != null,
    goalRaceIsToday: goalRace?.raceDate === todayISO,
  })

  return (
    <CommercialShell actief="/vandaag">
      <HeroVandaag presentation={presentation} planWeek={planWeek} />
      {/* Paginaspecifieke kolomindeling: op desktop twee kolommen (2:1),
          op mobiel ongewijzigd gestapeld. De CommercialShell-schil zelf
          blijft generiek — de kolomindeling leeft alleen in Vandaag. */}
      <div className="mx-auto w-full max-w-screen-xl px-5 lg:px-10">
        <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div>
            <WeekSection />
            <TrainingSection />
          </div>
          <div>
            <HerstelSection />
            <SeasonBand />
          </div>
        </div>
      </div>
    </CommercialShell>
  )
}
