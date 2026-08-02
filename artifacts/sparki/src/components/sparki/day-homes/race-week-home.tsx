// Race Week homepage (task #4, step 2). Now driven by the Race Intelligence
// engine: a phased preparation timeline (7/5/3/2/1 days + race day) replaces the
// old static guidance, and an auto race-day report previews what Sparki already
// knows. Honours grondregel 5: one primary action (briefing) + focused sections.

import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HomeIntro, ReactorReadiness, Skeleton } from "@/components/sparki/home-sections"
import {
  RaceCountdown,
  RaceSummaryCard,
  NoRaceCard,
} from "@/components/sparki/race/race-shared"
import { PrepTimeline, RaceDayReport } from "@/components/sparki/race/race-intel"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaceContext } from "@/hooks/use-races"
import { useRaceIntel } from "@/hooks/use-race-intel"
import { useFeatureAccess } from "@/hooks/use-feature-access"
import { UpgradeNudge } from "@/components/ds/upgrade-nudge"
import type { DayHomeComponentProps } from "@/lib/day-type"

export function RaceWeekHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const { context } = useRaceContext()
  const profile = data?.athleteProfile
  const race = context?.race ?? null
  // Go-poort (taak 385): race-intelligentie hoort bij Sparki Go.
  const goAccess = useFeatureAccess("race_intel")
  const raceGoBlocked = goAccess.known && !goAccess.entitled
  const { data: intel } = useRaceIntel(raceGoBlocked ? undefined : race?.id)

  return (
    <ScreenShell section="Home" bg="/atmosphere/wedstrijd-renner-close-up.webp">
      <HomeIntro kicker="RACE WEEK" profile={profile} isLoading={isLoading} />

      {!isLoading && <DayTypeBriefing config={briefing} />}

      <section>
        <SectionLabel n="01" title="Aftellen" large />
        <div className="mt-4 space-y-3">
          {context ? (
            <>
              <RaceCountdown race={context.race} daysUntil={context.daysUntil} />
              <RaceSummaryCard race={context.race} />
            </>
          ) : (
            <NoRaceCard />
          )}
        </div>
      </section>

      <section>
        <SectionLabel n="02" title="Hoe sta je ervoor" large />
        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center">
              <Skeleton className="h-60 w-60 rounded-full" />
            </div>
          ) : (
            <ReactorReadiness metrics={data?.todayMetrics ?? null} />
          )}
        </div>
      </section>

      {race && raceGoBlocked && (
        <section>
          <SectionLabel n="03" title="Voorbereiding stap voor stap" large />
          <div className="mt-4">
            <UpgradeNudge feature="race_intel" compact />
          </div>
        </section>
      )}

      {race && intel && (
        <>
          <section>
            <SectionLabel n="03" title="Voorbereiding stap voor stap" large />
            <div className="mt-4">
              <PrepTimeline phases={intel.prep} />
            </div>
          </section>

          <section>
            <SectionLabel n="04" title="Wedstrijddagrapportage" large />
            <div className="mt-4">
              <RaceDayReport report={intel.report} />
            </div>
          </section>
        </>
      )}

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
