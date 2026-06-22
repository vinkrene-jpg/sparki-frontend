// Recovery-day homepage (blueprint §4 #7). Active recovery — readiness and
// recovery data lead, the workout is intentionally de-emphasised. Honours
// grondregel 5: one primary action (in the briefing) + ≤3 recommendations.

import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import {
  HomeIntro,
  ReactorReadiness,
  VitalsGrid,
  Skeleton,
} from "@/components/sparki/home-sections"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import type { DayHomeComponentProps } from "@/lib/day-type"

const RECOVERY_GUIDANCE = [
  "Houd de inspanning in Z1–Z2 — soepel fietsen, wandelen of mobiliteit.",
  "Geef voorrang aan slaap, hydratatie en eiwitrijke voeding.",
  "Stop als iets niet goed voelt — herstel gaat vóór volume.",
]

export function RecoveryDayHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const { data: metricsHistory, isLoading: metricsLoading } = useDailyMetrics(14)
  const profile = data?.athleteProfile

  return (
    <ScreenShell section="Home" bg="/concept-lab.png">
      <HomeIntro kicker="HERSTELDAG" profile={profile} isLoading={isLoading} />

      {!isLoading && <DayTypeBriefing config={briefing} />}

      {/* 01 BEN IK ER KLAAR VOOR */}
      <section>
        <SectionLabel n="01" title="Ben ik er klaar voor" large />
        <div className="mt-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-60 w-60 rounded-full" />
              <Skeleton className="h-8 w-56 rounded-full" />
            </div>
          ) : (
            <ReactorReadiness metrics={data?.todayMetrics ?? null} />
          )}
        </div>
      </section>

      {/* 02 WAT ZIET SPARKI — hersteldata */}
      <section>
        <SectionLabel n="02" title="Wat ziet Sparki" large />
        <div className="mt-4">
          {metricsLoading ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          ) : metricsHistory && metricsHistory.length > 0 ? (
            <VitalsGrid metrics={metricsHistory} />
          ) : (
            <p className="text-[12px] text-white/35">
              Log een check-in om je hersteldata te zien
            </p>
          )}
        </div>
      </section>

      {/* 03 WAT WORDT AANBEVOLEN — ≤3 (grondregel 5) */}
      <section>
        <SectionLabel n="03" title="Wat wordt aanbevolen" large />
        <ul className="mt-4 space-y-3">
          {RECOVERY_GUIDANCE.map((tip) => (
            <li
              key={tip}
              className="flex gap-3 rounded-xl border border-white/[0.07] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: "rgba(120,210,230,0.85)",
                  boxShadow: "0 0 8px rgba(120,210,230,0.85)",
                }}
              />
              <span className="text-[13px] leading-relaxed text-white/70">
                {tip}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI AI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
