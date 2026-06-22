import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useAiBrief } from "@/hooks/use-ai-brief"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { useUserProfile } from "@/contexts/UserContext"
import { Zap, BedDouble, HeartPulse, Flame } from "lucide-react"

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/[0.06] ${className}`}
    />
  )
}

function ReadinessWidget({
  metrics,
}: {
  metrics: {
    feelScore?: number | null
    sleepQuality?: number | null
    fatigueScore?: number | null
    hrv?: number | null
  } | null
}) {
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

  const items: Array<{
    icon: typeof Zap
    label: string
    value: string
    level: number
  }> = []

  if (metrics.feelScore != null)
    items.push({
      icon: Zap,
      label: "Feel",
      value: `${metrics.feelScore}/5`,
      level: metrics.feelScore / 5,
    })
  if (metrics.sleepQuality != null)
    items.push({
      icon: BedDouble,
      label: "Sleep",
      value: `${metrics.sleepQuality}/5`,
      level: metrics.sleepQuality / 5,
    })
  if (metrics.fatigueScore != null)
    items.push({
      icon: Flame,
      label: "Fatigue",
      value: `${metrics.fatigueScore}/10`,
      level: 1 - metrics.fatigueScore / 10,
    })
  if (metrics.hrv != null)
    items.push({
      icon: HeartPulse,
      label: "HRV",
      value: `${metrics.hrv}ms`,
      level: Math.min(metrics.hrv / 120, 1),
    })

  if (items.length === 0) {
    return (
      <p className="text-center text-[12px] text-white/35">
        Check-in logged · Add more data in You
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-4">
      {items.map(({ icon: Icon, label, value, level }) => (
        <div key={label} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
              <span className="label-xs text-white/40">{label.toUpperCase()}</span>
            </div>
            <span
              className="font-sans text-[11px] font-light tabular-nums"
              style={{
                color: ACCENT,
                fontVariantNumeric: "tabular-nums lining-nums",
              }}
            >
              {value}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round(level * 100)}%`,
                background: ACCENT,
                boxShadow: `0 0 6px ${ACCENT}`,
              }}
            />
          </div>
        </div>
      ))}
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
                    boxShadow: isToday
                      ? `0 0 8px rgba(120,210,230,0.4)`
                      : "none",
                  }}
                />
              ) : (
                <div className="w-full rounded-t-sm bg-white/[0.05]" style={{ height: 3 }} />
              )}
            </div>
            <span
              className="label-xs"
              style={{
                color: isToday ? ACCENT : "rgba(255,255,255,0.25)",
              }}
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

  const firstName =
    userProfile?.displayName?.split(" ")[0] ?? "Athlete"

  return (
    <ScreenShell section="Home">
      {/* GREETING */}
      <div className="-mt-2">
        <p className="label-sm text-white/35">
          {todayLabel().toUpperCase()} · PERFORMANCE CENTER
        </p>
        <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
          Good morning, {firstName}.
        </h1>
        {isLoading ? (
          <Skeleton className="mt-1.5 h-4 w-40" />
        ) : data?.athleteProfile?.ftp ? (
          <p className="mt-1.5 label-sm text-white/40">
            {data.athleteProfile.discipline ?? "Cyclist"} · FTP{" "}
            {data.athleteProfile.ftp}W
            {data.athleteProfile.wkg ? ` · ${data.athleteProfile.wkg} W/kg` : ""}
          </p>
        ) : (
          <p className="mt-1.5 label-sm text-white/35">
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
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ReadinessWidget metrics={data?.todayMetrics ?? null} />
          )}
        </div>
      </section>

      {/* TRAINING LOAD */}
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
                    style={{ color: ACCENT, fontVariantNumeric: "tabular-nums lining-nums" }}
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
                        data.load.tsb >= 0
                          ? ACCENT
                          : "rgba(255,140,120,0.85)",
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
        <span className="label-xs text-white/20">
          SPARKI AI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
