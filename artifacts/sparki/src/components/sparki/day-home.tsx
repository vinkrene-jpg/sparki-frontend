// DayHome — the day-type homepage dispatcher (blueprint §4).
//
// The engine's registry: it detects today's DayType, resolves its briefing once,
// and renders the *registered homepage component* for that type. Home shows
// exactly one day-type homepage — not a single page with a swapped header.

import type { ReactElement } from "react"
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
    <ScreenShell section="Home" bg="/concept-lab.png">
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
function StateDayHome() {
  const homeView = useHomeView()
  return (
    <ScreenShell section="Home" bg="/concept-lab.png">
      <StateCard onShowDetails={() => homeView?.setView("full")} />
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
  const { data, isLoading } = useAthleteDashboard()
  const { context: raceContext, isLoading: racesLoading } = useRaceContext()

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
  const Component = dayHomeRegistry[dayType]

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
