import { useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ClubChip } from "@/components/sparki/club-chip"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"
import { useLoad } from "@/hooks/use-load"
import { useFtpHistory } from "@/hooks/use-ftp-history"
import { useSessions } from "@/hooks/use-sessions"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { AiMemoryPanel } from "@/components/sparki/ai-memory-panel"
import { ContextMemoryPanel } from "@/components/sparki/context-memory-panel"
import { SparkiObservations } from "@/components/sparki/insights-section"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { useLocation } from "wouter"
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer"
import { TrainingProgression } from "@/components/sparki/training-progression"
import { MentalResilienceCard } from "@/components/sparki/mental-resilience-card"
import type { TrainingSession } from "@/lib/athlete-types"
import { computePerformanceRadar } from "@/lib/performance-radar"
import { UitlegDot } from "@/components/viz/uitleg"

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
  currentFtp,
}: {
  history: Array<{ ftpWatts: number; measuredAt: string }>
  currentFtp: number | null
}) {
  if (history.length === 0 && currentFtp == null) {
    return (
      <MissingInputNotice
        compact
        showOrb={false}
        title="Nog geen FTP-tests"
        description="Sparki heeft je FTP nodig om je vooruitgang te volgen. Stel je FTP in of log een test."
        targets={["ftp"]}
        returnTo="/lab"
      />
    )
  }

  const sorted = [...history].sort((a, b) =>
    a.measuredAt.localeCompare(b.measuredAt),
  )
  const maxW = sorted.length > 0 ? Math.max(...sorted.map((h) => h.ftpWatts)) : 0

  const first = sorted[0]?.ftpWatts ?? 0
  const lastTest = sorted[sorted.length - 1]?.ftpWatts ?? 0
  const delta = sorted.length > 0 ? lastTest - first : 0
  // SSOT: de grote waarde is ALTIJD je huidige profiel-FTP (Sportpaspoort) —
  // een correctie daar werkt hier direct door.
  const shown = currentFtp ?? lastTest

  return (
    <div>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-4xl font-extralight tabular-nums">
            {shown}
          </span>
          <span className="font-mono text-[11px] text-white/35">W</span>
          <span className="font-mono text-[10px] text-white/30">
            · uit je Sportpaspoort
          </span>
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

const PERIODS = [14, 30, 90] as const

function localTodayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function LabPage() {
  const [periodDays, setPeriodDays] = useState<number>(14)
  const { data: load, isLoading: loadLoading } = useLoad()
  const { data: ftpHistory, isLoading: ftpLoading } = useFtpHistory()
  const { data: sessions, isLoading: sessionsLoading } = useSessions(60)
  const { data: metrics, isLoading: metricsLoading } = useDailyMetrics(periodDays)
  const { data: profile } = useAthleteExtendedProfile()
  const [, navigate] = useLocation()
  const [openSession, setOpenSession] = useState<TrainingSession | null>(null)

  // Eerlijke radar: pure berekening, per as herleidbaar; ontbrekende assen
  // worden niet getekend (nooit een neutrale 0.5-placeholder).
  const radarAxes = computePerformanceRadar({
    load: load ?? null,
    sessions: (sessions ?? []).map((s) => ({
      sessionDate: s.sessionDate,
      feelScore: s.feelScore ?? null,
    })),
    ftpWatts: profile?.ftp ?? null,
    weightKg: profile?.weightKg != null ? Number(profile.weightKg) : null,
    todayIso: localTodayIso(),
  })
  const measurableAxes = radarAxes.filter((a) => a.level != null) as Array<{
    key: string
    label: string
    level: number
  }>
  const missingAxes = radarAxes.filter((a) => a.level == null)

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

  const radarLoading = loadLoading || sessionsLoading
  // Honest, derived insight — the strongest measurable axis, never a claim.
  const strongestAxis = [...measurableAxes].sort((a, b) => b.level - a.level)[0]

  return (
    <ScreenShell section="Lab">
      {/* INTRO */}
      <div className="-mt-2">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
            PERFORMANCE LAB
          </p>
          <ClubChip />
        </div>
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

      {/* SPARKI ZIET VANDAAG — de nieuwsgierig makende kop van Inzicht */}
      <SparkiObservations />

      {/* 01 PERFORMANCE RADAR */}
      <section className="flex flex-col items-center">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SectionLabel n="01" title="Performance Radar" />
            <UitlegDot uitlegKey="performanceRadar" label="Performance Radar" />
          </div>
        </div>
        {radarLoading ? (
          <Skeleton className="mt-4 h-[260px] w-[260px] rounded-full" />
        ) : measurableAxes.length >= 3 ? (
          <>
            <BioRadar size={260} accent={ACCENT} axes={measurableAxes} />
            <p className="mt-1 max-w-[18rem] text-pretty text-center text-[12px] leading-relaxed text-white/40">
              {measurableAxes.length === radarAxes.length
                ? "Alle zes signalen berekend uit je eigen data."
                : `${measurableAxes.length} van ${radarAxes.length} signalen meetbaar — alleen die worden getekend.`}{" "}
              Je sterkste signaal nu: {strongestAxis?.label}.
            </p>
          </>
        ) : (
          <p className="mt-4 max-w-[18rem] text-pretty text-center text-[12px] leading-relaxed text-white/35">
            Nog te weinig gegevens voor je radar · Log sessies en check-ins zodat
            Sparki je capaciteitsprofiel kan opbouwen.
          </p>
        )}
        {!radarLoading && missingAxes.length > 0 && (
          <div className="mt-3 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="font-mono text-[9px] tracking-[0.2em] text-white/35">
              NOG NIET MEETBAAR
            </p>
            <ul className="mt-1.5 space-y-1">
              {missingAxes.map((a) => (
                <li key={a.key} className="text-[11px] leading-relaxed text-white/45">
                  <span className="text-white/70">{a.label}</span> — {a.missingReason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 02 READINESS HISTORY */}
      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SectionLabel n="02" title="Readiness history" />
            <UitlegDot uitlegKey="readinessTrend" label="Readiness-trend" />
          </div>
          <div className="flex items-center gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodDays(p)}
                className={`rounded-full border px-2.5 py-1 font-mono text-[10px] tabular-nums transition-colors ${
                  periodDays === p
                    ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200"
                    : "border-white/[0.08] text-white/40 hover:text-white/60"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
            {periodDays} DAGEN
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
          <div className="mt-3">
            <MissingInputNotice
              compact
              showOrb={false}
              title="Nog geen readiness-trend"
              description="Log je dagelijkse check-in zodat Sparki je readiness-trend kan opbouwen."
              targets={["checkin"]}
              returnTo="/lab"
            />
          </div>
        )}
      </section>

      {/* 03 HRV TREND */}
      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SectionLabel n="03" title="HRV trend" />
            <UitlegDot uitlegKey="hrvTrend" label="HRV-trend" />
          </div>
          <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
            {periodDays} DAGEN
          </span>
        </div>
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
          <div className="mt-4">
            <MissingInputNotice
              compact
              showOrb={false}
              title="Nog geen HRV"
              description="Voer je HRV in bij de dagelijkse check-in zodat Sparki je herstel kan volgen."
              targets={["checkin"]}
              returnTo="/lab"
            />
          </div>
        )}
      </section>

      {/* 04 FTP ONTWIKKELING */}
      <section>
        <div className="flex items-center gap-1.5">
          <SectionLabel n="04" title="FTP ontwikkeling" />
          <UitlegDot
            uitlegKey="ftpOntwikkeling"
            label="FTP-ontwikkeling"
            persoonlijk={{ ftp: profile?.ftp ?? null }}
          />
        </div>
        <div className="mt-4">
          {ftpLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <FtpBars
              history={ftpHistory ?? []}
              currentFtp={profile?.ftp ?? null}
            />
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
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setOpenSession(s)}
                  className="flex w-full items-center gap-4 border-b border-white/[0.05] py-3 text-left transition-colors last:border-0 hover:bg-white/[0.02]"
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
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mt-4">
            <MissingInputNotice
              compact
              showOrb={false}
              title="Nog geen sessies gelogd"
              description="Log een training om je sessie-historie en belasting op te bouwen."
              actions={[
                {
                  label: "Ga naar Training",
                  onClick: () => navigate("/train"),
                },
              ]}
            />
          </div>
        )}
      </section>

      {/* 06 TRAININGSVERLOOP */}
      <TrainingProgression
        sessions={sessions}
        chartData={load?.chartData}
        loading={loadLoading || sessionsLoading}
        n="06"
      />

      {/* 07 MENTALE WEERBAARHEID */}
      <MentalResilienceCard n="07" />

      {/* 08 AI GEHEUGEN */}
      <AiMemoryPanel />

      {/* 09 SPARKI ONTHOUDT */}
      <ContextMemoryPanel />

      <SessionDetailDrawer
        session={openSession}
        open={openSession != null}
        onOpenChange={(o) => {
          if (!o) setOpenSession(null)
        }}
      />
    </ScreenShell>
  )
}
