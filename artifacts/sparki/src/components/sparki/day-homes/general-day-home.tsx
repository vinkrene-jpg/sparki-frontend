// General / no-training fallback homepage (blueprint §4 #9). Shown when there
// is no plan and no profile yet — an onboarding briefing with ≤3 setup steps.
// Honours grondregel 5: one primary action (briefing) + a short guided list.

import { useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HomeIntro } from "@/components/sparki/home-sections"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import type { DayHomeComponentProps } from "@/lib/day-type"

const SETUP_STEPS: { label: string; hint: string; href: string }[] = [
  {
    label: "Stel je profiel & FTP in",
    hint: "Zo kan Sparki je zones en belasting berekenen.",
    href: "/you",
  },
  {
    label: "Log je eerste check-in",
    hint: "Voel, slaap en vermoeidheid voeden je readiness.",
    href: "/you",
  },
  {
    label: "Plan je volgende training",
    hint: "Sparki bouwt je dag op rond je vorm.",
    href: "/train",
  },
]

export function GeneralDayHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const profile = data?.athleteProfile
  const [, navigate] = useLocation()

  return (
    <ScreenShell section="Home" bg="/concept-lab.png">
      <HomeIntro kicker="VANDAAG" profile={profile} isLoading={isLoading} />

      {!isLoading && <DayTypeBriefing config={briefing} />}

      {/* 01 KOM OP GANG — ≤3 stappen (grondregel 5) */}
      <section>
        <SectionLabel n="01" title="Kom op gang" large />
        <ul className="mt-4 space-y-3">
          {SETUP_STEPS.map((step, i) => (
            <li key={step.label}>
              <button
                type="button"
                onClick={() => navigate(step.href)}
                className="flex w-full items-start gap-4 rounded-xl border border-white/[0.07] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:bg-white/[0.05]"
              >
                <span
                  className="mt-0.5 font-mono text-[11px] tabular-nums"
                  style={{ color: ACCENT }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[14px] font-medium tracking-tight text-white/90">
                    {step.label}
                  </span>
                  <span className="text-[12px] leading-relaxed text-white/45">
                    {step.hint}
                  </span>
                </span>
              </button>
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
