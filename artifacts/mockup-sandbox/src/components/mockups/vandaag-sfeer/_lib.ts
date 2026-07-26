// Gedeelde basis voor de Vandaag-sfeerverkenning op het canvas.
//
// De pure presentatielogica hieronder is 1-op-1 overgenomen uit
// artifacts/sparki/src/lib/commercial-shell.ts (de echte app), zodat elke
// variant exact dezelfde logica en dezelfde demogegevens gebruikt en de
// vergelijking eerlijk blijft. Alleen de data-hooks zijn hier vervangen door
// statische demogegevens — dat mag in de sandbox (dit is een ontwerpspeeltuin,
// geen productie-UI).

// ── Types (overgenomen uit athlete-types, alleen wat hier nodig is) ─────────
export type WorkoutBlock = {
  kind: string
  zone: number
  durationMin: number
  reps: number | null
}

export type WorkoutPhase = "base" | "build" | "peak" | "recovery"

// ── Navigatie ────────────────────────────────────────────────────────────────
export type CommercialNavItem = { href: string; label: string }

export const COMMERCIAL_MOBILE_NAV: CommercialNavItem[] = [
  { href: "/vandaag", label: "Vandaag" },
  { href: "/train", label: "Plan" },
  { href: "/routes", label: "Rijden" },
  { href: "/activiteiten", label: "Activiteiten" },
  { href: "/meer", label: "Meer" },
]

// ── Toestand (State Engine) ──────────────────────────────────────────────────
const BAND_LABELS: Record<string, string> = {
  belastbaar: "Belastbaar",
  solide: "Solide",
  wisselend: "Wisselend",
  kwetsbaar: "Kwetsbaar",
}

export function bandLabel(band: string | null | undefined): string | null {
  if (!band) return null
  return BAND_LABELS[band] ?? null
}

export type BandTone = "positive" | "watch" | "concern"

export function bandTone(band: string | null | undefined): BandTone | null {
  if (band === "belastbaar" || band === "solide") return "positive"
  if (band === "wisselend") return "watch"
  if (band === "kwetsbaar") return "concern"
  return null
}

const TREND_LABEL_REWRITES: Record<string, string> = {
  "Nog te weinig om een richting te zien":
    "Nog onvoldoende recente gegevens voor een betrouwbare trend.",
}

export function movementLabel(
  label: string | null | undefined,
): string | null {
  if (!label) return null
  return TREND_LABEL_REWRITES[label] ?? label
}

// ── Seizoensfasen ────────────────────────────────────────────────────────────
export const SEASON_PHASES = ["Basis", "Opbouw", "Specifiek", "Taper"] as const

const PHASE_LABELS: Record<WorkoutPhase, (typeof SEASON_PHASES)[number]> = {
  base: "Basis",
  build: "Opbouw",
  peak: "Specifiek",
  recovery: "Taper",
}

export function workoutPhaseLabel(
  phase: string | null | undefined,
): (typeof SEASON_PHASES)[number] | null {
  if (!phase) return null
  return PHASE_LABELS[phase as WorkoutPhase] ?? null
}

// ── Datum (lokale kalenderdag) ───────────────────────────────────────────────
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s
}

export function formatDayHeader(d: Date = new Date()): string {
  return capitalize(
    d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }),
  )
}

export function formatRaceDate(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number)
  const d = new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1)
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })
}

// ── Deze week ────────────────────────────────────────────────────────────────
export type WeekStripDay = {
  date: string
  label: string
  value: string
  isToday: boolean
}

function mondayFirstIndex(date: string): number {
  const d = new Date(date + "T12:00:00Z")
  return (d.getUTCDay() + 6) % 7
}

export function buildWeekStrip(
  weekTSS: ReadonlyArray<{ date: string; tss: number }>,
  todayISO: string,
): WeekStripDay[] {
  return [...weekTSS]
    .sort((a, b) => mondayFirstIndex(a.date) - mondayFirstIndex(b.date))
    .map(({ date, tss }) => {
      const d = new Date(date + "T12:00:00Z")
      const label = capitalize(
        d.toLocaleDateString("nl-NL", { weekday: "short" }).slice(0, 2),
      )
      return {
        date,
        label,
        value: tss > 0 ? String(Math.round(tss)) : "—",
        isToday: date === todayISO,
      }
    })
}

// ── Blokvisualisatie ─────────────────────────────────────────────────────────
export type BlockBar = { key: string; flex: number; accent: boolean }

export function buildBlockBars(
  blocks: ReadonlyArray<WorkoutBlock> | null | undefined,
): BlockBar[] {
  if (!blocks || blocks.length === 0) return []
  const maxZone = Math.max(...blocks.map((b) => b.zone))
  let accentUsed = false
  return blocks.map((b, i) => {
    const accent = !accentUsed && b.zone === maxZone
    if (accent) accentUsed = true
    return {
      key: `${i}-${b.kind}`,
      flex: Math.max(b.durationMin * (b.reps ?? 1), 1),
      accent,
    }
  })
}

// ── Hoofddoel ────────────────────────────────────────────────────────────────
export type UpcomingRaceLike = { name: string; raceDate: string }

export function nearestUpcomingRace<T extends UpcomingRaceLike>(
  races: ReadonlyArray<T> | null | undefined,
  todayISO: string,
): T | null {
  if (!races || races.length === 0) return null
  const upcoming = races
    .filter((r) => r.raceDate >= todayISO)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
  return upcoming[0] ?? null
}

// ── Vaste teksten ────────────────────────────────────────────────────────────
export const COMMERCIAL_COPY = {
  seasonTitle: "Seizoen in beeld",
  seasonEmpty: "Nog geen hoofddoel ingesteld.",
  seasonEmptyAction: "Hoofddoel instellen",
  seasonEmptyActionHref: "/races",
  noTraining: "Geen training gepland voor vandaag.",
  noTrainingAction: "Bekijk je plan",
  noTrainingActionHref: "/train",
} as const

// ── Presentatietoestand (sfeerlaag) ─────────────────────────────────────────
export const PRESENTATION_STATES = [
  "ready",
  "training",
  "race",
  "recovery",
  "neutral",
] as const

export type PresentationState = (typeof PRESENTATION_STATES)[number]

export type PresentationInput = {
  band: string | null | undefined
  hasTodayWorkout: boolean
  goalRaceIsToday: boolean
}

export function derivePresentationState(
  input: PresentationInput,
): PresentationState {
  if (input.goalRaceIsToday) return "race"
  if (input.band === "kwetsbaar") return "recovery"
  if (bandTone(input.band) == null) return "neutral"
  if (input.band === "wisselend") return "neutral"
  if (input.hasTodayWorkout) return "training"
  return "ready"
}

// ── Decoratieve fallback (routeachtige lijnen, puur sfeer) ───────────────────
export const DECOR_BACKDROP = {
  ariaHidden: true,
  viewBox: "0 0 400 160",
  paths: [
    "M0 118 C 70 92 130 138 205 104 C 268 76 330 96 400 74",
    "M0 140 C 80 118 150 152 230 124 C 300 100 350 118 400 102",
    "M0 96 C 60 76 120 108 190 86 C 262 62 328 80 400 54",
  ],
} as const

// ── Seizoenweergave ──────────────────────────────────────────────────────────
export type SeasonView =
  | { kind: "empty" }
  | { kind: "plan"; showPhaseBand: boolean; line: string }

export function buildSeasonView(
  goalRace: UpcomingRaceLike | null,
  activePhase: (typeof SEASON_PHASES)[number] | null,
): SeasonView {
  if (!goalRace && !activePhase) return { kind: "empty" }
  const line = goalRace
    ? `Hoofddoel: ${goalRace.name} · ${formatRaceDate(goalRace.raceDate)}` +
      (activePhase ? ` · fase: ${activePhase.toLowerCase()}` : "")
    : COMMERCIAL_COPY.seasonEmpty
  return { kind: "plan", showPhaseBand: activePhase != null, line }
}

// ═════════════════════════════════════════════════════════════════════════════
// DEMOGEGEVENS — alleen voor de sandbox-mockups (identiek voor álle varianten,
// zodat de sfeervergelijking eerlijk is). Vorm spiegelt de echte hooks.
// ═════════════════════════════════════════════════════════════════════════════

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function mondayOfWeek(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7))
}

const NOW = new Date()
const MONDAY = mondayOfWeek(NOW)
const TODAY_ISO = localISODate(NOW)

const WEEK_BASE = [68, 0, 92, 55, 0, 132, 74]

export const DEMO_WEEK_TSS: Array<{ date: string; tss: number }> =
  WEEK_BASE.map((tss, i) => {
    const date = localISODate(addDays(MONDAY, i))
    return { date, tss: date < TODAY_ISO ? tss : 0 }
  })

export const DEMO_STATE = {
  band: "belastbaar" as string,
  status: "Je bent goed belastbaar — vandaag kan je lichaam een stevige prikkel aan.",
  movement: { label: "Je vorm stijgt over de laatste twee weken." },
  why: [
    {
      kind: "load",
      label: "Trainingsbelasting",
      reading: "rustige opbouw, geen pieken in de laatste tien dagen",
    },
    {
      kind: "recovery",
      label: "Herstel",
      reading: "twee rustige dagen na je zware zaterdagrit",
    },
    {
      kind: "consistency",
      label: "Regelmaat",
      reading: "vijf van de laatste zeven dagen getraind",
    },
  ],
  missing: ["slaapgegevens"],
  confidenceLabel: "redelijk zeker",
}

export const DEMO_TODAY_WORKOUT = {
  title: "Duurrit met tempoblokken",
  targetDurationMin: 90,
  description:
    "Rustige duurrit met drie blokken van acht minuten op tempo. Blijf zitten en houd je trapfrequentie rond de 90.",
  structure: {
    phase: "build" as WorkoutPhase,
    week: 6,
    blocks: [
      { kind: "warmup", zone: 1, durationMin: 15, reps: null },
      { kind: "tempo", zone: 3, durationMin: 8, reps: 3 },
      { kind: "recover", zone: 1, durationMin: 4, reps: 3 },
      { kind: "endurance", zone: 2, durationMin: 25, reps: null },
      { kind: "cooldown", zone: 1, durationMin: 10, reps: null },
    ] as WorkoutBlock[],
    rationale: { supportsGoal: "Opbouw richting je hoofddoel" },
  },
  planDetails: { goal: "Opbouw richting je hoofddoel" },
}

export const DEMO_RACES: Array<{ name: string; raceDate: string }> = [
  { name: "Omloop van de Veluwe", raceDate: localISODate(addDays(NOW, 52)) },
]

export const DEMO_DASHBOARD = {
  todayWorkout: DEMO_TODAY_WORKOUT,
  weekTSS: DEMO_WEEK_TSS,
}

// ── Stub-hooks (zelfde vorm als de echte hooks; data is direct beschikbaar) ──
type StubQuery<T> = {
  data: T
  isLoading: false
  isError: false
  refetch: () => void
}

function stub<T>(data: T): StubQuery<T> {
  return { data, isLoading: false, isError: false, refetch: () => {} }
}

export function useSparkiState() {
  return stub(DEMO_STATE)
}

export function useAthleteDashboard() {
  return stub(DEMO_DASHBOARD)
}

export function useRaces() {
  return stub(DEMO_RACES)
}
