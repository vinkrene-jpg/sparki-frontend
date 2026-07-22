import { useLocation } from "wouter"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { Sparkline } from "@/components/sparki/primitives"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { UitlegDot } from "@/components/viz/uitleg"
import {
  weeklyBuckets,
  trendDir,
  volumeTrend,
  type TrendDir,
} from "@/lib/progression"
import type { TrainingSession } from "@/lib/athlete-types"
import type { LoadData } from "@/hooks/use-load"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

const CTL_VERDICT: Record<TrendDir, string> = {
  up: "Je fitheid bouwt op — je vorm stijgt over deze periode.",
  flat: "Je fitheid is stabiel — je houdt je niveau goed vast.",
  down: "Je fitheid zakt iets — je traint nu minder dan je lichaam gewend was.",
}

const VOLUME_VERDICT: Record<TrendDir, string> = {
  up: "Je trainingsvolume neemt toe vergeleken met de weken ervoor.",
  flat: "Je trainingsvolume blijft gelijkmatig — mooie regelmaat.",
  down: "Je trainingsvolume daalt — minder belasting dan eerder.",
}

const trendColor = (d: TrendDir) =>
  d === "down" ? "rgba(255,140,120,0.9)" : ACCENT

export function TrainingProgression({
  sessions,
  chartData,
  loading,
  n = "06",
  hideLabel = false,
}: {
  sessions: TrainingSession[] | undefined
  chartData: LoadData["chartData"] | undefined
  loading: boolean
  n?: string
  hideLabel?: boolean
}) {
  const [, navigate] = useLocation()
  const weeks = 6
  const buckets = weeklyBuckets(sessions ?? [], weeks)
  const totalSessions = buckets.reduce((a, b) => a + b.sessions, 0)
  const maxTss = Math.max(1, ...buckets.map((b) => b.totalTss))

  // CTL (fitness) trajectory over the load window.
  const ctlSeries = (chartData ?? []).map((d) => d.ctl).filter((v) => v >= 0)
  const hasCtl = ctlSeries.length >= 7 && ctlSeries.some((v) => v > 0)
  const ctlFirst = ctlSeries[0] ?? 0
  const ctlLast = ctlSeries[ctlSeries.length - 1] ?? 0
  const ctlDir = trendDir(ctlFirst, ctlLast)
  const ctlDelta = Math.round(ctlLast - ctlFirst)

  const volDir = volumeTrend(buckets)

  return (
    <section>
      {!hideLabel && (
        <>
          <SectionLabel n={n} title="Trainingsverloop" />
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
            Niet alleen vandaag — zo ontwikkel je je over meerdere trainingen heen.
          </p>
        </>
      )}

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Fitness (CTL) trajectory */}
          <div className="mt-4 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
            <div className="flex items-baseline justify-between">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] text-white/35">
                FITHEID (CTL)
                <UitlegDot uitlegKey="fitheid" label="Fitheid (CTL)" />
              </span>
              {hasCtl && (
                <span className="font-mono text-[10px] tracking-wide text-white/35">
                  laatste {ctlSeries.length} dagen
                </span>
              )}
            </div>
            {hasCtl ? (
              <>
                <div className="mt-3 flex items-end justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-sans text-4xl font-extralight tabular-nums">
                      {Math.round(ctlLast)}
                    </span>
                    <span className="font-mono text-[11px] text-white/35">
                      CTL
                    </span>
                  </div>
                  {ctlDelta !== 0 && (
                    <span
                      className="font-mono text-[11px] tabular-nums"
                      style={{ color: trendColor(ctlDir) }}
                    >
                      {ctlDelta > 0 ? "+" : ""}
                      {ctlDelta} in deze periode
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <Sparkline
                    data={ctlSeries}
                    width={340}
                    height={48}
                    stroke={ACCENT}
                    fill="rgba(120,210,230,0.07)"
                    className="w-full text-cyan-300"
                  />
                </div>
                <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/45">
                  {CTL_VERDICT[ctlDir]}
                </p>
              </>
            ) : (
              <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
                Nog te weinig gelogde belasting voor een fitheidsverloop. Log je
                trainingen een paar weken, dan wordt je opbouw zichtbaar.
              </p>
            )}
          </div>

          {/* Weekly training volume */}
          <div className="mt-4 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
            <div className="flex items-baseline justify-between">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] text-white/35">
                TRAININGSVOLUME · {weeks} WEKEN
                <UitlegDot uitlegKey="belasting" label="Trainingsvolume" />
              </span>
              <span className="font-mono text-[10px] tracking-wide text-white/35">
                belasting / week
              </span>
            </div>
            {totalSessions < 2 ? (
              <div className="mt-3">
                <MissingInputNotice
                  compact
                  showOrb={false}
                  title="Nog te weinig sessies"
                  description="Er zijn een paar gelogde trainingen nodig om je volume en ontwikkeling per week te tonen."
                  primary={{
                    label: "Log een training",
                    onClick: () => navigate("/train?focus=logsession"),
                  }}
                  actions={[
                    {
                      label: "Koppel een platform",
                      onClick: () => navigate("/you?focus=connections"),
                    },
                  ]}
                />
              </div>
            ) : (
              <>
                <div className="mt-4 flex h-24 items-end gap-2">
                  {buckets.map((b, i) => {
                    const h = (b.totalTss / maxTss) * 80 + 4
                    const isLast = i === buckets.length - 1
                    return (
                      <div
                        key={b.weekStart}
                        className="flex flex-1 flex-col items-center gap-1.5"
                      >
                        <span className="font-mono text-[9px] tabular-nums text-white/35">
                          {b.totalTss > 0 ? b.totalTss : ""}
                        </span>
                        <div className="relative h-20 w-full">
                          <div
                            className="absolute inset-x-0 bottom-0 rounded-t-sm"
                            style={{
                              height: `${h}px`,
                              background: isLast
                                ? `linear-gradient(180deg, ${ACCENT}, rgba(120,210,230,0.2))`
                                : "rgba(120,210,230,0.25)",
                              boxShadow: isLast
                                ? `0 0 10px rgba(120,210,230,0.4)`
                                : "none",
                            }}
                          />
                        </div>
                        <span className="font-mono text-[8px] tracking-wider text-white/30">
                          {b.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {volDir && (
                  <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/45">
                    {VOLUME_VERDICT[volDir]}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
