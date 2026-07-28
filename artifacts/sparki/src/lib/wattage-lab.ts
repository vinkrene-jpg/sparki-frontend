// Wattage-lab — deterministisch "knutsel"-model voor eigen vermogensdoelen.
// Geen verzonnen analyse: elk oordeel is een transparante vuistregel bovenop
// de éigen beste waarden van de atleet (power bests + FTP), met harde
// fysiologische plafonds zodat onmogelijke doelen (1000 W over 60 min) eerlijk
// "onhaalbaar" heten. Zonder eigen basiswaarde is er géén oordeel — alleen de
// eerlijke melding dat er eerst echte vermogensdata nodig is.

export type LabDuurKey = "5" | "60" | "300" | "1200" | "ftp"

export type LabDuur = {
  key: LabDuurKey
  label: string
  /** Duur in seconden (FTP ≈ 3600 voor de plafondcheck). */
  seconden: number
  /** Absoluut wereldtop-plafond in W/kg voor deze duur (vuistregel, ruim). */
  plafondWkg: number
  /**
   * Realistische verbetering in % t.o.v. je huidige beste, met 8–12 weken
   * gericht trainen (vuistregel voor een getrainde amateur).
   */
  kortetermijnPct: number
  /** Verwachte vooruitgang in % per trainingsweek bij gerichte focus. */
  pctPerWeek: number
  /** Wat je ervoor moet doen — vaste, concrete aanpak (geen AI-tekst). */
  aanpak: string[]
}

export const LAB_DUREN: LabDuur[] = [
  {
    key: "5",
    label: "5 sec sprint",
    seconden: 5,
    plafondWkg: 24,
    kortetermijnPct: 8,
    pctPerWeek: 0.8,
    aanpak: [
      "2× per week sprinttraining: 5–8 sprints van 10–15 sec, volledig uitgerust starten (4–5 min pauze).",
      "1× per week kracht: zware squats/legpress of heuvelsprints uit stilstand.",
      "Sprint altijd fris — sprinten op vermoeide benen traint techniek, geen piekvermogen.",
    ],
  },
  {
    key: "60",
    label: "1 minuut",
    seconden: 60,
    plafondWkg: 11.5,
    kortetermijnPct: 10,
    pctPerWeek: 1.0,
    aanpak: [
      "2× per week anaerobe intervallen: 4–6 × 1 min voluit, 4–6 min rust ertussen.",
      "1× per week 30/30's (30 sec hard / 30 sec rust, 2 series van 8) als aanvulling.",
      "Bouw per week maximaal één herhaling per serie op; kwaliteit boven kwantiteit.",
    ],
  },
  {
    key: "300",
    label: "5 minuten",
    seconden: 300,
    plafondWkg: 8.5,
    kortetermijnPct: 12,
    pctPerWeek: 0.9,
    aanpak: [
      "2× per week VO2max-blokken: 5 × 4–5 min op 105–115% van je doelvermogen aan herhaling, 4–5 min rust.",
      "Houd de rest van de week rustig (duurritten) zodat je deze blokken écht vol kunt rijden.",
      "Na 3 weken belasten 1 week ontlasten — de winst komt in de herstelweek.",
    ],
  },
  {
    key: "1200",
    label: "20 minuten",
    seconden: 1200,
    plafondWkg: 6.8,
    kortetermijnPct: 8,
    pctPerWeek: 0.6,
    aanpak: [
      "2–3× per week drempelwerk: 2–3 × 12–20 min op 88–95% van je 20-min-doel (sweet spot tot drempel).",
      "1 lange duurrit per week voor de onderbouw (2u+ rustig).",
      "Verhoog het blokvermogen pas als je alle blokken stabiel vol rijdt.",
    ],
  },
  {
    key: "ftp",
    label: "FTP (±60 min)",
    seconden: 3600,
    plafondWkg: 6.4,
    kortetermijnPct: 8,
    pctPerWeek: 0.5,
    aanpak: [
      "2× per week sweet spot/drempel: 2–3 × 15–20 min op 88–94% FTP, later 2 × 20 min op 95–100%.",
      "1 lange duurrit per week (2–3 u rustig) — de motor onder je drempel.",
      "Consistentie wint: 8–12 weken zonder gaten doet meer dan één zware week.",
    ],
  },
]

// Bovengrens voor lichaamsgewicht in de "niemand kan dit"-check wanneer het
// gewicht van de atleet onbekend is: zwaarder dan dit is voor deze duren geen
// realistisch wielrennersgewicht, dus alles boven plafondWkg × dit gewicht is
// voor íedereen onhaalbaar (1000 W over 60 min blijft dan eerlijk onhaalbaar).
const MAX_AANNAME_GEWICHT_KG = 110

export type LabOordeel =
  | "geen_basis" // geen eigen waarde voor deze duur — geen oordeel mogelijk
  | "al_bereikt" // doel ligt op of onder je huidige beste
  | "binnen_bereik" // haalbaar met 8–12 weken gericht trainen
  | "ambitieus" // seizoensdoel: haalbaar, maar reken op een half jaar of meer
  | "buiten_bereik" // te ver van je huidige niveau — eerst een tussenstap
  | "onhaalbaar" // boven het menselijke plafond voor deze duur

export type LabResultaat = {
  oordeel: LabOordeel
  /** Verschil t.o.v. huidig beste in % (null zonder basis). */
  deltaPct: number | null
  /** Geschat aantal weken gerichte training (alleen bij haalbare doelen). */
  weken: number | null
  /** Eerlijke tussenstap in watt wanneer het doel buiten bereik is. */
  tussenstapWatts: number | null
  /** Absoluut plafond in watt voor deze duur (alleen met bekend gewicht exact). */
  plafondWatts: number | null
  /** Of het plafond op eigen gewicht is gebaseerd of op de ruime aanname. */
  plafondBron: "gewicht" | "aanname"
  /** Doel in W/kg (alleen met bekend gewicht). */
  doelWkg: number | null
  /** Volledige uitleg in gewone taal — de verantwoording van het oordeel. */
  uitleg: string
  /** Concrete trainingsaanpak (alleen bij een haalbaar/ambitieus doel). */
  aanpak: string[]
}

function rond(n: number): number {
  return Math.round(n)
}

export function computeWattageLab(input: {
  duur: LabDuur
  doelWatts: number
  huidigWatts: number | null
  weightKg: number | null
}): LabResultaat {
  const { duur, huidigWatts, weightKg } = input
  // Defensief: een niet-eindig of onzinnig doel wordt geclampt zodat er nooit
  // NaN in oordeel of uitleg terechtkomt (UI valideert al, lib ook).
  const doelWatts = Number.isFinite(input.doelWatts)
    ? Math.max(1, Math.round(input.doelWatts))
    : 1

  const plafondBron: "gewicht" | "aanname" =
    weightKg != null && weightKg > 0 ? "gewicht" : "aanname"
  const plafondWatts = rond(
    duur.plafondWkg * (plafondBron === "gewicht" ? (weightKg as number) : MAX_AANNAME_GEWICHT_KG),
  )
  const doelWkg =
    weightKg != null && weightKg > 0
      ? Math.round((doelWatts / weightKg) * 10) / 10
      : null

  // 1. Menselijk plafond — geldt óók zonder eigen basiswaarde.
  if (doelWatts > plafondWatts) {
    const grensTekst =
      plafondBron === "gewicht"
        ? `Bij jouw gewicht (${weightKg} kg) is dat ${doelWkg} W/kg, terwijl de absolute wereldtop over ${duur.label.toLowerCase()} rond ${duur.plafondWkg} W/kg zit (≈ ${plafondWatts} W voor jou).`
        : `Zelfs voor een zeer zware topsporter ligt de grens over deze duur rond ${plafondWatts} W (wereldtop ≈ ${duur.plafondWkg} W/kg).`
    return {
      oordeel: "onhaalbaar",
      deltaPct: huidigWatts != null && huidigWatts > 0 ? rond(((doelWatts - huidigWatts) / huidigWatts) * 100) : null,
      weken: null,
      tussenstapWatts: null,
      plafondWatts,
      plafondBron,
      doelWkg,
      uitleg: `Dit doel is voor niemand haalbaar. ${grensTekst}`,
      aanpak: [],
    }
  }

  // 2. Zonder eigen basiswaarde geen oordeel — eerlijk zeggen wat er mist.
  if (huidigWatts == null || huidigWatts <= 0) {
    return {
      oordeel: "geen_basis",
      deltaPct: null,
      weken: null,
      tussenstapWatts: null,
      plafondWatts,
      plafondBron,
      doelWkg,
      uitleg:
        "Er is nog geen eigen beste waarde voor deze duur. Rijd eerst een rit met een vermogensmeter (of een echte test), dan kan het lab je doel tegen je eigen niveau afzetten.",
      aanpak: [],
    }
  }

  const deltaPct = ((doelWatts - huidigWatts) / huidigWatts) * 100

  if (deltaPct <= 0) {
    return {
      oordeel: "al_bereikt",
      deltaPct: rond(deltaPct),
      weken: null,
      tussenstapWatts: null,
      plafondWatts,
      plafondBron,
      doelWkg,
      uitleg: `Je beste waarde over deze duur is al ${huidigWatts} W — dit doel heb je dus al bereikt. Schuif hoger om te zien wat er nog in zit.`,
      aanpak: [],
    }
  }

  // 3. Haalbaarheid t.o.v. eigen niveau (vuistregels, transparant benoemd).
  const kort = duur.kortetermijnPct
  const weken = Math.min(40, Math.max(4, Math.ceil(deltaPct / duur.pctPerWeek)))

  if (deltaPct <= kort) {
    return {
      oordeel: "binnen_bereik",
      deltaPct: rond(deltaPct),
      weken,
      tussenstapWatts: null,
      plafondWatts,
      plafondBron,
      doelWkg,
      uitleg: `+${rond(deltaPct)}% t.o.v. je huidige beste (${huidigWatts} W). Dat valt binnen de vuistregel van ~${kort}% verbetering met gericht trainen — reken op zo'n ${weken} weken consequent werk.`,
      aanpak: duur.aanpak,
    }
  }

  if (deltaPct <= kort * 2) {
    return {
      oordeel: "ambitieus",
      deltaPct: rond(deltaPct),
      weken,
      tussenstapWatts: null,
      plafondWatts,
      plafondBron,
      doelWkg,
      uitleg: `+${rond(deltaPct)}% t.o.v. je huidige beste (${huidigWatts} W). Dat is meer dan de ~${kort}% die je in één trainingsblok mag verwachten — zie dit als seizoensdoel van grofweg ${weken} weken, met tussentijdse tests.`,
      aanpak: duur.aanpak,
    }
  }

  const tussenstap = rond(huidigWatts * (1 + kort / 100))
  return {
    oordeel: "buiten_bereik",
    deltaPct: rond(deltaPct),
    weken: null,
    tussenstapWatts: tussenstap,
    plafondWatts,
    plafondBron,
    doelWkg,
    uitleg: `+${rond(deltaPct)}% in één keer is vanaf je huidige beste (${huidigWatts} W) niet realistisch — dat is ver boven wat training in een seizoen oplevert. Een eerlijke eerste tussenstap is ${tussenstap} W (≈ +${kort}%).`,
    aanpak: [],
  }
}

export const LAB_OORDEEL_LABEL: Record<LabOordeel, string> = {
  geen_basis: "Nog geen basis",
  al_bereikt: "Al bereikt",
  binnen_bereik: "Binnen bereik",
  ambitieus: "Ambitieus",
  buiten_bereik: "Buiten bereik (nu)",
  onhaalbaar: "Onhaalbaar",
}
