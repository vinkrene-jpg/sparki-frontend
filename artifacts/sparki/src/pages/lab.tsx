import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useLoad } from "@/hooks/use-load"
import { useFtpHistory } from "@/hooks/use-ftp-history"
import { useSessions } from "@/hooks/use-sessions"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

const ATL_COLOR = "rgba(255,200,120,0.8)"
const TSB_COLOR = "rgba(255,255,255,0.45)"

function LoadChart({
  chartData,
}: {
  chartData: Array<{ date: string; ctl: number; atl: number; tsb: number }>
}) {
  const w = 340
  const h = 100

  if (chartData.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center text-[12px] text-white/25">
        Log sessions to see your fitness curve
      </div>
    )
  }

  const allVals = chartData.flatMap((d) => [d.ctl, d.atl, d.tsb])
  const min = Math.min(...allVals)
  const max = Math.max(...allVals, 1)
  const range = max - min || 1
  const n = chartData.length

  const x = (i: number) => (i / (n - 1)) * w
  const y = (v: number) => h - ((v - min) / range) * (h - 8) - 4

  const path = (arr: number[]) =>
    arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={path(chartData.map((d) => d.tsb))}
        fill="none"
        stroke={TSB_COLOR}
        strokeWidth="1.2"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={path(chartData.map((d) => d.atl))}
        fill="none"
        stroke={ATL_COLOR}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={path(chartData.map((d) => d.ctl))}
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 4px ${ACCENT})` }}
      />
    </svg>
  )
}

function FtpBars({
  history,
}: {
  history: Array<{ ftpWatts: number; measuredAt: string }>
}) {
  if (history.length === 0) {
    return (
      <p className="text-[12px] text-white/25">
        No FTP tests logged yet · Set your FTP in Profile
      </p>
    )
  }

  const sorted = [...history].sort((a, b) =>
    a.measuredAt.localeCompare(b.measuredAt),
  )
  const min = Math.min(...sorted.map((h) => h.ftpWatts)) - 10
  const max = Math.max(...sorted.map((h) => h.ftpWatts))
  const range = max - min || 1

  const first = sorted[0]?.ftpWatts ?? 0
  const last = sorted[sorted.length - 1]?.ftpWatts ?? 0
  const delta = last - first

  return (
    <div>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-sans text-4xl font-extralight tabular-nums"
            style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
          >
            {last}
          </span>
          <span className="font-mono text-[11px] text-white/35">W</span>
        </div>
        {delta !== 0 && (
          <span
            className="label-xs"
            style={{ color: delta > 0 ? ACCENT : "rgba(255,140,120,0.85)" }}
          >
            {delta > 0 ? "+" : ""}
            {delta}W all-time
          </span>
        )}
      </div>
      <div className="mt-4 flex h-20 items-end gap-2">
        {sorted.map((entry, i) => {
          const h = ((entry.ftpWatts - min) / range) * 68 + 8
          const isLast = i === sorted.length - 1
          const month = new Date(
            entry.measuredAt + "T12:00:00Z",
          ).toLocaleDateString("en-US", { month: "short" })
          return (
            <div
              key={entry.measuredAt + i}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
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
              <span className="label-xs text-white/30">{month}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function LabPage() {
  const { data: load, isLoading: loadLoading } = useLoad()
  const { data: ftpHistory, isLoading: ftpLoading } = useFtpHistory()
  const { data: sessions, isLoading: sessionsLoading } = useSessions(10)

  const formIcon =
    !load ? null
    : load.tsb > 5 ? TrendingUp
    : load.tsb < -10 ? TrendingDown
    : Minus

  const formLabel =
    !load ? "—"
    : load.tsb > 10 ? "Fresh"
    : load.tsb > 5 ? "Rested"
    : load.tsb > -5 ? "Neutral"
    : load.tsb > -15 ? "Tired"
    : "Very tired"

  const FormIcon = formIcon ?? Minus

  return (
    <ScreenShell section="Lab">
      {/* HEADER */}
      <div className="-mt-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">PERFORMANCE LAB</p>
        <h1 className="mt-2 font-sans text-3xl font-extralight leading-tight tracking-tight">
          Progress
        </h1>
      </div>

      {/* 01 FITNESS & FORM */}
      <section>
        <SectionLabel n="01" title="Fitness & Form" />

        {loadLoading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : load ? (
          <>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} />
                <span className="label-xs text-white/45">FITNESS (CTL)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: ATL_COLOR }} />
                <span className="label-xs text-white/45">FATIGUE (ATL)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: TSB_COLOR }} />
                <span className="label-xs text-white/45">FORM</span>
              </div>
            </div>

            <div className="relative mt-4 h-24">
              <LoadChart chartData={load.chartData} />
            </div>

            <div className="mt-5 flex items-center gap-5 border-t border-white/[0.07] pt-4">
              <div className="flex flex-col gap-1">
                <span className="label-xs text-white/35">CTL</span>
                <span
                  className="font-sans text-2xl font-light tabular-nums"
                  style={{ color: ACCENT, fontVariantNumeric: "tabular-nums lining-nums" }}
                >
                  {load.ctl}
                </span>
              </div>
              <span className="h-7 w-px bg-white/[0.08]" />
              <div className="flex flex-col gap-1">
                <span className="label-xs text-white/35">ATL</span>
                <span
                  className="font-sans text-2xl font-light tabular-nums"
                  style={{ color: ATL_COLOR, fontVariantNumeric: "tabular-nums lining-nums" }}
                >
                  {load.atl}
                </span>
              </div>
              <span className="h-7 w-px bg-white/[0.08]" />
              <div className="flex flex-col gap-1">
                <span className="label-xs text-white/35">FORM (TSB)</span>
                <div className="flex items-center gap-1.5">
                  <FormIcon
                    className="h-4 w-4"
                    style={{
                      color:
                        load.tsb >= 0 ? ACCENT : "rgba(255,140,120,0.85)",
                    }}
                    strokeWidth={2}
                  />
                  <span
                    className="font-sans text-2xl font-light tabular-nums"
                    style={{
                      color: load.tsb >= 0 ? ACCENT : "rgba(255,140,120,0.85)",
                      fontVariantNumeric: "tabular-nums lining-nums",
                    }}
                  >
                    {load.tsb > 0 ? "+" : ""}
                    {load.tsb}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[12px] leading-relaxed text-white/35">
              Form is{" "}
              <span style={{ color: load.tsb >= 0 ? ACCENT : "rgba(255,140,120,0.85)" }}>
                {formLabel.toLowerCase()}
              </span>
              {load.ctl === 0
                ? " — log sessions to build your fitness curve"
                : load.tsb > 5
                  ? " — good conditions for a quality effort"
                  : load.tsb < -10
                    ? " — consider a recovery day before hard training"
                    : " — maintain current load"}
            </p>
          </>
        ) : (
          <p className="mt-4 text-[13px] text-white/35">
            Log sessions to start tracking fitness
          </p>
        )}
      </section>

      {/* 02 FTP DEVELOPMENT */}
      <section>
        <SectionLabel n="02" title="FTP Development" />
        <div className="mt-4">
          {ftpLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <FtpBars history={ftpHistory ?? []} />
          )}
        </div>
      </section>

      {/* 03 RECENT SESSIONS */}
      <section>
        <SectionLabel n="03" title="Recent sessions" />
        {sessionsLoading ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="mt-4 flex flex-col">
            {sessions.slice(0, 8).map((s) => {
              const date = new Date(
                s.sessionDate + "T12:00:00Z",
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-4 border-b border-white/[0.05] py-3 last:border-0"
                >
                  <div className="w-14 shrink-0">
                    <span className="label-xs text-white/35">{date}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-[13px] font-medium text-white/80">
                      {s.title ??
                        s.type.charAt(0).toUpperCase() + s.type.slice(1)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.durationMin != null && (
                      <span className="label-xs text-white/35">
                        {s.durationMin}m
                      </span>
                    )}
                    {s.tss != null && (
                      <span
                        className="font-mono text-[12px] tabular-nums"
                        style={{ color: ACCENT }}
                      >
                        {s.tss}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-white/35">
            No sessions logged yet · Use Today → Log to record rides
          </p>
        )}
      </section>
    </ScreenShell>
  )
}
