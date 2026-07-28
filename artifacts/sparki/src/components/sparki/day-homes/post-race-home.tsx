// Post-Race homepage (task #4, step 7). The 1–2 days after a race: recovery and
// analysis lead. Honours grondregel 5: one primary action (briefing → log race).

import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HomeIntro, ReactorReadiness, Skeleton } from "@/components/sparki/home-sections"
import {
  RaceSummaryCard,
  GuidanceList,
  InfoBlock,
  NoRaceCard,
} from "@/components/sparki/race/race-shared"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaceContext } from "@/hooks/use-races"
import type { DayHomeComponentProps } from "@/lib/day-type"

const RECOVERY_GUIDANCE = [
  "Actief herstel: licht bewegen, rekken en bewegelijkheid boven stilzitten.",
  "Vul aan met eiwitten en koolhydraten en blijf goed hydrateren.",
  "Prioriteer slaap — daar gebeurt het echte herstel.",
]

export function PostRaceHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const { context } = useRaceContext()
  const profile = data?.athleteProfile
  const race = context?.race ?? null

  return (
    <ScreenShell section="Home" bg="/atmosphere/samen-koffiestop-close.webp">
      <HomeIntro kicker="NA DE RACE" profile={profile} isLoading={isLoading} />

      {!isLoading && <DayTypeBriefing config={briefing} />}

      <section>
        <SectionLabel n="01" title="Ben ik hersteld" large />
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
        <SectionLabel n="02" title="Wat wordt aanbevolen" large />
        <div className="mt-4">
          <GuidanceList items={RECOVERY_GUIDANCE} />
        </div>
      </section>

      <section>
        <SectionLabel n="03" title="Terugblik" large />
        <div className="mt-4 space-y-3">
          {race ? (
            <>
              <RaceSummaryCard race={race} />
              <InfoBlock
                label="Reflectie"
                value={null}
                empty="Leg vast hoe de race verliep — gevoel, uitvoering en lessen. Log je race om dit te bewaren."
              />
            </>
          ) : (
            <NoRaceCard />
          )}
        </div>
      </section>

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
