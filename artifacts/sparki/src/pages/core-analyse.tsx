// Centrale Analyse-omgeving (/analyse) — lichte datawerkruimte binnen de
// donkere app-shell. Hergebruikt uitsluitend bestaande hooks, engines en
// berekeningen; geen nieuwe formules, geen mock- of seeddata.
//
// Tabs: Overzicht · Belasting · Progressie · Doelen · Sessies
// Visueel: witte cards op slate-50 achtergrond; recharts grafieken op witte
// ondergrond; vaste semantische kleurset (CHART.*) voor alle data-reeksen.

import { useState, type ReactNode } from "react"
import { useLocation } from "wouter"
import {
  LineChart,
  Line,
  ComposedChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

import { CommercialShell } from "@/components/sparki/commercial-shell"
import { ClubChip } from "@/components/sparki/club-chip"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"
import { SparkiObservations } from "@/components/sparki/insights-section"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer"
import { TrainingProgression } from "@/components/sparki/training-progression"
import { UitlegDot } from "@/components/viz/uitleg"
import { useLoad, type LoadData } from "@/hooks/use-load"
import { useFtpHistory } from "@/hooks/use-ftp-history"
import { useSessions } from "@/hooks/use-sessions"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { usePowerBests } from "@/hooks/use-power-bests"
import { useGoalPicture, type Goal } from "@/hooks/use-goals"
import { useRaces } from "@/hooks/use-races"
import { computePerformanceRadar } from "@/lib/performance-radar"
import { localISODate } from "@/lib/commercial-shell"
import type { TrainingSession } from "@/lib/athlete-types"
import type { Race } from "@/lib/race-types"
import {
  analyseToestand,
  combineerToestanden,
  ANALYSE_PERIODES,
  type AnalysePeriode,
  periodeLabel,
  contextRegel,
  ftpWeergave,
  maandLabel,
  readinessReeks,
  hrvReeks,
  hrvVandaag,
  hrvDelta,
  radarSamenvatting,
  sessieDatumLabel,
  sessieTitel,
  sessieDuurLabel,
  sessieBelasting,
  ANALYSE_COPY,
  type AnalyseToestand,
} from "@/lib/core-analyse"
import { cn } from "@/lib/utils"

// ── Semantische kleurset (SSOT voor alle grafieken) ──────────────────────────
// Elke kleur heeft één vaste betekenis. Nooit voor decoratie.
export const CHART = {
  ctl:     "#0ea5e9", // sky-500    — fitheid (CTL)
  atl:     "#f97316", // orange-500 — vermoeidheid (ATL)
  tsbPos:  "#22c55e", // green-500  — positieve vorm (TSB ≥ 0)
  tsbNeg:  "#ef4444", // red-500    — negatieve vorm (TSB < 0)
  volume:  "#8b5cf6", // violet-500 — trainingsvolume
  ftp:     "#06b6d4", // cyan-500   — vermogen / FTP
  goal:    "#10b981", // emerald-500 — doelen
  race:    "#ec4899", // pink-500   — wedstrijden
  warn:    "#f59e0b", // amber-500  — waarschuwing
  missing: "#94a3b8", // slate-400  — ontbrekend / onzeker
} as const

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "overzicht" | "belasting" | "progressie" | "doelen" | "sessies"
const TABS: { id: Tab; label: string }[] = [
  { id: "overzicht",  label: "Overzicht"  },
  { id: "belasting",  label: "Belasting"  },
  { id: "progressie", label: "Progressie" },
  { id: "doelen",     label: "Doelen"     },
  { id: "sessies",    label: "Sessies"    },
]

// ── Gedeelde datalaag-types ───────────────────────────────────────────────────

type Bron<T> = {
  data: T | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => unknown
  dataUpdatedAt?: number
}

type Profiel =
  | { displayName?: string | null; ftp?: number | null; weightKg?: number | null }
  | null
  | undefined

function toestandVan(bron: Bron<unknown>, hasData: boolean): AnalyseToestand {
  return analyseToestand({ isLoading: bron.isLoading, isError: bron.isError, hasData })
}

// ── Lichte primitieven (white-bg variant) ────────────────────────────────────

function LCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white border border-slate-200 rounded-xl shadow-sm", className)}>
      {children}
    </div>
  )
}

function LCardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-sm font-semibold text-slate-900", className)}>{children}</h3>
}

function LLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
      {children}
    </span>
  )
}

function Skel({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-slate-100", className)} />
}

function LFout({ titel, onOpnieuw }: { titel: string; onOpnieuw?: () => void }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <p className="font-medium">{titel}</p>
      {onOpnieuw && (
        <button type="button" onClick={onOpnieuw}
          className="mt-2 text-xs underline underline-offset-2 hover:no-underline">
          Opnieuw proberen
        </button>
      )}
    </div>
  )
}

// ── Stat-tegel ────────────────────────────────────────────────────────────────

function StatTegel({
  label, value, unit, color, sub, uitlegKey,
}: {
  label: string
  value: string | number | null | undefined
  unit?: string
  color: string
  sub?: string
  uitlegKey?: string
}) {
  return (
    <LCard className="p-4 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1">
        <LLabel>{label}</LLabel>
        {uitlegKey && <UitlegDot uitlegKey={uitlegKey} label={label} />}
      </div>
      {value == null
        ? <span className="text-2xl font-light text-slate-300">—</span>
        : (
          <div className="flex items-baseline gap-1">
            <span className="num text-2xl font-light tabular-nums" style={{ color }}>{value}</span>
            {unit && <span className="text-xs text-slate-400">{unit}</span>}
          </div>
        )
      }
      {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
    </LCard>
  )
}

// ── Load-grafiek (recharts — CTL + ATL + TSB) ─────────────────────────────────

function fmtDatum(iso: string): string {
  const parts = iso.split("-")
  return `${parts[2]}/${parts[1]}`
}

type LoadPunt = { date: string; ctl: number; atl: number; tsb: number }

function CTLATLTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="tabular-nums flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}</span>
          <strong>{Math.round(p.value)}</strong>
        </p>
      ))}
    </div>
  )
}

function TSBTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const tsb = payload[0]?.value ?? 0
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      <p className="tabular-nums" style={{ color: tsb >= 0 ? CHART.tsbPos : CHART.tsbNeg }}>
        Vorm (TSB) <strong>{tsb > 0 ? "+" : ""}{Math.round(tsb)}</strong>
      </p>
    </div>
  )
}

function LoadGrafiek({
  chartData,
  periode,
}: {
  chartData: LoadData["chartData"]
  periode: number
}) {
  const gefilterd: LoadPunt[] = chartData.slice(-periode)
  const intervalStap = Math.max(1, Math.floor(gefilterd.length / 7))

  if (gefilterd.length < 3) {
    return (
      <p className="text-sm text-slate-400 py-6 text-center">
        Nog te weinig belastingsdata voor een grafiek. Log meer trainingen.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {/* CTL + ATL */}
      <div>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <LCardTitle>Fitheid &amp; Vermoeidheid</LCardTitle>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: CHART.ctl }} />
              CTL (fitheid)
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-5 rounded"
                style={{ background: CHART.atl, backgroundImage: `repeating-linear-gradient(90deg,${CHART.atl} 0,${CHART.atl} 4px,transparent 4px,transparent 8px)` }}
              />
              ATL (vermoeidheid)
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={gefilterd} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={fmtDatum} tick={{ fill: "#64748b", fontSize: 10 }} interval={intervalStap} />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip content={(props) => <CTLATLTooltip {...(props as Parameters<typeof CTLATLTooltip>[0])} />} />
            <Line type="monotone" dataKey="ctl" stroke={CHART.ctl} strokeWidth={2} dot={false} name="CTL" />
            <Line type="monotone" dataKey="atl" stroke={CHART.atl} strokeWidth={2} strokeDasharray="5 5" dot={false} name="ATL" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TSB */}
      <div>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <LCardTitle>Vorm (TSB)</LCardTitle>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHART.tsbPos }} />
              Positief — goed uitgerust
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHART.tsbNeg }} />
              Negatief — vermoeid
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={gefilterd} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={fmtDatum} tick={{ fill: "#64748b", fontSize: 10 }} interval={intervalStap} />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />
            <Tooltip content={(props) => <TSBTooltip {...(props as Parameters<typeof TSBTooltip>[0])} />} />
            <Bar dataKey="tsb" name="TSB" maxBarSize={10}>
              {gefilterd.map((punt, idx) => (
                <Cell key={idx} fill={punt.tsb >= 0 ? CHART.tsbPos : CHART.tsbNeg} opacity={0.85} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Overzicht-tabblad ─────────────────────────────────────────────────────────

function OverzichtTab({
  load,
  profiel,
  sessies,
}: {
  load: Bron<LoadData>
  profiel: Profiel
  sessies: Bron<TrainingSession[]>
}) {
  const tsb = load.data?.tsb
  const tsbKleur = tsb == null ? CHART.missing : tsb >= 0 ? CHART.tsbPos : CHART.tsbNeg
  const tsbWaarde = tsb == null ? null : `${tsb > 0 ? "+" : ""}${Math.round(tsb)}`

  return (
    <div className="space-y-6">
      {/* Stat-tegels */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTegel
          label="Fitheid (CTL)"
          value={load.data ? Math.round(load.data.ctl) : null}
          color={CHART.ctl}
          sub={load.isLoading ? "laden…" : undefined}
          uitlegKey="fitheid"
        />
        <StatTegel
          label="Vermoeidheid (ATL)"
          value={load.data ? Math.round(load.data.atl) : null}
          color={CHART.atl}
          uitlegKey="vermoeidheid"
        />
        <StatTegel
          label="Vorm (TSB)"
          value={load.data ? tsbWaarde : null}
          color={tsbKleur}
          sub={tsb != null ? (tsb >= 5 ? "Uitgerust" : tsb <= -15 ? "Vermoeid" : "Neutraal") : undefined}
          uitlegKey="vorm"
        />
        <StatTegel
          label="FTP"
          value={profiel?.ftp ?? null}
          unit="W"
          color={CHART.ftp}
        />
      </div>

      {/* Sparki's analyse — dark container */}
      <div className="rounded-xl bg-slate-900 p-4">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-white/35">
          Sparki's analyse
        </p>
        <SparkiObservations />
      </div>

      {/* Overzicht load sparkline */}
      {load.data && load.data.chartData.length >= 7 && (
        <LCard className="p-4">
          <div className="flex items-center gap-1.5 mb-4">
            <LCardTitle>Fitheid afgelopen 42 dagen</LCardTitle>
            <UitlegDot uitlegKey="fitheid" label="Fitheid (CTL)" />
          </div>
          <Sparkline
            data={load.data.chartData.slice(-42).map((d) => d.ctl)}
            width={340}
            height={48}
            stroke={CHART.ctl}
            fill="rgba(14,165,233,0.07)"
            className="w-full"
          />
          <div className="mt-2 flex justify-between text-[11px] text-slate-400 tabular-nums">
            <span>42d geleden: {Math.round(load.data.chartData.slice(-42)[0]?.ctl ?? 0)}</span>
            <span>Nu: {Math.round(load.data.ctl)}</span>
          </div>
        </LCard>
      )}
      {load.isLoading && <Skel className="h-24 w-full" />}
    </div>
  )
}

// ── Belasting-tabblad ─────────────────────────────────────────────────────────

function BelastingTab({
  load,
  sessies,
  profiel,
  metrics,
  periode,
  onPeriode,
}: {
  load: Bron<LoadData>
  sessies: Bron<TrainingSession[]>
  profiel: Profiel
  metrics: Bron<Array<{ feelScore?: number | null; hrv?: number | null }>>
  periode: AnalysePeriode
  onPeriode: (p: AnalysePeriode) => void
}) {
  const loadToestand = toestandVan(load, load.data != null)
  const [grafiekPeriode, setGrafiekPeriode] = useState<28 | 90>(90)

  // Radar axes — bestaande berekening
  const assen = computePerformanceRadar({
    load: load.data ? { ctl: load.data.ctl, atl: load.data.atl, tsb: load.data.tsb } : null,
    sessions: (sessies.data ?? []).map((s) => ({ sessionDate: s.sessionDate, feelScore: s.feelScore ?? null })),
    ftpWatts: profiel?.ftp ?? null,
    weightKg: profiel?.weightKg ?? null,
    todayIso: localISODate(new Date()),
  })
  const meetbaar = assen.filter((a): a is typeof a & { level: number } => a.level != null)
  const radarSamenv = radarSamenvatting(meetbaar)

  const readReeks = readinessReeks(metrics.data ?? [])
  const hrvWaarde = hrvVandaag(metrics.data ?? [])
  const hrvDeltaWaarde = hrvDelta(metrics.data ?? [])
  const hrvReeksData = hrvReeks(metrics.data ?? [])

  return (
    <div className="space-y-6">
      {/* Load grafiek */}
      <LCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <LCardTitle>Belastingsgrafiek</LCardTitle>
            <UitlegDot uitlegKey="belasting" label="Trainingsbelasting" />
          </div>
          <div className="flex gap-1" role="group" aria-label="Grafiekperiode">
            {([28, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setGrafiekPeriode(d)}
                aria-pressed={grafiekPeriode === d}
                className={cn(
                  "min-h-8 rounded-lg border px-3 font-mono text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                  grafiekPeriode === d
                    ? "border-sky-500/60 bg-sky-50 text-sky-600 font-medium"
                    : "border-slate-200 text-slate-500 hover:text-slate-800",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loadToestand === "laden" && <Skel className="h-64 w-full" />}
        {loadToestand === "fout" && <LFout titel="Belastingsgrafiek kon niet worden geladen." onOpnieuw={() => void load.refetch()} />}
        {(loadToestand === "ok" || loadToestand === "verouderd") && load.data && (
          <LoadGrafiek chartData={load.data.chartData} periode={grafiekPeriode} />
        )}
      </LCard>

      {/* Readiness-trend */}
      <LCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <LCardTitle>Readiness-trend</LCardTitle>
            <UitlegDot uitlegKey="readinessTrend" label="Readiness-trend" />
          </div>
          <div className="flex gap-1" role="group" aria-label="Periode">
            {ANALYSE_PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPeriode(p)}
                aria-pressed={periode === p}
                aria-label={periodeLabel(p)}
                className={cn(
                  "min-h-8 rounded-lg border px-3 font-mono text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                  periode === p
                    ? "border-sky-500/60 bg-sky-50 text-sky-600 font-medium"
                    : "border-slate-200 text-slate-500 hover:text-slate-800",
                )}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>

        {readReeks.length >= 2 ? (
          <>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs text-slate-500">{periodeLabel(periode)}</span>
              <span className="font-mono text-xs tabular-nums" style={{ color: CHART.ctl }}>
                {readReeks[readReeks.length - 1]} gereedheid
              </span>
            </div>
            <Sparkline
              data={readReeks}
              width={340}
              height={52}
              stroke={CHART.ctl}
              fill="rgba(14,165,233,0.07)"
              className="w-full"
            />
            <p className="mt-2 text-xs text-slate-400">
              Gebaseerd op dagelijkse check-in scores.
            </p>
          </>
        ) : (
          <MissingInputNotice compact showOrb={false}
            title="Nog geen readiness-trend"
            description="Log je dagelijkse check-in zodat Sparki je readiness kan volgen."
            targets={["checkin"]}
            returnTo="/analyse"
          />
        )}
      </LCard>

      {/* HRV-trend */}
      <LCard className="p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <LCardTitle>HRV-trend</LCardTitle>
          <span className="text-xs text-slate-400">{periodeLabel(periode)}</span>
          <UitlegDot uitlegKey="hrvTrend" label="HRV-trend" />
        </div>
        {hrvWaarde != null ? (
          <>
            <div className="flex items-end justify-between mb-2">
              <div className="flex items-baseline gap-1">
                <span className="num text-3xl font-light text-slate-900">{Math.round(hrvWaarde)}</span>
                <span className="text-xs text-slate-400">ms</span>
              </div>
              {hrvDeltaWaarde != null && (
                <span className="font-mono text-xs tabular-nums" style={{ color: hrvDeltaWaarde > 0 ? CHART.tsbPos : CHART.tsbNeg }}>
                  {hrvDeltaWaarde > 0 ? "+" : ""}{hrvDeltaWaarde} vs gisteren
                </span>
              )}
            </div>
            {hrvReeksData.length >= 2 && (
              <Sparkline
                data={hrvReeksData}
                width={340}
                height={44}
                stroke={CHART.ftp}
                fill="rgba(6,182,212,0.07)"
                className="w-full"
              />
            )}
          </>
        ) : (
          <MissingInputNotice compact showOrb={false}
            title="Nog geen HRV-data"
            description="Voer je HRV in bij de dagelijkse check-in."
            targets={["checkin"]}
            returnTo="/analyse"
          />
        )}
      </LCard>

      {/* Performance-radar */}
      <LCard className="p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <LCardTitle>Performance-radar</LCardTitle>
          <UitlegDot uitlegKey="performanceRadar" label="Performance Radar" />
        </div>
        {loadToestand === "laden" ? (
          <Skel className="h-[180px] w-[180px] rounded-full mx-auto" />
        ) : meetbaar.length >= 3 ? (
          <div className="flex flex-col items-center gap-3">
            <BioRadar size={200} axes={meetbaar} />
            {radarSamenv && <p className="sr-only">{radarSamenv}</p>}
            <p className="text-center text-xs text-slate-500 max-w-xs text-pretty">
              {meetbaar.length} van {assen.length} assen meetbaar.
              Sterkste: {meetbaar.reduce((a, b) => (b.level > a.level ? b : a)).label}.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">
            Nog te weinig gegevens voor een radar. Log sessies en check-ins.
          </p>
        )}
      </LCard>
    </div>
  )
}

// ── Progressie-tabblad ────────────────────────────────────────────────────────

const POWER_WINDOWS = [
  { key: "5",    label: "5s"    },
  { key: "10",   label: "10s"   },
  { key: "30",   label: "30s"   },
  { key: "60",   label: "1 min" },
  { key: "300",  label: "5 min" },
  { key: "1200", label: "20 min"},
  { key: "3600", label: "60 min"},
] as const

function PowerBestsTable() {
  const { data, isLoading, isError, refetch } = usePowerBests()

  if (isLoading) return <Skel className="h-40 w-full" />
  if (isError) return <LFout titel="Persoonlijke records konden niet worden geladen." onOpnieuw={() => void refetch()} />

  const hasAny = data && Object.keys(data.allTime).length > 0
  if (!hasAny) {
    return (
      <p className="text-sm text-slate-400 py-4">
        Nog geen vermogensrecords. Log ritten met een vermogensmeter om je records op te bouwen.
      </p>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="pb-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-slate-500 pr-4">Duur</th>
              <th className="pb-2.5 text-right text-[10px] font-mono uppercase tracking-widest text-slate-500 pr-4">All-time</th>
              <th className="pb-2.5 text-right text-[10px] font-mono uppercase tracking-widest text-slate-500 pr-4">Laatste 42d</th>
              <th className="pb-2.5 text-right text-[10px] font-mono uppercase tracking-widest text-slate-500">Datum</th>
            </tr>
          </thead>
          <tbody>
            {POWER_WINDOWS.map((w) => {
              const allTime = data?.allTime[w.key]
              const recent = data?.recent[w.key]
              if (!allTime) return null
              return (
                <tr key={w.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{w.label}</td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums font-medium text-slate-900">
                    {allTime.watts}W
                  </td>
                  <td
                    className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs"
                    style={{ color: recent ? CHART.ctl : CHART.missing }}
                  >
                    {recent ? `${recent.watts}W` : "—"}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs text-slate-400">
                    {allTime.date.slice(0, 10)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {data && data.sessionsWithBests > 0 && (
        <p className="mt-2.5 text-[11px] text-slate-400">
          {data.sessionsWithBests} {data.sessionsWithBests === 1 ? "rit" : "ritten"} met vermogensmeter
        </p>
      )}
    </div>
  )
}

function ProgressieTab({
  load,
  sessies,
  ftp,
  profiel,
}: {
  load: Bron<LoadData>
  sessies: Bron<TrainingSession[]>
  ftp: Bron<Array<{ ftpWatts: number; measuredAt: string }>>
  profiel: Profiel
}) {
  const weergave = ftp.data ? ftpWeergave(ftp.data, profiel?.ftp ?? null) : null
  const [, navigate] = useLocation()

  return (
    <div className="space-y-6">
      {/* FTP-ontwikkeling */}
      <LCard className="p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <LCardTitle>FTP-ontwikkeling</LCardTitle>
          <UitlegDot uitlegKey="ftpOntwikkeling" label="FTP-ontwikkeling" />
        </div>
        {ftp.isLoading ? (
          <Skel className="h-24 w-full" />
        ) : weergave == null || weergave.getoond == null ? (
          <MissingInputNotice compact showOrb={false}
            title="Nog geen FTP-tests"
            description="Stel je FTP in of log een test om je vermogensontwikkeling te volgen."
            targets={["ftp"]}
            returnTo="/analyse"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <div className="flex items-baseline gap-1.5">
                <span className="num text-3xl font-light tabular-nums" style={{ color: CHART.ftp }}>
                  {weergave.getoond}
                </span>
                <span className="text-xs text-slate-400">W{weergave.bronIsProfiel ? " · Sportpaspoort" : ""}</span>
              </div>
              {weergave.gesorteerd.length >= 2 && (
                <span className="font-mono text-xs tabular-nums"
                  style={{ color: weergave.deltaAllTime > 0 ? CHART.tsbPos : weergave.deltaAllTime < 0 ? CHART.tsbNeg : CHART.missing }}>
                  {weergave.deltaAllTime > 0 ? "+" : ""}{weergave.deltaAllTime}W all-time
                </span>
              )}
            </div>
            {weergave.gesorteerd.length > 0 && (
              <div aria-hidden="true" className="flex items-end gap-2 h-20">
                {weergave.gesorteerd.map((t, i) => {
                  const hoogte = weergave.maxWatts > 0
                    ? Math.max(8, Math.round((t.ftpWatts / weergave.maxWatts) * 100))
                    : 0
                  const laatste = i === weergave.gesorteerd.length - 1
                  return (
                    <div key={`${t.measuredAt}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-16 w-full max-w-12 items-end">
                        <div
                          className="w-full rounded-t-sm transition-all"
                          style={{
                            height: `${hoogte}%`,
                            background: laatste ? CHART.ftp : "#e2e8f0",
                          }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-slate-400">{maandLabel(t.measuredAt)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </LCard>

      {/* Persoonlijke records (vermogen) */}
      <LCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <LCardTitle>Persoonlijke vermogensrecords</LCardTitle>
        </div>
        <PowerBestsTable />
      </LCard>

      {/* Trainingsverloop (bestaande component in dark container) */}
      <div className="rounded-xl bg-slate-900 p-4 pt-5">
        <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-white/35">
          Trainingsverloop — 6 weken
        </p>
        <TrainingProgression
          sessions={sessies.data}
          chartData={load.data?.chartData}
          loading={(load.isLoading && !load.data) || (sessies.isLoading && !sessies.data)}
          hideLabel
        />
      </div>
    </div>
  )
}

// ── Doelen-tabblad ────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  op_koers:      { label: "Op koers",       kleur: "text-emerald-700", achtergrond: "bg-emerald-50", rand: "border-emerald-200" },
  aandacht:      { label: "Let op",          kleur: "text-amber-700",   achtergrond: "bg-amber-50",   rand: "border-amber-200"   },
  risico:        { label: "Risico",          kleur: "text-red-700",     achtergrond: "bg-red-50",     rand: "border-red-200"     },
  niet_meetbaar: { label: "Niet meetbaar",   kleur: "text-slate-600",   achtergrond: "bg-slate-50",   rand: "border-slate-200"   },
} as const

function GoalCard({ goal }: { goal: Goal }) {
  const v = VERDICT_CONFIG[goal.progress.verdict]
  const daysLeft = goal.progress.daysToTarget

  return (
    <div className={cn("border rounded-xl p-4", v.rand, v.achtergrond)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 text-sm truncate">{goal.title}</p>
          {goal.progress.reasons[0] && (
            <p className="text-xs text-slate-500 mt-0.5">{goal.progress.reasons[0]}</p>
          )}
        </div>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0", v.kleur, v.rand, v.achtergrond)}>
          {v.label}
        </span>
      </div>
      {(goal.targetDate ?? daysLeft != null) && (
        <div className="flex items-center gap-4 mt-2">
          {goal.targetDate && (
            <span className="text-xs text-slate-500">Doel: {goal.targetDate}</span>
          )}
          {daysLeft != null && (
            <span className="text-xs text-slate-400">{daysLeft} dagen resterend</span>
          )}
        </div>
      )}
      {goal.progress.gaps.length > 0 && (
        <p className="mt-2 text-xs text-slate-500 italic">{goal.progress.gaps[0]}</p>
      )}
    </div>
  )
}

function RaceCard({ race, todayISO }: { race: Race; todayISO: string }) {
  const dagenTot = Math.ceil(
    (new Date(race.raceDate + "T12:00:00").getTime() - new Date(todayISO + "T12:00:00").getTime()) / 86400000,
  )
  const dagenLabel =
    dagenTot === 0 ? "Vandaag" : dagenTot === 1 ? "Morgen" : `Over ${dagenTot}d`

  return (
    <LCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 text-sm truncate">{race.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {race.raceDate}
            {race.discipline && ` · ${race.discipline}`}
            {race.category && ` · ${race.category}`}
          </p>
        </div>
        <span className="text-xs font-medium shrink-0" style={{ color: CHART.race }}>
          {dagenLabel}
        </span>
      </div>
    </LCard>
  )
}

function DoelenTab() {
  const [, navigate] = useLocation()
  const { data: goalPicture, isLoading: goalsLoading, isError: goalsError, refetch: goalsRefetch } = useGoalPicture()
  const { data: races } = useRaces()
  const todayISO = localISODate(new Date())

  const actieveDoelen = goalPicture?.goals.filter((g) => g.status === "active") ?? []
  const komende = (races ?? [])
    .filter((r) => r.raceDate >= todayISO && r.status !== "geannuleerd")
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
    .slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Doelen */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Actieve doelen</h2>
          <button type="button" onClick={() => navigate("/you?focus=doelen")}
            className="text-xs text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60">
            Beheer →
          </button>
        </div>

        {goalsLoading && <div className="space-y-3"><Skel className="h-20 w-full" /><Skel className="h-20 w-full" /></div>}
        {goalsError && <LFout titel="Doelen konden niet worden geladen." onOpnieuw={() => void goalsRefetch()} />}
        {!goalsLoading && !goalsError && actieveDoelen.length === 0 && (
          <p className="text-sm text-slate-400 py-2">
            Nog geen actieve doelen.{" "}
            <button type="button" onClick={() => navigate("/you?focus=doelen")}
              className="underline underline-offset-2 hover:no-underline">
              Voeg een doel toe via Jij
            </button>
            .
          </p>
        )}
        {actieveDoelen.length > 0 && (
          <div className="space-y-3">
            {actieveDoelen.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        )}
      </section>

      {/* Wedstrijden */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Aankomende wedstrijden</h2>
          <button type="button" onClick={() => navigate("/races")}
            className="text-xs text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60">
            Alle races →
          </button>
        </div>

        {komende.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">
            Geen aankomende wedstrijden.{" "}
            <button type="button" onClick={() => navigate("/races")}
              className="underline underline-offset-2 hover:no-underline">
              Plan een wedstrijd via Races
            </button>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {komende.map((r) => <RaceCard key={r.id} race={r} todayISO={todayISO} />)}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Sessies-tabblad ───────────────────────────────────────────────────────────

function SessiesTab({
  sessies,
  onOpen,
}: {
  sessies: Bron<TrainingSession[]>
  onOpen: (s: TrainingSession) => void
}) {
  const [, navigate] = useLocation()
  const toestand = toestandVan(sessies, sessies.data != null)
  const lijst = sessies.data ?? []

  if (toestand === "laden") {
    return <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skel key={i} className="h-12 w-full" />)}</div>
  }
  if (toestand === "fout") {
    return <LFout titel="Sessies konden niet worden geladen." onOpnieuw={() => void sessies.refetch()} />
  }
  if (lijst.length === 0) {
    return (
      <MissingInputNotice compact showOrb={false}
        title="Nog geen sessies gelogd"
        description="Log een training om je sessie-overzicht op te bouwen."
        actions={[{ label: "Ga naar Trainen", onClick: () => navigate("/train") }]}
      />
    )
  }

  return (
    <div>
      {toestand === "verouderd" && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span>{ANALYSE_COPY.verouderd}</span>
          <button type="button" onClick={() => void sessies.refetch()} className="underline underline-offset-2 hover:no-underline">
            {ANALYSE_COPY.opnieuw}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="pb-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-slate-500 pr-3">Datum</th>
              <th className="pb-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-slate-500 pr-3">Training</th>
              <th className="pb-2.5 text-right text-[10px] font-mono uppercase tracking-widest text-slate-500 pr-3 hidden sm:table-cell">Duur</th>
              <th className="pb-2.5 text-right text-[10px] font-mono uppercase tracking-widest text-slate-500">TSS</th>
            </tr>
          </thead>
          <tbody>
            {lijst.slice(0, 50).map((s) => (
              <tr
                key={s.id}
                onClick={() => onOpen(s)}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors focus-visible:bg-slate-50"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(s)}
                aria-label={`Sessie: ${sessieTitel(s)}`}
              >
                <td className="py-2.5 pr-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                  {sessieDatumLabel(s.sessionDate)}
                </td>
                <td className="py-2.5 pr-3 text-slate-900 max-w-[14rem] truncate">
                  {sessieTitel(s)}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-slate-500 hidden sm:table-cell">
                  {sessieDuurLabel(s.durationMin) ?? "—"}
                </td>
                <td
                  className="py-2.5 text-right font-mono text-xs tabular-nums"
                  style={{ color: s.tss != null ? CHART.ctl : CHART.missing }}
                >
                  {sessieBelasting(s.tss) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Hoofdpagina ───────────────────────────────────────────────────────────────

export default function CoreAnalysePage() {
  const [activeTab, setActiveTab] = useState<Tab>("overzicht")
  const [openSessie, setOpenSessie] = useState<TrainingSession | null>(null)
  const [periode, setPeriode] = useState<AnalysePeriode>(30)

  // Bestaande hooks — berekeningen blijven in engines en API-laag
  const load    = useLoad()
  const ftp     = useFtpHistory()
  const sessies = useSessions(60)
  const metrics = useDailyMetrics(90)
  const profielQuery = useAthleteExtendedProfile()
  const profiel = profielQuery.data as Profiel

  const wkg = profiel?.ftp && profiel?.weightKg
    ? (profiel.ftp / profiel.weightKg).toFixed(1).replace(".", ",")
    : null
  const context = contextRegel(profiel ? { displayName: profiel.displayName, ftp: profiel.ftp, wkg } : null)

  return (
    <CommercialShell actief="/analyse">
      {/* ── Lichte datawerkruimte ── */}
      <div className="min-h-dvh bg-slate-50">

        {/* Sticky header + tabbladen */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
          <div className="mx-auto max-w-5xl px-4 lg:px-8">
            <div className="flex items-center justify-between pt-5 pb-3 gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-slate-900">{ANALYSE_COPY.paginaTitel}</h1>
                {context && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{context}</p>
                )}
              </div>
              <div className="shrink-0">
                <ClubChip />
              </div>
            </div>

            {/* Tabbladen — horizontaal scrollbaar op mobiel */}
            <div
              className="flex -mb-px overflow-x-auto scrollbar-none"
              role="tablist"
              aria-label="Analyse-secties"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-inset",
                    activeTab === tab.id
                      ? "border-sky-500 text-sky-600 font-medium"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab-inhoud */}
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
          <div id="tab-overzicht"  role="tabpanel" hidden={activeTab !== "overzicht"}>
            <OverzichtTab load={load} profiel={profiel} sessies={sessies} />
          </div>
          <div id="tab-belasting"  role="tabpanel" hidden={activeTab !== "belasting"}>
            <BelastingTab
              load={load}
              sessies={sessies}
              profiel={profiel}
              metrics={metrics}
              periode={periode}
              onPeriode={setPeriode}
            />
          </div>
          <div id="tab-progressie" role="tabpanel" hidden={activeTab !== "progressie"}>
            <ProgressieTab load={load} sessies={sessies} ftp={ftp} profiel={profiel} />
          </div>
          <div id="tab-doelen"     role="tabpanel" hidden={activeTab !== "doelen"}>
            {activeTab === "doelen" && <DoelenTab />}
          </div>
          <div id="tab-sessies"    role="tabpanel" hidden={activeTab !== "sessies"}>
            <SessiesTab sessies={sessies} onOpen={setOpenSessie} />
          </div>
        </div>
      </div>

      <SessionDetailDrawer
        session={openSessie}
        open={openSessie != null}
        onOpenChange={(open) => { if (!open) setOpenSessie(null) }}
      />
    </CommercialShell>
  )
}
