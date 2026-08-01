// DayHome — the day-type homepage dispatcher (blueprint §4).
//
// The engine's registry: it detects today's DayType, resolves its briefing once,
// and renders the *registered homepage component* for that type. Home shows
// exactly one day-type homepage — not a single page with a swapped header.

import { useEffect, useState, type ReactElement } from "react"
import { useLocation, useSearch } from "wouter"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaceContext } from "@/hooks/use-races"
import {
  detectDayType,
  getDayTypeBriefing,
  type DayType,
  type DayTypeContext,
  type DayHomeComponentProps,
} from "@/lib/day-type"
import {
  decideCoach,
  coachInputFromProfile,
  resolveOverrideInput,
  COACH_SCENARIOS,
  type CoachDayData,
  type CoachDecision,
  type CoachOverrideMode,
  type CoachScenarioKey,
} from "@/lib/coach-engine"
import { CoachDecisionProvider } from "@/contexts/CoachDecisionContext"
import { HomeViewProvider, useHomeView } from "@/contexts/HomeViewContext"
import { DEV_PREVIEW } from "@/lib/dev"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { StateCard } from "@/components/sparki/state-card"
import { VoedingScreen } from "@/components/sparki/voeding-screen"
import { MaterialCoach } from "@/components/sparki/material-coach"
import { LeskaartVandaag } from "@/components/sparki/leskaart-van-dag"
import { RideMomentBlock } from "@/components/sparki/ride-moment-block"
import { CheckInChip } from "@/components/sparki/check-in-chip"
import { FollowUpChip } from "@/components/sparki/follow-up-chip"
import { MeerijderNudge } from "@/components/sparki/meerijder-nudge"
import { ReleaseNoteCard } from "@/components/sparki/release-note-card"
import { HomeWeatherRow } from "@/components/sparki/home-weather-row"
import { MaintenanceSignalsPanel } from "@/components/sparki/maintenance-signals"
import { useRideMoment, useRideStoryFlag } from "@/hooks/use-ride-story"
import { useHomeWeather } from "@/hooks/use-home-weather"
import { useSetHealthStatus } from "@/hooks/use-health-status"
import {
  selectMoment,
  weatherAllowed,
  leskaartAllowed,
} from "@/lib/aandachtswet"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useNutritionLogs } from "@/hooks/use-nutrition"
import { AddTrainingButton } from "@/components/sparki/add-training"
import { Apple, ChevronRight } from "lucide-react"
import { useFixParams } from "@/hooks/use-missing-input"
import { Skeleton } from "@/components/sparki/home-sections"
import { TrainingDayHome } from "@/components/sparki/training-day-home"
import { RecoveryDayHome } from "@/components/sparki/day-homes/recovery-day-home"
import { RestDayHome } from "@/components/sparki/day-homes/rest-day-home"
import { GeneralDayHome } from "@/components/sparki/day-homes/general-day-home"
import { EmergencyDayHome } from "@/components/sparki/day-homes/emergency-day-home"
import { RaceWeekHome } from "@/components/sparki/day-homes/race-week-home"
import { DayBeforeRaceHome } from "@/components/sparki/day-homes/day-before-race-home"
import { RaceDayHome } from "@/components/sparki/day-homes/race-day-home"
import { TravelDayHome } from "@/components/sparki/day-homes/travel-day-home"
import { PostRaceHome } from "@/components/sparki/day-homes/post-race-home"

// DayType → homepage component. Coach/Sparki training share the full training
// home; recovery/rest/general have their own focused homepages; the race-window
// types each have a dedicated race homepage driven by the resolved race context.
const dayHomeRegistry: Record<
  DayType,
  (props: DayHomeComponentProps) => ReactElement
> = {
  emergency: EmergencyDayHome,
  race_day: RaceDayHome,
  day_before_race: DayBeforeRaceHome,
  race_week: RaceWeekHome,
  travel_day: TravelDayHome,
  post_race: PostRaceHome,
  coach_training: TrainingDayHome,
  sparki_training: TrainingDayHome,
  recovery: RecoveryDayHome,
  rest: RestDayHome,
  general: GeneralDayHome,
}

function DayHomeLoading() {
  return (
    <ScreenShell section="Home" bg="/atmosphere/training-renster-heide.webp">
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="flex justify-center">
          <Skeleton className="h-60 w-60 rounded-full" />
        </div>
      </div>
    </ScreenShell>
  )
}

// Dev/preview-only coach override (Adaptive Coach Engine selector). Ignored
// entirely in production: the override is only applied when DEV_PREVIEW is true,
// so production builds always run the engine on the real profile.
export type DevCoachOverride = {
  mode: CoachOverrideMode
  scenario: CoachScenarioKey
}

// Vandaag's default surface: the calm State Card. It carries its own loading /
// error / empty states, so it never has to wait on the dashboard or races
// queries. The State Card is a generic engine consumer; Vandaag is the host that
// injects what its drill-in does (open the full day-type analysis) via the
// HomeView context — the card itself stays surface-agnostic.
function relativeDate(iso: string): string {
  const then = new Date(iso + "T12:00:00Z").getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "vandaag"
  if (days === 1) return "gisteren"
  if (days < 7) return `${days} dgn geleden`
  return new Date(iso + "T12:00:00Z").toLocaleDateString("nl-NL", {
    month: "short",
    day: "numeric",
  })
}

// Explicit rest-day detection — mirrors the day-type engine's isRestWorkout so
// Vandaag's aandachtswet agrees with the full day-type analysis.
function isRestType(t: string | null | undefined): boolean {
  if (!t) return false
  const s = t.toLowerCase()
  return s.includes("rest") || s.includes("rust") || s.includes("off")
}

// The leading Momentblok when the athlete has marked themselves sick/injured
// (aandachtswet prio 1). Reuses the real health mutation — no fabricated medical
// advice, just an honest status line, the neutral "herstel gaat voor" framing,
// and the working "ik ben weer hersteld" action.
function HealthMomentBlock() {
  const setStatus = useSetHealthStatus()
  const { data } = useAthleteDashboard()
  const label =
    data?.athleteProfile?.healthStatus === "injured" ? "geblesseerd" : "ziek"
  return (
    <section className="rounded-2xl border border-[rgba(255,140,120,0.28)] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: "rgba(255,140,120,0.9)",
            boxShadow: "0 0 8px rgba(255,140,120,0.8)",
          }}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[rgba(255,170,150,0.85)]">
          Herstel gaat voor
        </span>
      </div>
      <p className="mt-2.5 text-[15px] font-medium leading-snug text-white/90">
        Je hebt jezelf {label} gemeld.
      </p>
      <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-white/60">
        Er komt nu geen trainingsdruk bij. Rust, slaap, hydratatie en voeding
        gaan voor. Meld je weer beter zodra het kan, dan bouwt je plan rustig op.
      </p>
      <button
        type="button"
        disabled={setStatus.isPending}
        onClick={() => setStatus.mutate("ok")}
        className="mt-4 w-full rounded-full border border-cyan-300/30 bg-cyan-300/[0.06] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-200/90 transition-colors hover:bg-cyan-300/[0.12] disabled:opacity-50"
      >
        {setStatus.isPending ? "Bijwerken…" : "Ik ben weer hersteld"}
      </button>
    </section>
  )
}

function StateDayHome() {
  const homeView = useHomeView()
  const { focus } = useFixParams()
  const [, navigate] = useLocation()
  const [voedingOpen, setVoedingOpen] = useState(false)
  const { data: nutritionData } = useNutritionLogs()
  const { data: dashboard } = useAthleteDashboard()
  const { data: moment } = useRideMoment()
  const weather = useHomeWeather()
  // Fase 2 "De aandachtswet" is isolated behind the same tester flag as Fase 1
  // (`rit_verhaal`): flag off ⇒ the prior Vandaag composition renders unchanged.
  const fase2 = useRideStoryFlag()

  // Vandaag is the single place to update yourself as an athlete: how you feel
  // (the check-in chip below the Momentblok) plus your nutrition and your gear.
  // The Voeding card opens the dedicated Voeding screen directly. When the coach
  // sends you here to "vul je voeding in" (?focus=nutrition), open that screen
  // straight away, then strip the param so a refresh/back doesn't re-trigger it.
  useEffect(() => {
    if (focus !== "nutrition") return
    setVoedingOpen(true)
    navigate("/", { replace: true })
  }, [focus, navigate])

  // ── De aandachtswet (Fase 2, §5.1): resolve the SINGLE leading Momentblok
  // from real, already-resolved signals. Higher priority always wins; health is
  // never dimmed and presentation variation never moves this leader. ──
  const profile = dashboard?.athleteProfile
  const todayWorkout = dashboard?.todayWorkout ?? null
  const healthActive =
    profile?.healthStatus === "sick" || profile?.healthStatus === "injured"
  const ridePhase = moment && !moment.suppressed ? moment.phase : null
  const restDay = isRestType(todayWorkout?.type)
  const plannedWorkoutToday =
    !!todayWorkout &&
    !restDay &&
    todayWorkout.status !== "completed" &&
    todayWorkout.status !== "done"

  // Real proposal signal (never fabricated): the ride-moment consequence carries
  // status "voorstel" when Sparki has an outstanding schema-adjustment. It lives
  // INSIDE the ride story, so whenever it is set a ride phase (na-rit) is also
  // set and wins the higher rung — the proposal is then surfaced within that
  // na-rit Momentblok's consequence. Wiring the honest signal keeps the engine
  // input truthful without ever leading with a fabricated standalone block.
  const hasProposal =
    !!moment &&
    !moment.suppressed &&
    moment.story?.consequence.status === "voorstel"

  const leadMoment = selectMoment({
    healthActive: !!healthActive,
    ridePhase,
    hasProposal,
    plannedWorkoutToday,
    restDay,
  })

  const rideLeads =
    leadMoment === "racedag" ||
    leadMoment === "na-rit" ||
    leadMoment === "rit-binnen"
  const stateLeads = !rideLeads && leadMoment !== "health"

  // Honest weather gate (§5.2 #3): only where it is a real decision factor
  // (right before a training / on race day) AND it truly resolved for the home
  // location. Otherwise it is absent (reachable via its own destination).
  const hw = weather.data
  const showWeather =
    weatherAllowed(leadMoment) && !!hw?.available && !!hw.today

  const logs = nutritionData?.logs ?? []
  const lastLog = logs[0] ?? null
  const voedingSummary = lastLog
    ? logs.length === 1
      ? `1 keer gelogd · laatste ${relativeDate(lastLog.logDate)}`
      : `${logs.length} keer gelogd · laatste ${relativeDate(lastLog.logDate)}`
    : "Nog niets gelogd — begin hier"

  // ── Flag off: the prior Vandaag surface, unchanged (no aandachtswet
  // composition, check-in inside the State Card, inline gear nudge intact). ──
  if (!fase2) {
    return (
      <ScreenShell section="Home" bg="/atmosphere/training-renster-heide.webp">
        <StateCard
          checkInFirst
          onShowDetails={() => homeView?.setView("full")}
        />

        <section className="mt-2">
          <SectionLabel title="Jouw update vandaag" />
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
            Eén plek om jezelf bij te werken. Hoe je je voelt staat hierboven —
            open je voeding of bekijk je materiaalstatus.
          </p>

          <div className="mt-5">
            <AddTrainingButton variant="prominent" />
          </div>

          <button
            id="nutrition"
            type="button"
            onClick={() => setVoedingOpen(true)}
            className="mt-5 flex w-full scroll-mt-4 items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
              style={{ background: "rgba(120,210,230,0.08)" }}
            >
              <Apple className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-white/90">
                Voeding &amp; hydratatie
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                {voedingSummary}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/25" strokeWidth={1.75} />
          </button>

          <div className="mt-7">
            <MaterialCoach n="" />
          </div>
        </section>

        <LeskaartVandaag />

        <VoedingScreen open={voedingOpen} onOpenChange={setVoedingOpen} />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell section="Home" bg="/atmosphere/training-renster-heide.webp">
      {/* ── The single leading Momentblok (§5.1) — exactly one thing leads ── */}
      {leadMoment === "health" ? (
        <HealthMomentBlock />
      ) : rideLeads ? (
        // Fresh ride / race day — flag-gated, suppressed when ziek/geblesseerd.
        <RideMomentBlock />
      ) : (
        // Calm toestand leads (voorstel/voor-training/herstel/balans).
        <StateCard hideCheckIn onShowDetails={() => homeView?.setView("full")} />
      )}

      {/* ── Non-blocking chips (§5.2 #1): check-in + evening follow-up, never at
          the top, never a blocking modal. ── */}
      <div className="mt-4 space-y-2">
        <CheckInChip />
        <FollowUpChip />
      </div>

      {/* Golf 14 — releasebericht: rustig, nooit leidend, alleen op Vandaag. */}
      <ReleaseNoteCard />

      {/* When a ride/health block leads, the calm toestand still follows below so
          the State is always reachable — just not as the leader. */}
      {!stateLeads && (
        <div className="mt-6">
          <StateCard hideCheckIn onShowDetails={() => homeView?.setView("full")} />
        </div>
      )}

      {/* ── Meerijder-budget (§5.2 #2): at most ONE nudge across all sources. ── */}
      <MeerijderNudge />

      {/* ── Weer (§5.2 #3): only when it is a real decision factor today. ── */}
      {showWeather && hw?.today && (
        <div className="mt-6">
          <HomeWeatherRow
            summary={hw.today}
            locationLabel={hw.locationLabel}
            advisory={hw.advisory}
          />
        </div>
      )}

      {/* Onderhoudssignalen rijden alleen mee als er echt iets is (compact =
          null bij geen signalen) — de aandachtswet blijft intact: dit blok
          leidt nooit, het waarschuwt alleen bij vermoede slijtage of een
          zelf-geregistreerd defect. */}
      <MaintenanceSignalsPanel context="vandaag" compact className="mt-6" />

      <section className="mt-8">
        <SectionLabel title="Jouw update vandaag" />
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
          Eén plek om jezelf bij te werken. Hoe je je voelt staat hierboven —
          open je voeding of bekijk je materiaalstatus.
        </p>

        {/* Adding a training must never be hidden — log a done session or plan a
            new one right from Vandaag. */}
        <div className="mt-5">
          <AddTrainingButton variant="prominent" />
        </div>

        <button
          id="nutrition"
          type="button"
          onClick={() => setVoedingOpen(true)}
          className="mt-5 flex w-full scroll-mt-4 items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
            style={{ background: "rgba(120,210,230,0.08)" }}
          >
            <Apple className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-white/90">
              Voeding &amp; hydratatie
            </span>
            <span className="mt-0.5 block text-[12px] text-white/45">
              {voedingSummary}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/25" strokeWidth={1.75} />
        </button>

        {/* Gear coach stays reachable as a self-update tool, but its inline
            nudge is suppressed here — the meerijder-budget above owns the single
            nudge for this visit (§5.2 #2). */}
        <div className="mt-7">
          <MaterialCoach n="" hideNudge />
        </div>
      </section>

      {/* Leskaart rides along ONLY on calm learn-room moments (§5.2 #3) — never
          when a ride, race or safety signal is leading. */}
      {leskaartAllowed(leadMoment) && <LeskaartVandaag />}

      <VoedingScreen open={voedingOpen} onOpenChange={setVoedingOpen} />
    </ScreenShell>
  )
}

export function DayHome(props: {
  devDayTypeOverride?: DayType
  devCoachOverride?: DevCoachOverride
} = {}) {
  return (
    <HomeViewProvider>
      <DayHomeInner {...props} />
    </HomeViewProvider>
  )
}

function DayHomeInner({
  devDayTypeOverride,
  devCoachOverride,
}: {
  devDayTypeOverride?: DayType
  devCoachOverride?: DevCoachOverride
}) {
  const homeView = useHomeView()
  const view = homeView?.view ?? "state"
  const search = useSearch()
  const { data, isLoading } = useAthleteDashboard()
  const { context: raceContext, isLoading: racesLoading } = useRaceContext()

  // Self-update deep-links (coach "vul je voeding in" → ?focus=nutrition; material
  // nudge → ?materiaal=…) target the calm State Card surface, where the nutrition
  // and material panels now live. If the athlete happens to be in the full
  // day-type analysis when such a link fires, switch back to the state view so the
  // panel is actually mounted and its own scroll/open effect can run.
  useEffect(() => {
    const params = new URLSearchParams(search)
    const wantsSelfUpdate =
      params.get("focus") === "nutrition" || params.has("materiaal")
    if (wantsSelfUpdate && homeView && homeView.view !== "state") {
      homeView.setView("state")
    }
  }, [search, homeView])

  // Default surface — the State Card. Shown unless the athlete drills into the
  // full day-type analysis. Rendered before the dashboard/races gate so it never
  // blocks on data it doesn't need.
  if (view === "state") {
    return <StateDayHome />
  }

  const profile = data?.athleteProfile
  const todayWorkout = data?.todayWorkout ?? null
  const ctx: DayTypeContext = {
    todayWorkout: todayWorkout
      ? {
          type: todayWorkout.type,
          source: todayWorkout.source,
          title: todayWorkout.title,
        }
      : null,
    hasProfile: !!profile,
    healthStatus: profile?.healthStatus ?? null,
    race: raceContext
      ? {
          phase: raceContext.phase,
          daysUntil: raceContext.daysUntil,
          name: raceContext.race.name,
        }
      : null,
  }

  // Wait for the dashboard + races before picking a non-override type — otherwise
  // the first paint would briefly show the wrong day (e.g. "rest" before data).
  if ((isLoading || racesLoading) && !devDayTypeOverride) {
    return <DayHomeLoading />
  }

  const dayType = devDayTypeOverride ?? detectDayType(ctx)
  const briefing = getDayTypeBriefing(dayType, ctx)
  // Defensive: an unregistered day type must never render `undefined` (a blank
  // crash). Fall back to the General homepage so Vandaag always shows something.
  const Component = dayHomeRegistry[dayType] ?? GeneralDayHome

  // ── Adaptive Coach Engine ─────────────────────────────────────────────────
  // Today's real day data feeds the engine. The engine sits between the profile
  // and the advice; Home reads its decision, never the other way around.
  const realDay: CoachDayData = {
    feelScore: data?.todayMetrics?.feelScore ?? null,
    fatigueScore: data?.todayMetrics?.fatigueScore ?? null,
    tsb: data?.load?.tsb ?? null,
  }
  const raceForCoach = raceContext
    ? { daysUntil: raceContext.daysUntil }
    : null

  let coachDecision: CoachDecision | null = null
  if (DEV_PREVIEW && devCoachOverride) {
    // Dev/preview override: scenario = fully fictional; profile = scenario's
    // profile portion but today's REAL day data preserved. Never reached in
    // production (DEV_PREVIEW is false → dead-code).
    const scenario = COACH_SCENARIOS[devCoachOverride.scenario]
    coachDecision = decideCoach(
      resolveOverrideInput(scenario, devCoachOverride.mode, realDay),
    )
  } else {
    const input = coachInputFromProfile(profile, realDay, raceForCoach)
    coachDecision = input ? decideCoach(input) : null
  }

  return (
    <CoachDecisionProvider value={coachDecision}>
      <Component dayType={dayType} briefing={briefing} />
    </CoachDecisionProvider>
  )
}
