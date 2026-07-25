// Pure presentatielogica voor de commerciële lichte schil (flag: commercial_shell).
// Geen React en geen data-fetching — alles hier is deterministisch en direct
// testbaar (test:commercial-shell). De component (commercial-shell.tsx) is de
// enige consument; de data blijft uit de bestaande Vandaag-hooks komen.

import type { WorkoutBlock, WorkoutPhase } from "@/lib/athlete-types"

// ── Navigatie ────────────────────────────────────────────────────────────────
// Doelen zijn bestaande routes uit App.tsx — de schil voegt géén routes toe.
export type CommercialNavItem = { href: string; label: string }

export const COMMERCIAL_MOBILE_NAV: CommercialNavItem[] = [
  { href: "/vandaag", label: "Vandaag" },
  { href: "/train", label: "Plan" },
  { href: "/routes", label: "Rijden" },
  { href: "/activiteiten", label: "Activiteiten" },
  { href: "/meer", label: "Meer" },
]

export const COMMERCIAL_DESKTOP_NAV: CommercialNavItem[] = [
  { href: "/vandaag", label: "Vandaag" },
  { href: "/train", label: "Plan" },
  { href: "/routes", label: "Rijden" },
  { href: "/activiteiten", label: "Activiteiten" },
  { href: "/feed", label: "Ontdekken" },
]

export const COMMERCIAL_ACCOUNT_NAV: CommercialNavItem = {
  href: "/you",
  label: "Mijn account",
}

// ── Toestand (State Engine) ──────────────────────────────────────────────────
// Er bestaat geen 0–100-gereedheidsscore in Sparki; de schil toont daarom de
// echte band + statuszin van de State Engine en verzint nooit een getal.
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

// ── Datum (lokale kalenderdag — nooit via toISOString/UTC) ──────────────────
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s
}

/** "Dinsdag 25 juli" — kop onder de paginatitel. */
export function formatDayHeader(d: Date = new Date()): string {
  return capitalize(
    d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }),
  )
}

/** "16 september" — hoofddoel-datum in Seizoen in beeld. */
export function formatRaceDate(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number)
  const d = new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1)
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })
}

// ── Deze week (echte weekTSS uit het dashboard) ──────────────────────────────
export type WeekStripDay = {
  date: string
  label: string
  value: string
  isToday: boolean
}

export function buildWeekStrip(
  weekTSS: ReadonlyArray<{ date: string; tss: number }>,
  todayISO: string,
): WeekStripDay[] {
  return weekTSS.map(({ date, tss }) => {
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

// ── Blokvisualisatie van de training ─────────────────────────────────────────
// Breedte ∝ echte blokduur; het zwaarste blok (hoogste zone) krijgt het accent.
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

// ── Hoofddoel (dichtstbijzijnde toekomstige wedstrijd) ───────────────────────
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
