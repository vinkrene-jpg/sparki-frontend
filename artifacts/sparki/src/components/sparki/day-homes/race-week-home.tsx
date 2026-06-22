// Race Week homepage (task #4, step 2). Build phase (7–4 days) leads with
// training focus; taper phase (3–2 days) shifts to freshness. Honours grondregel
// 5: one primary action (briefing) + ≤3 recommendations.

import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HomeIntro, ReactorReadiness, Skeleton } from "@/components/sparki/home-sections"
import {
  RaceCountdown,
  RaceSummaryCard,
  GuidanceList,
  NoRaceCard,
} from "@/components/sparki/race/race-shared"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaceContext } from "@/hooks/use-races"
import type { DayHomeComponentProps } from "@/lib/day-type"

const BUILD_GUIDANCE = [
  "Laatste kwaliteit deze week — scherpe intervallen, beheerst volume.",
  "Verzorg slaap en voeding nu al; vorm bouw je niet op in één dag.",
  "Check materiaal vroeg zodat er tijd is voor reparatie of vervanging.",
]

const TAPER_GUIDANCE = [
  "Taperen: minder volume, behoud intensiteit met korte prikkels.",
  "Kom fris aan de start — extra rust telt nu zwaarder dan training.",
  "Visualiseer je race en leg je plan en logistiek vast.",
]

export function RaceWeekHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const { context } = useRaceContext()
  const profile = data?.athleteProfile
  const isTaper = (context?.daysUntil ?? 7) <= 3

  return (
    <ScreenShell section="Home" bg="/concept-lab.png">
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

      <section>
        <SectionLabel n="03" title="Wat wordt aanbevolen" large />
        <div className="mt-4">
          <GuidanceList items={isTaper ? TAPER_GUIDANCE : BUILD_GUIDANCE} />
        </div>
      </section>

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI AI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
