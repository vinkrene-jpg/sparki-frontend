// Pure presentatielogica voor de commerciële schil (flag: commercial_shell).
// Geen React en geen data-fetching — alles hier is deterministisch en direct
// testbaar (test:commercial-shell). De component (commercial-shell.tsx) is de
// enige consument; de data blijft uit de bestaande Vandaag-hooks komen.
//
// Sinds de migratie naar de centrale designsysteem-fundering (donker, Figma-
// node 15:6) levert deze module ook de vertaling naar ds-componenten:
// bandStatusSoort (DsStatus) en buildWeekDays (DsWeek).

import type { WorkoutBlock, WorkoutBlockKind, WorkoutPhase } from "@/lib/athlete-types"
import { isRestWorkout } from "@/lib/day-type"
import { labelSignal } from "@/lib/signal-labels"

// ── Navigatie ────────────────────────────────────────────────────────────────
// Doelen zijn bestaande routes uit App.tsx — de schil voegt géén routes toe.
export type CommercialNavItem = { href: string; label: string }

export const COMMERCIAL_MOBILE_NAV: CommercialNavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  // Label gelijkgetrokken met het menu-label "Trainen" (Beslisblok 01,
  // veilige fix 1) — de paginatitel en de nav zeggen nu hetzelfde.
  { href: "/train", label: "Trainen" },
  { href: "/routes", label: "Rijden" },
  // Analyse verving Activiteiten op verzoek van René (28-7-2026);
  // Activiteiten blijft bereikbaar via Meer → Veelgebruikt.
  { href: "/analyse", label: "Analyse" },
  { href: "/meer", label: "Meer" },
]

// Besluitenpatch 2026-08-01 (hoofdstuk B): bij een ACTIEVE clubrol vervangt
// "Club" de Analyse-positie in de vijf hoofdposities. Analyse blijft
// bereikbaar via Meer. Pure functie zodat de nav-regressietest dit dekt.
export function withClubNav(
  items: CommercialNavItem[],
  hasClubRole: boolean,
): CommercialNavItem[] {
  if (!hasClubRole) return items
  return items.map((i) =>
    i.href === "/analyse" ? { href: "/club", label: "Club" } : i,
  )
}

// DASHBOARD_01 Fase C (DSH-14): Gratis heeft GEEN dashboard-item. Laag 1 en 3
// van het dashboard vragen gegevens die een gratis gebruiker niet heeft, dus
// het item hoort niet in zijn navigatie (en /dashboard verwijst voor Gratis
// netjes door naar de kaart — DSH-22). Voor Go en Compleet blijft Dashboard op
// positie 1 staan. Pure functie zodat de nav-regressietest dit dekt.
export function withoutDashboardNav(
  items: CommercialNavItem[],
): CommercialNavItem[] {
  return items.filter((i) => i.href !== "/dashboard")
}

// DASHBOARD_01 Fase C (DSH-15): welke laag-3-onderdelen mag dit pakket zien op
// het sporterdashboard? Compleet ziet de volledige laag 3 met een meerweekse
// horizon (trend-/risico-observaties over weken, seizoensdoel-framing,
// meerweekse opbouwsignalen). Go blijft beperkt tot "gisteren/vandaag/morgen":
// alle meerweekse onderdelen vervallen — dus zowel de volledige weekstrook
// ("Deze week") als de seizoensband ("Seizoen in beeld"). Wat overblijft is
// hooguit vandaag (training) en herstel na gisteren.
//
// Pure functie, React-vrij, direct testbaar. GEEN nieuwe rechtenlaag (DSH-09):
// de aanroeper geeft simpelweg het bestaande pakket door (usePackage()). Bij een
// onbekend pakket (`null`, pakket nog niet geladen) tonen we niets meerweeks —
// veilige default: nooit meer laten zien dan het pakket toestaat.
//
// Lege laag na dit filter ⇒ de aanroeper laat de sectie wég (DSH-08/21), zonder
// mededeling: er is bewust géén "niet in jouw pakket"-tekst.
export type DashboardPakket = "gratis" | "go" | "compleet"

export type Laag3Zichtbaar = {
  /** De volledige weekstrook ("Deze week", 7 dagen — meerweekse horizon). */
  weekstrook: boolean
  /** De seizoensband ("Seizoen in beeld" — hoofddoel/fase over weken). */
  seizoensband: boolean
}

export function dashboardLaag3Zichtbaar(
  pkg: DashboardPakket | null,
): Laag3Zichtbaar {
  const isCompleet = pkg === "compleet"
  // Alle meerweekse onderdelen zijn Compleet-only. Go (en Gratis, dat hier niet
  // eens landt) krijgt geen enkel meerweeks laag-3-onderdeel te zien.
  return { weekstrook: isCompleet, seizoensband: isCompleet }
}

// Beslisblok 01 (RENE_APPROVED_PATTERN, apparaat-eigen navigatie met
// gegarandeerde kernset): Wedstrijd hoort ook op desktop logisch bereikbaar
// te zijn, en desktop krijgt een duidelijk Meer-equivalent (zelfde inhoud als
// het mobiele Meer-overzicht, geen 1-op-1 kopie van de mobiele onderbalk).
export const COMMERCIAL_DESKTOP_NAV: CommercialNavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/train", label: "Trainen" },
  { href: "/routes", label: "Rijden" },
  { href: "/races", label: "Wedstrijd" },
  { href: "/activiteiten", label: "Activiteiten" },
  { href: "/analyse", label: "Analyse" },
  { href: "/feed", label: "Ontdekken" },
  { href: "/meer", label: "Meer" },
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

// ── Herstel-presentatielaag ──────────────────────────────────────────────────
// Signaalsleutels worden vertaald via labelSignal() uit lib/signal-labels.ts —
// de enige plek waar nieuwe signaalsoorten worden toegevoegd.

// Kernmissende signalen in volgorde van dagelijkse relevantie.
const MISSING_CORE_PRIORITY = [
  "training_load",
  "sleep",
  "hrv_trend",
  "subjective_feel",
  "resting_hr_trend",
]

// Geeft de ontbrekende sleutels terug als Nederlandse termen die de gebruiker
// te zien krijgt. Als bijna alles ontbreekt (>= 8 van de 11 signalen) geeft
// dit een lege array terug — de aanroeper toont dan één compacte zin.
export function relevantMissingLabels(keys: string[]): string[] {
  if (keys.length >= 8) return []
  const core = keys.filter((k) => MISSING_CORE_PRIORITY.includes(k)).slice(0, 4)
  if (core.length > 0) return core.map((k) => labelSignal(k))
  return keys.slice(0, 4).map((k) => labelSignal(k))
}

// Presentatieconfiguratiedrempels — uitsluitend voor toon en formulering van de
// herstelstatus in de UI. NIET voor engine-beslissingen, planadaptatie of
// medische logica.
//
// HERSTEL_CONF_MED (0.35) sluit aan op de "weinig data"→"genoeg data" grens in
// computeConfidence() in api-server/src/engines/state/compute.ts. Elke aanpassing
// hier moet ook daar worden gecontroleerd en omgekeerd.
//
// HERSTEL_CONF_LOW (0.10) is een aanvullende presentatielaag: bij nul signalen
// én een zeer lage confidence laat je de band geheel achterwege. Dit is een lokale
// presentatiebeslissing die NIET in de engine staat.
const HERSTEL_CONF_LOW = 0.1 // presentatie-only; zie commentaar hierboven
const HERSTEL_CONF_MED = 0.35 // presentatie-only; synchroon houden met engine

// Confidence-bewuste presentatie van de herstelstatus.
// De band van de engine is leidend; de confidence bepaalt of we die band
// stellig tonen of eerlijk moeten nuanceren.
//
// Drempelwaarden:
//   < HERSTEL_CONF_LOW en geen signalen → "Beperkte beoordeling" (neutraal)
//   HERSTEL_CONF_LOW – HERSTEL_CONF_MED → "Waarschijnlijk [band] — lage zekerheid"
//   ≥ HERSTEL_CONF_MED                  → normaal bandlabel + DsStatus-soort
export type HerstelPresentatie = {
  label: string
  soort: "positief" | "waarschuwing" | "fout" | "neutraal"
  toelichting: string | null
}

export function buildHerstelPresentatie(
  band: string | null | undefined,
  confidence: number,
  whyCount: number,
): HerstelPresentatie {
  if (!band) {
    return {
      label: "Geen beoordeling beschikbaar",
      soort: "neutraal",
      toelichting: null,
    }
  }

  if (confidence < HERSTEL_CONF_LOW && whyCount === 0) {
    return {
      label: "Beperkte beoordeling",
      soort: "neutraal",
      toelichting:
        "Er is nog te weinig informatie om je herstel voor vandaag betrouwbaar te beoordelen.",
    }
  }

  if (confidence < HERSTEL_CONF_MED) {
    const base = BAND_LABELS[band] ?? band
    const soort: HerstelPresentatie["soort"] =
      band === "belastbaar" || band === "solide"
        ? "neutraal"
        : (bandStatusSoort(band) ?? "neutraal")
    return {
      label: `Waarschijnlijk ${base.toLowerCase()} — lage zekerheid`,
      soort,
      toelichting: "Beoordeling is gebaseerd op beperkte gegevens.",
    }
  }

  return {
    label: bandLabel(band) ?? band,
    soort: bandStatusSoort(band) ?? "neutraal",
    toelichting: null,
  }
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

// Presentatie-herschrijving van één bekende dubbele coachboodschap (correctie
// 27-07-2026): bij "belastbaar + dalende vorm" eindigt de engine-status al op
// "maar je zakt iets" terwijl de trendregel exact dezelfde conclusie herhaalt.
// Alleen dit exacte paar wordt herschreven — de hoofdzin leest vollediger en de
// onderregel voegt echte uitleg toe in plaats van de herhaling. Elke andere
// combinatie gaat 1-op-1 door (status ongewijzigd, trend via movementLabel).
export const COACH_MESSAGE_REWRITE = {
  status: "Je bent goed belastbaar maar je zakt iets.",
  trend: "Je zakt iets",
  statusRewritten: "Je bent goed belastbaar, maar je vorm zakt iets.",
  sublineRewritten:
    "Een rustige dag helpt om vermoeidheid te laten zakken en je volgende trainingsprikkel beter te verwerken.",
} as const

export function buildCoachMessage(
  status: string,
  trendLabel: string | null | undefined,
  action?: { label: string; reason: string } | null,
): { headline: string; subline: string | null } {
  if (
    status === COACH_MESSAGE_REWRITE.status &&
    trendLabel === COACH_MESSAGE_REWRITE.trend
  ) {
    return {
      headline: COACH_MESSAGE_REWRITE.statusRewritten,
      subline: COACH_MESSAGE_REWRITE.sublineRewritten,
    }
  }
  // Algemene dedupe (correctie 28-07-2026): de engine-status eindigt soms al
  // op exact de trendconclusie ("… en blijft stabiel." + "Je blijft stabiel").
  // Herhaalt de onderregel de hoofdzin, dan tonen we in plaats daarvan de
  // concrete dagactie van de engine — echte inhoud, nooit dezelfde zin twee
  // keer. Zonder actie vervalt de onderregel gewoon.
  const kern = (trendLabel ?? "").replace(/^Je\s+/i, "").trim().toLowerCase()
  if (kern.length > 0 && status.toLowerCase().includes(kern)) {
    return {
      headline: status,
      subline: action ? `${action.label} — ${action.reason}.` : null,
    }
  }
  return { headline: status, subline: movementLabel(trendLabel) }
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
  /** Markeert de echte vandaag-dag (aria-current in de selecteerbare DsWeek). */
  vandaag: boolean
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
    vandaag: d.isToday,
    waarde: d.value,
  }))
}

// ── Blokvisualisatie van de training ─────────────────────────────────────────
// Breedte ∝ echte blokduur; het zwaarste blok (hoogste zone) krijgt het accent.
// Alle velden komen uit de echte WorkoutBlock — geen verzonnen of geschatte waarden.
export type BlockBar = {
  key: string
  flex: number
  accent: boolean
  label: string
  zone: number
  durationMin: number
  kind: WorkoutBlockKind
  reps: number
  totalMin: number
  targetPctFtp: number | null
}

export function buildBlockBars(
  blocks: ReadonlyArray<WorkoutBlock> | null | undefined,
): BlockBar[] {
  if (!blocks || blocks.length === 0) return []
  const maxZone = Math.max(...blocks.map((b) => b.zone))
  let accentUsed = false
  return blocks.map((b, i) => {
    const accent = !accentUsed && b.zone === maxZone
    if (accent) accentUsed = true
    const reps = b.reps ?? 1
    const totalMin = b.durationMin * reps
    return {
      key: `${i}-${b.kind}`,
      flex: Math.max(totalMin, 1),
      accent,
      label: b.label,
      zone: b.zone,
      durationMin: b.durationMin,
      kind: b.kind,
      reps,
      totalMin,
      targetPctFtp: b.targetPctFtp,
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
  restDayPrimary: "Plan bekijken",
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

// ── Primaire knop van de trainingskaart ──────────────────────────────────────
// Bij een geplande rustdag is er geen training om te bekijken — de knop leest
// dan "Plan bekijken" (mobiel én desktop; "Training openen" zou dezelfde fout
// zijn). Route en klikactie blijven ongewijzigd. Elke andere workout behoudt
// de bestaande teksten; een ontbrekend type telt nooit als rustdag. De
// rustdag-definitie is die van day-type (isRestWorkout) — één bron.
export function trainingPrimaryLabel(
  workoutType: string | null | undefined,
): { mobile: string; desktop: string } {
  if (workoutType && isRestWorkout(workoutType)) {
    return {
      mobile: COMMERCIAL_COPY.restDayPrimary,
      desktop: COMMERCIAL_COPY.restDayPrimary,
    }
  }
  return {
    mobile: COMMERCIAL_COPY.trainingPrimaryMobile,
    desktop: COMMERCIAL_COPY.trainingPrimaryDesktop,
  }
}

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
