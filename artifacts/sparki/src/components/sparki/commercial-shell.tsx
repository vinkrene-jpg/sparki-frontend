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

import { useState, type ReactNode } from "react"
import { Link, useLocation } from "wouter"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useSparkiState } from "@/hooks/use-sparki-state"
import { useRaces } from "@/hooks/use-races"
import {
  useToday,
  useTodayInteraction,
  type TodayAction,
  type TodayItem,
} from "@/hooks/use-today"
import { TodayDebugPanel } from "@/components/sparki/role-today"
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
  IconAnalyse,
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
  buildHerstelPresentatie,
  buildSeasonView,
  buildWeekDays,
  derivePresentationState,
  formatDayHeader,
  localISODate,
  nearestUpcomingRace,
  relevantMissingLabels,
  trainingPrimaryLabel,
  workoutPhaseLabel,
  type BlockBar,
  type HerstelPresentatie,
  type PresentationState,
} from "@/lib/commercial-shell"

// Eén krachtige wielerfoto als sfeerlaag — de rustige, mistige rijder uit de
// conceptronde (donker, premium, past bij de Core-richting). Puur decoratief:
// alt="" + aria-hidden, met een donkere contrastlaag zodat tekst nooit op een
// druk fotodeel staat.
//
// Visual Atmosphere Layer — uit de centrale Atmosphere Library (lib/atmosphere-library.ts).
// Vandaag gebruikt VANDAAG_HERO_ID = "training-renster-bos": warm herfstlicht,
// vrouwelijke renner bergop, voldoende contrast voor tekst zonder zware overlay.
// Wijzig via VANDAAG_HERO_ID in atmosphere-library.ts — nooit rechtstreeks hier.
import { VANDAAG_HERO } from "@/lib/atmosphere-library"
const HERO_FOTO_WEBP = VANDAAG_HERO.webp
const HERO_FOTO = VANDAAG_HERO.png

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
  "/analyse": IconAnalyse,
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
// markering. Sinds Beslisblok 01 staan ook Wedstrijd en Meer in de desktopnav
// (Meer-overzicht is het desktop-equivalent van de mobiele Meer-knop).
export function CommercialShell({
  actief,
  bare = false,
  achtergrond,
  sfeer,
  children,
}: {
  actief: string
  /** Verberg zijbalk + onderbalk (onboarding, tester-welcome, wedstrijd-room). */
  bare?: boolean
  /**
   * Optionele achtergrondlaag (bijv. de cinematische scène van legacy-
   * hoofdstukken). Afwijken van de effen bg-app mag UITSLUITEND via deze
   * prop — nooit via een eigen shell of eigen full-screen achtergrond.
   */
  achtergrond?: ReactNode
  /**
   * Optionele subtiele sfeerfoto (pad uit de atmosphere-bibliotheek).
   * Wordt sterk gedimd gerenderd zodat data en tekst leesbaar blijven;
   * weglaten = rustige effen bg-app (bewuste keuze, geen default-foto).
   */
  sfeer?: string
  children: ReactNode
}) {
  const [, navigate] = useLocation()
  // Prefix-match zodat ook diepere paden (/train/…, /routes/…) het juiste
  // nav-item actief markeren — zelfde gedrag op desktop en mobiel.
  const isActive = (href: string) =>
    href === actief || (href.length > 1 && actief.startsWith(`${href}/`))

  return (
    // [overflow-x:clip] prevents page content from expanding the layout viewport,
    // which would shift the fixed bottom nav rightward on narrow screens.
    // clip (not hidden) avoids creating a scroll container so fixed children
    // keep their viewport-relative positioning.
    <div className="relative min-h-dvh bg-app font-sans text-white [overflow-x:clip]">
      {achtergrond}
      {sfeer && (
        // Sfeerfoto duidelijk zichtbaar, zonder uitvergroot te ogen: op mobiel
        // een vaste hoge band (16:9-foto verliest dan nauwelijks beeld i.p.v.
        // ~2,4× ingezoomd bij full-screen cover op een staand scherm), op
        // desktop paginavullend (verhouding komt daar vanzelf overeen).
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[62dvh] lg:inset-0 lg:h-auto"
          aria-hidden="true"
        >
          <img
            src={sfeer}
            alt=""
            className="h-full w-full object-cover object-top opacity-55 lg:object-center"
            loading="eager"
            decoding="async"
          />
          {/* Lichte dim + verloop naar bg-app: foto herkenbaar, data leesbaar */}
          <div className="absolute inset-0 bg-app/25" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-app/20 to-app" />
        </div>
      )}
      {/* Desktop — vaste linkernav met accountknop onderin */}
      {!bare && (
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
      )}

      <main className={cn("relative z-10 pb-28 lg:pb-16", !bare && "lg:ml-56")}>
        {children}
      </main>

      {/* Mobiel — onderbalk via het centrale designsysteem */}
      {!bare && (
        <div className="lg:hidden">
          <DsMobileNav
            items={MOBILE_NAV_ITEMS}
            actiefPad={actief}
            onNavigeer={(href) => navigate(href)}
          />
        </div>
      )}
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
      {/* Visual Atmosphere Layer — Midjourney-asset via Atmosphere Library.
          WebP primair (~85–120 kB), PNG-fallback. Puur decoratief: alt="" + aria-hidden.
          Lokale gradient: alleen onderaan faden naar bg-app voor pagina-overgang.
          Bovenkant beeld blijft onbedekt — foto toont warm en helder. */}
      <picture>
        <source srcSet={HERO_FOTO_WEBP} type="image/webp" />
        <img
          src={HERO_FOTO}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[50%_40%]"
        />
      </picture>
      {/* Lokale contrastlaag: alleen onderste helft, beeldhelderheid boven behouden. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-transparent via-app/20 to-app"
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
    data.action,
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

// ── Zonekleuren voor de balkvisualisatie ─────────────────────────────────────
// Identiek aan workout-detail-drawer.tsx — één referentiepalette.
const BALK_ZONE_COLORS: Record<number, string> = {
  1: "rgba(120,210,230,0.25)",
  2: "rgba(120,210,230,0.45)",
  3: "rgba(255,220,100,0.50)",
  4: "rgba(120,210,230,0.95)",
  5: "rgba(255,140,80,0.85)",
  6: "rgba(255,80,80,0.80)",
}
const BALK_ZONE_FALLBACK = "rgba(120,210,230,0.40)"

// ── BlockBalk — toegankelijke trainingsopbouwbalk ────────────────────────────
// Segmenten: breedte ∝ echte duur, kleur + "Z{n}" tekst per zone (kleur is
// nooit de enige informatiedrager). Tik/klik toont blokdetail; aria-live
// zorgt dat schermlezers de detailpaneel aankondigen. Geen blokdata →
// eerlijke melding, geen decoratieve balk.
function BlockBalk({
  bars,
  totalTrainingMin,
}: {
  bars: BlockBar[]
  totalTrainingMin: number | null
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  if (bars.length === 0) {
    return (
      <p className="mt-4 text-[11px] leading-relaxed text-white/35">
        Geen gedetailleerde trainingsopbouw beschikbaar
      </p>
    )
  }

  const totalBlockMin = bars.reduce((s, b) => s + b.totalMin, 0)
  const displayMin = totalTrainingMin ?? totalBlockMin
  const activeBar = activeIdx !== null ? bars[activeIdx] : null

  return (
    <div className="mt-4">
      {/* Koptekst — altijd zichtbaar, geen interactie vereist */}
      <div className="mb-2 flex items-center gap-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">
          Opbouw training
        </span>
        <span className="font-mono text-[9px] tabular-nums text-white/30">
          {displayMin} min
        </span>
      </div>

      {/* Interactieve segmentbalk */}
      <div
        role="group"
        aria-label="Trainingsopbouw per blok"
        className="flex h-9 gap-1"
      >
        {bars.map((b, i) => {
          const isActive = activeIdx === i
          const bgColor = BALK_ZONE_COLORS[b.zone] ?? BALK_ZONE_FALLBACK
          return (
            <button
              key={b.key}
              type="button"
              aria-label={`${b.label}, ${b.totalMin} minuten, zone ${b.zone}`}
              aria-pressed={isActive}
              onClick={() => setActiveIdx(isActive ? null : i)}
              className={cn(
                "relative flex min-w-[16px] items-center justify-center overflow-hidden rounded-md",
                "text-[9px] font-bold tabular-nums text-white/75",
                "transition-opacity focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-white/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
                isActive && "ring-2 ring-white/70",
              )}
              style={{
                flexGrow: b.flex,
                flexBasis: 0,
                background: bgColor,
                opacity: activeIdx !== null && !isActive ? 0.4 : 1,
              }}
            >
              {/* Zonenummer zichtbaar in het segment — kleur nooit enige informatiedrager */}
              <span aria-hidden="true" className="select-none">
                Z{b.zone}
              </span>
            </button>
          )
        })}
      </div>

      {/* Compacte blokbenamingen — altijd zichtbaar, geen interactie vereist */}
      <p className="mt-2 truncate text-[10px] leading-relaxed text-white/35">
        {bars.map((b) => b.label).join(" · ")}
      </p>

      {/* Blokdetail na tik/klik/focus op een segment */}
      {activeBar && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-2.5 flex items-start justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5"
        >
          <div>
            <p className="text-[13px] font-medium leading-snug text-white/90">
              {activeBar.label}
            </p>
            <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-white/45">
              <span>Zone {activeBar.zone}</span>
              {activeBar.reps > 1 && (
                <span>×{activeBar.reps} herhalingen</span>
              )}
              {activeBar.targetPctFtp != null && (
                <span>{activeBar.targetPctFtp}% FTP</span>
              )}
            </div>
          </div>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-white/55">
            {activeBar.totalMin} min
          </span>
        </div>
      )}
    </div>
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
        <BlockBalk bars={bars} totalTrainingMin={w.targetDurationMin ?? null} />
        {/* 6 — maximaal één primaire actie op het hele scherm. */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row ds-actiebalk">
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
//
// Presentatieregels (data-trust):
//   - Technische sleutels (training_load, hrv_trend, …) zijn nooit zichtbaar.
//   - De status past altijd bij de confidence: bij weinig data géén stellig
//     groen "Belastbaar" maar een eerlijke "Beperkte beoordeling".
//   - Een API-fout levert géén fallbackstatus — de sectie verdwijnt.
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

  const presentatie = buildHerstelPresentatie(
    data.band,
    data.confidence,
    data.why.length,
  )
  // Ontbrekende sleutels vertaald naar gewone taal; bij bijna alle ontbrekend
  // (>= 8) geeft relevantMissingLabels een lege array — dan tonen we één
  // compacte zin in plaats van een lange lijst.
  const missingLabels = relevantMissingLabels(data.missing)
  const allesMissing = data.missing.length >= 8

  return (
    <section className="mt-8" aria-label={COMMERCIAL_COPY.herstelTitle}>
      <h2 className="type-title-card text-white/90">
        {COMMERCIAL_COPY.herstelTitle}
      </h2>
      <DsCard className="mt-3">
        {/* Status — altijd zichtbaar; soort en label zijn confidence-bewust */}
        <DsStatus status={presentatie.soort} aria-label={`Herstelstatus: ${presentatie.label}`}>
          {presentatie.label}
        </DsStatus>

        {/* Compacte toelichting bij lage zekerheid — direct zichtbaar, geen klik */}
        {presentatie.toelichting && (
          <p className="type-body mt-2 text-content-secondary">
            {presentatie.toelichting}
          </p>
        )}
        {presentatie.toelichting && allesMissing && (
          <p className="type-body-sm mt-1 text-content-secondary">
            Recente training, slaap of hoe je je voelt kan de beoordeling
            verbeteren.
          </p>
        )}

        {/* Uitklapbare onderbouwing — toetsenbordtoegankelijk via <details> */}
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

          {/* Beschikbare signalen */}
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

          {/* Ontbrekende gegevens — in gewone taal, nooit als technische sleutels */}
          {allesMissing ? (
            <p className="type-body mt-2 text-content-secondary">
              Er zijn nog geen meetgegevens beschikbaar. Log een training, voer
              een check-in in of koppel een wearable om de beoordeling te
              verbeteren.
            </p>
          ) : missingLabels.length > 0 ? (
            <p className="type-body mt-2 text-content-secondary">
              Ontbreekt nog:{" "}
              {missingLabels.join(", ")}.
            </p>
          ) : null}

          {/* Zekerheidsaanduiding */}
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

// ── Today Orchestrator-blokken (WP-T1) ───────────────────────────────────────
// De orchestrator (engines/today, deterministisch) bepaalt wát nu bovenaan
// hoort: één hoofdboodschap met acties, één onderbouwing, één inzicht en één
// wisselend blok. Alles komt uit bestaande engines; ontbreekt een slot, dan
// wordt er niets gerenderd (eerlijke lege toestand, geen vulkaart).
function TodayOrchestratorSection() {
  const { data, isLoading, isError } = useToday()
  const interact = useTodayInteraction()
  const [, navigate] = useLocation()

  if (isLoading || isError || !data) return null

  const open = (item: TodayItem, action: TodayAction) => {
    interact.mutate({ itemKey: item.key, action: "clicked" })
    navigate(action.href)
  }

  // Presentatie-dedupe: is de lead de geplande training, dan is de bestaande
  // TrainingSection (met blokkenbalk en primaire actie) al de leidende kaart —
  // dezelfde training niet twee keer tonen. De orchestrator blijft de selector;
  // hier valt alleen de dubbele weergave weg.
  const lead =
    data.lead && data.lead.key.startsWith("lead:workout_today:")
      ? null
      : data.lead

  const blocks = [lead, data.insight, data.rotating].filter(
    (i): i is TodayItem => i != null,
  )
  if (blocks.length === 0) return null

  return (
    <section
      aria-label="Nu belangrijk"
      className="mx-auto w-full max-w-screen-xl px-5 pt-6 lg:px-10"
    >
      {data.lead && (
        <DsCard
          className={cn(
            data.lead.urgent && "border-[color:var(--status-let-op,#b45309)]",
          )}
        >
          <DsCardTitel>{data.lead.title}</DsCardTitel>
          <p className="type-body mt-2 text-content-secondary">
            {data.lead.body}
          </p>
          {data.support && (
            <details className="mt-3">
              <summary className="type-body cursor-pointer text-content-secondary">
                {data.support.title}
              </summary>
              <p className="type-body mt-2 text-content-secondary">
                {data.support.body}
              </p>
              <p className="type-caption mt-1 text-content-tertiary">
                Bron: {data.support.source}
              </p>
            </details>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {data.lead.actions.map((a, idx) => (
              <DsButton
                key={a.id}
                variant={idx === 0 ? "primair" : "tekst"}
                onClick={() => open(data.lead!, a)}
              >
                {a.label}
              </DsButton>
            ))}
          </div>
        </DsCard>
      )}
      <div className="mt-4">
        {/* WP-T3: onderbouwing voor bevoegde testers/admins (server-gated). */}
        <TodayDebugPanel />
      </div>
      {(data.insight || data.rotating) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[data.insight, data.rotating]
            .filter((i): i is TodayItem => i != null)
            .map((item) => (
              <DsCard key={item.key}>
                <DsCardTitel>{item.title}</DsCardTitel>
                <p className="type-body mt-2 text-content-secondary">
                  {item.body}
                </p>
                {item.actions[0] && (
                  <div className="mt-3">
                    <DsButton
                      variant="tekst"
                      onClick={() => open(item, item.actions[0]!)}
                    >
                      {item.actions[0].label}
                      <IconChevron aria-hidden="true" />
                    </DsButton>
                  </div>
                )}
              </DsCard>
            ))}
        </div>
      )}
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

  // WP-T1: profielvariant van de orchestrator stuurt de kaartvolgorde —
  // jeugd/beginner zien eerst de training (eenvoud, één actie), daarna pas de
  // weekbelasting; wedstrijd/prestatie/recreatief houden week eerst.
  const today = useToday()
  const variant = today.data?.profile.variant ?? null
  const simpleFirst = variant === "jeugd" || variant === "beginner"
  // Presentatie-dedupe (spiegel van TodayOrchestratorSection): voert de
  // orchestrator een niet-training-lead aan (geen plan, of gezondheid wint),
  // dan zegt de lead-kaart dat al — de TrainingSection zou daaronder dezelfde
  // conclusie ("geen training" / de training die nu juist niet leidend is)
  // herhalen en verdwijnt daarom.
  const todayLead = today.data?.lead ?? null
  const hideTraining =
    todayLead != null && !todayLead.key.startsWith("lead:workout_today:")

  return (
    <CommercialShell actief="/vandaag">
      <HeroVandaag presentation={presentation} planWeek={planWeek} />
      <TodayOrchestratorSection />
      {/* Paginaspecifieke kolomindeling: op desktop twee kolommen (2:1),
          op mobiel ongewijzigd gestapeld. De CommercialShell-schil zelf
          blijft generiek — de kolomindeling leeft alleen in Vandaag. */}
      <div className="mx-auto w-full max-w-screen-xl px-5 lg:px-10">
        <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div>
            {simpleFirst ? (
              <>
                {!hideTraining && <TrainingSection />}
                <WeekSection />
              </>
            ) : (
              <>
                <WeekSection />
                {!hideTraining && <TrainingSection />}
              </>
            )}
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
