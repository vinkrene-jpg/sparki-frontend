// Day Before Race homepage (task #4, step 3). Preparation mode: countdown,
// persisted prep checklist, race strategy (nutrition/hydration/sleep/weather),
// equipment recs, logistics planner, team meeting, Sparki observations and coach
// notes. Honours grondregel 5: one primary action (briefing → checklist).

import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HomeIntro } from "@/components/sparki/home-sections"
import {
  RaceCountdown,
  RaceSummaryCard,
  GuidanceList,
  InfoBlock,
  NoRaceCard,
} from "@/components/sparki/race/race-shared"
import { PrepChecklist } from "@/components/sparki/race/prep-checklist"
import { RacePlannerTimeline } from "@/components/sparki/race/race-planner-timeline"
import { TeamMeetingPlanner } from "@/components/sparki/race/team-meeting-planner"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaceContext } from "@/hooks/use-races"
import type { DayHomeComponentProps } from "@/lib/day-type"

const STRATEGY = [
  "Eet vanavond koolhydraatrijk en vermijd experimenten met nieuw voedsel.",
  "Hydrateer goed door de dag — niet alles in één keer voor het slapen.",
  "Ga op tijd naar bed; slaap twee nachten voor de race telt het zwaarst.",
]

const EQUIPMENT = [
  "Controleer bandenspanning, remmen en schakeling.",
  "Laad fietscomputer, shifters en lampjes volledig op.",
  "Leg wedstrijdkleding en reservemateriaal klaar.",
]

const OBSERVATIONS = [
  "Loop je checklist vanavond na, niet morgenochtend in haast.",
  "Plan je vertrek met marge — onverwacht oponthoud kost rust.",
  "Bevestig je startttijd en locatie nog één keer.",
]

export function DayBeforeRaceHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const { context } = useRaceContext()
  const profile = data?.athleteProfile
  const race = context?.race ?? null

  return (
    <ScreenShell section="Home" bg="/concept-lab.png">
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
              <PrepChecklist race={race} />
            </div>
          </section>

          <section>
            <SectionLabel n="03" title="Strategie" large />
            <div className="mt-4 space-y-3">
              <GuidanceList items={STRATEGY} />
              <InfoBlock label="Weer" value={race.weatherNote} empty="Nog geen weersinschatting toegevoegd" />
            </div>
          </section>

          <section>
            <SectionLabel n="04" title="Materiaal & logistiek" large />
            <div className="mt-4 space-y-3">
              <GuidanceList items={EQUIPMENT} />
              <RacePlannerTimeline race={race} />
              <TeamMeetingPlanner race={race} />
            </div>
          </section>

          <section>
            <SectionLabel n="05" title="Wat ziet Sparki" large />
            <div className="mt-4">
              <GuidanceList items={OBSERVATIONS} dotColor="rgba(255,200,120,0.85)" />
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
