// Centrale Analyse-omgeving (/analyse) — donkere datawerkruimte binnen de
// gedeelde cinematic app-shell (ScreenShell). Hergebruikt uitsluitend
// bestaande hooks, engines en berekeningen; geen nieuwe formules, geen mock-
// of seeddata.
//
// Tabs: Overzicht · Belasting · Progressie · Doelen · Sessies
// Visueel: glass cards (bg-card, border-border) op de
// cinematic achtergrond van ScreenShell; recharts grafieken met wit/laag-alpha
// assen en gridlijnen; vaste semantische kleurset (CHART.*) voor alle
// data-reeksen.

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

import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { HoofdstukTabs } from "@/components/sparki/hoofdstuk-tabs"
import { ClubChip } from "@/components/sparki/club-chip"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"
import { WattageLab } from "@/components/sparki/wattage-lab"
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
import { useWeeklyZones } from "@/hooks/use-weekly-zones"
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
import { CHART, tsbKleur, tsbBalkKleur } from "@/lib/chart-kleuren"

// ── Uitleg-stand ─────────────────────────────────────────────────────────────
// Pagina-brede schakelaar voor de onervaren sporter: elke kaart toont dan een
// korte uitleg in gewone taal, rechtstreeks uit het centrale uitleg-registry.

const UitlegModus = createContext(false)

function UitlegRegel({ k }: { k: string }) {
  const aan = useContext(UitlegModus)
  const u = UITLEG[k]
  if (!aan || !u) return null
  return (
    <p className="mb-4 rounded-lg border border-accent-cyan/20 bg-accent-cyan/[0.06] px-3 py-2 text-xs leading-relaxed text-muted-foreground">
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
  | { displayName?: string | null; ftp?: number | null; ftpEstimated?: boolean | null; weightKg?: number | null; weeklyHourTarget?: number | null }
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

// ── Glass-primitieven (donkere schil-variant) ────────────────────────────────

// Glass card conform de gedeelde schil: donkere ondergrond + laag-alpha rand +
// backdrop-blur. Radius 16px (rounded-2xl), ruime padding (default p-5/20px,
// door callers overschrijfbaar).
// Intensiteitsfactor (IF) als tekst — alleen echte, aannemelijke waarden;
// null (⇒ "—") wanneer de sessie geen IF droeg. Nooit berekend uit een gok.
function ifLabel(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0 || n > 2) return null
  return n.toFixed(2)
}

function LCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  )
}

function LCardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-[15px] font-semibold text-foreground", className)}>{children}</h3>
}

function LLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block min-w-0 [overflow-wrap:anywhere] text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
      {children}
    </span>
  )
}

function Skel({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-2xl bg-muted", className)} />
}

function LFout({ titel, onOpnieuw }: { titel: string; onOpnieuw?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.08] p-4 text-sm text-[color:var(--color-negative)]">
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
    <div className="rounded-xl border border-dashed border-border bg-muted px-4 py-5 text-center">
      <p className="text-sm text-muted-foreground">{titel}</p>
      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/connect")}
          className="rounded-lg bg-accent-cyan px-3 py-1.5 text-xs font-medium text-[color:var(--color-on-accent)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          Platform koppelen
        </button>
        <button
          type="button"
          // Bewust ANDERS dan "Platform koppelen": landt direct op de bestaande
          // FIT/GPX/TCX-bestandsimport (ActivityImportPanel) op Sparki Connect,
          // via het bestaande ?focus=-patroon van de Smart Missing Input-flow.
          onClick={() => navigate("/connect?focus=import")}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-accent-cyan/40 hover:text-accent-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
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
        ? <span className="text-3xl font-light text-muted-foreground">—</span>
        : (
          <div className="flex items-baseline gap-1">
            <span className="num text-3xl font-bold tracking-tight tabular-nums" style={{ color }}>{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
        )
      }
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
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
    <div className="rounded-lg bg-card px-3 py-2 text-xs text-foreground shadow-lg">
      <p className="mb-1.5 font-medium text-foreground/85">{label}</p>
      {payload
        .filter((p) => typeof p.value === "number" && p.name !== "CTL-vlak")
        .map((p) => (
          <p key={p.name} className="tabular-nums flex justify-between gap-4">
            <span className="text-muted-foreground">{p.name}</span>
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
    <div className="rounded-lg bg-card px-3 py-2 text-xs text-foreground shadow-lg">
      <p className="mb-1 font-medium text-foreground/85">{label}</p>
      <p className="tabular-nums">
        <span className="text-muted-foreground">Vorm (TSB)</span>{" "}
        <strong>{tsb > 0 ? "+" : ""}{Math.round(tsb)}</strong>
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
      <p className="text-sm text-muted-foreground py-6 text-center">
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
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                <span className="inline-block h-0.5 w-5 rounded bg-muted" />
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
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDatum} tick={{ fill: CHART.as, fontSize: 11 }} interval={intervalStap} />
            <YAxis
              tick={{ fill: CHART.as, fontSize: 11 }}
              domain={["auto", "auto"]}
              label={{ value: "punten", angle: -90, position: "insideLeft", offset: 18, fill: CHART.as, fontSize: 10 }}
            />
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
              <Line type="monotone" dataKey="vorigCtl" stroke="rgba(20,24,31,0.35)" strokeWidth={1.5} dot={false} name="Vorige periode" connectNulls={false} />
            )}
            {/* Area-fill onder CTL: aflopende gradient (addendum 30 jul) —
                trend in één oogopslag. ATL krijgt bewust GEEN fill en minder
                lijngewicht: CTL blijft primair. */}
            <defs>
              <linearGradient id="ctl-fill-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.ctl} stopOpacity={CHART.ctlFillTopOpacity} />
                <stop offset="100%" stopColor={CHART.ctl} stopOpacity={CHART.ctlFillBottomOpacity} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="ctl"
              stroke="none"
              fill="url(#ctl-fill-gradient)"
              fillOpacity={1}
              name="CTL-vlak"
              tooltipType="none"
              legendType="none"
              isAnimationActive={false}
            />
            {atlAan && (
              <Line type="monotone" dataKey="atl" stroke={CHART.atl} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4 }} name="ATL" />
            )}
            <Line type="monotone" dataKey="ctl" stroke={CHART.ctl} strokeWidth={3} dot={false} activeDot={{ r: 4 }} name="CTL" />
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
          <p className="mt-1 text-[11px] text-muted-foreground">Klik op een dag om de sessie van die dag te openen.</p>
        )}
      </div>

      {/* TSB */}
      <div>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <LCardTitle>Vorm (TSB)</LCardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHART.tsbPos }} />
              Positief — goed uitgerust
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHART.tsbNegLicht }} />
              Licht negatief
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHART.tsbNeg }} />
              Sterk negatief — vermoeid
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <ComposedChart data={gefilterd} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDatum} tick={{ fill: CHART.as, fontSize: 11 }} interval={intervalStap} />
            <YAxis
              tick={{ fill: CHART.as, fontSize: 11 }}
              label={{ value: "punten", angle: -90, position: "insideLeft", offset: 18, fill: CHART.as, fontSize: 10 }}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />
            <Tooltip content={(props) => <TSBTooltip {...(props as Parameters<typeof TSBTooltip>[0])} />} />
            {/* Gradatie: licht → donker naarmate de vorm verder van 0 ligt */}
            <Bar dataKey="tsb" name="TSB" radius={[2, 2, 0, 0]}>
              {gefilterd.map((punt, idx) => (
                <Cell key={idx} fill={tsbBalkKleur(punt.tsb)} />
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
  const tsbWaarde = tsb == null ? null : `${tsb > 0 ? "+" : ""}${Math.round(tsb)}`
  // Kiesbaar grafiekvenster — niet vast op 42 dagen.
  const [overzichtPeriode, setOverzichtPeriode] = useState<number>(42)

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
          color={tsbKleur(tsb)}
          sub={tsb != null ? (tsb >= 5 ? "Uitgerust" : tsb <= -15 ? "Vermoeid" : "Neutraal") : undefined}
          uitlegKey="vorm"
        />
        <StatTegel
          label={profiel?.ftpEstimated ? "FTP (geschat)" : "FTP"}
          value={profiel?.ftp ?? null}
          unit="W"
          color={CHART.ftp}
        />
      </div>

      {/* Belastingsverloop — volwaardige grafiek, geen dunne sparkline */}
      {load.data && load.data.chartData.length >= 7 && (
        <LCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1.5">
              <LCardTitle>Belastingsverloop</LCardTitle>
              <UitlegDot uitlegKey="fitheid" label="Fitheid (CTL)" />
            </div>
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Grafiekperiode">
              {GRAFIEK_PERIODES.map((p) => (
                <button
                  key={p.dagen}
                  type="button"
                  onClick={() => setOverzichtPeriode(p.dagen)}
                  aria-pressed={overzichtPeriode === p.dagen}
                  className={cn(
                    "min-h-8 rounded-lg border px-3 font-mono text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                    overzichtPeriode === p.dagen
                      ? "border-cyan-400/50 bg-accent-cyan/10 text-accent-cyan font-medium"
                      : "border-border text-muted-foreground hover:text-foreground/85",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <UitlegRegel k="belasting" />
          <LoadGrafiek chartData={load.data.chartData} periode={overzichtPeriode} />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{overzichtPeriode} dagen geleden: fitheid {Math.round(load.data.chartData.slice(-overzichtPeriode)[0]?.ctl ?? 0)}</span>
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
    <div className="rounded-lg bg-card px-3 py-2 text-xs text-foreground shadow-lg">
      <p className="mb-1 font-medium text-foreground/85">Week van {label}</p>
      <p className="tabular-nums text-foreground/90">
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
  doelUren = null,
}: {
  sessies: TrainingSession[]
  todayIso: string
  onWeekKlik: (weekStart: string) => void
  /** Doelscenario-uren per week (paarse doellijn); null = scenario uit of geen urenbasis. */
  doelUren?: number | null
}) {
  const reeks = weekVolumeReeks(sessies, todayIso, 12)
  const heeftData = reeks.some((w) => w.sessies > 0)
  return (
    <LCard className="p-5">
      <div className="flex items-center gap-1.5 mb-4">
        <LCardTitle>Trainingsvolume per week</LCardTitle>
        <span className="text-xs text-muted-foreground">12 weken</span>
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
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART.as, fontSize: 10 }} interval={1} />
              <YAxis
                tick={{ fill: CHART.as, fontSize: 10 }}
                label={{ value: "uren", angle: -90, position: "insideLeft", offset: 18, fill: CHART.as, fontSize: 10 }}
              />
              <Tooltip content={(props) => <VolumeTooltip {...(props as Parameters<typeof VolumeTooltip>[0])} />} />
              {doelUren != null && (
                // Doellijn uit het Doelscenario: de balken (werkelijke uren)
                // blijven onaangetast — historie herschrijven we nooit.
                <ReferenceLine
                  y={doelUren}
                  stroke={CHART.verwacht}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{
                    value: `doel ${urenLabel(doelUren)} u`,
                    position: "insideTopRight",
                    fill: CHART.verwacht,
                    fontSize: 10,
                  }}
                />
              )}
              <Bar dataKey="uren" name="Uren" cursor="pointer" radius={[2, 2, 0, 0]}>
                {reeks.map((w, i) => (
                  <Cell key={i} fill={w.sessies > 0 ? CHART.volume : "#e2e8f0"} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] text-muted-foreground">Uren per week. Klik op een week om de laatste sessie te openen.</p>
        </>
      )}
    </LCard>
  )
}

// ── Weekzoneverdeling (vermogenszones, echte streams) ────────────────────────
// Tijd per Coggan-zone per week uit de echte vermogensstreams — dezelfde
// zone-indeling als de per-rit verdeling in de sessieweergave. Eerlijk:
// zonder FTP of zonder vermogensdata zegt de kaart dat, nooit een gok.

const WEEKZONE_KLEUR: Record<string, string> = {
  Z1: "#94a3b8", // slate-400 — herstel
  Z2: "#2563EB", // blue-600  — duur
  Z3: "#0891B2", // cyan-600  — tempo
  Z4: "#D97706", // amber-600 — drempel
  Z5: "#EA580C", // orange-600 — VO2max
  Z6: "#DC2626", // red-600   — anaeroob
}

function weekLabelKort(weekStart: string): string {
  const [, m, d] = weekStart.split("-")
  return `${parseInt(d ?? "1", 10)}/${parseInt(m ?? "1", 10)}`
}

function WeekZonesTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => (p.value ?? 0) > 0)
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">Week van {label}</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Geen vermogensdata deze week.</p>
      ) : (
        [...rows].reverse().map((p, i) => (
          <p key={i} className="font-mono tabular-nums" style={{ color: p.color }}>
            {p.name}: {(p.value ?? 0).toFixed(1)} u
          </p>
        ))
      )}
    </div>
  )
}

function WeekZonesCard() {
  const { data, isLoading, isError, refetch } = useWeeklyZones()

  const reeks = (data?.weeks ?? []).map((w) => {
    const rij: Record<string, number | string> = {
      label: weekLabelKort(w.weekStart),
      weekStart: w.weekStart,
      rides: w.rides,
      ridesWithPower: w.ridesWithPower,
    }
    for (let i = 0; i < (data?.zones.length ?? 0); i++) {
      rij[data!.zones[i]!.zone] = Math.round(((w.zoneSeconds[i] ?? 0) / 3600) * 10) / 10
    }
    return rij
  })
  const heeftData = (data?.sessionsWithPower ?? 0) > 0
  const wekenZonderPower = (data?.weeks ?? []).filter((w) => w.rides > 0 && w.ridesWithPower < w.rides).length

  return (
    <LCard className="p-5">
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <LCardTitle>Zoneverdeling per week</LCardTitle>
        <UitlegDot uitlegKey="weekzoneverdeling" label="Zoneverdeling per week" />
        <span className="text-xs text-muted-foreground ml-2">laatste 6 weken</span>
      </div>
      <UitlegRegel k="weekzoneverdeling" />
      {isLoading ? (
        <Skel className="h-56 w-full" />
      ) : isError ? (
        <LFout titel="Zoneverdeling kon niet worden geladen." onOpnieuw={() => void refetch()} />
      ) : data?.ftp == null ? (
        <MissingInputNotice compact showOrb={false} tone="dark"
          title="Geen FTP bekend"
          description="Zonder FTP kunnen je vermogenszones niet worden berekend. Stel je FTP in om deze verdeling te zien."
          targets={["ftp"]}
          returnTo="/analyse"
        />
      ) : !heeftData ? (
        <LegeGrafiek titel="Geen ritten met vermogensdata in de laatste 6 weken — zonder echt vermogenssignaal is er geen zoneverdeling." />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={reeks} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART.as, fontSize: 10 }} />
              <YAxis
                tick={{ fill: CHART.as, fontSize: 10 }}
                label={{ value: "uren", angle: -90, position: "insideLeft", offset: 18, fill: CHART.as, fontSize: 10 }}
              />
              <Tooltip content={(props) => <WeekZonesTooltip {...(props as Parameters<typeof WeekZonesTooltip>[0])} />} />
              {(data?.zones ?? []).map((z, i, all) => (
                <Bar
                  key={z.zone}
                  dataKey={z.zone}
                  name={`${z.zone} ${z.label}`}
                  stackId="zones"
                  fill={WEEKZONE_KLEUR[z.zone] ?? CHART.missing}
                  radius={i === all.length - 1 ? [2, 2, 0, 0] : undefined}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(data?.zones ?? []).map((z) => (
              <span key={z.zone} className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: WEEKZONE_KLEUR[z.zone] ?? CHART.missing }} />
                {z.zone} {z.label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Je ziet per week hoeveel uur je in elke vermogenszone reed. Veel Z1–Z2 met gerichte harde tijd is een gezonde mix; groeit Z3 zonder plan, maak je rustige ritten dan weer écht rustig.
          </p>
          {wekenZonderPower > 0 && (
            <p className="mt-1 text-[11px]" style={{ color: CHART.missing }}>
              In {wekenZonderPower} {wekenZonderPower === 1 ? "week" : "weken"} reed je ook ritten zonder vermogensdata — die tellen hier niet mee, de werkelijke trainingstijd ligt daar dus hoger.
            </p>
          )}
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
        <span className="text-xs text-muted-foreground">laatste sessies</span>
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
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {buckets.filter((b) => b.minuten > 0).map((b) => (
              <span key={b.key} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: INTENSITEIT_KLEUR[b.key] }} />
                {b.label} <strong className="tabular-nums">{Math.round(b.aandeel * 100)}%</strong>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
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
        <span className="text-xs text-muted-foreground">{periodeLabel(periode)}</span>
        <UitlegDot uitlegKey="slaap" label="Slaap" />
      </div>
      <UitlegRegel k="slaap" />
      {reeks.length < 2 ? (
        <MissingInputNotice compact showOrb={false} tone="dark"
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
            <span className="num text-3xl font-bold tracking-tight text-foreground">{String(laatste.uren).replace(".", ",")}</span>
            <span className="text-xs text-muted-foreground">u laatst gemeten</span>
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
  { dagen: 42,  label: "6 weken"  },
  { dagen: 90,  label: "Kwartaal" },
  { dagen: 182, label: "Seizoen"  },
  { dagen: 365, label: "Jaar"     },
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

  // Scenario-overlay op de radar: dezelfde asberekeningen (SSOT), maar met de
  // belasting die het Doelscenario na 6 weken verwacht. Fitheid = midden van de
  // verwachte CTL-band; vermoeidheid (ATL) is dan vrijwel geconvergeerd naar de
  // nieuwe dagbelasting. Alleen belasting-assen (fitheid/vorm/herstel) schuiven
  // mee — vermogen, gevoel en regelmaat volgen niet automatisch uit volume.
  const scenarioAssen = (() => {
    if (scenarioPct == null || !projectie || !load.data) return null
    const ctlS = (projectie.ctlEind[0] + projectie.ctlEind[1]) / 2
    const atlS = projectie.basisTssPerDag * (1 + scenarioPct / 100)
    return computePerformanceRadar({
      load: { ctl: ctlS, atl: atlS, tsb: ctlS - atlS },
      sessions: (sessies.data ?? []).map((s) => ({ sessionDate: s.sessionDate, feelScore: s.feelScore ?? null })),
      ftpWatts: profiel?.ftp ?? null,
      weightKg: profiel?.weightKg ?? null,
      todayIso: localISODate(new Date()),
    })
  })()
  const radarOverlay = scenarioAssen
    ? meetbaar.map((a) => scenarioAssen.find((s) => s.key === a.key)?.level ?? a.level)
    : null

  const readReeks = readinessReeks(metrics.data ?? [])
  const hrvWaarde = hrvVandaag(metrics.data ?? [])
  const hrvDeltaWaarde = hrvDelta(metrics.data ?? [])
  const hrvReeksData = hrvReeks(metrics.data ?? [])

  return (
    <div className="space-y-6">
      {/* Doelscenario — centraal veld boven de grafiek */}
      <LCard className="p-5 border-2 border-purple-400/25">
        <div className="flex items-center gap-1.5 mb-1">
          <LCardTitle>Doelscenario</LCardTitle>
          <UitlegDot uitlegKey="doelscenario" label="Doelscenario" />
          {/* WP-K5: vast label — dit is een verkenning, geen meting of advies. */}
          <span className="ml-auto rounded-full border border-purple-400/25 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-purple-700">
            Verkenning · simulatie
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Kies een voorgenomen verandering van je trainingsvolume. De grafiek toont dan in het paars
          de verwachte ontwikkeling van je fitheid, als band met een boven- en onderwaarde.
        </p>
        <UitlegRegel k="doelscenario" />
        <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Doelscenario trainingsvolume">
          {/* Draaiwieltje: in stappen van 5% van −50% tot +50% */}
          <div className="inline-flex items-center rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              aria-label="5% minder volume"
              disabled={(scenarioPct ?? 0) <= -50}
              onClick={() => setScenarioPct(Math.max(-50, (scenarioPct ?? 0) - 5) || null)}
              className="min-h-11 min-w-11 px-3 text-lg text-muted-foreground hover:bg-muted hover:text-foreground/85 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
            >
              −
            </button>
            <span
              aria-live="polite"
              className={cn(
                "min-w-[5.5rem] border-x border-border px-3 py-2 text-center font-mono text-sm tabular-nums",
                scenarioPct == null ? "text-muted-foreground" : "font-semibold text-purple-700",
              )}
            >
              {scenarioPct == null ? "0% (uit)" : `${scenarioPct > 0 ? "+" : ""}${scenarioPct}%`}
            </span>
            <button
              type="button"
              aria-label="5% meer volume"
              disabled={(scenarioPct ?? 0) >= 50}
              onClick={() => setScenarioPct(Math.min(50, (scenarioPct ?? 0) + 5) || null)}
              className="min-h-11 min-w-11 px-3 text-lg text-muted-foreground hover:bg-muted hover:text-foreground/85 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
            >
              +
            </button>
          </div>
          {scenarioPct != null && (
            <button
              type="button"
              onClick={() => setScenarioPct(null)}
              className="min-h-9 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
            >
              Uit
            </button>
          )}
        </div>
        {scenarioPct != null && urenBasis != null && (
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {scenarioPct > 0 ? "+" : ""}{scenarioPct}% volume ≈{" "}
            <strong>{urenDeltaLabel(urenBasis.uren, scenarioPct)}</strong>{" "}
            ({urenLabel(urenBasis.uren)} → {urenLabel(urenBasis.uren * (1 + scenarioPct / 100))} u/week,{" "}
            {urenBasis.bron === "plan" ? "op basis van je trainingsplan" : "op basis van je werkelijke laatste 4 weken"}).
          </p>
        )}
        {scenarioPct != null && urenBasis == null && (
          <p className="mt-2 text-sm text-muted-foreground">
            Wat dit in uren betekent is nog niet te zeggen: er staan geen uren per week in je plan en er
            zijn geen recente sessies met een duur.
          </p>
        )}
        {scenarioPct != null && projectie && (
          <p className="mt-3 rounded-lg bg-purple-500/100/10 border border-purple-400/20 px-3 py-2 text-sm text-muted-foreground">
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
          <p className="mt-3 rounded-lg bg-muted border border-border px-3 py-2 text-sm text-muted-foreground">
            Er zijn de afgelopen vier weken geen sessies met een belastingsscore, dus een verwachting
            is nu niet te berekenen. Log trainingen met duur en intensiteit of koppel een platform.
          </p>
        )}
      </LCard>

      {/* Wattage-lab — knutselen met eigen vermogensdoelen (eerlijke vuistregels) */}
      <WattageLab ftp={profiel?.ftp ?? null} weightKg={profiel?.weightKg ?? null} />

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
                  "min-h-8 rounded-lg border px-3 font-mono text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                  grafiekPeriode === p.dagen
                    ? "border-cyan-400/50 bg-accent-cyan/10 text-accent-cyan font-medium"
                    : "border-border text-muted-foreground hover:text-foreground/85",
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
                "min-h-8 rounded-lg border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                vergelijk
                  ? "border-border bg-muted text-muted-foreground font-medium"
                  : "border-border text-muted-foreground hover:text-foreground/85",
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
      <WeekVolumeCard
        sessies={sessies.data ?? []}
        todayIso={todayIso}
        onWeekKlik={onWeekKlik}
        doelUren={scenarioPct != null && urenBasis != null ? urenBasis.uren * (1 + scenarioPct / 100) : null}
      />
      <IntensiteitCard sessies={sessies.data ?? []} />
      <WeekZonesCard />

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
                  "min-h-8 rounded-lg border px-3 font-mono text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                  periode === p
                    ? "border-cyan-400/50 bg-accent-cyan/10 text-accent-cyan font-medium"
                    : "border-border text-muted-foreground hover:text-foreground/85",
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
              <span className="text-xs text-muted-foreground">{periodeLabel(periode)}</span>
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
            <p className="mt-2 text-xs text-muted-foreground">
              Gebaseerd op dagelijkse check-in scores.
            </p>
          </>
        ) : (
          <MissingInputNotice compact showOrb={false} tone="dark"
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
          <span className="text-xs text-muted-foreground">{periodeLabel(periode)}</span>
          <UitlegDot uitlegKey="hrvTrend" label="HRV-trend" />
        </div>
        <UitlegRegel k="hrvTrend" />
        {hrvWaarde != null ? (
          <>
            <div className="flex items-end justify-between mb-2">
              <div className="flex items-baseline gap-1">
                <span className="num text-3xl font-bold tracking-tight text-foreground">{Math.round(hrvWaarde)}</span>
                <span className="text-xs text-muted-foreground">ms</span>
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
          <MissingInputNotice compact showOrb={false} tone="dark"
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
              labelColor="rgba(20,24,31,0.62)"
              gridColor="rgba(20,24,31,0.10)"
              overlay={radarOverlay}
              overlayAccent="rgba(168,85,247,0.9)"
            />
            {radarSamenv && <p className="sr-only">{radarSamenv}</p>}
            <p className="text-center text-xs text-muted-foreground max-w-xs text-pretty">
              {meetbaar.length} van {assen.length} assen meetbaar.
              Sterkste: {meetbaar.reduce((a, b) => (b.level > a.level ? b : a)).label}.
            </p>
            {radarOverlay && scenarioPct != null && (
              <p className="text-center text-xs text-purple-700 max-w-xs text-pretty">
                Paars gestippeld: verwachte stand na {projectie?.dagen ?? 42} dagen met{" "}
                {scenarioPct > 0 ? `${scenarioPct}% meer` : `${Math.abs(scenarioPct)}% minder`} volume —
                fitheid, vorm en herstel schuiven mee; vermogen, gevoel en regelmaat volgen niet
                vanzelf uit volume.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
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

// Powercurve-grafiek: beste gemiddelde vermogen per duur, dit blok (laatste
// 42 dagen) vs het blok ervoor, met all-time als referentie. Alleen echte
// meetpunten — duren zonder data blijven eerlijk leeg (connectNulls uit).
function PowerCurveTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | null; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.filter((p) => p.value != null).map((p, i) => (
        <p key={i} className="font-mono tabular-nums" style={{ color: p.color }}>
          {p.name}: {p.value} W
        </p>
      ))}
    </div>
  )
}

function PowerCurveCard() {
  const { data, isLoading, isError, refetch } = usePowerBests()

  const reeks = POWER_WINDOWS.map((w) => ({
    label: w.label,
    ditBlok: data?.recent[w.key]?.watts ?? null,
    vorigBlok: data?.previous?.[w.key]?.watts ?? null,
    allTime: data?.allTime[w.key]?.watts ?? null,
  })).filter((r) => r.ditBlok != null || r.vorigBlok != null || r.allTime != null)

  const heeftPeriodes = reeks.some((r) => r.ditBlok != null || r.vorigBlok != null)

  return (
    <LCard className="p-5">
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <LCardTitle>Powercurve</LCardTitle>
        <UitlegDot uitlegKey="powercurve" label="Powercurve" />
        <span className="text-xs text-muted-foreground ml-2">laatste 42 dagen vs 42 dagen ervoor</span>
      </div>
      <UitlegRegel k="powercurve" />
      {isLoading ? (
        <Skel className="h-56 w-full" />
      ) : isError ? (
        <LFout titel="Powercurve kon niet worden geladen." onOpnieuw={() => void refetch()} />
      ) : reeks.length === 0 ? (
        <LegeGrafiek titel="Nog geen ritten met vermogensmeter geïmporteerd — zonder echt vermogenssignaal is er geen curve." />
      ) : (
        <>
          {!heeftPeriodes && (
            <p className="mb-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              Te weinig ritten met vermogensmeter in de laatste 84 dagen om periodes te vergelijken — alleen je all-time curve wordt getoond.
            </p>
          )}
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={reeks} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART.as, fontSize: 10 }} />
              <YAxis
                tick={{ fill: CHART.as, fontSize: 10 }}
                domain={["auto", "auto"]}
                label={{ value: "watt", angle: -90, position: "insideLeft", offset: 18, fill: CHART.as, fontSize: 10 }}
              />
              <Tooltip content={(props) => <PowerCurveTooltip {...(props as Parameters<typeof PowerCurveTooltip>[0])} />} />
              <Line
                type="monotone" dataKey="allTime" name="All-time"
                stroke={CHART.missing} strokeWidth={1.5} strokeDasharray="5 4"
                dot={{ r: 2, fill: CHART.missing, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false}
              />
              <Line
                type="monotone" dataKey="vorigBlok" name="Vorige 42 dagen"
                stroke={CHART.atl} strokeWidth={1.5}
                dot={{ r: 2.5, fill: CHART.atl, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false}
              />
              <Line
                type="monotone" dataKey="ditBlok" name="Laatste 42 dagen"
                stroke={CHART.ftp} strokeWidth={2}
                dot={{ r: 3, fill: CHART.ftp, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 rounded" style={{ background: CHART.ftp }} />Laatste 42 dagen</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 rounded" style={{ background: CHART.atl }} />Vorige 42 dagen</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 rounded" style={{ backgroundImage: `repeating-linear-gradient(90deg,${CHART.missing} 0,${CHART.missing} 4px,transparent 4px,transparent 8px)` }} />All-time</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Je ziet per duur je beste gemiddelde vermogen in dit blok en het blok ervoor. Ligt de blauwe lijn onder de oranje, dan heb je die duur dit blok simpelweg nog niet zo hard gereden — dat is geen vormverlies op zich.
          </p>
        </>
      )}
    </LCard>
  )
}

function PowerBestsTable() {
  const { data, isLoading, isError, refetch } = usePowerBests()

  if (isLoading) return <Skel className="h-40 w-full" />
  if (isError) return <LFout titel="Persoonlijke records konden niet worden geladen." onOpnieuw={() => void refetch()} />

  const hasAny = data && Object.keys(data.allTime).length > 0
  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nog geen vermogensrecords. Log ritten met een vermogensmeter om je records op te bouwen.
      </p>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground pr-4">Duur</th>
              <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground pr-4">All-time</th>
              <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground pr-4">Laatste 42d</th>
              <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Datum</th>
            </tr>
          </thead>
          <tbody>
            {POWER_WINDOWS.map((w) => {
              const allTime = data?.allTime[w.key]
              const recent = data?.recent[w.key]
              if (!allTime) return null
              return (
                <tr key={w.key} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{w.label}</td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums font-medium text-foreground">
                    {allTime.watts}W
                  </td>
                  <td
                    className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs"
                    style={{ color: recent ? CHART.ctl : CHART.missing }}
                  >
                    {recent ? `${recent.watts}W` : "—"}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">
                    {allTime.date.slice(0, 10)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {data && data.sessionsWithBests > 0 && (
        <p className="mt-2.5 text-[11px] text-muted-foreground">
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
    <div className="rounded-lg bg-card px-3 py-2 text-xs text-foreground shadow-lg">
      <p className="mb-1 font-medium text-foreground/85">{label}</p>
      <p className="tabular-nums text-foreground/90">
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
  doelZin,
}: {
  metrics: Array<{ metricDate: string; weightKg?: number | string | null }>
  ftpTests: Array<{ ftpWatts: number; measuredAt: string }>
  profielFtp: number | null
  overlays: DoelOverlays
  /** Canonieke benoemingszin van het afvaldoel (API-veld `line`); null = niet tonen. */
  doelZin: string | null
}) {
  const reeks = gewichtWkgReeks(metrics, ftpTests, profielFtp)
  const heeftWkg = reeks.some((p) => p.wkg != null)
  return (
    <LCard className="p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
        <LCardTitle>Gewicht &amp; W/kg</LCardTitle>
        <UitlegDot uitlegKey="gewichtWkg" label="Gewicht & W/kg" />
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded bg-muted" /> Gewicht
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
      {overlays.streefGewichtKg != null && doelZin != null && (
        <p className="mb-3 text-xs text-muted-foreground">{doelZin}</p>
      )}
      {reeks.length < 2 ? (
        <LegeGrafiek titel="Nog geen gewichtsmetingen om een verloop te tonen." />
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={reeks} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDatum} tick={{ fill: CHART.as, fontSize: 10 }} />
            <YAxis
              yAxisId="kg"
              tick={{ fill: CHART.as, fontSize: 10 }}
              domain={["auto", "auto"]}
              label={{ value: "kg", angle: -90, position: "insideLeft", offset: 18, fill: CHART.as, fontSize: 10 }}
            />
            <YAxis
              yAxisId="wkg"
              orientation="right"
              tick={{ fill: CHART.as, fontSize: 10 }}
              domain={["auto", "auto"]}
              hide={!heeftWkg}
              label={{ value: "W/kg", angle: 90, position: "insideRight", offset: 12, fill: CHART.as, fontSize: 10 }}
            />
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
  doelZin,
}: {
  load: Bron<LoadData>
  sessies: Bron<TrainingSession[]>
  ftp: Bron<Array<{ ftpWatts: number; measuredAt: string }>>
  profiel: Profiel
  metrics: Bron<Array<{ metricDate: string; weightKg?: number | string | null }>>
  overlays: DoelOverlays
  /** Canonieke benoemingszin van het afvaldoel (API-veld `line`); null = niet tonen. */
  doelZin: string | null
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
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: CHART.goal, backgroundImage: `repeating-linear-gradient(90deg,${CHART.goal} 0,${CHART.goal} 4px,transparent 4px,transparent 8px)` }} />
              Streef-FTP {overlays.streefFtp} W
            </span>
          )}
        </div>
        <UitlegRegel k="ftpOntwikkeling" />
        {ftp.isLoading ? (
          <Skel className="h-24 w-full" />
        ) : weergave == null || weergave.getoond == null ? (
          <MissingInputNotice compact showOrb={false} tone="dark"
            title="Nog geen FTP-tests"
            description="Stel je FTP in of log een test om je vermogensontwikkeling te volgen."
            targets={["ftp"]}
            returnTo="/analyse"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <div className="flex items-baseline gap-1.5">
                <span className="num text-3xl font-bold tracking-tight tabular-nums" style={{ color: CHART.ftp }}>
                  {weergave.getoond}
                </span>
                <span className="text-xs text-muted-foreground">W{weergave.bronIsProfiel ? " · Sportpaspoort" : ""}</span>
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
                  <XAxis dataKey="maand" tick={{ fill: CHART.as, fontSize: 9 }} interval={0} />
                  <YAxis
                    tick={{ fill: CHART.as, fontSize: 9 }}
                    label={{ value: "watt", angle: -90, position: "insideLeft", offset: 22, fill: CHART.as, fontSize: 9 }}
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
        doelZin={doelZin}
      />

      {/* Powercurve met periodevergelijking */}
      <PowerCurveCard />

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

      {/* Trainingsverloop — donkere glass-variant, passend bij de rest van Analyse */}
      <div>
        <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Trainingsverloop — 6 weken
        </p>
        <TrainingProgression
          sessions={sessies.data}
          chartData={load.data?.chartData}
          loading={(load.isLoading && !load.data) || (sessies.isLoading && !sessies.data)}
          hideLabel
          variant="donker"
        />
      </div>
    </div>
  )
}

// ── Doelen-tabblad ────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  op_koers:      { label: "Op koers",       kleur: "text-[color:var(--color-positive)]", achtergrond: "bg-emerald-500/10", rand: "border-emerald-400/25" },
  aandacht:      { label: "Let op",          kleur: "text-[color:var(--color-warning)]",   achtergrond: "bg-amber-500/10",   rand: "border-amber-400/25"   },
  risico:        { label: "Risico",          kleur: "text-[color:var(--color-negative)]",     achtergrond: "bg-red-500/10",     rand: "border-red-400/25"     },
  niet_meetbaar: { label: "Niet meetbaar",   kleur: "text-muted-foreground",   achtergrond: "bg-muted",   rand: "border-border"   },
} as const

function GoalCard({ goal }: { goal: Goal }) {
  const v = VERDICT_CONFIG[goal.progress.verdict]
  const daysLeft = goal.progress.daysToTarget

  return (
    <div className={cn("border rounded-xl p-4", v.rand, v.achtergrond)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{goal.title}</p>
          {goal.progress.reasons[0] && (
            <p className="text-xs text-muted-foreground mt-0.5">{goal.progress.reasons[0]}</p>
          )}
        </div>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0", v.kleur, v.rand, v.achtergrond)}>
          {v.label}
        </span>
      </div>
      {(goal.targetDate ?? daysLeft != null) && (
        <div className="flex items-center gap-4 mt-2">
          {goal.targetDate && (
            <span className="text-xs text-muted-foreground">Doel: {goal.targetDate}</span>
          )}
          {daysLeft != null && (
            <span className="text-xs text-muted-foreground">{daysLeft} dagen resterend</span>
          )}
        </div>
      )}
      {goal.progress.gaps.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground italic">{goal.progress.gaps[0]}</p>
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
          <p className="font-medium text-foreground text-sm truncate">{race.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
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
          <h2 className="text-base font-semibold text-foreground">Actieve doelen</h2>
          <button type="button" onClick={() => setDoelenPopup({ autoAdd: false })}
            className="text-xs text-accent-cyan hover:text-accent-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50">
            Beheer
          </button>
        </div>

        {goalsLoading && <div className="space-y-3"><Skel className="h-20 w-full" /><Skel className="h-20 w-full" /></div>}
        {goalsError && <LFout titel="Doelen konden niet worden geladen." onOpnieuw={() => void goalsRefetch()} />}
        {!goalsLoading && !goalsError && actieveDoelen.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
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
          <h2 className="text-base font-semibold text-foreground">Aankomende wedstrijden</h2>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setRacePopup(true)}
              className="text-xs text-accent-cyan hover:text-accent-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50">
              + Wedstrijd
            </button>
            <button type="button" onClick={() => navigate("/races")}
              className="text-xs text-muted-foreground hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50">
              Alle races →
            </button>
          </div>
        </div>

        {komende.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
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
      <MissingInputNotice compact showOrb={false} tone="dark"
        title="Nog geen sessies gelogd"
        description="Log een training om je sessie-overzicht op te bouwen."
        actions={[{ label: "Ga naar Trainen", onClick: () => navigate("/train") }]}
      />
    )
  }

  return (
    <div>
      {toestand === "verouderd" && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-[color:var(--color-warning)]">
          <span>{ANALYSE_COPY.verouderd}</span>
          <button type="button" onClick={() => void sessies.refetch()} className="underline underline-offset-2 hover:no-underline">
            {ANALYSE_COPY.opnieuw}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground pr-3">Datum</th>
              <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground pr-3">Training</th>
              <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground pr-3 hidden sm:table-cell">Duur</th>
              <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground pr-3">
                <span className="inline-flex items-center gap-1">
                  IF
                  <UitlegDot uitlegKey="intensiteitsfactor" label="Intensiteitsfactor (IF)" />
                </span>
              </th>
              <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  TSS
                  <UitlegDot uitlegKey="belasting" label="Belastingsscore (TSS)" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lijst.slice(0, 50).map((s) => (
              <tr
                key={s.id}
                onClick={() => onOpen(s)}
                className="border-b border-border last:border-0 hover:bg-muted cursor-pointer transition-colors focus-visible:bg-muted"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(s)}
                aria-label={`Sessie: ${sessieTitel(s)}`}
              >
                <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {sessieDatumLabel(s.sessionDate)}
                </td>
                <td className="py-2.5 pr-3 text-foreground max-w-[14rem] truncate">
                  {sessieTitel(s)}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-muted-foreground hidden sm:table-cell">
                  {sessieDuurLabel(s.durationMin) ?? "—"}
                </td>
                <td
                  className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums"
                  style={{ color: ifLabel(s.intensityFactor) != null ? CHART.ftp : CHART.missing }}
                >
                  {ifLabel(s.intensityFactor) ?? "—"}
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
      <div className="mt-0.5 text-sm text-foreground">{waarde}</div>
      {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )

  return (
    <LCard className="p-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {cel(
          "Belasting",
          kern.ctl != null
            ? <span className="tabular-nums" style={{ color: CHART.ctl }}>{kern.ctl} <span className="text-xs text-muted-foreground">CTL</span> <UitlegDot uitlegKey="fitheid" label="Fitheid (CTL)" /></span>
            : <span className="text-muted-foreground">—</span>,
          kern.atl != null ? `vermoeidheid ${kern.atl}` : undefined,
        )}
        {cel(
          "Vorm & herstel",
          kern.tsb != null
            ? <span className="tabular-nums" style={{ color: tsbKleur(kern.tsb) }}>{kern.tsb > 0 ? "+" : ""}{kern.tsb} <UitlegDot uitlegKey="vorm" label="Vorm (TSB)" /></span>
            : <span className="text-muted-foreground">—</span>,
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
            : <span className="text-muted-foreground">—</span>,
          kern.wkg != null ? `${String(kern.wkg).replace(".", ",")} W/kg` : undefined,
        )}
        {cel(
          "Laatste sync",
          sync
            ? <span className="tabular-nums">{synclabel(sync.moment)}</span>
            : <span className="text-muted-foreground">geen koppeling</span>,
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
  // Volledig jaar ophalen: de grafieken kiezen client-side hun venster
  // (Week t/m Jaar) door op de reeks te slicen.
  const load    = useLoad(365)
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
    <ScreenShell section="Lab" bg={null}>
      {/* Paginakop — leunt op de gedeelde donkere schil (ScreenShell bezit de
          chrome/achtergrond). Alleen de eigen sectielabel, titel en acties. */}
      <section className="flex flex-col gap-3">
        <SectionLabel title="Performance-analyse" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="type-display font-light tracking-tight text-foreground">
              {ANALYSE_COPY.paginaTitel}
            </h1>
            {context && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{context}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setUitlegAan((v) => !v)}
              aria-pressed={uitlegAan}
              className={cn(
                "min-h-8 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                uitlegAan
                  ? "border-cyan-400/50 bg-accent-cyan/10 font-medium text-accent-cyan"
                  : "border-border text-muted-foreground hover:border-accent-cyan/40 hover:text-accent-cyan",
              )}
              title="Toon bij elk onderdeel een korte uitleg in gewone taal"
            >
              {uitlegAan ? "Uitleg aan" : "Uitleg"}
            </button>
            <ClubChip />
          </div>
        </div>

        {/* Tabbladen — Strava-stijl hoofdstuk-tabbalk (volle breedte,
            accentstreep onder de actieve tab), donkere variant. */}
        <div className="-mx-6 px-6">
          <HoofdstukTabs
            tabs={TABS}
            actief={activeTab}
            onKies={setActiveTab}
            variant="donker"
            ariaLabel="Analyse-secties"
          />
        </div>
      </section>

      {/* Tab-inhoud */}
      <UitlegModus.Provider value={uitlegAan}>
        <div className="flex flex-col gap-6">
          {/* Bovenste samenvatting — zichtbaar op elk tabblad */}
          <SamenvattingStrip
            load={load}
            ftpTests={ftp.data ?? []}
            profiel={profiel}
            metrics={metrics.data ?? []}
            sessies={sessies.data ?? []}
            todayIso={todayIso}
          />

          <div id="tab-overzicht"  role="tabpanel" aria-labelledby="tabknop-overzicht" hidden={activeTab !== "overzicht"}>
            <OverzichtTab load={load} profiel={profiel} sessies={sessies} />
          </div>
          <div id="tab-belasting"  role="tabpanel" aria-labelledby="tabknop-belasting" hidden={activeTab !== "belasting"}>
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
          <div id="tab-progressie" role="tabpanel" aria-labelledby="tabknop-progressie" hidden={activeTab !== "progressie"}>
            <ProgressieTab load={load} sessies={sessies} ftp={ftp} profiel={profiel} metrics={metrics} overlays={overlays}
              doelZin={seasonGoal.data?.eligible === true ? seasonGoal.data.line : null} />
          </div>
          <div id="tab-doelen"     role="tabpanel" aria-labelledby="tabknop-doelen" hidden={activeTab !== "doelen"}>
            {activeTab === "doelen" && <DoelenTab />}
          </div>
          <div id="tab-sessies"    role="tabpanel" aria-labelledby="tabknop-sessies" hidden={activeTab !== "sessies"}>
            <SessiesTab sessies={sessies} onOpen={setOpenSessie} />
          </div>
        </div>
      </UitlegModus.Provider>

      <SessionDetailDrawer
        session={openSessie}
        open={openSessie != null}
        onOpenChange={(open) => { if (!open) setOpenSessie(null) }}
      />
    </ScreenShell>
  )
}
