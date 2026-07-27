// Pure presentatielogica voor de commerciële schil (flag: commercial_shell).
// Geen React en geen data-fetching — alles hier is deterministisch en direct
// testbaar (test:commercial-shell). De component (commercial-shell.tsx) is de
// enige consument; de data blijft uit de bestaande Vandaag-hooks komen.
//
// Sinds de migratie naar de centrale designsysteem-fundering (donker, Figma-
// node 15:6) levert deze module ook de vertaling naar ds-componenten:
// bandStatusSoort (DsStatus) en buildWeekDays (DsWeek).

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

// Vertaling band → DsStatus-soort (centrale designsysteem-status).
// DsStatus communiceert nooit alleen met kleur (icoon + verplichte tekst).
// "Kwetsbaar" krijgt de fout-/aandachtsstijl als eerlijk signaal; de getoonde
// tekst blijft de bestaande bandnaam — er wordt niets luiders beweerd.
// Onbekende of ontbrekende band → null (dan tonen we géén status).
export type BandStatusSoort = "positief" | "waarschuwing" | "fout"

export function bandStatusSoort(
  band: string | null | undefined,
): BandStatusSoort | null {
  const tone = bandTone(band)
  if (tone === "positive") return "positief"
  if (tone === "watch") return "waarschuwing"
  if (tone === "concern") return "fout"
  return null
}

// Presentatie-herformulering (alleen deze schil): de engine-zin voor "geen
// richting zichtbaar" leest hier als datamelding. Alleen deze exacte zin wordt
// herschreven; alle andere engine-teksten gaan ongewijzigd door.
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

/** 0 = maandag … 6 = zondag — vaste weekvolgorde Ma–Zo. */
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

// ── Weekdagen voor DsWeek (centrale weekcomponent) ───────────────────────────
// Eerlijke statusafleiding uit uitsluitend bestaande dashboarddata:
//   • echte belasting (tss > 0)              → "training" (er is echt gereden);
//   • vandaag mét geplande training           → "training" (echt plan);
//   • anders                                  → "leeg".
// "herstel" wordt bewust nooit afgeleid: weekTSS bevat geen herstelinformatie
// en we verzinnen geen dagtypes. waarde = echte belasting of "—" (niets
// verzonnen); DsWeek toont die waarde onder de dagmarkering.
export type WeekDay = {
  date: string
  label: string
  status: "training" | "leeg"
  actief: boolean
  waarde: string
}

export function buildWeekDays(
  weekTSS: ReadonlyArray<{ date: string; tss: number }>,
  todayISO: string,
  hasTodayWorkout: boolean,
): WeekDay[] {
  return buildWeekStrip(weekTSS, todayISO).map((d) => ({
    date: d.date,
    label: d.label,
    status:
      d.value !== "—" || (d.isToday && hasTodayWorkout) ? "training" : "leeg",
    actief: d.isToday,
    waarde: d.value,
  }))
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

// ── Vaste teksten (exacte copy — één bron voor component én tests) ──────────
export const COMMERCIAL_COPY = {
  seasonTitle: "Seizoen in beeld",
  seasonEmpty: "Nog geen hoofddoel ingesteld.",
  seasonEmptyAction: "Hoofddoel instellen",
  seasonEmptyActionHref: "/races",
  seasonPlanLink: "Volledig plan bekijken",
  trendInsufficient:
    "Nog onvoldoende recente gegevens voor een betrouwbare trend.",
  noTraining: "Geen training gepland voor vandaag.",
  noTrainingAction: "Bekijk je plan",
  noTrainingActionHref: "/train",
  trainingTitle: "Training van vandaag",
  trainingPrimaryMobile: "Training bekijken",
  trainingPrimaryDesktop: "Training openen",
  trainingHref: "/train",
  trainingSecondary: "Planning aanpassen",
  trainingSecondaryHref: "/kalender",
  weekTitle: "Deze week",
  weekEmpty: "Nog geen weekbelasting bekend.",
  herstelTitle: "Herstel en gereedheid",
  onderbouwing: "Bekijk onderbouwing",
  geenSignalen: "Nog geen signalen voor vandaag.",
  stateLoading: "Je toestand wordt geladen…",
  stateError: "Je toestand kon niet worden geladen.",
  trainingLoading: "Je training wordt geladen…",
  trainingError: "Je training kon niet worden geladen.",
  retry: "Opnieuw proberen",
} as const

// ── Presentatietoestand (CUX_02A — sfeerlaag, alleen presentatie) ────────────
// Deterministische afleiding uit uitsluitend bestaande viewdata (State-Engine-
// band, wel/geen geplande training, hoofddoel-op-vandaag). De toestand stuurt
// alleen een subtiele sfeertint (tokenkleuren op lage alpha) op de dominante
// coachboodschap aan en trekt nooit een sterkere conclusie dan de tekst:
//  - ontbrekende of onduidelijke data → neutral (geen tint);
//  - "wisselend" → neutral (kleur mag niets extra's suggereren);
//  - "kwetsbaar" → recovery (rustig, gedempt — géén alarmkleur);
//  - er bestaat bewust géén alarm-/roodtoestand in deze laag.
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

// ── Seizoenweergave (beslislogica — testbaar zonder React) ──────────────────
// empty  → geen hoofddoel én geen seizoensplan: één eerlijke lege toestand
//          met één actie naar de bestaande wedstrijd-/doelenflow, géén faseband.
// plan   → er bestaat echte seizoensinformatie: faseband alleen als er een
//          actieve fase is; de regel toont uitsluitend afleidbare gegevens.
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
