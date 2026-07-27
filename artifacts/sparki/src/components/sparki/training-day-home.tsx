import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { HumorLine } from "@/components/sparki/humor-line"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useAiBrief } from "@/hooks/use-ai-brief"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useLoad } from "@/hooks/use-load"
import { useSessions } from "@/hooks/use-sessions"
import type { DayType, DayTypeBriefingConfig } from "@/lib/day-type"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HealthStatusControl } from "@/components/sparki/health-status-control"
import {
  HomeIntro,
  ReactorReadiness,
  VitalsGrid,
  Skeleton,
} from "@/components/sparki/home-sections"
import { WorkoutDetailDrawer } from "@/components/sparki/workout-detail-drawer"
import { QuickActionButton } from "@/components/sparki/coach-input-actions"
import { GoalContextLine } from "@/components/sparki/goal-context-line"
import { useState } from "react"
import { ChevronRight } from "lucide-react"


const zoneColor: Record<number, string> = {
  1: "rgba(120,210,230,0.25)",
  2: "rgba(120,210,230,0.4)",
  4: "rgba(120,210,230,0.95)",
}

// Training-day homepage (blueprint §4: Coach Training & Sparki Training). The
// full execution-focused home — workout, readiness, vitals, system balance, AI
// coach and development. Selected by the DayHome dispatcher; `briefing` and
// `dayType` are resolved upstream so this component only renders.
export function TrainingDayHome({
  dayType,
  briefing,
}: {
  dayType: DayType
  briefing: DayTypeBriefingConfig
}) {
  const { data, isLoading } = useAthleteDashboard()
  const [detailOpen, setDetailOpen] = useState(false)
  const aiEnabled = useFeatureFlag("ai_observations")
  const { data: brief, isLoading: briefLoading } = useAiBrief(aiEnabled)
  const { data: metricsHistory, isLoading: metricsLoading } = useDailyMetrics(14)
  const { data: loadData, isLoading: loadLoading } = useLoad()
  const { data: sessions } = useSessions(1)

  const profile = data?.athleteProfile
  const isCoachDay = dayType === "coach_training"

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
      <HomeIntro
        kicker={isCoachDay ? "COACH-TRAINING" : "TRAINING DAY"}
        profile={profile}
        isLoading={isLoading}
      />

      {/* DAGTYPE BRIEFING — wat is vandaag & waarom (blueprint §4) */}
      {!isLoading && <DayTypeBriefing config={briefing} />}

      {/* 01 WAT GA IK VANDAAG DOEN */}
      <section>
        <SectionLabel n="01" title="Wat ga ik vandaag doen" large />
        <div className="mt-4">
          {isLoading ? (
            <Skeleton className="h-28 w-full rounded-2xl" />
          ) : data?.todayWorkout ? (
            <>
              {isCoachDay ? (
                <div className="space-y-3">
                  {/* COACH ZEGT — het plan + notities, of een expliciete
                      interpretatie-melding wanneer er geen notities zijn. */}
                  <div
                    className="rounded-2xl border p-5 backdrop-blur-md"
                    style={{
                      borderColor: "rgba(170,235,248,0.25)",
                      background: "rgba(10,20,30,0.82)",
                    }}
                  >
                    <span
                      className="font-mono text-[10px] tracking-[0.22em]"
                      style={{ color: "rgba(170,235,248,0.95)" }}
                    >
                      COACH ZEGT
                    </span>
                    <h2 className="mt-2 font-sans text-2xl font-light tracking-tight">
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
                    {data.todayWorkout.description ? (
                      <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/75">
                        {data.todayWorkout.description}
                      </p>
                    ) : (
                      <p className="mt-3 text-pretty text-[12px] italic leading-relaxed text-white/45">
                        Geen notities van je coach — Sparki interpreteert het doel
                        hieronder.
                      </p>
                    )}
                  </div>

                  {/* SPARKI LEGT UIT — ondersteunt de coach, vervangt nooit
                      (grondregel 4: coach first). Alleen afgeleide/echte data;
                      externe bronnen zijn expliciet gelabeld, nooit verzonnen. */}
                  <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                      <SparkiCore
                        size={20}
                        accent={ACCENT}
                        readiness={0.9}
                        variant="orb"
                      />
                      <span
                        className="font-mono text-[10px] tracking-[0.22em]"
                        style={{ color: ACCENT }}
                      >
                        SPARKI LEGT UIT
                      </span>
                    </div>
                    <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-white/70">
                      <li>
                        Verwachte belasting:{" "}
                        {data.todayWorkout.targetTSS
                          ? `${data.todayWorkout.targetTSS} TSS`
                          : "—"}
                        {data.todayWorkout.targetDurationMin
                          ? ` · ${data.todayWorkout.targetDurationMin} min`
                          : ""}
                        .
                      </li>
                      {data?.load != null && (
                        <li>
                          Je huidige vorm (TSB) is {data.load.tsb > 0 ? "+" : ""}
                          {data.load.tsb} —{" "}
                          {data.load.tsb >= 0
                            ? "fris genoeg voor kwaliteit"
                            : "let op vermoeidheid"}
                          .
                        </li>
                      )}
                      <li className="text-white/45">
                        Weer, route &amp; beste vertrektijd — externe koppeling
                        volgt (nog geen live data).
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
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
                    <p
                      className="mt-1.5 font-mono text-[10px] tracking-[0.16em]"
                      style={{ color: ACCENT }}
                    >
                      SPARKI LEGT UIT · afgestemd op je vorm
                    </p>
                  </div>
                  <span
                    className="font-mono text-[10px] tracking-[0.2em]"
                    style={{ color: ACCENT }}
                  >
                    ZONE 4
                  </span>
                </div>
              )}

              {/* DOEL-CONTEXT — welk doel deze training dient (alleen bij een
                  echt actief/afgeleid doel; eerlijk leeg anders). Klik opent
                  het Doelen-werkblad op /you. */}
              <GoalContextLine />

              {/* week TSS bars as session load visualization */}
              {data.weekTSS && data.weekTSS.length > 0 && (
                <div className="mt-5 flex h-24 items-end gap-1.5">
                  {data.weekTSS.map(({ date, tss }) => {
                    const n = new Date()
                    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`
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

              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="group mt-4 flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-cyan-300/25"
              >
                <span className="font-mono text-[10px] tracking-[0.18em] text-white/55 transition-colors group-hover:text-cyan-300/70">
                  BEKIJK VOLLEDIGE TRAINING
                </span>
                <ChevronRight
                  className="h-4 w-4 text-white/30 transition-colors group-hover:text-cyan-300/60"
                  strokeWidth={1.75}
                />
              </button>

            </>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/30">
                  GEEN PLAN VANDAAG
                </span>
                <span className="font-mono text-[9px] tracking-[0.18em] text-white/20">
                  Rustdag
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-white/35">
                Geen training gepland — voeg een wedstrijd toe en Sparki plant je
                opbouw.
              </p>
              <div className="mt-3">
                <QuickActionButton action="race" />
              </div>
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

      {/* 03 WAAROM DEZE TRAINING */}
      <section>
        <SectionLabel n="03" title="Waarom deze training" large />
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
            <div className="flex flex-col items-start gap-3">
              <p className="text-[12px] text-white/35">
                Nog geen hersteldata — vul je check-in in om dit te zien
              </p>
              <QuickActionButton action="checkin" />
            </div>
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
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
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
                SPARKI
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
              <div className="mt-3 flex flex-col items-start gap-3">
                <p className="text-[13px] leading-relaxed text-white/35">
                  Vul je check-in in zodat Sparki je dagelijkse briefing kan
                  opstellen.
                </p>
                <QuickActionButton action="checkin" />
              </div>
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
                  label="Belasting (TSS)"
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

      <HealthStatusControl />

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>

      <WorkoutDetailDrawer
        workoutId={data?.todayWorkout?.id ?? null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
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
