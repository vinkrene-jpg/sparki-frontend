// Day Before Race homepage (task #4, step 3). Now driven by the Race Intelligence
// engine: multi-day checklist (grouped, persisted), auto race-day report, and
// the race-fuel plan with budget alternatives replace the old static copy. The
// logistics timeline and team-meeting planner stay. Honours grondregel 5: one
// primary action (briefing → checklist).

import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HomeIntro } from "@/components/sparki/home-sections"
import {
  RaceCountdown,
  RaceSummaryCard,
  InfoBlock,
  NoRaceCard,
} from "@/components/sparki/race/race-shared"
import {
  MultiDayChecklist,
  RaceDayReport,
  RaceFuelCard,
} from "@/components/sparki/race/race-intel"
import { PrepChecklist } from "@/components/sparki/race/prep-checklist"
import { RacePlannerTimeline } from "@/components/sparki/race/race-planner-timeline"
import { TeamMeetingPlanner } from "@/components/sparki/race/team-meeting-planner"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaceContext } from "@/hooks/use-races"
import { useRaceIntel } from "@/hooks/use-race-intel"
import { useFeatureAccess } from "@/hooks/use-feature-access"
import { UpgradeNudge } from "@/components/ds/upgrade-nudge"
import type { DayHomeComponentProps } from "@/lib/day-type"

export function DayBeforeRaceHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const { context } = useRaceContext()
  const profile = data?.athleteProfile
  const race = context?.race ?? null
  // Go-poort (taak 385): race-intelligentie hoort bij Sparki Go.
  const goAccess = useFeatureAccess("race_intel")
  const raceGoBlocked = goAccess.known && !goAccess.entitled
  const { data: intel } = useRaceIntel(raceGoBlocked ? undefined : race?.id)

  return (
    <ScreenShell section="Home" bg="/atmosphere/wedstrijd-renster-goud.webp">
      <HomeIntro kicker="DAG VÓÓR RACE" profile={profile} isLoading={isLoading} />

      {!isLoading && <DayTypeBriefing config={briefing} />}

      <section>
        <SectionLabel n="01" title="Aftellen" large />
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
            <SectionLabel n="02" title="Checklist" large />
            <div className="mt-4">
              {intel ? (
                <MultiDayChecklist
                  race={race}
                  groups={intel.checklistGroups}
                  daysUntil={context!.daysUntil}
                />
              ) : (
                <PrepChecklist race={race} />
              )}
            </div>
          </section>

          {raceGoBlocked && (
            <section>
              <SectionLabel n="03" title="Wedstrijddagrapportage" large />
              <div className="mt-4">
                <UpgradeNudge feature="race_intel" compact />
              </div>
            </section>
          )}

          {intel && (
            <section>
              <SectionLabel n="03" title="Wedstrijddagrapportage" large />
              <div className="mt-4">
                <RaceDayReport report={intel.report} />
              </div>
            </section>
          )}

          {intel && (
            <section>
              <SectionLabel n="04" title="Race fuel" large />
              <div className="mt-4">
                <RaceFuelCard fuel={intel.fuel} />
              </div>
            </section>
          )}

          <section>
            <SectionLabel n="05" title="Materiaal & logistiek" large />
            <div className="mt-4 space-y-3">
              <RacePlannerTimeline race={race} />
              <TeamMeetingPlanner race={race} />
              <InfoBlock label="Weer" value={race.weatherNote} empty="Nog geen weersinschatting toegevoegd" />
            </div>
          </section>

          {race.coachInstructions && (
            <section>
              <SectionLabel n="06" title="Van je coach" large />
              <div className="mt-4">
                <InfoBlock label="Coachinstructies" value={race.coachInstructions} />
              </div>
            </section>
          )}
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
