import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useAiBrief } from "@/hooks/use-ai-brief"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { useUserProfile } from "@/contexts/UserContext"

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
  )
}

type Metrics = {
  feelScore?: number | null
  sleepQuality?: number | null
  fatigueScore?: number | null
  hrv?: number | null
} | null

function computeReadiness(m: Metrics) {
  if (!m) return null
  const feel = m.feelScore != null ? m.feelScore / 5 : null
  const sleep = m.sleepQuality != null ? m.sleepQuality / 5 : null
  const fatigue = m.fatigueScore != null ? (10 - m.fatigueScore) / 9 : null
  const parts = [feel, sleep, fatigue].filter((v): v is number => v !== null)
  if (parts.length === 0) return null
  const score = Math.round((parts.reduce((s, v) => s + v, 0) / parts.length) * 100)
  const state =
    score >= 80 ? "PEAK"
    : score >= 65 ? "GOOD"
    : score >= 50 ? "MODERATE"
    : "LOW"
  const advice =
    score >= 80 ? "Maintain full session — conditions are ideal"
    : score >= 65 ? "Go ahead — manage effort if needed"
    : score >= 50 ? "Consider lower intensity today"
    : "Rest recommended — recovery first"
  return { score, state, advice }
}

function ReactorReadiness({ metrics }: { metrics: Metrics }) {
  if (!metrics) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
          <span className="text-3xl font-extralight text-white/25">—</span>
        </div>
        <p className="text-center text-[12px] leading-relaxed text-white/35">
          No check-in yet · Log readiness in{" "}
          <span style={{ color: ACCENT }}>You</span>
        </p>
      </div>
    )
  }

  const result = computeReadiness(metrics)

  if (!result) {
    return (
      <p className="text-center text-[12px] text-white/35">
        Check-in logged · Add feel, sleep &amp; fatigue data
      </p>
    )
  }

  const { score, state, advice } = result

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center py-2">
        <SparkiCore
          size={240}
          accent={ACCENT}
          readiness={score / 100}
          variant="reactor"
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/80">
            READINESS
          </span>
          <span
            className="font-sans text-7xl font-extralight leading-none tabular-nums"
            style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
          >
            {score}
          </span>
          <span className="mt-1 font-mono text-[11px] tracking-[0.25em] text-white/50">
            {state}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 backdrop-blur-sm">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
        />
        <span className="text-sm font-medium leading-tight tracking-tight text-white/90">
          {advice}
        </span>
      </div>
    </div>
  )
}

function WorkoutCard({
  workout,
}: {
  workout: {
    title: string
    type: string
    targetDurationMin?: number | null
    targetTSS?: number | null
    status: string
  } | null
}) {
  if (!workout) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <span className="label-sm text-white/30">NO PLAN TODAY</span>
          <span className="label-xs text-white/20">Rest day</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-white/35">
          No workout scheduled · Add one in Today
        </p>
      </div>
    )
  }

  const statusColor =
    workout.status === "completed"
      ? ACCENT
      : workout.status === "skipped"
        ? "rgba(255,140,120,0.7)"
        : "rgba(255,200,120,0.8)"

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className="label-xs text-white/35">
            {workout.type.toUpperCase()}
          </span>
          <h2 className="mt-1 text-pretty font-sans text-xl font-light leading-tight tracking-tight">
            {workout.title}
          </h2>
        </div>
        <span
          className="shrink-0 rounded-full border px-2.5 py-1 label-xs"
          style={{
            color: statusColor,
            borderColor: `${statusColor.replace("1)", "0.3)")}`,
            background: `${statusColor.replace("1)", "0.08)")}`,
          }}
        >
          {workout.status.toUpperCase()}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-5">
        {workout.targetDurationMin != null && (
          <>
            <div className="flex flex-col gap-1">
              <span className="label-xs text-white/35">DURATION</span>
              <span className="font-sans text-[15px] font-light tabular-nums text-white/90">
                {workout.targetDurationMin}min
              </span>
            </div>
            <span className="h-7 w-px bg-white/[0.08]" />
          </>
        )}
        {workout.targetTSS != null && (
          <div className="flex flex-col gap-1">
            <span className="label-xs text-white/35">TSS</span>
            <span className="font-sans text-[15px] font-light tabular-nums text-white/90">
              {workout.targetTSS}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function WeekTSSBars({
  weekTSS,
}: {
  weekTSS: Array<{ date: string; tss: number }>
}) {
  const max = Math.max(...weekTSS.map((d) => d.tss), 1)
  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="flex h-12 items-end gap-1.5">
      {weekTSS.map(({ date, tss }) => {
        const isToday = date === today
        const h = Math.max((tss / max) * 100, tss > 0 ? 8 : 0)
        const day = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
          weekday: "narrow",
        })
        return (
          <div
            key={date}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <div className="relative flex w-full flex-1 items-end">
              {tss > 0 ? (
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${h}%`,
                    minHeight: 3,
                    background: isToday
                      ? `linear-gradient(180deg, ${ACCENT}, rgba(120,210,230,0.15))`
                      : "rgba(120,210,230,0.3)",
                    boxShadow: isToday ? `0 0 8px rgba(120,210,230,0.4)` : "none",
                  }}
                />
              ) : (
                <div
                  className="w-full rounded-t-sm bg-white/[0.05]"
                  style={{ height: 3 }}
                />
              )}
            </div>
            <span
              className="label-xs"
              style={{ color: isToday ? ACCENT : "rgba(255,255,255,0.25)" }}
            >
              {day}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function TrainingDayHome() {
  const { data, isLoading } = useAthleteDashboard()
  const aiEnabled = useFeatureFlag("ai_observations")
  const { data: brief, isLoading: briefLoading } = useAiBrief(aiEnabled)
  const { profile: userProfile } = useUserProfile()

  const firstName = userProfile?.displayName?.split(" ")[0] ?? "Athlete"

  return (
    <ScreenShell section="Home">
      {/* GREETING */}
      <div className="-mt-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
          {todayLabel().toUpperCase()} · PERFORMANCE CENTER
        </p>
        <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
          Good morning, {firstName}.
        </h1>
        {isLoading ? (
          <Skeleton className="mt-1.5 h-4 w-40" />
        ) : data?.athleteProfile?.ftp ? (
          <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
            {data.athleteProfile.discipline ?? "Cyclist"} · FTP{" "}
            {data.athleteProfile.ftp}W
            {data.athleteProfile.wkg ? ` · ${data.athleteProfile.wkg} W/kg` : ""}
          </p>
        ) : (
          <p className="mt-1 font-mono text-[11px] tracking-wide text-white/35">
            Set your FTP in{" "}
            <span style={{ color: ACCENT }}>Profile</span> to get started
          </p>
        )}
      </div>

      {/* TODAY'S WORKOUT */}
      <section>
        <SectionLabel n="01" title="Today" />
        <div className="mt-4">
          {isLoading ? (
            <Skeleton className="h-28 w-full rounded-2xl" />
          ) : (
            <WorkoutCard workout={data?.todayWorkout ?? null} />
          )}
        </div>
      </section>

      {/* READINESS */}
      <section>
        <SectionLabel n="02" title="Readiness" />
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

      {/* 7-DAY LOAD */}
      <section>
        <SectionLabel n="03" title="7-Day Load" />
        <div className="mt-4">
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : data?.weekTSS ? (
            <>
              <WeekTSSBars weekTSS={data.weekTSS} />
              <div className="mt-4 flex items-center gap-5">
                <div className="flex flex-col gap-1">
                  <span className="label-xs text-white/35">FITNESS (CTL)</span>
                  <span
                    className="font-sans text-[15px] font-light tabular-nums"
                    style={{
                      color: ACCENT,
                      fontVariantNumeric: "tabular-nums lining-nums",
                    }}
                  >
                    {data.load.ctl}
                  </span>
                </div>
                <span className="h-7 w-px bg-white/[0.08]" />
                <div className="flex flex-col gap-1">
                  <span className="label-xs text-white/35">FATIGUE (ATL)</span>
                  <span
                    className="font-sans text-[15px] font-light tabular-nums text-white/90"
                    style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
                  >
                    {data.load.atl}
                  </span>
                </div>
                <span className="h-7 w-px bg-white/[0.08]" />
                <div className="flex flex-col gap-1">
                  <span className="label-xs text-white/35">FORM (TSB)</span>
                  <span
                    className="font-sans text-[15px] font-light tabular-nums"
                    style={{
                      color:
                        data.load.tsb >= 0 ? ACCENT : "rgba(255,140,120,0.85)",
                      fontVariantNumeric: "tabular-nums lining-nums",
                    }}
                  >
                    {data.load.tsb > 0 ? "+" : ""}
                    {data.load.tsb}
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* SPARKI AI BRIEF — gated by feature flag */}
      {aiEnabled && (
        <section>
          <SectionLabel n="04" title="Sparki Says" />
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 animate-breathe rounded-full"
              style={{
                background: `radial-gradient(circle, ${ACCENT}, transparent 70%)`,
                opacity: 0.18,
              }}
            />
            <div className="flex items-center gap-2">
              <SparkiCore size={28} accent={ACCENT} readiness={0.9} variant="orb" />
              <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">
                AI COACH
              </span>
            </div>
            {briefLoading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : brief ? (
              <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/75">
                {brief.brief}
              </p>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-white/35">
                Log a check-in and plan a workout to get your daily brief.
              </p>
            )}
          </div>
        </section>
      )}

      <footer className="pt-2 text-center">
        <span className="label-xs text-white/20">SPARKI AI PERFORMANCE CENTER</span>
      </footer>
    </ScreenShell>
  )
}
