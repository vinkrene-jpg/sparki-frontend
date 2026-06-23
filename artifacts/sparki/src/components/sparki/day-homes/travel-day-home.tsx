// Travel Day homepage (task #4, step 7). Surfaces when the athlete marked a
// travel date for an upcoming race. Logistics-led: travel plan, team meeting and
// reminders. Honours grondregel 5: one primary action (briefing → reisplan).

import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HomeIntro } from "@/components/sparki/home-sections"
import {
  RaceCountdown,
  RaceSummaryCard,
  GuidanceList,
  NoRaceCard,
} from "@/components/sparki/race/race-shared"
import { RacePlannerTimeline } from "@/components/sparki/race/race-planner-timeline"
import { TeamMeetingPlanner } from "@/components/sparki/race/team-meeting-planner"
import { ChecklistStatus } from "@/components/sparki/race/prep-checklist"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaceContext } from "@/hooks/use-races"
import type { DayHomeComponentProps } from "@/lib/day-type"

const TRAVEL_TIPS = [
  "Houd je benen los: kort wandelen of mobiliteit na lang zitten.",
  "Eet en drink regelmatig onderweg — plan stops in.",
  "Check je bagage tegen je checklist vóór vertrek, niet achteraf.",
]

export function TravelDayHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const { context } = useRaceContext()
  const profile = data?.athleteProfile
  const race = context?.race ?? null

  return (
    <ScreenShell section="Home" bg="/concept-lab.png">
      <HomeIntro kicker="REISDAG" profile={profile} isLoading={isLoading} />

      {!isLoading && <DayTypeBriefing config={briefing} />}

      <section>
        <SectionLabel n="01" title="Bestemming" large />
        <div className="mt-4 space-y-3">
          {race ? (
            <>
              <RaceCountdown race={race} daysUntil={context!.daysUntil} />
              <RaceSummaryCard race={race} />
            </>
          ) : (
            <NoRaceCard />
          )}
        </div>
      </section>

      {race && (
        <>
          <section>
            <SectionLabel n="02" title="Reisplan" large />
            <div className="mt-4 space-y-3">
              <RacePlannerTimeline race={race} title="Reis & aankomst" />
              <TeamMeetingPlanner race={race} />
            </div>
          </section>

          <section>
            <SectionLabel n="03" title="Onderweg" large />
            <div className="mt-4">
              <GuidanceList items={TRAVEL_TIPS} />
            </div>
          </section>

          <section>
            <SectionLabel n="04" title="Materiaal mee?" large />
            <div className="mt-4">
              <ChecklistStatus race={race} />
            </div>
          </section>
        </>
      )}

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
