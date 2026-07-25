// Tests voor de pure presentatielogica van de commerciële lichte schil
// (flag: commercial_shell). Pint de responsieve navigatiesets (mobiel vs
// desktop), de eerlijke band-labels (geen verzonnen score), de fasevertaling,
// de weekstrip uit echte weekTSS en de blokvisualisatie.
//
// Pure functies, geen DB — run: `pnpm --filter @workspace/sparki run test:commercial-shell`
// Exits non-zero on any failure.
import {
  COMMERCIAL_ACCOUNT_NAV,
  COMMERCIAL_DESKTOP_NAV,
  COMMERCIAL_MOBILE_NAV,
  SEASON_PHASES,
  bandLabel,
  bandTone,
  buildBlockBars,
  buildWeekStrip,
  formatRaceDate,
  localISODate,
  nearestUpcomingRace,
  workoutPhaseLabel,
} from "./commercial-shell"
import type { WorkoutBlock } from "./athlete-types"

type Status = "pass" | "fail"
const results: { scenario: string; status: Status; note?: string }[] = []

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function scenario(name: string, fn: () => void) {
  try {
    fn()
    results.push({ scenario: name, status: "pass" })
  } catch (e) {
    results.push({
      scenario: name,
      status: "fail",
      note: e instanceof Error ? e.message : String(e),
    })
  }
}

// ── Navigatie ────────────────────────────────────────────────────────────────
scenario("mobiele nav is Vandaag/Plan/Rijden/Activiteiten/Meer", () => {
  assert(
    COMMERCIAL_MOBILE_NAV.map((i) => i.label).join(",") ===
      "Vandaag,Plan,Rijden,Activiteiten,Meer",
    "mobiele nav-labels wijken af",
  )
})

scenario("desktop nav heeft Ontdekken en geen Meer", () => {
  const labels = COMMERCIAL_DESKTOP_NAV.map((i) => i.label)
  assert(labels.includes("Ontdekken"), "Ontdekken ontbreekt op desktop")
  assert(!labels.includes("Meer"), "Meer hoort niet in de desktop-nav")
  assert(COMMERCIAL_ACCOUNT_NAV.href === "/you", "accountknop wijst niet naar /you")
})

scenario("alle nav-doelen zijn bestaande app-routes", () => {
  const known = new Set([
    "/vandaag",
    "/train",
    "/routes",
    "/activiteiten",
    "/meer",
    "/feed",
    "/you",
  ])
  for (const item of [
    ...COMMERCIAL_MOBILE_NAV,
    ...COMMERCIAL_DESKTOP_NAV,
    COMMERCIAL_ACCOUNT_NAV,
  ]) {
    assert(known.has(item.href), `onbekende route: ${item.href}`)
  }
})

// ── Band-labels (eerlijk — geen score) ───────────────────────────────────────
scenario("bandLabel vertaalt alle echte banden en verzint niets", () => {
  assert(bandLabel("belastbaar") === "Belastbaar", "belastbaar")
  assert(bandLabel("solide") === "Solide", "solide")
  assert(bandLabel("wisselend") === "Wisselend", "wisselend")
  assert(bandLabel("kwetsbaar") === "Kwetsbaar", "kwetsbaar")
  assert(bandLabel("onzin") === null, "onbekende band moet null zijn")
  assert(bandLabel(null) === null, "null band moet null zijn")
})

scenario("bandTone volgt de band en faalt eerlijk op onbekend", () => {
  assert(bandTone("belastbaar") === "positive", "belastbaar → positive")
  assert(bandTone("solide") === "positive", "solide → positive")
  assert(bandTone("wisselend") === "watch", "wisselend → watch")
  assert(bandTone("kwetsbaar") === "concern", "kwetsbaar → concern")
  assert(bandTone("x") === null, "onbekend → null")
})

// ── Seizoensfasen ────────────────────────────────────────────────────────────
scenario("fasevertaling dekt de plan-fasen en niets meer", () => {
  assert(workoutPhaseLabel("base") === "Basis", "base → Basis")
  assert(workoutPhaseLabel("build") === "Opbouw", "build → Opbouw")
  assert(workoutPhaseLabel("peak") === "Specifiek", "peak → Specifiek")
  assert(workoutPhaseLabel("recovery") === "Taper", "recovery → Taper")
  assert(workoutPhaseLabel("xyz") === null, "onbekende fase → null")
  assert(workoutPhaseLabel(null) === null, "null fase → null")
  assert(SEASON_PHASES.length === 4, "vier seizoensfasen")
})

// ── Lokale datum (geen UTC-val) ──────────────────────────────────────────────
scenario("localISODate bouwt uit lokale getters", () => {
  const d = new Date(2026, 6, 25, 0, 30) // 25 juli 2026, 00:30 lokale tijd
  assert(localISODate(d) === "2026-07-25", `kreeg ${localISODate(d)}`)
})

// ── Weekstrip ────────────────────────────────────────────────────────────────
scenario("buildWeekStrip toont echte belasting en — voor lege dagen", () => {
  const week = [
    { date: "2026-07-20", tss: 75.4 },
    { date: "2026-07-21", tss: 0 },
    { date: "2026-07-22", tss: 48 },
    { date: "2026-07-23", tss: 0 },
    { date: "2026-07-24", tss: 90.6 },
    { date: "2026-07-25", tss: 0 },
    { date: "2026-07-26", tss: 0 },
  ]
  const strip = buildWeekStrip(week, "2026-07-25")
  assert(strip.length === 7, "zeven dagen")
  assert(strip[0]!.value === "75", "75.4 rondt naar 75")
  assert(strip[1]!.value === "—", "0 TSS toont —, geen verzonnen getal")
  assert(strip[4]!.value === "91", "90.6 rondt naar 91")
  assert(strip[5]!.isToday === true, "vandaag gemarkeerd")
  assert(strip.filter((d) => d.isToday).length === 1, "precies één vandaag")
  assert(strip[0]!.label.length === 2, "korte daglabel (2 tekens)")
})

// ── Blokbalkjes ──────────────────────────────────────────────────────────────
scenario("buildBlockBars accentueert alleen het zwaarste blok", () => {
  const blocks: WorkoutBlock[] = [
    { kind: "warmup", durationMin: 15, zone: 1 },
    { kind: "interval", durationMin: 5, zone: 4, reps: 4 },
    { kind: "recovery", durationMin: 3, zone: 1, reps: 4 },
    { kind: "cooldown", durationMin: 10, zone: 1 },
  ]
  const bars = buildBlockBars(blocks)
  assert(bars.length === 4, "vier balkjes")
  assert(bars.filter((b) => b.accent).length === 1, "precies één accent")
  assert(bars[1]!.accent === true, "accent op het zone-4-blok")
  assert(bars[1]!.flex === 20, "flex = duur × herhalingen (5×4)")
  assert(bars[0]!.flex === 15, "flex = duur zonder reps")
})

scenario("buildBlockBars is eerlijk leeg zonder structuur", () => {
  assert(buildBlockBars(null).length === 0, "null → leeg")
  assert(buildBlockBars(undefined).length === 0, "undefined → leeg")
  assert(buildBlockBars([]).length === 0, "[] → leeg")
})

// ── Hoofddoel ────────────────────────────────────────────────────────────────
scenario("nearestUpcomingRace kiest de dichtstbijzijnde toekomstige", () => {
  const races = [
    { name: "Voorjaarsklassieker", raceDate: "2026-04-12" },
    { name: "NK Weg", raceDate: "2026-09-16" },
    { name: "Clubkoers", raceDate: "2026-08-02" },
  ]
  const r = nearestUpcomingRace(races, "2026-07-25")
  assert(r !== null && r.name === "Clubkoers", "dichtstbijzijnde toekomstige wint")
  assert(
    nearestUpcomingRace(races, "2026-10-01") === null,
    "alles in het verleden → null (geen verzonnen doel)",
  )
  assert(nearestUpcomingRace([], "2026-07-25") === null, "leeg → null")
  assert(nearestUpcomingRace(null, "2026-07-25") === null, "null → null")
  const sameDay = nearestUpcomingRace(races, "2026-08-02")
  assert(sameDay !== null && sameDay.name === "Clubkoers", "racedag zelf telt mee")
})

scenario("formatRaceDate toont een Nederlandse datum", () => {
  assert(formatRaceDate("2026-09-16") === "16 september", "16 september")
})

// ── Rapportage ───────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  console.log(
    `${r.status === "pass" ? "✓" : "✗"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
  )
}
console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`)
if (failed.length > 0) process.exit(1)
