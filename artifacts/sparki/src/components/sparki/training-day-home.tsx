import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useAiBrief } from "@/hooks/use-ai-brief"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { useUserProfile } from "@/contexts/UserContext"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useLoad } from "@/hooks/use-load"
import { useSessions } from "@/hooks/use-sessions"
import type { AthleteDailyMetric } from "@/lib/athlete-types"

function todayLabel() {
  return new Date().toLocaleDateString("nl-NL", {
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
    score >= 80 ? "PRIMED"
    : score >= 65 ? "GOED"
    : score >= 50 ? "MATIG"
    : "LAAG"
  const advice =
    score >= 80 ? "Training handhaven — condities zijn ideaal"
    : score >= 65 ? "Ga door — pas intensiteit aan indien nodig"
    : score >= 50 ? "Overweeg lagere intensiteit vandaag"
    : "Rust aanbevolen — herstel eerst"
  const detail =
    score >= 80
      ? "Je systeem is fris genoeg voor de volledige belasting. Geen aanpassing nodig."
      : score >= 65
        ? "Goed herstel zichtbaar. Luister naar je lichaam tijdens de opbouw."
        : score >= 50
          ? "Verlaag de doelbelasting met 10–15%. Matig herstel."
          : "Herstel heeft prioriteit. Actieve recovery of rust is de beste keuze."
  return { score, state, advice, detail }
}

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0
  const sign = value > 0 ? "+" : ""
  return (
    <span
      className="font-mono text-[10px] tabular-nums"
      style={{ color: positive ? ACCENT : "rgba(255,140,120,0.85)" }}
    >
      {sign}{value}
    </span>
  )
}

function ReactorReadiness({ metrics }: { metrics: Metrics }) {
  if (!metrics) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
          <span className="text-3xl font-extralight text-white/25">—</span>
        </div>
        <p className="text-center text-[12px] leading-relaxed text-white/35">
          Nog geen check-in · Log gereedheid in{" "}
          <span style={{ color: ACCENT }}>You</span>
        </p>
      </div>
    )
  }

  const result = computeReadiness(metrics)

  if (!result) {
    return (
      <p className="text-center text-[12px] text-white/35">
        Check-in gelogd · Voeg voel, slaap &amp; vermoeidheid toe
      </p>
    )
  }

  const { score, state, advice, detail } = result

  return (
    <div className="relative mt-2 flex flex-col items-center">
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
          Advies: {advice}
        </span>
      </div>
      <p className="mt-2 max-w-[16rem] text-pretty text-center text-[12px] leading-relaxed text-white/40">
        {detail}
      </p>
    </div>
  )
}

function VitalsGrid({ metrics }: { metrics: AthleteDailyMetric[] }) {
  const today = metrics[0] ?? null

  type VitalDef = {
    label: string
    value: string | null
    unit: string
    delta: number | null
    trend: number[]
    invert?: boolean
  }

  const entries: VitalDef[] = [
    {
      label: "HRV",
      value: today?.hrv != null ? String(Math.round(today.hrv)) : null,
      unit: "ms",
      delta: (() => {
        const vals = metrics.filter((m) => m.hrv != null).map((m) => m.hrv!)
        return vals.length >= 2 ? Math.round(vals[0] - vals[1]) : null
      })(),
      trend: metrics
        .slice()
        .reverse()
        .filter((m) => m.hrv != null)
        .map((m) => m.hrv!),
    },
    {
      label: "Slaap",
      value: today?.sleepHours != null ? today.sleepHours : null,
      unit: "hrs",
      delta: (() => {
        const vals = metrics
          .filter((m) => m.sleepHours != null)
          .map((m) => parseFloat(m.sleepHours!))
        return vals.length >= 2
          ? Math.round((vals[0] - vals[1]) * 10) / 10
          : null
      })(),
      trend: metrics
        .slice()
        .reverse()
        .filter((m) => m.sleepHours != null)
        .map((m) => parseFloat(m.sleepHours!)),
    },
    {
      label: "Rust HR",
      value: today?.restingHR != null ? String(today.restingHR) : null,
      unit: "bpm",
      delta: (() => {
        const vals = metrics
          .filter((m) => m.restingHR != null)
          .map((m) => m.restingHR!)
        return vals.length >= 2 ? Math.round(vals[0] - vals[1]) : null
      })(),
      trend: metrics
        .slice()
        .reverse()
        .filter((m) => m.restingHR != null)
        .map((m) => m.restingHR!),
      invert: true,
    },
    {
      label: "Vermoeidheid",
      value: today?.fatigueScore != null ? String(today.fatigueScore) : null,
      unit: "/10",
      delta: (() => {
        const vals = metrics
          .filter((m) => m.fatigueScore != null)
          .map((m) => m.fatigueScore!)
        return vals.length >= 2 ? Math.round(vals[0] - vals[1]) : null
      })(),
      trend: metrics
        .slice()
        .reverse()
        .filter((m) => m.fatigueScore != null)
        .map((m) => m.fatigueScore!),
      invert: true,
    },
  ]

  const hasAnyData = entries.some((e) => e.value !== null)
  if (!hasAnyData) {
    return (
      <p className="text-[12px] text-white/35">
        Log een check-in om je hersteldata te zien
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-6">
      {entries.map((vital) => (
        <div key={vital.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] tracking-[0.18em] text-white/40">
              {vital.label.toUpperCase()}
            </span>
            {vital.delta !== null && (
              <Delta value={vital.delta} invert={vital.invert} />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-sans text-2xl font-light tabular-nums">
              {vital.value ?? "—"}
            </span>
            <span className="font-mono text-[10px] text-white/35">{vital.unit}</span>
          </div>
          {vital.trend.length >= 2 ? (
            <Sparkline
              data={vital.trend}
              width={150}
              height={26}
              stroke={ACCENT}
              fill="rgba(120,210,230,0.08)"
              className="text-cyan-300"
            />
          ) : (
            <div className="h-[26px] rounded bg-white/[0.04]" />
          )}
        </div>
      ))}
    </div>
  )
}

const zoneColor: Record<number, string> = {
  1: "rgba(120,210,230,0.25)",
  2: "rgba(120,210,230,0.4)",
  4: "rgba(120,210,230,0.95)",
}

export function TrainingDayHome() {
  const { data, isLoading } = useAthleteDashboard()
  const aiEnabled = useFeatureFlag("ai_observations")
  const { data: brief, isLoading: briefLoading } = useAiBrief(aiEnabled)
  const { profile: userProfile } = useUserProfile()
  const { data: metricsHistory, isLoading: metricsLoading } = useDailyMetrics(14)
  const { data: loadData, isLoading: loadLoading } = useLoad()
  const { data: sessions } = useSessions(1)

  const firstName = userProfile?.displayName?.split(" ")[0] ?? "Atleet"
  const profile = data?.athleteProfile

  const ctlTrend = loadData?.chartData.map((d) => d.ctl) ?? []

  const bioAxes = (() => {
    const load = data?.load ?? { ctl: 0, atl: 0, tsb: 0 }
    const todayMetrics = data?.todayMetrics
    return [
      { key: "fitness", label: "Fitness", level: Math.min(load.ctl / 80, 1) },
      {
        key: "feel",
        label: "Voel",
        level: todayMetrics?.feelScore != null ? todayMetrics.feelScore / 5 : 0,
      },
      {
        key: "form",
        label: "Form",
        level: Math.min(Math.max((load.tsb + 30) / 60, 0), 1),
      },
      {
        key: "power",
        label: "Power",
        level: profile?.ftp != null ? Math.min(profile.ftp / 350, 1) : 0,
      },
      {
        key: "recovery",
        label: "Herstel",
        level:
          load.ctl > 0
            ? Math.min(Math.max(1 - load.atl / (load.ctl * 1.5), 0), 1)
            : 0,
      },
      {
        key: "consistency",
        label: "Consistentie",
        level: Math.min((sessions?.length ?? 0) / 10, 1),
      },
    ]
  })()

  const lastSession = sessions?.[0] ?? null

  return (
    <ScreenShell section="Home" bg="/concept-lab.png">
      {/* INTRO */}
      <div className="-mt-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
          {todayLabel().toUpperCase()} · TRAINING DAY
        </p>
        <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
          Goedemorgen, {firstName}.
        </h1>
        {isLoading ? (
          <Skeleton className="mt-1.5 h-4 w-40" />
        ) : profile?.ftp ? (
          <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
            {profile.discipline ?? "Wielrenner"} · FTP {profile.ftp}W
            {profile.wkg ? ` · ${profile.wkg} W/kg` : ""}
          </p>
        ) : (
          <p className="mt-1 font-mono text-[11px] tracking-wide text-white/35">
            Stel je FTP in bij{" "}
            <span style={{ color: ACCENT }}>Profiel</span> om te beginnen
          </p>
        )}
      </div>

      {/* 01 WAT GA IK VANDAAG DOEN */}
      <section>
        <SectionLabel n="01" title="Wat ga ik vandaag doen" large />
        <div className="mt-4">
          {isLoading ? (
            <Skeleton className="h-28 w-full rounded-2xl" />
          ) : data?.todayWorkout ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="font-sans text-2xl font-light tracking-tight">
                    {data.todayWorkout.title}
                  </h2>
                  <p className="mt-1 font-mono text-[11px] tracking-wide text-white/45">
                    {data.todayWorkout.type}
                    {data.todayWorkout.targetDurationMin
                      ? ` · ${data.todayWorkout.targetDurationMin}m`
                      : ""}
                    {data.todayWorkout.targetTSS
                      ? ` · ${data.todayWorkout.targetTSS} TSS`
                      : ""}
                  </p>
                </div>
                <span
                  className="font-mono text-[10px] tracking-[0.2em]"
                  style={{ color: ACCENT }}
                >
                  ZONE 4
                </span>
              </div>

              {/* week TSS bars as session load visualization */}
              {data.weekTSS && data.weekTSS.length > 0 && (
                <div className="mt-5 flex h-24 items-end gap-1.5">
                  {data.weekTSS.map(({ date, tss }) => {
                    const today = new Date().toISOString().split("T")[0]
                    const isToday = date === today
                    const maxTSS = Math.max(...data.weekTSS.map((d) => d.tss), 1)
                    const h = Math.max((tss / maxTSS) * 100, tss > 0 ? 8 : 0)
                    const day = new Date(date + "T12:00:00Z").toLocaleDateString(
                      "nl-NL",
                      { weekday: "narrow" },
                    )
                    return (
                      <div
                        key={date}
                        className="flex flex-1 flex-col items-center justify-end"
                        style={{ height: "100%" }}
                      >
                        <div
                          className="w-full rounded-t-sm"
                          style={{
                            height: `${h}%`,
                            minHeight: tss > 0 ? 3 : 0,
                            background: isToday
                              ? `linear-gradient(180deg, ${ACCENT}, rgba(120,210,230,0.15))`
                              : "rgba(120,210,230,0.3)",
                            boxShadow: isToday
                              ? "0 0 12px rgba(120,210,230,0.5)"
                              : "none",
                          }}
                        />
                        <span
                          className="mt-1.5 font-mono text-[7px] tracking-wider"
                          style={{
                            color: isToday ? ACCENT : "rgba(255,255,255,0.3)",
                          }}
                        >
                          {day}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* workout stats row */}
              <div className="mt-5 flex items-center gap-4 border-t border-white/[0.07] pt-4">
                <WorkoutStat label="Type" value={data.todayWorkout.type} />
                {data.todayWorkout.targetDurationMin && (
                  <>
                    <span className="h-7 w-px bg-white/[0.08]" />
                    <WorkoutStat
                      label="Duur"
                      value={`${data.todayWorkout.targetDurationMin}m`}
                    />
                  </>
                )}
                {data.todayWorkout.targetTSS && (
                  <>
                    <span className="h-7 w-px bg-white/[0.08]" />
                    <WorkoutStat
                      label="Belasting"
                      value={`${data.todayWorkout.targetTSS} TSS`}
                      accent
                    />
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/30">
                  GEEN PLAN VANDAAG
                </span>
                <span className="font-mono text-[9px] tracking-[0.18em] text-white/20">
                  Rustdag
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-white/35">
                Geen training gepland · Voeg toe via Train
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 02 BEN IK ER KLAAR VOOR */}
      <section>
        <SectionLabel n="02" title="Ben ik er klaar voor" large />
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

      {/* 03 WAAROM DENKT SPARKI DAT */}
      <section>
        <SectionLabel n="03" title="Waarom denkt Sparki dat" large />
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

      {/* SYSTEEMBALANS — BioRadar */}
      <section className="flex flex-col items-center">
        <div className="flex w-full items-center justify-between">
          <SectionLabel title="Systeembalans" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-white/30">
            6 SIGNALEN
          </span>
        </div>
        {isLoading || loadLoading ? (
          <Skeleton className="mt-4 h-64 w-64 rounded-full" />
        ) : (
          <BioRadar size={250} accent={ACCENT} axes={bioAxes} />
        )}
      </section>

      {/* 04 WAT MOET IK VANDAAG EXTRA WETEN — AI Coach */}
      {aiEnabled && (
        <section>
          <SectionLabel n="04" title="Wat moet ik vandaag extra weten" large />
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
                Log een check-in en plan een training voor je dagelijkse briefing.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 05 HOE ONTWIKKEL IK MIJ */}
      <section>
        <SectionLabel n="05" title="Hoe ontwikkel ik mij" large />

        {/* laatste training */}
        {lastSession && (
          <div className="mt-4">
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
              LAATSTE TRAINING
            </span>
            <div className="mt-2 flex items-center gap-5">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[9px] tracking-[0.16em] text-white/35">
                  {lastSession.title ?? lastSession.type}
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-5">
              {lastSession.normalizedPower != null && (
                <>
                  <AnalysisStat
                    label="Normalized"
                    value={`${lastSession.normalizedPower}W`}
                  />
                  <span className="h-7 w-px bg-white/[0.08]" />
                </>
              )}
              {lastSession.intensityFactor && (
                <>
                  <AnalysisStat label="IF" value={lastSession.intensityFactor} />
                  <span className="h-7 w-px bg-white/[0.08]" />
                </>
              )}
              {lastSession.tss != null && (
                <AnalysisStat
                  label="TSS"
                  value={String(lastSession.tss)}
                  accent
                />
              )}
            </div>
          </div>
        )}

        {/* ontwikkeling sparkline */}
        <div className={lastSession ? "mt-7 border-t border-white/[0.07] pt-5" : "mt-4"}>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
              ONTWIKKELING · FITHEID (CTL)
            </span>
            {data?.load?.ctl != null && (
              <span className="font-mono text-[11px] tabular-nums text-cyan-300/80">
                {data.load.ctl} CTL
              </span>
            )}
          </div>
          {loadLoading ? (
            <Skeleton className="mt-3 h-12 w-full" />
          ) : ctlTrend.length >= 2 ? (
            <div className="mt-3">
              <Sparkline
                data={ctlTrend}
                width={340}
                height={50}
                stroke={ACCENT}
                fill="rgba(120,210,230,0.07)"
                className="w-full text-cyan-300"
              />
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-white/35">
              Log sessies om je fitheidsontwikkeling te zien
            </p>
          )}
          {data?.load != null && (
            <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
              Fitness (CTL) {data.load.ctl} · Vermoeidheid (ATL) {data.load.atl} · Form (TSB){" "}
              {data.load.tsb > 0 ? "+" : ""}
              {data.load.tsb}
            </p>
          )}
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

function WorkoutStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] tracking-[0.18em] text-white/35">
        {label.toUpperCase()}
      </span>
      <span
        className="text-[13px] font-medium tracking-tight"
        style={{ color: accent ? ACCENT : "rgba(255,255,255,0.85)" }}
      >
        {value}
      </span>
    </div>
  )
}

function AnalysisStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] tracking-[0.16em] text-white/35">
        {label.toUpperCase()}
      </span>
      {value ? (
        <span
          className="font-sans text-lg font-light tabular-nums"
          style={{ color: accent ? ACCENT : "rgba(255,255,255,0.9)" }}
        >
          {value}
        </span>
      ) : null}
    </div>
  )
}
