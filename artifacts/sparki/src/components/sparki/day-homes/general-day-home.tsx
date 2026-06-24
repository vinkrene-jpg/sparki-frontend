// General / no-training fallback homepage (blueprint §4 #9). Shown when there is
// NO planned workout at all — distinct from an explicitly planned Rest day (#8).
// It still surfaces a full picture: readiness, recovery data and ≤3 suggestions
// so the day is never empty. For brand-new athletes (no profile) it instead
// leads with a short onboarding list. Honours grondregel 5 (one primary action,
// ≤3 recommendations) and grondregel 3 (external data is labeled, never faked).

import { useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import {
  HomeIntro,
  ReactorReadiness,
  VitalsGrid,
  Skeleton,
} from "@/components/sparki/home-sections"
import { HealthStatusControl } from "@/components/sparki/health-status-control"
import { QuickActionButton } from "@/components/sparki/coach-input-actions"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useRaces } from "@/hooks/use-races"
import { computeDayAdvice, type DayAdvice } from "@/lib/day-advice"
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
  const { data: metricsHistory, isLoading: metricsLoading } = useDailyMetrics(14)
  const { data: races } = useRaces()
  const profile = data?.athleteProfile
  const [, navigate] = useLocation()

  // Concrete, explainable advice for a no-plan day — built from the athlete's
  // real signals (check-in, form, weekly hours, FTP, nearest race). Null until
  // there's a check-in to base readiness on (the reactor prompts for one).
  const advice = computeDayAdvice({
    profile: profile ?? null,
    metrics: data?.todayMetrics ?? null,
    load: data?.load ?? null,
    races,
  })

  // Brand-new athletes (no profile yet) get the onboarding flow; established
  // athletes with simply no plan today get the rich no-training fallback.
  const isOnboarding = !isLoading && !profile

  return (
    <ScreenShell section="Home" bg="/concept-lab.png">
      <HomeIntro kicker="VANDAAG" profile={profile} isLoading={isLoading} />

      {!isLoading && <DayTypeBriefing config={briefing} />}

      {isOnboarding ? (
        /* 01 KOM OP GANG — onboarding, ≤3 stappen (grondregel 5) */
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
      ) : (
        <>
          {/* 01 BEN IK ER KLAAR VOOR — readiness blijft centraal */}
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

          {/* 03 WAT NU — één concreet, uitlegbaar advies (grondregel 5) */}
          <section>
            <SectionLabel n="03" title="Wat nu" large />
            <div className="mt-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4 rounded" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : advice ? (
                <DayAdviceCard
                  advice={advice}
                  onPrimary={() => navigate(advice.primary.href)}
                />
              ) : (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-white/[0.07] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
                  <p className="text-[13px] leading-relaxed text-white/70">
                    Log je check-in van vandaag, dan zet Sparki hier een concreet
                    advies neer op basis van je vorm, FTP en doel.
                  </p>
                  <QuickActionButton action="checkin" />
                </div>
              )}
            </div>
          </section>

          <HealthStatusControl />
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

// One concrete, explainable recommendation: a headline with real numbers, the
// power band (when an FTP is known), what to focus on, and a "waarom" that cites
// each signal Sparki weighed. Replaces the old generic no-training tips.
function DayAdviceCard({
  advice,
  onPrimary,
}: {
  advice: DayAdvice
  onPrimary: () => void
}) {
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span
          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
        />
        <div className="flex-1">
          <p className="text-[15px] font-medium leading-snug tracking-tight text-white/95">
            {advice.headline}
          </p>
          {advice.power && (
            <p className="mt-1.5 font-mono text-[12px] tabular-nums tracking-wide text-cyan-300/90">
              {advice.power.low}–{advice.power.high} W · {advice.power.label}
            </p>
          )}
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">
            {advice.focus}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.07] pt-4">
        <p className="font-mono text-[10px] tracking-[0.18em] text-white/40">
          WAAROM DIT ADVIES
        </p>
        <ul className="mt-3 space-y-2.5">
          {advice.reasons.map((reason) => (
            <li key={reason} className="flex gap-2.5">
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                style={{ background: "rgba(120,210,230,0.7)" }}
              />
              <span className="text-[12.5px] leading-relaxed text-white/70">
                {reason}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onPrimary}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/[0.08] px-5 py-2.5 text-[13px] font-medium tracking-tight text-white/90 transition-colors hover:bg-cyan-300/[0.14]"
      >
        {advice.primary.label}
        <span aria-hidden="true" style={{ color: ACCENT }}>
          →
        </span>
      </button>
    </div>
  )
}
