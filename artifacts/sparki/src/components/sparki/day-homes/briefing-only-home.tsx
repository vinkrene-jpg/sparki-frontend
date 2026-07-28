// Briefing-only homepage — used by the dormant high-priority day types
// (Emergency / Race*) until their data sources exist. They are part of the §4
// hierarchy and registered for completeness, but never trigger on invented data
// (grondregel 3). Activating them is a later phase (health status, races table).

import { ScreenShell } from "@/components/sparki/screen-shell"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HomeIntro } from "@/components/sparki/home-sections"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import type { DayHomeComponentProps } from "@/lib/day-type"

export function BriefingOnlyHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const profile = data?.athleteProfile

  return (
    <ScreenShell section="Home" bg="/atmosphere/routes-weg-ochtend-mist.webp">
      <HomeIntro kicker={briefing.eyebrow} profile={profile} isLoading={isLoading} />

      {!isLoading && <DayTypeBriefing config={briefing} />}

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
