import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ACCENT } from "@/components/sparki/ui"
import { UitlegDot } from "@/components/viz/uitleg"
import type { TrainingSession } from "@/lib/athlete-types"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { analyzeSession, type InsightTone } from "@/lib/session-analysis"
import { useRideStory, useRideStoryFlag } from "@/hooks/use-ride-story"
import { RideStoryChapters } from "@/components/sparki/ride-story"
import {
  useSessionSegments,
  useSessionDetail,
  useUpdateSessionFeel,
  type RideSegment,
  type SessionDetail,
  type SourceConflict,
} from "@/hooks/use-sessions"
import { useState } from "react"
import { SessionGraphs } from "@/components/sparki/session-graphs"
import { computeAge } from "@/lib/age"
import { ShareRidePanel } from "@/components/sparki/share-ride"
import { HerkomstKnop } from "@/components/sparki/herkomst-sheet"
import {
  Clock,
  Route as RouteIcon,
  Mountain,
  Gauge,
  Zap,
  HeartPulse,
  Activity,
  TrendingDown,
  ChevronDown,
  Timer,
} from "lucide-react"

// Numeriek uit een DB-string (numerieke kolommen komen als string via JSON).
function parseNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Tempo per kilometer (min/km) uit echte afstand + tijd — de wandelmaat (F7).
// Null zolang er geen echte afstand én tijd is (nooit een verzonnen tempo).
function walkPacePerKm(
  distanceKm: number | null,
  durationMin: number | null,
): string | null {
  if (distanceKm == null || durationMin == null) return null
  if (!(distanceKm > 0) || !(durationMin > 0)) return null
  const paceMinPerKm = durationMin / distanceKm
  const m = Math.floor(paceMinPerKm)
  const s = Math.round((paceMinPerKm - m) * 60)
  const mm = s === 60 ? m + 1 : m
  const ss = s === 60 ? 0 : s
  return `${mm}:${String(ss).padStart(2, "0")}`
}

function fmtSegTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}u${String(m % 60).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")} min`
}

// Leesbaar verslag per interessant stuk van de rit (klimmen en afdalingen),
// met uitsluitend écht gemeten waarden — ontbrekende cijfers blijven weg.
function SegmentReport({ segments }: { segments: RideSegment[] }) {
  return (
    <div className="mt-6">
      <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
        ZO REED JE DE SEGMENTEN
      </span>
      <div className="mt-2 flex flex-col gap-2">
        {segments.map((seg, i) => {
          const isKlim = seg.kind === "klim"
          const facts: Array<[string, string]> = []
          if (seg.timeSec != null) facts.push(["Tijd", fmtSegTime(seg.timeSec)])
          if (seg.avgKmh != null) facts.push(["Gem.", `${seg.avgKmh} km/u`])
          if (!isKlim && seg.maxKmh != null)
            facts.push(["Top", `${seg.maxKmh} km/u`])
          if (seg.avgPowerW != null)
            facts.push(["Vermogen", `${seg.avgPowerW} W`])
          if (seg.avgHr != null) facts.push(["Hartslag", `${seg.avgHr} bpm`])
          if (isKlim && seg.vamMPerH != null)
            facts.push(["Klimtempo", `${seg.vamMPerH} m/u`])
          return (
            <div
              key={i}
              className="rounded-xl border border-border bg-muted px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isKlim ? (
                    <Mountain
                      className="h-4 w-4 shrink-0"
                      style={{ color: ACCENT }}
                      strokeWidth={1.75}
                    />
                  ) : (
                    <TrendingDown
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                  )}
                  <span className="text-[14px] font-medium text-foreground/90">
                    {seg.name}
                  </span>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {seg.lengthKm} km · {isKlim ? "+" : "−"}
                  {seg.elevationDeltaM} m · {Math.abs(seg.avgGradePct)}%
                </span>
              </div>
              {facts.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                  {facts.map(([label, value]) => (
                    <span
                      key={label}
                      className="text-[12px] tabular-nums text-muted-foreground"
                    >
                      <span className="text-muted-foreground">{label} </span>
                      {value}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                  Het bestand van deze rit bevat geen tijden op dit stuk, dus
                  over je tempo valt hier niets te zeggen.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Gegenereerde data: eerlijk overzicht van wat deze sessie wél en niet
//    heeft vastgelegd, en wat dat betekent voor grafieken en analyses. ──────
function heeftKanaal(reeks: Array<number | null> | null | undefined): boolean {
  return Array.isArray(reeks) && reeks.some((v) => v != null)
}

function DataInventaris({
  session,
  detail,
  segments,
}: {
  session: TrainingSession
  detail: SessionDetail | null | undefined
  segments: RideSegment[] | null | undefined
}) {
  const s = detail?.streams ?? null
  const items: Array<{ label: string; aanwezig: boolean; hint?: string }> = [
    { label: "Vermogen (meetreeks)", aanwezig: heeftKanaal(s?.power), hint: "vermogensmeter nodig — voedt de grafiek, zones en TSS" },
    { label: "Hartslag (meetreeks)", aanwezig: heeftKanaal(s?.heartRate), hint: "hartslagband nodig — voedt de grafiek, zones en drift-analyse" },
    { label: "Cadans", aanwezig: heeftKanaal(s?.cadence) },
    { label: "Snelheid", aanwezig: heeftKanaal(s?.speedKph) },
    { label: "Hoogte", aanwezig: heeftKanaal(s?.elevationM), hint: "voedt het hoogteprofiel en het segmentverslag" },
    { label: "Temperatuur", aanwezig: heeftKanaal(s?.temperatureC) },
    { label: "GPS-route", aanwezig: (detail?.track?.length ?? 0) > 0 },
    { label: "Belasting (TSS/IF)", aanwezig: session.tss != null, hint: "vraagt vermogen + een ingevulde FTP" },
    { label: "Segmenten (klimmen/afdalingen)", aanwezig: (segments?.length ?? 0) > 0 },
    { label: "Gevoel (jouw score)", aanwezig: session.feelScore != null },
    { label: "Notities / verloop", aanwezig: session.notes != null && session.notes.trim() !== "" },
    { label: "Gekoppeld trainingsschema", aanwezig: detail?.plannedWorkout != null },
  ]
  const ontbrekend = items.filter((i) => !i.aanwezig)
  return (
    <div className="mt-6">
      <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
        GEGENEREERDE DATA
      </span>
      <div className="mt-2 grid grid-cols-1 gap-1 rounded-xl border border-border bg-muted px-4 py-3">
        {items.map((i) => (
          <div key={i.label} className="flex items-start gap-2 py-0.5">
            <span
              className={`mt-0.5 font-mono text-[11px] ${i.aanwezig ? "text-accent-cyan" : "text-muted-foreground"}`}
              aria-hidden
            >
              {i.aanwezig ? "✓" : "—"}
            </span>
            <div className="min-w-0">
              <span className={`text-[12.5px] ${i.aanwezig ? "text-foreground/80" : "text-muted-foreground"}`}>
                {i.label}
              </span>
              {!i.aanwezig && i.hint && (
                <span className="ml-1.5 text-[11px] text-muted-foreground">({i.hint})</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {ontbrekend.length > 0 && (
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
          Grafieken en analyses tonen wat tijdens deze rit gemeten is.
        </p>
      )}
    </div>
  )
}

const CONFLICT_FIELD_LABELS: Record<string, { label: string; unit?: string }> = {
  durationMin: { label: "Duur", unit: "min" },
  distanceKm: { label: "Afstand", unit: "km" },
  elevationM: { label: "Hoogtemeters", unit: "m" },
  normalizedPower: { label: "Genormaliseerd vermogen", unit: "W" },
  avgPower: { label: "Gem. vermogen", unit: "W" },
  avgHR: { label: "Gem. hartslag", unit: "bpm" },
  maxHR: { label: "Max. hartslag", unit: "bpm" },
  avgCadence: { label: "Cadans", unit: "rpm" },
  avgSpeedKph: { label: "Gem. snelheid", unit: "km/u" },
  tss: { label: "Belasting (TSS)" },
  intensityFactor: { label: "Intensiteit (IF)" },
  title: { label: "Titel" },
  notes: { label: "Notities" },
  powerBests: { label: "Vermogensrecords" },
}
function WedstrijdVerloopVragen({ session }: { session: TrainingSession }) {
  const update = useUpdateSessionFeel()
  const [zwaarte, setZwaarte] = useState<number | null>(session.feelScore ?? null)
  const [verloop, setVerloop] = useState("")
  const [les, setLes] = useState("")
  const [opgeslagen, setOpgeslagen] = useState(false)

  const alBeantwoord =
    session.notes != null && session.notes.includes("Wedstrijdverloop:")
  if (alBeantwoord || opgeslagen) return null

  const kanOpslaan = zwaarte != null || verloop.trim() !== "" || les.trim() !== ""
  const opslaan = () => {
    const delen: string[] = []
    if (verloop.trim() !== "") delen.push(`Wedstrijdverloop: ${verloop.trim()}`)
    if (les.trim() !== "") delen.push(`Les voor volgende keer: ${les.trim()}`)
    const bestaand = session.notes?.trim()
    const notes =
      delen.length > 0
        ? [bestaand, delen.join("\n")].filter(Boolean).join("\n\n")
        : undefined
    update.mutate(
      {
        id: session.id,
        ...(zwaarte != null ? { feelScore: zwaarte } : {}),
        ...(notes != null ? { notes } : {}),
      },
      { onSuccess: () => setOpgeslagen(true) },
    )
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <span className="font-mono text-[10px] tracking-[0.2em] text-accent-cyan">
        HOE VERLIEP JE WEDSTRIJD?
      </span>
      <p className="mt-1.5 text-pretty text-[12.5px] leading-relaxed text-muted-foreground">
        De meetdata vertelt maar de helft. Met een paar antwoorden kan deze
        wedstrijd op waarde worden geschat.
      </p>

      <p className="mt-4 text-[12px] text-muted-foreground">Hoe zwaar voelde het?</p>
      <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Zwaarte van de wedstrijd">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setZwaarte(n)}
            aria-pressed={zwaarte === n}
            className={`min-h-9 flex-1 rounded-lg border px-1 text-[11px] transition-colors ${
              zwaarte === n
                ? "border-accent-cyan bg-accent-cyan text-accent-cyan"
                : "border-border text-muted-foreground hover:text-muted-foreground"
            }`}
          >
            {FEEL_LABELS[n]}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-[12px] text-muted-foreground">
        Hoe verliep de wedstrijd? (start, verloop, finale)
        <textarea
          value={verloop}
          onChange={(e) => setVerloop(e.target.value)}
          rows={3}
          placeholder="Bijv. goed weggekomen, in de finale kramp — moest lossen op de laatste klim…"
          className="mt-1.5 w-full rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground/90 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </label>

      <label className="mt-3 block text-[12px] text-muted-foreground">
        Wat neem je mee naar de volgende keer?
        <textarea
          value={les}
          onChange={(e) => setLes(e.target.value)}
          rows={2}
          placeholder="Bijv. eerder en meer eten in het tweede uur."
          className="mt-1.5 w-full rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground/90 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </label>

      <button
        type="button"
        disabled={!kanOpslaan || update.isPending}
        onClick={opslaan}
        className="mt-4 min-h-10 rounded-lg border border-accent-cyan px-4 text-[13px] text-accent-cyan transition-colors hover:bg-accent-cyan disabled:opacity-35"
      >
        {update.isPending ? "Opslaan…" : "Antwoorden opslaan"}
      </button>
      {update.isError && (
        <p className="mt-2 text-[12px] text-[color:var(--color-negative)]">
          Opslaan is niet gelukt. Probeer het opnieuw.
        </p>
      )}
    </div>
  )
}

const TONE_COLOR: Record<InsightTone, string> = {
  neutral: "rgba(255,255,255,0.4)",
  positive: ACCENT,
  caution: "rgba(255,180,90,0.9)",
}

const TYPE_LABELS: Record<string, string> = {
  endurance: "Duurtraining",
  duurtraining: "Duurtraining",
  interval: "Intervaltraining",
  intervals: "Intervaltraining",
  recovery: "Hersteltraining",
  herstel: "Hersteltraining",
  tempo: "Tempotraining",
  threshold: "Drempeltraining",
  race: "Wedstrijd",
  rest: "Rustdag",
  strength: "Krachttraining",
  other: "Training",
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Handmatig",
  sparki: "Sparki",
  strava: "Strava",
  import: "Import",
  garmin: "Garmin",
  wahoo: "Wahoo",
}

const FEEL_LABELS: Record<number, string> = {
  1: "Heel zwaar",
  2: "Zwaar",
  3: "Prima",
  4: "Goed",
  5: "Geweldig",
}

function typeLabel(t: string) {
  return TYPE_LABELS[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1)
}

function sourceLabel(s: string) {
  return SOURCE_LABELS[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1)
}

// Nederlandse labels voor de ruwe per-veld herkomstwaarden (fieldSources) die
// de Data Hub vastlegt. Onbekende waarden tonen we letterlijk — nooit raden.
const VELD_BRON_LABELS: Record<string, string> = {
  manual: "handmatig",
  strava: "Strava",
  garmin: "Garmin",
  wahoo: "Wahoo",
  file: "bestand",
  gpx: "GPX-bestand",
  fit: "FIT-bestand",
  tcx: "TCX-bestand",
  sensor: "sensor",
  mobiel: "Sparki-app",
  mobile: "Sparki-app",
  sparki: "Sparki",
  coach: "coach",
  derived: "berekend",
  import: "bestand",
}

function veldBronLabel(raw: string): string {
  return VELD_BRON_LABELS[raw.toLowerCase()] ?? raw
}

function Metric({
  icon: Icon,
  label,
  value,
  uitlegKey,
  bron,
}: {
  icon: typeof Clock
  label: string
  value: string
  uitlegKey?: string
  bron?: string | null
}) {
  return (
    <div className="rounded-xl border border-border bg-muted px-3 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        {uitlegKey && <UitlegDot uitlegKey={uitlegKey} label={label} />}
      </div>
      <p className="mt-1.5 font-sans text-lg font-light tabular-nums text-foreground/90">
        {value}
      </p>
      {bron != null && (
        <p className="mt-1 font-mono text-[9px] tracking-[0.08em] text-muted-foreground">
          Bron: {bron}
        </p>
      )}
    </div>
  )
}

export function SessionDetailDrawer({
  session,
  open,
  onOpenChange,
  recentSessions = [],
}: {
  session: TrainingSession | null
  open: boolean
  onOpenChange: (open: boolean) => void
  recentSessions?: TrainingSession[]
}) {
  const { data: profile } = useAthleteExtendedProfile()
  // Rit-verhaal (flag `rit_verhaal`): when the story is available it replaces
  // the loose analysis + metrics blocks with the four chapters. Flag off (or
  // story unavailable) keeps the existing drawer untouched.
  const storyFlagOn = useRideStoryFlag()
  const { data: story } = useRideStory(
    storyFlagOn && open && session ? session.id : null,
  )
  // Segmentverslag: klimmen/afdalingen met echte prestatie uit het gekoppelde
  // ritbestand. Alleen tonen als ze er echt zijn — geen lege beloftes.
  const { data: segments } = useSessionSegments(
    open && session ? session.id : null,
  )
  // Grafieken & analyses: echte meetreeksen (streams) + gekoppeld planschema.
  const { data: detail } = useSessionDetail(
    open && session ? session.id : null,
  )
  // Geschatte maximale hartslag (leeftijdsformule, Tanaka) — alleen als de
  // geboortedatum bekend is; altijd als schatting gelabeld in de grafiek.
  const age = computeAge(profile?.birthDate ?? null, profile?.birthYear ?? null)
  const estimatedMaxHr = age != null ? Math.round(208 - 0.7 * age) : null
  // Vorige rit (recentste eerdere sessie, niet handmatig) voor de eerlijke
  // vergelijking — of de vergelijking mág, beslist assessComparability.
  const previousSession =
    session != null
      ? (recentSessions
          .filter(
            (s) =>
              s.id !== session.id &&
              s.sessionDate < session.sessionDate &&
              s.source !== "manual",
          )
          .sort((a, b) => (a.sessionDate < b.sessionDate ? 1 : -1))[0] ?? null)
      : null
  const showStory = storyFlagOn && story != null && session?.id === story.session.id
  const analysis = session
    ? analyzeSession(session, profile, recentSessions)
    : null
  const fullDate = session
    ? new Date(session.sessionDate + "T12:00:00Z").toLocaleDateString("nl-NL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : ""

  // Per-veld herkomst uit de Data Origin-laag: alleen tonen wat aantoonbaar
  // vastligt. Zolang het detail nog laadt, tonen we niets (geen gok); zodra
  // het er is, is elk veld óf herleidbaar óf eerlijk "onbekend".
  const veldBronnen = detail?.herkomst?.veldBronnen ?? null
  const handmatigeVelden = new Set(detail?.herkomst?.handmatigeVelden ?? [])
  const bronVoor = (field: string): string | null => {
    if (detail == null || detail.herkomst == null) return null
    if (handmatigeVelden.has(field)) return "handmatig aangepast"
    const raw = veldBronnen?.[field]
    if (raw) return veldBronLabel(raw)
    return "onbekend"
  }

  // Wandelen (F7): de analyse wijkt af van fietsen — geen max. snelheid, wél
  // tempo per kilometer. Afgeleid uit de sport van de sessie.
  const isWalkSession =
    session?.sport === "hiking" || session?.sport === "walking"

  // Which real metrics do we actually have? Honest readback only.
  const metrics: Array<{
    icon: typeof Clock
    label: string
    value: string
    uitlegKey?: string
    bron?: string | null
  }> =
    []
  if (session) {
    if (session.durationMin != null)
      metrics.push({
        icon: Clock,
        label: "Duur",
        value: `${session.durationMin} min`,
        bron: bronVoor("durationMin"),
      })
    if (session.distanceKm != null && session.distanceKm !== "")
      metrics.push({
        icon: RouteIcon,
        label: "Afstand",
        value: `${session.distanceKm} km`,
        bron: bronVoor("distanceKm"),
      })
    if (session.elevationM != null)
      metrics.push({
        icon: Mountain,
        label: "Hoogtemeters",
        value: `${session.elevationM} m`,
        bron: bronVoor("elevationM"),
      })
    // Wandelen (F7): de analyse is bewust rijker dan bij fietsen. Gem. snelheid
    // en tempo per kilometer (min/km) horen erbij; max. snelheid zegt bij
    // wandelen niets en blijft weg. Alleen bij wandelsporten, alleen als het
    // echt uit afstand + tijd te berekenen valt.
    if (isWalkSession) {
      const avgSpeed = parseNum(session.avgSpeedKph)
      if (avgSpeed != null)
        metrics.push({
          icon: Gauge,
          label: "Gem. snelheid",
          value: `${avgSpeed.toFixed(1)} km/u`,
          bron: bronVoor("avgSpeedKph"),
        })
      const pace = walkPacePerKm(
        parseNum(session.distanceKm),
        session.durationMin,
      )
      if (pace != null)
        metrics.push({
          icon: Timer,
          label: "Tempo",
          value: `${pace} min/km`,
        })
    }
    if (session.tss != null)
      metrics.push({
        icon: Activity,
        label: "Belasting (TSS)",
        value: `${session.tss}`,
        uitlegKey: "belasting",
        bron: bronVoor("tss"),
      })
    // F3: hartslagbelasting — bewust een eigen label zodat altijd zichtbaar is
    // welke bron eronder ligt; nooit vermengd met de vermogensbelasting.
    if (session.tss == null && session.hrLoad != null)
      metrics.push({
        icon: Activity,
        label: "Belasting (hartslag)",
        value: `${session.hrLoad}`,
        bron: "hartslag",
      })
    if (session.intensityFactor != null && session.intensityFactor !== "")
      metrics.push({
        icon: Gauge,
        label: "Intensiteit (IF)",
        value: session.intensityFactor,
        bron: bronVoor("intensityFactor"),
      })
    if (session.avgPower != null)
      metrics.push({
        icon: Zap,
        label: "Gem. vermogen",
        value: `${session.avgPower} W`,
        bron: bronVoor("avgPower"),
      })
    if (session.normalizedPower != null)
      metrics.push({
        icon: Zap,
        label: "Genormaliseerd",
        value: `${session.normalizedPower} W`,
        bron: bronVoor("normalizedPower"),
      })
    if (session.avgHR != null)
      metrics.push({
        icon: HeartPulse,
        label: "Gem. hartslag",
        value: `${session.avgHR} bpm`,
        bron: bronVoor("avgHR"),
      })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-border bg-card text-foreground sm:max-w-md"
      >
        {session && (
          <>
            <SheetHeader className="space-y-2 text-left">
              <span className="font-mono text-[10px] tracking-[0.22em] text-accent-cyan">
                {fullDate}
              </span>
              <SheetTitle className="text-balance font-sans text-2xl font-extralight leading-tight tracking-tight text-foreground">
                {session.title ?? typeLabel(session.type)}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span
                  className="rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wide"
                  style={{
                    borderColor: "rgba(120,210,230,0.4)",
                    color: ACCENT,
                  }}
                >
                  {typeLabel(session.type)}
                </span>
                <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] tracking-wide text-muted-foreground">
                  Bron: {sourceLabel(session.source)}
                </span>
                <HerkomstKnop
                  target={{ type: "session", id: session.id }}
                  compact
                />
              </div>
            </SheetHeader>

            {showStory && story ? (
              <div className="mt-5">
                <RideStoryChapters story={story} />
              </div>
            ) : (
              <>
            {analysis && analysis.insights.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
                <span className="font-mono text-[10px] tracking-[0.2em] text-accent-cyan">
                  HOE DEZE RIT GING
                </span>
                <div className="mt-3 flex flex-col gap-3">
                  {analysis.insights.map((ins, i) => (
                    <div key={i}>
                      <span
                        className="font-mono text-[9px] uppercase tracking-[0.16em]"
                        style={{ color: TONE_COLOR[ins.tone] }}
                      >
                        {ins.label}
                      </span>
                      <p className="mt-0.5 text-pretty text-[13px] leading-relaxed text-muted-foreground">
                        {ins.text}
                      </p>
                    </div>
                  ))}
                </div>
                {analysis.missing && (
                  <p className="mt-3 text-pretty text-[12px] leading-relaxed text-muted-foreground">
                    {analysis.missing}
                  </p>
                )}
              </div>
            ) : analysis && analysis.missing ? (
              <p className="mt-5 text-pretty text-[13px] leading-relaxed text-muted-foreground">
                {analysis.missing}
              </p>
            ) : null}

            {metrics.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {metrics.map((m) => (
                  <Metric
                    key={m.label}
                    icon={m.icon}
                    label={m.label}
                    value={m.value}
                    uitlegKey={m.uitlegKey}
                    bron={m.bron}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-5 text-pretty text-[13px] leading-relaxed text-muted-foreground">
                Voor deze sessie is alleen de basis vastgelegd. Log meer details
                (duur, vermogen, hartslag) om je trainingen rijker terug te
                lezen.
              </p>
            )}
              </>
            )}

            {session.type.toLowerCase() === "race" && (
              <WedstrijdVerloopVragen key={session.id} session={session} />
            )}

            {segments != null && segments.length > 0 && (
              <SegmentReport segments={segments} />
            )}

            <DataInventaris
              session={session}
              detail={detail}
              segments={segments}
            />

            {detail?.sourceConflicts != null &&
              detail.sourceConflicts.length > 0 && (
                <BronConflicten conflicts={detail.sourceConflicts} />
              )}

            {/* F2/TD-17: rit kwam onder het gekozen meetniveau binnen — dat
                wordt eerlijk gezegd, nooit stil gedegradeerd. */}
            {detail?.measurementNote != null && (
              <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-600">
                  Meetniveau
                </span>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">
                  {detail.measurementNote}
                </p>
              </div>
            )}
          

            {session.source !== "manual" && (
              <SessionGraphs
                detail={detail}
                session={session}
                ftp={profile?.ftp ?? null}
                maxHr={estimatedMaxHr}
                maxHrEstimated={estimatedMaxHr != null}
                previousSession={previousSession}
              />
            )}

            {session.feelScore != null && (
              <div className="mt-5 rounded-xl border border-border bg-muted px-4 py-3.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  Hoe het voelde
                </span>
                <p className="mt-1 text-[14px] font-medium text-foreground/90">
                  {FEEL_LABELS[session.feelScore] ?? `${session.feelScore}/5`}
                </p>
              </div>
            )}

            {session.notes != null && session.notes.trim() !== "" && (
              <div className="mt-5">
                <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                  NOTITIES
                </span>
                <p className="mt-2 whitespace-pre-line text-pretty text-[13px] leading-relaxed text-muted-foreground">
                  {session.notes}
                </p>
              </div>
            )}

            <ShareRidePanel session={session} open={open} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function conflictSourceLabel(s: string): string {
  if (s === "handmatig") return "jouw invoer"
  if (s === "onbekend") return "onbekende bron"
  return sourceLabel(s)
}

function BronConflicten({ conflicts }: { conflicts: SourceConflict[] }) {
  return (
    <details className="group mt-4">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="h-3 w-3 text-muted-foreground transition-transform group-open:rotate-180"
          strokeWidth={1.75}
        />
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
          BRONNEN VERSCHILDEN HIER
        </span>
      </summary>
      <div className="mt-2 rounded-xl border border-border bg-muted px-4 py-3">
        <div className="flex flex-col gap-2">
          {conflicts.map((c) => {
            const meta = CONFLICT_FIELD_LABELS[c.field] ?? { label: c.field }
            return (
              <div key={c.field} className="text-[12px] leading-relaxed">
                <span className="text-muted-foreground">{meta.label}: </span>
                <span className="tabular-nums text-foreground/80">
                  {conflictValue(c.chosen, meta.unit)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  ({conflictSourceLabel(c.chosenSource)}, gekozen)
                </span>
                <span className="text-muted-foreground"> · </span>
                <span className="tabular-nums text-muted-foreground">
                  {conflictValue(c.offered, meta.unit)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  ({conflictSourceLabel(c.offeredSource)})
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-pretty text-[11px] leading-relaxed text-muted-foreground">
          Meerdere bronnen leverden deze rit aan met net andere getallen. Sparki
          koos per veld één waarde; de andere blijft hier terug te vinden.
        </p>
      </div>
    </details>
  )
}

function conflictValue(v: string | number | null, unit?: string): string {
  if (v === null) return "leeg"
  const s = String(v)
  return unit ? `${s} ${unit}` : s
}
