// Centrale Analyse-omgeving (/analyse) — lichte datawerkruimte binnen de
// donkere app-shell. Hergebruikt uitsluitend bestaande hooks, engines en
// berekeningen; geen nieuwe formules, geen mock- of seeddata.
//
// Tabs: Overzicht · Belasting · Progressie · Doelen · Sessies
// Visueel: witte cards op slate-50 achtergrond; recharts grafieken op witte
// ondergrond; vaste semantische kleurset (CHART.*) voor alle data-reeksen.

import { useState, createContext, useContext, type ReactNode } from "react"
import { useLocation } from "wouter"
import {
  LineChart,
  Line,
  Area,
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
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer"
import { TrainingProgression } from "@/components/sparki/training-progression"
import { UitlegDot } from "@/components/viz/uitleg"
import { UITLEG } from "@/lib/uitleg-content"
import { useLoad, type LoadData } from "@/hooks/use-load"
import { useFtpHistory } from "@/hooks/use-ftp-history"
import { useSessions } from "@/hooks/use-sessions"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { usePowerBests } from "@/hooks/use-power-bests"
import { useGoalPicture, type Goal } from "@/hooks/use-goals"
import { useRaces } from "@/hooks/use-races"
import { useConnectors } from "@/hooks/use-connectors"
import { useSeasonGoal } from "@/hooks/use-nutrition"
import {
  weekVolumeReeks,
  intensiteitsVerdeling,
  gewichtWkgReeks,
  doelOverlays,
  vergelijkReeks,
  dataBetrouwbaarheid,
  laatsteSync,
  analyseSamenvatting,
  alsGetal,
  belastingProjectie,
  type BelastingProjectie,
  type DoelOverlays,
  type WeekVolume,
} from "@/lib/analyse-dashboard"
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
import { DoelenBeheerSheet, WedstrijdToevoegenSheet } from "@/components/sparki/beheer-popup"

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
  verwacht: "#9333ea", // purple-600 — doelscenario / verwachting (vaste kleur)
} as const

// ── Uitleg-stand ─────────────────────────────────────────────────────────────
// Pagina-brede schakelaar voor de onervaren sporter: elke kaart toont dan een
// korte uitleg in gewone taal, rechtstreeks uit het centrale uitleg-registry.

const UitlegModus = createContext(false)

function UitlegRegel({ k }: { k: string }) {
  const aan = useContext(UitlegModus)
  const u = UITLEG[k]
  if (!aan || !u) return null
  return (
    <p className="mb-4 rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2 text-xs leading-relaxed text-slate-600">
      {u.wat} {u.waarom}
    </p>
  )
}

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
  | { displayName?: string | null; ftp?: number | null; weightKg?: number | null; weeklyHourTarget?: number | null }
  | null
  | undefined

// Uren netjes tonen: "8", "8,5", "2,4" — max één decimaal, NL-komma.
function urenLabel(uren: number): string {
  const afgerond = Math.round(uren * 10) / 10
  return String(afgerond).replace(".", ",")
}

// "+0,8 u/week" of "−1,6 u/week" voor een procentuele volumeverandering.
function urenDeltaLabel(basisUren: number, pct: number): string {
  const delta = basisUren * (pct / 100)
  const teken = delta >= 0 ? "+" : "−"
  return `${teken}${urenLabel(Math.abs(delta))} u/week`
}

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

// ── Eerlijke lege toestand per grafiek ───────────────────────────────────────
// Compact: één regel + twee acties. Nooit geschatte waarden of mockgrafieken.

function LegeGrafiek({ titel }: { titel: string }) {
  const [, navigate] = useLocation()
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center">
      <p className="text-sm text-slate-500">{titel}</p>
      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/connect")}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          Platform koppelen
        </button>
        <button
          type="button"
          onClick={() => navigate("/connect")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          Rit importeren
        </button>
      </div>
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
        ? <span className="text-3xl font-light text-slate-300">—</span>
        : (
          <div className="flex items-baseline gap-1">
            <span className="num text-3xl font-semibold tracking-tight tabular-nums" style={{ color }}>{value}</span>
            {unit && <span className="text-sm text-slate-400">{unit}</span>}
          </div>
        )
      }
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
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
      {payload
        .filter((p) => typeof p.value === "number")
        .map((p) => (
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
  raceMarkers = [],
  vergelijk = false,
  onDagKlik,
  projectie,
}: {
  chartData: LoadData["chartData"]
  periode: number
  raceMarkers?: DoelOverlays["raceMarkers"]
  vergelijk?: boolean
  onDagKlik?: (dateIso: string) => void
  projectie?: BelastingProjectie | null
}) {
  // ATL is via de legenda aan/uit te zetten; standaard aan, ook in
  // vergelijk-modus (voorheen verdween de lijn daar stil terwijl de
  // legenda hem wél benoemde).
  const [atlAan, setAtlAan] = useState(true)
  const gefilterd: LoadPunt[] = chartData.slice(-periode)
  const intervalStap = Math.max(1, Math.floor(gefilterd.length / 7))

  if (gefilterd.length < 3) {
    return (
      <p className="text-sm text-slate-400 py-6 text-center">
        Nog te weinig belastingsdata voor een grafiek. Log meer trainingen.
      </p>
    )
  }

  // Vorige periode (grijs) over de huidige heen — uitgelijnd op index.
  const metVorig = vergelijk ? vergelijkReeks(chartData, periode) : null
  const basisData: Array<Record<string, unknown> & { date: string }> = metVorig ?? gefilterd
  const heeftVorig = metVorig != null && metVorig.some((p) => p.vorigCtl != null)

  // Wedstrijdmarkers: as loopt door tot de eerstvolgende wedstrijd (max 21
  // dagen vooruit) zodat een aankomende wedstrijddatum zichtbaar is. Lege
  // toekomstdagen krijgen géén waarden — alleen een as-positie, geen data.
  const eerste = gefilterd[0]?.date ?? ""
  const laatste = gefilterd[gefilterd.length - 1]?.date ?? ""
  let ctlData: Array<Record<string, unknown> & { date: string }> = basisData
  let asEinde = laatste

  // Doelscenario: verwachtingsband + middenlijn vooruit vanaf de laatste dag.
  if (projectie && projectie.punten.length > 0) {
    const [startPunt, ...rest] = projectie.punten
    ctlData = basisData.map((row) =>
      row.date === startPunt.date
        ? { ...row, projCtl: startPunt.projCtl, projBand: startPunt.projBand }
        : row,
    )
    ctlData = [...ctlData, ...rest.map((p) => ({ date: p.date, projCtl: p.projCtl, projBand: p.projBand }))]
    asEinde = rest[rest.length - 1]?.date ?? laatste
  }
  const volgendeRace = raceMarkers.find((r) => r.date > laatste)
  if (!projectie && volgendeRace && laatste) {
    const cursor = new Date(`${laatste}T12:00:00`)
    const extra: Array<{ date: string }> = []
    for (let i = 0; i < 21; i++) {
      cursor.setDate(cursor.getDate() + 1)
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
      extra.push({ date: iso })
      if (iso >= volgendeRace.date) break
    }
    if (extra[extra.length - 1]?.date >= volgendeRace.date) {
      ctlData = [...basisData, ...extra]
      asEinde = extra[extra.length - 1].date
    }
  }
  const zichtbareRaces = raceMarkers.filter((r) => r.date >= eerste && r.date <= asEinde)

  const klik = onDagKlik
    ? (state: { activeLabel?: string | number } | null) => {
        if (state?.activeLabel) onDagKlik(String(state.activeLabel))
      }
    : undefined

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
            <button
              type="button"
              onClick={() => setAtlAan((v) => !v)}
              aria-pressed={atlAan}
              title={atlAan ? "Verberg de ATL-lijn" : "Toon de ATL-lijn"}
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-md px-1.5 -mx-1.5 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50",
                atlAan ? "" : "opacity-40 line-through",
              )}
            >
              <span
                className="inline-block h-0.5 w-5 rounded"
                style={{ background: CHART.atl, backgroundImage: `repeating-linear-gradient(90deg,${CHART.atl} 0,${CHART.atl} 4px,transparent 4px,transparent 8px)` }}
              />
              ATL (vermoeidheid)
            </button>
            {heeftVorig && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 rounded bg-slate-300" />
                Vorige periode (CTL)
              </span>
            )}
            {zichtbareRaces.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-0.5 rounded" style={{ background: CHART.race }} />
                Wedstrijd
              </span>
            )}
            {projectie && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: CHART.verwacht, opacity: 0.35 }} />
                Verwachting (boven- en onderwaarde)
              </span>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={ctlData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} onClick={klik}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={fmtDatum} tick={{ fill: "#64748b", fontSize: 11 }} interval={intervalStap} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip content={(props) => <CTLATLTooltip {...(props as Parameters<typeof CTLATLTooltip>[0])} />} />
            {projectie && (
              <Area
                type="monotone"
                dataKey="projBand"
                stroke="none"
                fill={CHART.verwacht}
                fillOpacity={0.18}
                name="Verwachtingsband"
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {heeftVorig && (
              <Line type="monotone" dataKey="vorigCtl" stroke="#cbd5e1" strokeWidth={1.5} dot={false} name="Vorige periode" connectNulls={false} />
            )}
            {atlAan && (
              <Line type="monotone" dataKey="atl" stroke={CHART.atl} strokeWidth={2.5} strokeDasharray="5 5" dot={false} name="ATL" />
            )}
            <Line type="monotone" dataKey="ctl" stroke={CHART.ctl} strokeWidth={2.5} dot={false} name="CTL" />
            {projectie && (
              <Line
                type="monotone"
                dataKey="projCtl"
                stroke={CHART.verwacht}
                strokeWidth={3}
                strokeDasharray="7 5"
                dot={false}
                name="Verwachte fitheid"
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {zichtbareRaces.map((r) => (
              <ReferenceLine
                key={r.date}
                x={r.date}
                stroke={CHART.race}
                strokeDasharray="4 3"
                label={{ value: r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name, position: "top", fill: CHART.race, fontSize: 9 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        {onDagKlik && (
          <p className="mt-1 text-[11px] text-slate-400">Klik op een dag om de sessie van die dag te openen.</p>
        )}
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
        <ResponsiveContainer width="100%" height={120}>
          <ComposedChart data={gefilterd} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={fmtDatum} tick={{ fill: "#64748b", fontSize: 11 }} interval={intervalStap} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
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

      {/* Belastingsverloop — volwaardige grafiek, geen dunne sparkline */}
      {load.data && load.data.chartData.length >= 7 && (
        <LCard className="p-5">
          <div className="flex items-center gap-1.5 mb-4">
            <LCardTitle>Belastingsverloop — laatste 42 dagen</LCardTitle>
            <UitlegDot uitlegKey="fitheid" label="Fitheid (CTL)" />
          </div>
          <UitlegRegel k="belasting" />
          <LoadGrafiek chartData={load.data.chartData} periode={42} />
          <div className="mt-2 flex justify-between text-xs text-slate-500 tabular-nums">
            <span>42 dagen geleden: fitheid {Math.round(load.data.chartData.slice(-42)[0]?.ctl ?? 0)}</span>
            <span className="font-medium" style={{ color: CHART.ctl }}>Nu: {Math.round(load.data.ctl)}</span>
          </div>
        </LCard>
      )}
      {load.isLoading && <Skel className="h-24 w-full" />}
    </div>
  )
}

// ── Trainingsvolume per week ─────────────────────────────────────────────────

function VolumeTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ payload: WeekVolume }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const w = payload[0]?.payload
  if (!w) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-1">Week van {label}</p>
      <p className="tabular-nums text-slate-600">
        {w.uren != null ? `${String(w.uren).replace(".", ",")} u` : "duur onbekend"}
        {w.tss != null && ` · ${w.tss} TSS`} · {w.sessies} {w.sessies === 1 ? "sessie" : "sessies"}
      </p>
    </div>
  )
}

function WeekVolumeCard({
  sessies,
  todayIso,
  onWeekKlik,
}: {
  sessies: TrainingSession[]
  todayIso: string
  onWeekKlik: (weekStart: string) => void
}) {
  const reeks = weekVolumeReeks(sessies, todayIso, 12)
  const heeftData = reeks.some((w) => w.sessies > 0)
  return (
    <LCard className="p-5">
      <div className="flex items-center gap-1.5 mb-4">
        <LCardTitle>Trainingsvolume per week</LCardTitle>
        <span className="text-xs text-slate-400">12 weken</span>
        <UitlegDot uitlegKey="trainingsvolume" label="Trainingsvolume" />
      </div>
      <UitlegRegel k="trainingsvolume" />
      {!heeftData ? (
        <LegeGrafiek titel="Nog geen trainingsvolume om te tonen." />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart
              data={reeks}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              onClick={(state) => {
                const s = state as { activePayload?: Array<{ payload: WeekVolume }> } | null
                const w = s?.activePayload?.[0]?.payload
                if (w && w.sessies > 0) onWeekKlik(w.weekStart)
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} interval={1} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip content={(props) => <VolumeTooltip {...(props as Parameters<typeof VolumeTooltip>[0])} />} />
              <Bar dataKey="uren" name="Uren" maxBarSize={18} cursor="pointer">
                {reeks.map((w, i) => (
                  <Cell key={i} fill={w.sessies > 0 ? CHART.volume : "#e2e8f0"} opacity={0.85} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] text-slate-400">Uren per week. Klik op een week om de laatste sessie te openen.</p>
        </>
      )}
    </LCard>
  )
}

// ── Intensiteitsverdeling ────────────────────────────────────────────────────

const INTENSITEIT_KLEUR: Record<string, string> = {
  rustig: "#94a3b8",
  stevig: CHART.ctl,
  hard: CHART.atl,
  onbekend: "#e2e8f0",
}

function IntensiteitCard({ sessies }: { sessies: TrainingSession[] }) {
  const { buckets, totaalMin, bekendMin } = intensiteitsVerdeling(
    sessies.map((s) => ({ id: s.id, sessionDate: s.sessionDate, durationMin: s.durationMin, tss: s.tss })),
  )
  return (
    <LCard className="p-5">
      <div className="flex items-center gap-1.5 mb-4">
        <LCardTitle>Intensiteitsverdeling</LCardTitle>
        <span className="text-xs text-slate-400">laatste sessies</span>
        <UitlegDot uitlegKey="intensiteitsverdeling" label="Intensiteitsverdeling" />
      </div>
      <UitlegRegel k="intensiteitsverdeling" />
      {totaalMin === 0 ? (
        <LegeGrafiek titel="Nog geen sessies met duur om een verdeling te maken." />
      ) : (
        <>
          <div className="flex h-4 w-full overflow-hidden rounded-full" role="img"
            aria-label={buckets.map((b) => `${b.label}: ${Math.round(b.aandeel * 100)}%`).join(", ")}>
            {buckets.filter((b) => b.minuten > 0).map((b) => (
              <div key={b.key} style={{ width: `${b.aandeel * 100}%`, background: INTENSITEIT_KLEUR[b.key] }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {buckets.filter((b) => b.minuten > 0).map((b) => (
              <span key={b.key} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: INTENSITEIT_KLEUR[b.key] }} />
                {b.label} <strong className="tabular-nums">{Math.round(b.aandeel * 100)}%</strong>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Afgeleid uit werkelijke belastingsscore en duur per sessie
            {bekendMin < totaalMin && " — sessies zonder score tellen als onbekend"}.
          </p>
        </>
      )}
    </LCard>
  )
}

// ── Slaap ────────────────────────────────────────────────────────────────────

function SlaapCard({ metrics, periode }: { metrics: Array<{ metricDate: string; sleepHours?: number | string | null }>; periode: AnalysePeriode }) {
  const [, navigate] = useLocation()
  const reeks = metrics
    .map((m) => ({ metricDate: m.metricDate, uren: alsGetal(m.sleepHours) }))
    .filter((m): m is { metricDate: string; uren: number } => m.uren != null && m.uren > 0)
    .sort((a, b) => a.metricDate.localeCompare(b.metricDate))
    .slice(-periode)
  const laatste = reeks[reeks.length - 1]
  return (
    <LCard className="p-5">
      <div className="flex items-center gap-1.5 mb-4">
        <LCardTitle>Slaap</LCardTitle>
        <span className="text-xs text-slate-400">{periodeLabel(periode)}</span>
        <UitlegDot uitlegKey="slaap" label="Slaap" />
      </div>
      <UitlegRegel k="slaap" />
      {reeks.length < 2 ? (
        <MissingInputNotice compact showOrb={false}
          title="Nog geen slaapdata"
          description="Koppel een platform dat slaap registreert — direct (zoals Garmin) of indirect (zoals Google Health) — of vul je slaap in bij de dagelijkse check-in."
          targets={["checkin"]}
          actions={[
            {
              label: "Slaapbron koppelen",
              onClick: () => navigate("/you?focus=connections"),
            },
          ]}
          returnTo="/analyse"
        />
      ) : (
        <>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="num text-3xl font-light text-slate-900">{String(laatste.uren).replace(".", ",")}</span>
            <span className="text-xs text-slate-400">u laatst gemeten</span>
          </div>
          <Sparkline
            data={reeks.map((m) => m.uren)}
            width={340}
            height={44}
            stroke={CHART.volume}
            fill="rgba(139,92,246,0.07)"
            className="w-full"
          />
        </>
      )}
    </LCard>
  )
}

// ── Belasting-tabblad ─────────────────────────────────────────────────────────

const GRAFIEK_PERIODES = [
  { dagen: 7,   label: "Week"     },
  { dagen: 28,  label: "Maand"    },
  { dagen: 90,  label: "Kwartaal" },
  { dagen: 182, label: "Seizoen"  },
] as const

function BelastingTab({
  load,
  sessies,
  profiel,
  metrics,
  periode,
  onPeriode,
  overlays,
  todayIso,
  onDagKlik,
  onWeekKlik,
}: {
  load: Bron<LoadData>
  sessies: Bron<TrainingSession[]>
  profiel: Profiel
  metrics: Bron<Array<{ metricDate: string; feelScore?: number | null; hrv?: number | null; sleepHours?: number | string | null }>>
  periode: AnalysePeriode
  onPeriode: (p: AnalysePeriode) => void
  overlays: DoelOverlays
  todayIso: string
  onDagKlik: (dateIso: string) => void
  onWeekKlik: (weekStart: string) => void
}) {
  const loadToestand = toestandVan(load, load.data != null)
  const [grafiekPeriode, setGrafiekPeriode] = useState<number>(90)
  const [vergelijk, setVergelijk] = useState(false)

  // Doelscenario: volumeverandering in % (null = uit). Deterministische
  // projectie uit de gedeelde engine; zonder echte belastingsscores geen band.
  const [scenarioPct, setScenarioPct] = useState<number | null>(null)

  // Urenbasis voor het scenario: eerst de uren uit je trainingsplan, anders
  // je werkelijke gemiddelde van de laatste 4 weken. Geen van beide = eerlijk
  // geen urenvertaling.
  const urenBasis: { uren: number; bron: "plan" | "werkelijk" } | null = (() => {
    const planUren = profiel?.weeklyHourTarget
    if (planUren != null && planUren > 0) return { uren: planUren, bron: "plan" }
    const grens = new Date()
    grens.setDate(grens.getDate() - 28)
    const grensIso = localISODate(grens)
    const minuten = (sessies.data ?? [])
      .filter((s) => s.sessionDate >= grensIso && s.durationMin != null && s.durationMin > 0)
      .reduce((sum, s) => sum + (s.durationMin ?? 0), 0)
    if (minuten <= 0) return null
    return { uren: minuten / 60 / 4, bron: "werkelijk" }
  })()
  const projectie =
    scenarioPct != null && load.data
      ? belastingProjectie({
          chartData: load.data.chartData,
          sessies: (sessies.data ?? []).map((s) => ({ sessionDate: s.sessionDate, tss: s.tss })),
          pctVolume: scenarioPct,
        })
      : null

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
      {/* Doelscenario — centraal veld boven de grafiek */}
      <LCard className="p-5 border-2 border-purple-200">
        <div className="flex items-center gap-1.5 mb-1">
          <LCardTitle>Doelscenario</LCardTitle>
          <UitlegDot uitlegKey="doelscenario" label="Doelscenario" />
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Kies een voorgenomen verandering van je trainingsvolume. De grafiek toont dan in het paars
          de verwachte ontwikkeling van je fitheid, als band met een boven- en onderwaarde.
        </p>
        <UitlegRegel k="doelscenario" />
        <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Doelscenario trainingsvolume">
          {/* Draaiwieltje: in stappen van 5% van −50% tot +50% */}
          <div className="inline-flex items-center rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              aria-label="5% minder volume"
              disabled={(scenarioPct ?? 0) <= -50}
              onClick={() => setScenarioPct(Math.max(-50, (scenarioPct ?? 0) - 5) || null)}
              className="min-h-11 min-w-11 px-3 text-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
            >
              −
            </button>
            <span
              aria-live="polite"
              className={cn(
                "min-w-[5.5rem] border-x border-slate-200 px-3 py-2 text-center font-mono text-sm tabular-nums",
                scenarioPct == null ? "text-slate-400" : "font-semibold text-purple-700",
              )}
            >
              {scenarioPct == null ? "0% (uit)" : `${scenarioPct > 0 ? "+" : ""}${scenarioPct}%`}
            </span>
            <button
              type="button"
              aria-label="5% meer volume"
              disabled={(scenarioPct ?? 0) >= 50}
              onClick={() => setScenarioPct(Math.min(50, (scenarioPct ?? 0) + 5) || null)}
              className="min-h-11 min-w-11 px-3 text-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
            >
              +
            </button>
          </div>
          {scenarioPct != null && (
            <button
              type="button"
              onClick={() => setScenarioPct(null)}
              className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
            >
              Uit
            </button>
          )}
        </div>
        {scenarioPct != null && urenBasis != null && (
          <p className="mt-2 text-sm text-slate-600 tabular-nums">
            {scenarioPct > 0 ? "+" : ""}{scenarioPct}% volume ≈{" "}
            <strong>{urenDeltaLabel(urenBasis.uren, scenarioPct)}</strong>{" "}
            ({urenLabel(urenBasis.uren)} → {urenLabel(urenBasis.uren * (1 + scenarioPct / 100))} u/week,{" "}
            {urenBasis.bron === "plan" ? "op basis van je trainingsplan" : "op basis van je werkelijke laatste 4 weken"}).
          </p>
        )}
        {scenarioPct != null && urenBasis == null && (
          <p className="mt-2 text-sm text-slate-500">
            Wat dit in uren betekent is nog niet te zeggen: er staan geen uren per week in je plan en er
            zijn geen recente sessies met een duur.
          </p>
        )}
        {scenarioPct != null && projectie && (
          <p className="mt-3 rounded-lg bg-purple-50/70 border border-purple-100 px-3 py-2 text-sm text-slate-700">
            Bij <strong>{scenarioPct > 0 ? "+" : ""}{scenarioPct}% trainingsvolume</strong> komt je fitheid over{" "}
            {projectie.dagen} dagen naar verwachting uit tussen{" "}
            <strong className="tabular-nums" style={{ color: CHART.verwacht }}>
              {projectie.ctlEind[0]} en {projectie.ctlEind[1]}
            </strong>{" "}
            (nu {projectie.ctlNu}).
            {projectie.tsbDip < -15 && (
              <> Je vorm zakt onderweg tijdelijk naar ongeveer {projectie.tsbDip} — houd rekening met extra vermoeidheid.</>
            )}{" "}
            Dit is een verwachting op basis van je werkelijke belasting van de laatste vier weken, geen zekerheid.
          </p>
        )}
        {scenarioPct != null && !projectie && (
          <p className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-500">
            Er zijn de afgelopen vier weken geen sessies met een belastingsscore, dus een verwachting
            is nu niet te berekenen. Log trainingen met duur en intensiteit of koppel een platform.
          </p>
        )}
      </LCard>

      {/* Load grafiek — volle breedte */}
      <LCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <LCardTitle>Belastingsgrafiek</LCardTitle>
            <UitlegDot uitlegKey="belasting" label="Trainingsbelasting" />
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Grafiekperiode">
            {GRAFIEK_PERIODES.map((p) => (
              <button
                key={p.dagen}
                type="button"
                onClick={() => setGrafiekPeriode(p.dagen)}
                aria-pressed={grafiekPeriode === p.dagen}
                className={cn(
                  "min-h-8 rounded-lg border px-3 font-mono text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                  grafiekPeriode === p.dagen
                    ? "border-sky-500/60 bg-sky-50 text-sky-600 font-medium"
                    : "border-slate-200 text-slate-500 hover:text-slate-800",
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setVergelijk((v) => !v)}
              aria-pressed={vergelijk}
              className={cn(
                "min-h-8 rounded-lg border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                vergelijk
                  ? "border-slate-400 bg-slate-100 text-slate-700 font-medium"
                  : "border-slate-200 text-slate-500 hover:text-slate-800",
              )}
              title="Vergelijk met de vorige periode van gelijke lengte"
            >
              Vergelijk
            </button>
          </div>
        </div>

        <UitlegRegel k="belasting" />
        {loadToestand === "laden" && <Skel className="h-64 w-full" />}
        {loadToestand === "fout" && <LFout titel="Belastingsgrafiek kon niet worden geladen." onOpnieuw={() => void load.refetch()} />}
        {(loadToestand === "ok" || loadToestand === "verouderd") && load.data && (
          load.data.chartData.length >= 3 ? (
            <LoadGrafiek
              chartData={load.data.chartData}
              periode={grafiekPeriode}
              raceMarkers={overlays.raceMarkers}
              vergelijk={vergelijk}
              onDagKlik={onDagKlik}
              projectie={projectie}
            />
          ) : (
            <LegeGrafiek titel="Nog te weinig belastingsdata voor een grafiek." />
          )
        )}
      </LCard>

      {/* Grid: volume + intensiteit + herstel — desktop naast elkaar */}
      <div className="grid gap-6 lg:grid-cols-2">
      <WeekVolumeCard sessies={sessies.data ?? []} todayIso={todayIso} onWeekKlik={onWeekKlik} />
      <IntensiteitCard sessies={sessies.data ?? []} />

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
            description="Log je dagelijkse check-in om je readiness te volgen."
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
        <UitlegRegel k="hrvTrend" />
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
        <UitlegRegel k="performanceRadar" />
        {loadToestand === "laden" ? (
          <Skel className="h-[180px] w-[180px] rounded-full mx-auto" />
        ) : meetbaar.length >= 3 ? (
          <div className="flex flex-col items-center gap-3">
            <BioRadar
              size={220}
              axes={meetbaar}
              labelColor="rgba(51,65,85,0.85)"
              gridColor="rgba(15,23,42,0.10)"
            />
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

      <SlaapCard metrics={metrics.data ?? []} periode={periode} />
      </div>
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

// ── Gewicht & W/kg ───────────────────────────────────────────────────────────

function GewichtTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ payload: { kg: number; wkg: number | null } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      <p className="tabular-nums text-slate-600">
        {String(p.kg).replace(".", ",")} kg
        {p.wkg != null && ` · ${String(p.wkg).replace(".", ",")} W/kg`}
      </p>
    </div>
  )
}

function GewichtWkgCard({
  metrics,
  ftpTests,
  profielFtp,
  overlays,
}: {
  metrics: Array<{ metricDate: string; weightKg?: number | string | null }>
  ftpTests: Array<{ ftpWatts: number; measuredAt: string }>
  profielFtp: number | null
  overlays: DoelOverlays
}) {
  const reeks = gewichtWkgReeks(metrics, ftpTests, profielFtp)
  const heeftWkg = reeks.some((p) => p.wkg != null)
  return (
    <LCard className="p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
        <LCardTitle>Gewicht &amp; W/kg</LCardTitle>
        <UitlegDot uitlegKey="gewichtWkg" label="Gewicht & W/kg" />
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded bg-slate-700" /> Gewicht
          </span>
          {heeftWkg && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: CHART.ftp }} /> W/kg
            </span>
          )}
          {(overlays.streefGewichtKg != null || overlays.streefWkg != null) && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: CHART.goal, backgroundImage: `repeating-linear-gradient(90deg,${CHART.goal} 0,${CHART.goal} 4px,transparent 4px,transparent 8px)` }} /> Doel
            </span>
          )}
        </div>
      </div>
      <UitlegRegel k="gewichtWkg" />
      {reeks.length < 2 ? (
        <LegeGrafiek titel="Nog geen gewichtsmetingen om een verloop te tonen." />
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={reeks} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={fmtDatum} tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis yAxisId="kg" tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
            <YAxis yAxisId="wkg" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} hide={!heeftWkg} />
            <Tooltip content={(props) => <GewichtTooltip {...(props as Parameters<typeof GewichtTooltip>[0])} />} />
            <Line yAxisId="kg" type="monotone" dataKey="kg" stroke="#334155" strokeWidth={2} dot={false} name="Gewicht" />
            {heeftWkg && (
              <Line yAxisId="wkg" type="monotone" dataKey="wkg" stroke={CHART.ftp} strokeWidth={2} dot={false} name="W/kg" connectNulls={false} />
            )}
            {overlays.streefGewichtKg != null && (
              <ReferenceLine yAxisId="kg" y={overlays.streefGewichtKg} stroke={CHART.goal} strokeDasharray="5 4"
                label={{ value: `Streefgewicht ${String(overlays.streefGewichtKg).replace(".", ",")} kg`, position: "insideTopLeft", fill: CHART.goal, fontSize: 10 }} />
            )}
            {overlays.streefWkg != null && heeftWkg && (
              <ReferenceLine yAxisId="wkg" y={overlays.streefWkg} stroke={CHART.goal} strokeDasharray="5 4"
                label={{ value: `Doel ${String(overlays.streefWkg).replace(".", ",")} W/kg`, position: "insideBottomRight", fill: CHART.goal, fontSize: 10 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </LCard>
  )
}

function ProgressieTab({
  load,
  sessies,
  ftp,
  profiel,
  metrics,
  overlays,
}: {
  load: Bron<LoadData>
  sessies: Bron<TrainingSession[]>
  ftp: Bron<Array<{ ftpWatts: number; measuredAt: string }>>
  profiel: Profiel
  metrics: Bron<Array<{ metricDate: string; weightKg?: number | string | null }>>
  overlays: DoelOverlays
}) {
  const weergave = ftp.data ? ftpWeergave(ftp.data, profiel?.ftp ?? null) : null
  const [, navigate] = useLocation()

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
      {/* FTP-ontwikkeling */}
      <LCard className="p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <LCardTitle>FTP-ontwikkeling</LCardTitle>
          <UitlegDot uitlegKey="ftpOntwikkeling" label="FTP-ontwikkeling" />
          {overlays.streefFtp != null && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500 ml-2">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: CHART.goal, backgroundImage: `repeating-linear-gradient(90deg,${CHART.goal} 0,${CHART.goal} 4px,transparent 4px,transparent 8px)` }} />
              Streef-FTP {overlays.streefFtp} W
            </span>
          )}
        </div>
        <UitlegRegel k="ftpOntwikkeling" />
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
              <ResponsiveContainer width="100%" height={110}>
                <ComposedChart
                  data={weergave.gesorteerd.map((t) => ({ ...t, maand: maandLabel(t.measuredAt) }))}
                  margin={{ top: 12, right: 8, left: -24, bottom: 0 }}
                >
                  <XAxis dataKey="maand" tick={{ fill: "#94a3b8", fontSize: 9 }} interval={0} />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 9 }}
                    domain={[
                      (min: number) => Math.floor(Math.min(min, overlays.streefFtp ?? min) * 0.9),
                      (max: number) => Math.ceil(Math.max(max, overlays.streefFtp ?? max) * 1.05),
                    ]}
                  />
                  <Bar dataKey="ftpWatts" name="FTP" maxBarSize={28} radius={[3, 3, 0, 0]}>
                    {weergave.gesorteerd.map((t, i) => (
                      <Cell key={`${t.measuredAt}-${i}`} fill={i === weergave.gesorteerd.length - 1 ? CHART.ftp : "#e2e8f0"} />
                    ))}
                  </Bar>
                  {overlays.streefFtp != null && (
                    <ReferenceLine
                      y={overlays.streefFtp}
                      stroke={CHART.goal}
                      strokeDasharray="5 4"
                      label={{ value: `Streef-FTP ${overlays.streefFtp} W`, position: "insideTopRight", fill: CHART.goal, fontSize: 10 }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </LCard>

      <GewichtWkgCard
        metrics={metrics.data ?? []}
        ftpTests={ftp.data ?? []}
        profielFtp={profiel?.ftp ?? null}
        overlays={overlays}
      />

      {/* Persoonlijke records (vermogen) */}
      <LCard className="p-5 lg:col-span-2">
        <div className="flex items-center gap-1.5 mb-4">
          <LCardTitle>Persoonlijke vermogensrecords</LCardTitle>
          <UitlegDot uitlegKey="records" label="Beste vermogens" />
        </div>
        <UitlegRegel k="records" />
        <PowerBestsTable />
      </LCard>
      </div>

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
  // Beheer als popup: je blijft op deze pagina; wijzigingen komen via de
  // gedeelde query-cache meteen hier én in Plan/Jij terug.
  const [doelenPopup, setDoelenPopup] = useState<null | { autoAdd: boolean }>(null)
  const [racePopup, setRacePopup] = useState(false)

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
          <button type="button" onClick={() => setDoelenPopup({ autoAdd: false })}
            className="text-xs text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60">
            Beheer
          </button>
        </div>

        {goalsLoading && <div className="space-y-3"><Skel className="h-20 w-full" /><Skel className="h-20 w-full" /></div>}
        {goalsError && <LFout titel="Doelen konden niet worden geladen." onOpnieuw={() => void goalsRefetch()} />}
        {!goalsLoading && !goalsError && actieveDoelen.length === 0 && (
          <p className="text-sm text-slate-400 py-2">
            Nog geen actieve doelen.{" "}
            <button type="button" onClick={() => setDoelenPopup({ autoAdd: true })}
              className="underline underline-offset-2 hover:no-underline">
              Voeg een doel toe
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
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setRacePopup(true)}
              className="text-xs text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60">
              + Wedstrijd
            </button>
            <button type="button" onClick={() => navigate("/races")}
              className="text-xs text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60">
              Alle races →
            </button>
          </div>
        </div>

        {komende.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">
            Geen aankomende wedstrijden.{" "}
            <button type="button" onClick={() => setRacePopup(true)}
              className="underline underline-offset-2 hover:no-underline">
              Plan een wedstrijd
            </button>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {komende.map((r) => <RaceCard key={r.id} race={r} todayISO={todayISO} />)}
          </div>
        )}
      </section>

      <DoelenBeheerSheet
        open={doelenPopup != null}
        onOpenChange={(o) => !o && setDoelenPopup(null)}
        autoAdd={doelenPopup?.autoAdd ?? false}
      />
      <WedstrijdToevoegenSheet open={racePopup} onOpenChange={setRacePopup} />
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

// ── Bovenste samenvatting ─────────────────────────────────────────────────────
// Huidige belasting · vorm/herstel · ontwikkeling · laatste sync ·
// databetrouwbaarheid — alles uit dezelfde engine als de grafieken.

function synclabel(momentIso: string): string {
  const d = new Date(momentIso)
  if (Number.isNaN(d.getTime())) return momentIso.slice(0, 10)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

const BETROUWBAARHEID_KLEUR = {
  hoog: CHART.tsbPos,
  beperkt: CHART.warn,
  laag: CHART.tsbNeg,
  geen: CHART.missing,
} as const

function SamenvattingStrip({
  load,
  ftpTests,
  profiel,
  metrics,
  sessies,
  todayIso,
}: {
  load: Bron<LoadData>
  ftpTests: Array<{ ftpWatts: number; measuredAt: string }>
  profiel: Profiel
  metrics: Array<{ metricDate: string; weightKg?: number | string | null }>
  sessies: TrainingSession[]
  todayIso: string
}) {
  const connectors = useConnectors()
  const kern = analyseSamenvatting({
    load: load.data ? { ctl: load.data.ctl, atl: load.data.atl, tsb: load.data.tsb } : null,
    ftpTests,
    profielFtp: profiel?.ftp ?? null,
    metrics,
  })
  const sync = laatsteSync(
    (connectors.data ?? []).map((c) => ({ displayName: c.displayName, status: c.status, lastSyncAt: c.lastSyncAt })),
  )
  const kwaliteit = dataBetrouwbaarheid(
    sessies.map((s) => ({ id: s.id, sessionDate: s.sessionDate, durationMin: s.durationMin, tss: s.tss })),
    todayIso,
  )

  const cel = (label: string, waarde: ReactNode, sub?: string) => (
    <div className="min-w-0">
      <LLabel>{label}</LLabel>
      <div className="mt-0.5 text-sm text-slate-900">{waarde}</div>
      {sub && <p className="truncate text-[10px] text-slate-400">{sub}</p>}
    </div>
  )

  return (
    <LCard className="p-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {cel(
          "Belasting",
          kern.ctl != null
            ? <span className="tabular-nums" style={{ color: CHART.ctl }}>{kern.ctl} <span className="text-xs text-slate-400">CTL</span></span>
            : <span className="text-slate-300">—</span>,
          kern.atl != null ? `vermoeidheid ${kern.atl}` : undefined,
        )}
        {cel(
          "Vorm & herstel",
          kern.tsb != null
            ? <span className="tabular-nums" style={{ color: kern.tsb >= 0 ? CHART.tsbPos : CHART.tsbNeg }}>{kern.tsb > 0 ? "+" : ""}{kern.tsb}</span>
            : <span className="text-slate-300">—</span>,
          kern.vormLabel ?? undefined,
        )}
        {cel(
          "Ontwikkeling",
          kern.ftp != null
            ? (
              <span className="tabular-nums" style={{ color: CHART.ftp }}>
                {kern.ftp} W
                {kern.ftpDelta != null && (
                  <span className="ml-1 text-xs" style={{ color: kern.ftpDelta > 0 ? CHART.tsbPos : kern.ftpDelta < 0 ? CHART.tsbNeg : CHART.missing }}>
                    {kern.ftpDelta > 0 ? "+" : ""}{kern.ftpDelta}
                  </span>
                )}
              </span>
            )
            : <span className="text-slate-300">—</span>,
          kern.wkg != null ? `${String(kern.wkg).replace(".", ",")} W/kg` : undefined,
        )}
        {cel(
          "Laatste sync",
          sync
            ? <span className="tabular-nums">{synclabel(sync.moment)}</span>
            : <span className="text-slate-400">geen koppeling</span>,
          sync?.bron,
        )}
        {cel(
          "Databetrouwbaarheid",
          <span className="capitalize" style={{ color: BETROUWBAARHEID_KLEUR[kwaliteit.label] }}>{kwaliteit.label}</span>,
          kwaliteit.reden,
        )}
      </div>
    </LCard>
  )
}

// ── Hoofdpagina ───────────────────────────────────────────────────────────────

export default function CoreAnalysePage() {
  // Deep-linkbaar tabblad: /analyse?tab=belasting opent direct dat tabblad.
  const initieleTab = (): Tab => {
    const t = new URLSearchParams(window.location.search).get("tab")
    return TABS.some((tab) => tab.id === t) ? (t as Tab) : "overzicht"
  }
  const [activeTab, setActiveTabState] = useState<Tab>(initieleTab)
  // Tab-wissel schrijft de query terug zodat de URL altijd deelbaar blijft.
  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab)
    const url = new URL(window.location.href)
    if (tab === "overzicht") url.searchParams.delete("tab")
    else url.searchParams.set("tab", tab)
    window.history.replaceState(null, "", url.pathname + url.search)
  }
  const [openSessie, setOpenSessie] = useState<TrainingSession | null>(null)
  const [periode, setPeriode] = useState<AnalysePeriode>(30)
  const [uitlegAan, setUitlegAan] = useState(false)

  // Bestaande hooks — berekeningen blijven in engines en API-laag
  const load    = useLoad()
  const ftp     = useFtpHistory()
  const sessies = useSessions(60)
  const metrics = useDailyMetrics(90)
  const profielQuery = useAthleteExtendedProfile()
  const profiel = profielQuery.data as Profiel
  const todayIso = localISODate(new Date())

  // Doel-overlays — alleen echte, actief ingestelde doelen; anders kale grafiek.
  const { data: goalPicture } = useGoalPicture()
  const seasonGoal = useSeasonGoal(true)
  const { data: races } = useRaces()
  const overlays = doelOverlays({
    goals: (goalPicture?.goals ?? []).map((g) => ({
      status: g.status,
      measure: g.measure,
      targetValue: g.targetValue,
      targetDate: g.targetDate,
      title: g.title,
    })),
    seasonGoalTargetKg:
      seasonGoal.data?.eligible === true ? seasonGoal.data.goal.targetWeightKg : null,
    races: (races ?? []).map((r) => ({ name: r.name, raceDate: r.raceDate, status: r.status })),
    todayIso,
  })

  // Doorklikken vanuit een grafiekpunt naar de onderliggende sessie.
  const openOpDatum = (dateIso: string) => {
    const dag = (sessies.data ?? []).filter((s) => s.sessionDate === dateIso.slice(0, 10))
    if (dag.length > 0) setOpenSessie(dag[0])
  }
  const openOpWeek = (weekStart: string) => {
    const eind = new Date(`${weekStart}T12:00:00`)
    eind.setDate(eind.getDate() + 6)
    const eindIso = localISODate(eind)
    const week = (sessies.data ?? [])
      .filter((s) => s.sessionDate >= weekStart && s.sessionDate <= eindIso)
      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
    if (week.length > 0) setOpenSessie(week[0])
  }

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
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUitlegAan((v) => !v)}
                  aria-pressed={uitlegAan}
                  className={cn(
                    "min-h-8 rounded-lg border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
                    uitlegAan
                      ? "border-sky-500/60 bg-sky-50 font-medium text-sky-700"
                      : "border-slate-200 text-slate-500 hover:text-slate-800",
                  )}
                  title="Toon bij elk onderdeel een korte uitleg in gewone taal"
                >
                  {uitlegAan ? "Uitleg aan" : "Uitleg"}
                </button>
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
        <UitlegModus.Provider value={uitlegAan}>
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 space-y-6">
          {/* Bovenste samenvatting — zichtbaar op elk tabblad */}
          <SamenvattingStrip
            load={load}
            ftpTests={ftp.data ?? []}
            profiel={profiel}
            metrics={metrics.data ?? []}
            sessies={sessies.data ?? []}
            todayIso={todayIso}
          />

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
              overlays={overlays}
              todayIso={todayIso}
              onDagKlik={openOpDatum}
              onWeekKlik={openOpWeek}
            />
          </div>
          <div id="tab-progressie" role="tabpanel" hidden={activeTab !== "progressie"}>
            <ProgressieTab load={load} sessies={sessies} ftp={ftp} profiel={profiel} metrics={metrics} overlays={overlays} />
          </div>
          <div id="tab-doelen"     role="tabpanel" hidden={activeTab !== "doelen"}>
            {activeTab === "doelen" && <DoelenTab />}
          </div>
          <div id="tab-sessies"    role="tabpanel" hidden={activeTab !== "sessies"}>
            <SessiesTab sessies={sessies} onOpen={setOpenSessie} />
          </div>
        </div>
        </UitlegModus.Provider>
      </div>

      <SessionDetailDrawer
        session={openSessie}
        open={openSessie != null}
        onOpenChange={(open) => { if (!open) setOpenSessie(null) }}
      />
    </CommercialShell>
  )
}
