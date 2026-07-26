// Tests voor de pure presentatielogica van de commerciële lichte schil
// (flag: commercial_shell). Pint de responsieve navigatiesets (mobiel vs
// desktop), de eerlijke band-labels (geen verzonnen score), de fasevertaling,
// de weekstrip uit echte weekTSS en de blokvisualisatie.
//
// Pure functies, geen DB — run: `pnpm --filter @workspace/sparki run test:commercial-shell`
// Exits non-zero on any failure.
import {
  COMMERCIAL_ACCOUNT_NAV,
  COMMERCIAL_COPY,
  COMMERCIAL_DESKTOP_NAV,
  COMMERCIAL_MOBILE_NAV,
  SEASON_PHASES,
  bandLabel,
  bandTone,
  buildBlockBars,
  buildSeasonView,
  buildWeekStrip,
  formatRaceDate,
  localISODate,
  movementLabel,
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

// ── Trendtekst (presentatie-herformulering) ──────────────────────────────────
scenario("movementLabel herschrijft alleen de 'geen richting'-zin", () => {
  assert(
    movementLabel("Nog te weinig om een richting te zien") ===
      "Nog onvoldoende recente gegevens voor een betrouwbare trend.",
    "engine-zin wordt herschreven",
  )
  assert(
    movementLabel("Je vorm stijgt") === "Je vorm stijgt",
    "andere engine-teksten gaan ongewijzigd door",
  )
  assert(movementLabel(null) === null, "null → null")
  assert(movementLabel("") === null, "lege string → null")
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

scenario("buildWeekStrip zet de volgorde vast op Ma–Zo", () => {
  // Dashboard levert de week zondag-eerst aan (Zo 19 juli … Za 25 juli).
  const sundayFirst = [
    { date: "2026-07-19", tss: 10 }, // zondag
    { date: "2026-07-20", tss: 20 }, // maandag
    { date: "2026-07-21", tss: 30 },
    { date: "2026-07-22", tss: 40 },
    { date: "2026-07-23", tss: 50 },
    { date: "2026-07-24", tss: 60 },
    { date: "2026-07-25", tss: 70 }, // zaterdag
  ]
  const strip = buildWeekStrip(sundayFirst, "2026-07-25")
  assert(
    strip.map((d) => d.label).join(",") === "Ma,Di,Wo,Do,Vr,Za,Zo",
    `volgorde is ${strip.map((d) => d.label).join(",")}`,
  )
  assert(strip[0]!.date === "2026-07-20", "maandag staat vooraan")
  assert(strip[6]!.date === "2026-07-19", "zondag staat achteraan")
  assert(strip[5]!.isToday === true, "vandaag (za) blijft correct gemarkeerd")
})

scenario("buildWeekStrip: willekeurige invoervolgorde wordt altijd Ma–Zo", () => {
  // Bewust husselen — de volgorde van aanlevering mag niets uitmaken.
  const shuffled = [
    { date: "2026-07-23", tss: 50 }, // donderdag
    { date: "2026-07-19", tss: 10 }, // zondag
    { date: "2026-07-25", tss: 70 }, // zaterdag
    { date: "2026-07-20", tss: 20 }, // maandag
    { date: "2026-07-24", tss: 60 }, // vrijdag
    { date: "2026-07-21", tss: 30 }, // dinsdag
    { date: "2026-07-22", tss: 40 }, // woensdag
  ]
  const strip = buildWeekStrip(shuffled, "2026-07-22")
  assert(
    strip.map((d) => d.label).join(",") === "Ma,Di,Wo,Do,Vr,Za,Zo",
    `volgorde is ${strip.map((d) => d.label).join(",")}`,
  )
  assert(
    strip.map((d) => d.date).join(",") ===
      "2026-07-20,2026-07-21,2026-07-22,2026-07-23,2026-07-24,2026-07-25,2026-07-19",
    "datums volgen de Ma–Zo-volgorde, niet de invoervolgorde",
  )
  // Vandaag (wo) wordt gemarkeerd maar NIET verplaatst.
  assert(strip[2]!.isToday === true, "vandaag blijft op de wo-positie")
  assert(strip.filter((d) => d.isToday).length === 1, "precies één vandaag")
})

scenario("buildWeekStrip: ontbrekende weekdata verandert de volgorde niet", () => {
  // Slechts drie aangeleverde dagen, bewust door elkaar.
  const partial = [
    { date: "2026-07-24", tss: 0 }, // vrijdag — geen belasting
    { date: "2026-07-20", tss: 35 }, // maandag
    { date: "2026-07-22", tss: 0 }, // woensdag — geen belasting
  ]
  const strip = buildWeekStrip(partial, "2026-07-22")
  assert(
    strip.map((d) => d.label).join(",") === "Ma,Wo,Vr",
    `volgorde is ${strip.map((d) => d.label).join(",")}`,
  )
  assert(strip[0]!.value === "35", "echte belasting blijft staan")
  assert(strip[1]!.value === "—", "ontbrekende belasting toont — (niets verzonnen)")
  assert(strip[2]!.value === "—", "ontbrekende belasting toont — (niets verzonnen)")
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

// ── Vaste teksten (exacte copy, CUX_01R1) ────────────────────────────────────
scenario("vaste teksten luiden exact volgens de opdracht", () => {
  assert(
    COMMERCIAL_COPY.trendInsufficient ===
      "Nog onvoldoende recente gegevens voor een betrouwbare trend.",
    "trendzin exact",
  )
  assert(
    COMMERCIAL_COPY.noTraining === "Geen training gepland voor vandaag.",
    "training-lege-toestand exact",
  )
  assert(COMMERCIAL_COPY.noTrainingAction === "Bekijk je plan", "planactie exact")
  assert(COMMERCIAL_COPY.seasonTitle === "Seizoen in beeld", "seizoenkop exact")
  assert(
    COMMERCIAL_COPY.seasonEmpty === "Nog geen hoofddoel ingesteld.",
    "seizoen-lege-toestand exact",
  )
  assert(
    COMMERCIAL_COPY.seasonEmptyAction === "Hoofddoel instellen",
    "hoofddoelactie exact",
  )
  assert(
    movementLabel("Nog te weinig om een richting te zien") ===
      COMMERCIAL_COPY.trendInsufficient,
    "herschreven engine-zin gebruikt exact dezelfde copy-bron",
  )
})

scenario("acties gebruiken bestaande flows (geen nieuwe routes)", () => {
  assert(
    COMMERCIAL_COPY.seasonEmptyActionHref === "/races",
    "Hoofddoel instellen → bestaande wedstrijd-/doelenflow (/races)",
  )
  assert(
    COMMERCIAL_COPY.noTrainingActionHref === "/train",
    "Bekijk je plan → bestaande plan-/kalenderflow (/train)",
  )
})

// ── Seizoenweergave (buildSeasonView) ────────────────────────────────────────
scenario("zonder hoofddoel én zonder fase → één lege toestand, geen faseband", () => {
  const v = buildSeasonView(null, null)
  assert(v.kind === "empty", "lege toestand")
})

scenario("met geldig hoofddoel verdwijnt de lege toestand", () => {
  const v = buildSeasonView({ name: "NK Weg", raceDate: "2026-09-16" }, null)
  assert(v.kind === "plan", "geen lege toestand meer")
  if (v.kind === "plan") {
    assert(v.showPhaseBand === false, "geen faseband zonder actieve fase")
    assert(
      v.line === "Hoofddoel: NK Weg · 16 september",
      `regel is "${v.line}"`,
    )
  }
})

scenario("met geldig seizoensplan blijft echte informatie zichtbaar", () => {
  const v = buildSeasonView({ name: "NK Weg", raceDate: "2026-09-16" }, "Opbouw")
  assert(v.kind === "plan", "planweergave")
  if (v.kind === "plan") {
    assert(v.showPhaseBand === true, "faseband zichtbaar bij actieve fase")
    assert(
      v.line === "Hoofddoel: NK Weg · 16 september · fase: opbouw",
      `regel is "${v.line}"`,
    )
  }
})

scenario("alleen een actieve fase (zonder doel) toont plan, eerlijk zonder doelregel", () => {
  const v = buildSeasonView(null, "Basis")
  assert(v.kind === "plan", "fase-informatie is echt → geen lege toestand")
  if (v.kind === "plan") {
    assert(v.showPhaseBand === true, "faseband zichtbaar")
    assert(v.line === COMMERCIAL_COPY.seasonEmpty, "doelregel blijft eerlijk leeg")
  }
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
