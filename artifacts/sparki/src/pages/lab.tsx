import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"
import { useLoad } from "@/hooks/use-load"
import { useFtpHistory } from "@/hooks/use-ftp-history"
import { useSessions } from "@/hooks/use-sessions"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

function Delta({ value }: { value: number }) {
  const positive = value > 0
  const sign = value > 0 ? "+" : ""
  return (
    <span
      className="font-mono text-[11px] tabular-nums"
      style={{ color: positive ? ACCENT : "rgba(255,140,120,0.85)" }}
    >
      {sign}{value}
    </span>
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
        Nog geen FTP-tests gelogd · Stel FTP in bij Profiel
      </p>
    )
  }

  const sorted = [...history].sort((a, b) =>
    a.measuredAt.localeCompare(b.measuredAt),
  )
  const maxW = Math.max(...sorted.map((h) => h.ftpWatts))

  const first = sorted[0]?.ftpWatts ?? 0
  const last = sorted[sorted.length - 1]?.ftpWatts ?? 0
  const delta = last - first

  return (
    <div>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-4xl font-extralight tabular-nums">
            {last}
          </span>
          <span className="font-mono text-[11px] text-white/35">W</span>
        </div>
        {delta !== 0 && (
          <span
            className="font-mono text-[11px] tabular-nums"
            style={{ color: delta > 0 ? ACCENT : "rgba(255,140,120,0.85)" }}
          >
            {delta > 0 ? "+" : ""}
            {delta}W all-time
          </span>
        )}
      </div>
      <div className="mt-4 flex h-20 items-end gap-2">
        {sorted.map((entry, i) => {
          const h = ((entry.ftpWatts / maxW) * 72) + 8
          const isLast = i === sorted.length - 1
          const month = new Date(
            entry.measuredAt + "T12:00:00Z",
          ).toLocaleDateString("nl-NL", { month: "short" })
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
                    boxShadow: isLast ? `0 0 10px rgba(120,210,230,0.4)` : "none",
                  }}
                />
              </div>
              <span className="font-mono text-[8px] tracking-wider text-white/30">{month}</span>
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
  const { data: metrics, isLoading: metricsLoading } = useDailyMetrics(14)
  const { data: profile } = useAthleteExtendedProfile()

  const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))

  const feelScores = (sessions ?? [])
    .filter((s) => s.feelScore != null)
    .map((s) => s.feelScore!)
  const avgFeel =
    feelScores.length > 0
      ? feelScores.reduce((a, b) => a + b, 0) / feelScores.length / 5
      : 0.5

  const lastFtp =
    (ftpHistory ?? []).length > 0
      ? [...(ftpHistory ?? [])]
          .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
          .at(-1)?.ftpWatts ?? 0
      : 0

  const bioAxes = [
    {
      key: "fitness",
      label: "Fitness",
      level: load ? clamp(load.ctl / 80) : 0.5,
    },
    { key: "feel", label: "Voel", level: avgFeel || 0.5 },
    {
      key: "form",
      label: "Form",
      level: load ? clamp((load.tsb + 30) / 60) : 0.5,
    },
    {
      key: "power",
      label: "Power",
      level:
        lastFtp > 0
          ? clamp(lastFtp / 350)
          : profile?.ftp
            ? clamp(profile.ftp / 350)
            : 0.5,
    },
    {
      key: "recovery",
      label: "Herstel",
      level: load
        ? clamp(1 - load.atl / Math.max(load.ctl * 1.5, 60))
        : 0.5,
    },
    {
      key: "consistency",
      label: "Consistentie",
      level: clamp((sessions ?? []).length / 10),
    },
  ]

  // Readiness history from feel scores in daily metrics (proxy for v0 readiness trend)
  const readinessHistory = (metrics ?? [])
    .slice()
    .reverse()
    .filter((m) => m.feelScore != null)
    .map((m) => Math.round((m.feelScore! / 5) * 100))

  // HRV trend from daily metrics
  const todayHrv = metrics?.[0]?.hrv ?? null
  const yesterdayHrv = metrics?.[1]?.hrv ?? null
  const hrvDelta =
    todayHrv != null && yesterdayHrv != null
      ? Math.round(todayHrv - yesterdayHrv)
      : null

  const hrvTrend = (metrics ?? [])
    .slice()
    .reverse()
    .filter((m) => m.hrv != null)
    .map((m) => m.hrv!)

  const showRadar = !loadLoading && !sessionsLoading

  return (
    <ScreenShell section="Lab">
      {/* INTRO */}
      <div className="-mt-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
          PERFORMANCE LAB
        </p>
        <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
          Begrijp je vorm
        </h1>
        {profile && (
          <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
            {profile.displayName ?? "Atleet"}
            {profile.ftp ? ` · FTP ${profile.ftp}W` : ""}
            {profile.wkg ? ` · ${profile.wkg} W/kg` : ""}
          </p>
        )}
      </div>

      {/* 01 PERFORMANCE RADAR */}
      {showRadar && (
        <section className="flex flex-col items-center">
          <div className="flex w-full items-center justify-between">
            <SectionLabel n="01" title="Performance Radar" />
          </div>
          <BioRadar size={260} accent={ACCENT} axes={bioAxes} />
          <p className="mt-1 max-w-[18rem] text-pretty text-center text-[12px] leading-relaxed text-white/40">
            Je capaciteitsprofiel over zes signalen. Threshold en herstel zijn je
            sterkste assen deze cyclus.
          </p>
        </section>
      )}

      {/* 02 READINESS HISTORY */}
      <section>
        <SectionLabel n="02" title="Readiness history" />
        <div className="mt-4 flex items-baseline justify-between">
          <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
            14 DAGEN
          </span>
          {readinessHistory.length > 1 && (
            <span className="font-mono text-[11px] tabular-nums text-cyan-300/80">
              {readinessHistory[readinessHistory.length - 1]} gereedheid
            </span>
          )}
        </div>
        {metricsLoading ? (
          <Skeleton className="mt-3 h-14 w-full" />
        ) : readinessHistory.length >= 2 ? (
          <>
            <div className="mt-3">
              <Sparkline
                data={readinessHistory}
                width={340}
                height={56}
                stroke={ACCENT}
                fill="rgba(120,210,230,0.07)"
                className="w-full text-cyan-300"
              />
            </div>
            <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
              Gebaseerd op dagelijkse check-in scores. Gestage opbouw is het doel.
            </p>
          </>
        ) : (
          <p className="mt-3 text-[12px] text-white/25">
            Log dagelijkse check-ins om je readiness-trend te zien
          </p>
        )}
      </section>

      {/* 03 HRV TREND */}
      <section>
        <SectionLabel n="03" title="HRV trend" />
        {metricsLoading ? (
          <Skeleton className="mt-4 h-16 w-full" />
        ) : todayHrv != null ? (
          <>
            <div className="mt-4 flex items-end justify-between">
              <div className="flex items-baseline gap-1">
                <span className="font-sans text-4xl font-extralight tabular-nums">
                  {Math.round(todayHrv)}
                </span>
                <span className="font-mono text-[11px] text-white/35">ms</span>
              </div>
              {hrvDelta !== null && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tracking-wide text-white/35">
                    vs gisteren
                  </span>
                  <Delta value={hrvDelta} />
                </div>
              )}
            </div>
            {hrvTrend.length >= 2 && (
              <div className="mt-3">
                <Sparkline
                  data={hrvTrend}
                  width={340}
                  height={48}
                  stroke={ACCENT}
                  fill="rgba(120,210,230,0.07)"
                  className="w-full text-cyan-300"
                />
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 text-[12px] text-white/25">
            Voer je HRV in bij de dagelijkse check-in
          </p>
        )}
      </section>

      {/* 04 FTP ONTWIKKELING */}
      <section>
        <SectionLabel n="04" title="FTP ontwikkeling" />
        <div className="mt-4">
          {ftpLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <FtpBars history={ftpHistory ?? []} />
          )}
        </div>
      </section>

      {/* 05 RECENTE SESSIES */}
      <section>
        <SectionLabel n="05" title="Recente sessies" />
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
              ).toLocaleDateString("nl-NL", {
                month: "short",
                day: "numeric",
              })
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-4 border-b border-white/[0.05] py-3 last:border-0"
                >
                  <div className="w-14 shrink-0">
                    <span className="font-mono text-[10px] text-white/35">{date}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-[13px] font-medium text-white/80">
                      {s.title ??
                        s.type.charAt(0).toUpperCase() + s.type.slice(1)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {s.durationMin != null && (
                      <span className="font-mono text-[10px] text-white/35">
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
            Nog geen sessies gelogd · Gebruik Train → Sessie loggen
          </p>
        )}
      </section>
    </ScreenShell>
  )
}
