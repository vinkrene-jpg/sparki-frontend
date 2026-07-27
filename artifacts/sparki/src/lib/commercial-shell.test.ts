// Tests voor de pure presentatielogica van de commerciële schil
// (flag: commercial_shell; donker, op de centrale designsysteem-fundering).
// Pint de responsieve navigatiesets (mobiel vs desktop), de eerlijke
// band-labels (geen verzonnen score), de ds-statusvertaling, de fasevertaling,
// de weekstrip/DsWeek-dagen uit echte weekTSS en de blokvisualisatie.
//
// Pure functies, geen DB — run: `pnpm --filter @workspace/sparki run test:commercial-shell`
// Exits non-zero on any failure.
import {
  COMMERCIAL_ACCOUNT_NAV,
  COACH_MESSAGE_REWRITE,
  COMMERCIAL_COPY,
  buildCoachMessage,
  trainingPrimaryLabel,
  COMMERCIAL_DESKTOP_NAV,
  COMMERCIAL_MOBILE_NAV,
  PRESENTATION_STATES,
  SEASON_PHASES,
  bandLabel,
  bandStatusSoort,
  bandTone,
  buildBlockBars,
  buildSeasonView,
  buildWeekDays,
  buildWeekStrip,
  derivePresentationState,
  formatRaceDate,
  localISODate,
  movementLabel,
  nearestUpcomingRace,
  workoutPhaseLabel,
  type PresentationInput,
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

scenario("bandStatusSoort vertaalt banden naar ds-statussoorten", () => {
  assert(bandStatusSoort("belastbaar") === "positief", "belastbaar → positief")
  assert(bandStatusSoort("solide") === "positief", "solide → positief")
  assert(
    bandStatusSoort("wisselend") === "waarschuwing",
    "wisselend → waarschuwing",
  )
  assert(
    bandStatusSoort("kwetsbaar") === "fout",
    "kwetsbaar → fout (eerlijk aandachtssignaal, tekst blijft de bandnaam)",
  )
  assert(bandStatusSoort("onzin") === null, "onbekend → null (geen status)")
  assert(bandStatusSoort(null) === null, "null → null")
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

// ── Coachboodschap (correctie 27-07-2026: het bekende dubbele paar) ──────────
scenario("buildCoachMessage herschrijft alleen het exacte dubbele paar", () => {
  const fixed = buildCoachMessage(
    "Je bent goed belastbaar maar je zakt iets.",
    "Je zakt iets",
  )
  assert(
    fixed.headline === COACH_MESSAGE_REWRITE.statusRewritten &&
      fixed.headline === "Je bent goed belastbaar, maar je vorm zakt iets.",
    "hoofdtekst exact herschreven",
  )
  assert(
    fixed.subline ===
      "Een rustige dag helpt om vermoeidheid te laten zakken en je volgende trainingsprikkel beter te verwerken.",
    "ondertekst is exact de nieuwe uitleg",
  )
  assert(
    fixed.subline !== null && !fixed.headline.includes("Je zakt iets"),
    "hoofd- en ondertekst herhalen elkaar niet meer",
  )

  const solide = buildCoachMessage(
    "Je staat er solide voor maar je zakt iets.",
    "Je zakt iets",
  )
  assert(
    solide.headline === "Je staat er solide voor maar je zakt iets." &&
      solide.subline === "Je zakt iets",
    "elke andere status gaat 1-op-1 door (alleen het exacte paar wijzigt)",
  )

  const stijgt = buildCoachMessage(
    "Je bent goed belastbaar en je gaat vooruit.",
    "Je gaat vooruit",
  )
  assert(
    stijgt.headline === "Je bent goed belastbaar en je gaat vooruit." &&
      stijgt.subline === "Je gaat vooruit",
    "stijgende vorm blijft ongewijzigd",
  )

  assert(
    buildCoachMessage("Je bent goed belastbaar.", null).subline === null,
    "zonder trend geen ondertekst",
  )
  assert(
    buildCoachMessage(
      "Je beeld is wisselend.",
      "Nog te weinig om een richting te zien",
    ).subline === COMMERCIAL_COPY.trendInsufficient,
    "de bestaande 'geen richting'-herschrijving blijft werken",
  )
})

// ── Rustdagknop (alleen de knoptekst; route en klikactie ongewijzigd) ────────
scenario("trainingPrimaryLabel: rustdag → Plan bekijken, training blijft", () => {
  const rust = trainingPrimaryLabel("rest")
  assert(
    rust.mobile === "Plan bekijken" && rust.desktop === "Plan bekijken",
    "rustdag → Plan bekijken (mobiel én desktop)",
  )
  assert(
    trainingPrimaryLabel("Rustdag").mobile === COMMERCIAL_COPY.restDayPrimary,
    "Nederlands rusttype telt ook als rustdag",
  )
  const gewoon = trainingPrimaryLabel("endurance")
  assert(
    gewoon.mobile === COMMERCIAL_COPY.trainingPrimaryMobile &&
      gewoon.desktop === COMMERCIAL_COPY.trainingPrimaryDesktop,
    "gewone training behoudt de bestaande knopteksten",
  )
  assert(
    trainingPrimaryLabel(undefined).mobile ===
      COMMERCIAL_COPY.trainingPrimaryMobile,
    "ontbrekend type valt terug op de bestaande knop (nooit gokken)",
  )
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

// ── DsWeek-dagen ─────────────────────────────────────────────────────────────
scenario("buildWeekDays: echte belasting → training, anders leeg (nooit herstel)", () => {
  const week = [
    { date: "2026-07-20", tss: 75.4 },
    { date: "2026-07-21", tss: 0 },
    { date: "2026-07-22", tss: 48 },
    { date: "2026-07-23", tss: 0 },
    { date: "2026-07-24", tss: 0 },
    { date: "2026-07-25", tss: 0 },
    { date: "2026-07-26", tss: 0 },
  ]
  const days = buildWeekDays(week, "2026-07-25", false)
  assert(days.length === 7, "zeven dagen")
  assert(
    days[0]!.status === "training" && days[0]!.waarde === "75",
    "echte belasting → training mét waarde",
  )
  assert(
    days[1]!.status === "leeg" && days[1]!.waarde === "—",
    "geen belasting → leeg met — (niets verzonnen)",
  )
  assert(
    days.every((d) => (d.status as string) !== "herstel"),
    "herstel wordt nooit afgeleid (geen eerlijke bron in weekTSS)",
  )
  assert(days.filter((d) => d.actief).length === 1, "precies één actieve dag")
  assert(days[5]!.actief === true, "vandaag is de actieve dag")
  assert(
    days.map((d) => d.label).join(",") === "Ma,Di,Wo,Do,Vr,Za,Zo",
    "Ma–Zo-volgorde blijft behouden",
  )
})

scenario("buildWeekDays: gepland werk kleurt alleen vandaag als training", () => {
  const week = [
    { date: "2026-07-24", tss: 0 },
    { date: "2026-07-25", tss: 0 },
  ]
  const met = buildWeekDays(week, "2026-07-25", true)
  assert(
    met[1]!.status === "training",
    "vandaag mét geplande training → training",
  )
  assert(met[1]!.waarde === "—", "waarde blijft eerlijk — (nog geen belasting)")
  assert(met[0]!.status === "leeg", "andere lege dagen blijven leeg")
  const zonder = buildWeekDays(week, "2026-07-25", false)
  assert(zonder[1]!.status === "leeg", "vandaag zonder plan blijft eerlijk leeg")
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
  assert(
    COMMERCIAL_COPY.trainingTitle === "Training van vandaag",
    "trainingskop exact",
  )
  assert(
    COMMERCIAL_COPY.trainingPrimaryMobile === "Training bekijken" &&
      COMMERCIAL_COPY.trainingPrimaryDesktop === "Training openen",
    "trainingsknoppen exact (mobiel/desktop)",
  )
  assert(
    COMMERCIAL_COPY.trainingSecondary === "Planning aanpassen",
    "secundaire trainingsactie exact",
  )
  assert(COMMERCIAL_COPY.weekTitle === "Deze week", "weekkop exact")
  assert(
    COMMERCIAL_COPY.weekEmpty === "Nog geen weekbelasting bekend.",
    "week-lege-toestand exact",
  )
  assert(
    COMMERCIAL_COPY.herstelTitle === "Herstel en gereedheid",
    "herstelkop exact",
  )
  assert(
    COMMERCIAL_COPY.onderbouwing === "Bekijk onderbouwing",
    "onderbouwing-uitklap exact",
  )
  assert(
    COMMERCIAL_COPY.geenSignalen === "Nog geen signalen voor vandaag.",
    "lege-signalen-tekst exact",
  )
  assert(
    COMMERCIAL_COPY.stateError === "Je toestand kon niet worden geladen." &&
      COMMERCIAL_COPY.trainingError === "Je training kon niet worden geladen.",
    "eerlijke foutteksten exact",
  )
  assert(COMMERCIAL_COPY.retry === "Opnieuw proberen", "herstelactie exact")
  assert(
    COMMERCIAL_COPY.seasonPlanLink === "Volledig plan bekijken",
    "planlink exact (chevron is een ds-icoon, geen unicode-teken)",
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
  assert(
    COMMERCIAL_COPY.trainingHref === "/train",
    "trainingsactie → bestaande trainflow (/train)",
  )
  assert(
    COMMERCIAL_COPY.trainingSecondaryHref === "/kalender",
    "planning aanpassen → bestaande kalenderflow (/kalender)",
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

// ── Presentatietoestand (CUX_02A — sfeerlaag) ────────────────────────────────
scenario("presentatietoestand is deterministisch (zelfde invoer → zelfde uitvoer)", () => {
  const inputs: PresentationInput[] = []
  for (const band of ["belastbaar", "solide", "wisselend", "kwetsbaar", null, "onzin"])
    for (const hasTodayWorkout of [true, false])
      for (const goalRaceIsToday of [true, false])
        inputs.push({ band, hasTodayWorkout, goalRaceIsToday })
  for (const input of inputs) {
    const a = derivePresentationState(input)
    const b = derivePresentationState({ ...input })
    assert(a === b, `niet deterministisch voor ${JSON.stringify(input)}`)
    assert(
      (PRESENTATION_STATES as readonly string[]).includes(a),
      `onbekende toestand ${a}`,
    )
  }
})

scenario("ontbrekende of onduidelijke toestand → neutraal (nooit gissen)", () => {
  const base = { hasTodayWorkout: false, goalRaceIsToday: false }
  assert(derivePresentationState({ band: null, ...base }) === "neutral", "null → neutral")
  assert(
    derivePresentationState({ band: undefined, ...base }) === "neutral",
    "undefined → neutral",
  )
  assert(
    derivePresentationState({ band: "onzin", ...base }) === "neutral",
    "onbekende band → neutral",
  )
  // "wisselend" is echt maar onduidelijk: kleur mag geen sterkere conclusie
  // suggereren dan de tekst — dus neutraal, óók met een geplande training.
  assert(
    derivePresentationState({ band: "wisselend", ...base }) === "neutral",
    "wisselend → neutral",
  )
  assert(
    derivePresentationState({
      band: "wisselend",
      hasTodayWorkout: true,
      goalRaceIsToday: false,
    }) === "neutral",
    "wisselend + training blijft neutral",
  )
})

scenario("presentatietoestand volgt de echte context, wedstrijddag gaat voor", () => {
  assert(
    derivePresentationState({
      band: "belastbaar",
      hasTodayWorkout: false,
      goalRaceIsToday: false,
    }) === "ready",
    "positieve band zonder training → ready",
  )
  assert(
    derivePresentationState({
      band: "solide",
      hasTodayWorkout: true,
      goalRaceIsToday: false,
    }) === "training",
    "positieve band mét training → training",
  )
  assert(
    derivePresentationState({
      band: "kwetsbaar",
      hasTodayWorkout: true,
      goalRaceIsToday: false,
    }) === "recovery",
    "kwetsbaar → recovery, ook met geplande training",
  )
  assert(
    derivePresentationState({
      band: "kwetsbaar",
      hasTodayWorkout: true,
      goalRaceIsToday: true,
    }) === "race",
    "hoofddoel vandaag gaat voor alles",
  )
  assert(
    derivePresentationState({
      band: null,
      hasTodayWorkout: false,
      goalRaceIsToday: true,
    }) === "race",
    "wedstrijddag ook zonder band",
  )
})

scenario("sfeerlaag kent geen alarm-/roodtoestand en verzint geen conclusies", () => {
  const states = PRESENTATION_STATES as readonly string[]
  assert(states.length === 5, "precies vijf toestanden")
  for (const bad of ["alarm", "critical", "danger", "warning", "error"]) {
    assert(!states.includes(bad), `verboden toestand ${bad}`)
  }
  // Kwetsbaar mag nooit iets luiders opleveren dan de bestaande tekst/pil.
  assert(
    derivePresentationState({
      band: "kwetsbaar",
      hasTodayWorkout: false,
      goalRaceIsToday: false,
    }) === "recovery",
    "kwetsbaar blijft rustig (recovery)",
  )
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
