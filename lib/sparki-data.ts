// Single source of truth. All three concepts render THIS exact data differently.

export type Trend = number[]

export const athlete = {
  name: "Marco Vel",
  discipline: "Road / Threshold Block",
  ftp: 342,
  weight: 68,
  wkg: 5.03,
}

export const readiness = {
  score: 87,
  delta: +4,
  state: "PRIMED",
}

export type Vital = {
  key: string
  label: string
  value: string
  unit: string
  delta: number
  trend: Trend
  // 0-1 normalized "health" of the metric for visual fills
  level: number
}

export const vitals: Vital[] = [
  {
    key: "hrv",
    label: "HRV",
    value: "112",
    unit: "ms",
    delta: +8,
    level: 0.86,
    trend: [78, 82, 80, 88, 91, 86, 95, 101, 98, 104, 109, 112],
  },
  {
    key: "sleep",
    label: "Sleep",
    value: "7:48",
    unit: "hrs",
    delta: +0.5,
    level: 0.78,
    trend: [6.2, 6.8, 7.1, 6.5, 7.0, 7.4, 7.2, 7.6, 7.1, 7.5, 7.7, 7.8],
  },
  {
    key: "fatigue",
    label: "Fatigue",
    value: "Low",
    unit: "tsb +6",
    delta: -3,
    level: 0.28,
    trend: [42, 48, 55, 60, 58, 52, 47, 40, 35, 30, 26, 22],
  },
  {
    key: "form",
    label: "Form",
    value: "+6",
    unit: "tsb",
    delta: +2,
    level: 0.82,
    trend: [-12, -8, -5, -2, 0, 1, 3, 2, 4, 5, 5, 6],
  },
  {
    key: "rhr",
    label: "Resting HR",
    value: "41",
    unit: "bpm",
    delta: -2,
    level: 0.9,
    trend: [46, 45, 45, 44, 43, 44, 43, 42, 42, 41, 41, 41],
  },
  {
    key: "load",
    label: "7d Load",
    value: "412",
    unit: "tss",
    delta: +38,
    level: 0.64,
    trend: [280, 300, 320, 340, 360, 350, 380, 390, 400, 405, 410, 412],
  },
]

// Mean-maximal power curve (watts across durations)
export const powerCurve = {
  durations: ["5s", "15s", "1m", "5m", "8m", "20m", "60m"],
  watts: [1180, 980, 640, 412, 388, 360, 318],
  // peak this season vs today
  peak: [1240, 1020, 668, 430, 402, 372, 330],
}

// Recovery / readiness trend over last 14 days
export const recoveryTrend: Trend = [
  62, 58, 65, 71, 68, 74, 70, 66, 73, 79, 81, 84, 83, 87,
]

// Today's prescribed workout, normalized 0-1 intensity per block
export const intervals = {
  title: "Threshold 4 × 8",
  duration: "1h 24m",
  tss: 96,
  blocks: [
    { z: 1, w: 0.32, label: "WU" },
    { z: 4, w: 0.92, label: "T1" },
    { z: 2, w: 0.45, label: "R" },
    { z: 4, w: 0.94, label: "T2" },
    { z: 2, w: 0.45, label: "R" },
    { z: 4, w: 0.95, label: "T3" },
    { z: 2, w: 0.45, label: "R" },
    { z: 4, w: 0.97, label: "T4" },
    { z: 1, w: 0.3, label: "CD" },
  ],
}

export type AiSignal = {
  kind: "opportunity" | "risk" | "performance" | "recovery"
  label: string
  headline: string
  detail: string
}

export const aiSignals: AiSignal[] = [
  {
    kind: "opportunity",
    label: "Today's Opportunity",
    headline: "Your system is primed for a threshold breakthrough.",
    detail:
      "HRV is +8ms above your 30-day baseline and form has crossed positive. Conditions align for a personal best on the 20-minute effort.",
  },
  {
    kind: "risk",
    label: "Risk Watch",
    headline: "Hydration debt detected from yesterday.",
    detail:
      "Resting HR recovered fully, but overnight respiration suggests mild dehydration. Front-load 500ml before the first interval.",
  },
  {
    kind: "performance",
    label: "Expected Performance",
    headline: "Projected 20-min power: 364–372W.",
    detail:
      "Based on current freshness, recent load, and HRV stability, Sparki forecasts a 2–4% uplift over your last threshold test.",
  },
  {
    kind: "recovery",
    label: "Recovery Status",
    headline: "Fully recovered. Green to push.",
    detail:
      "Parasympathetic recovery is complete and muscular fatigue markers have cleared. No accumulated stress flags.",
  },
]

/* ─────────────────────────  TRAIN  ───────────────────────── */

// Today's training zones, derived from FTP.
export const zones = [
  { z: 1, name: "Herstel", power: "≤ 188W", hr: "≤ 118", color: "rgba(120,210,230,0.22)" },
  { z: 2, name: "Duur", power: "189–256W", hr: "119–142", color: "rgba(120,210,230,0.4)" },
  { z: 3, name: "Tempo", power: "257–307W", hr: "143–158", color: "rgba(120,210,230,0.6)" },
  { z: 4, name: "Threshold", power: "308–359W", hr: "159–171", color: "rgba(120,210,230,0.95)" },
  { z: 5, name: "VO2max", power: "≥ 360W", hr: "≥ 172", color: "rgba(170,235,248,1)" },
]

// The headline target for today's key efforts.
export const target = {
  power: "324–342W",
  hr: "162–171 bpm",
  cadence: "90–95 rpm",
  zone: 4,
}

export const route = {
  name: "Heuvelrug Loop",
  distance: "58 km",
  elevation: "640 m",
  surface: "Asfalt",
  status: "Klaar",
  // normalized elevation profile points
  profile: [40, 52, 78, 120, 96, 62, 138, 176, 132, 90, 68, 112, 58, 34],
  climbs: [
    { name: "Amerongse Berg", length: "1.4 km", grade: "6.2%" },
    { name: "Posbank", length: "2.1 km", grade: "4.8%" },
  ],
  nav: [
    { km: "0.0", dir: "Start", note: "Vertrek vanaf Maartensdijk" },
    { km: "12.4", dir: "Rechtsaf", note: "Aanloop Amerongse Berg" },
    { km: "31.0", dir: "Linksaf", note: "Posbank beklimming" },
    { km: "58.0", dir: "Finish", note: "Terug bij start" },
  ],
}

export const fueling = [
  { t: "−15 min", kind: "drink", text: "500 ml met elektrolyten" },
  { t: "T1", kind: "fuel", text: "1 gel vóór eerste interval" },
  { t: "R2", kind: "drink", text: "150 ml water" },
  { t: "T3", kind: "fuel", text: "1 gel · 25 g koolhydraten" },
  { t: "CD", kind: "drink", text: "Aanvullen: 750 ml" },
] as const

export const prep = [
  { label: "Bandenspanning", value: "6.2 bar", done: true },
  { label: "Vermogensmeter", value: "Gekalibreerd", done: true },
  { label: "Di2 accu", value: "82%", done: true },
  { label: "Weer", value: "14° · ZW 12 km/u", done: true },
  { label: "Bidons", value: "2 × vullen", done: false },
]

/* ─────────────────────────  FEED  ───────────────────────── */

export type FeedItem = {
  id: string
  type: "coach" | "team" | "club" | "race" | "ai" | "comment" | "video"
  author: string
  time: string
  title: string
  body: string
  meta?: string
}

export const feed: FeedItem[] = [
  {
    id: "f1",
    type: "coach",
    author: "Coach Daan",
    time: "08:12",
    title: "Plan aangepast voor donderdag",
    body: "Ik heb je VO2-blok verplaatst naar donderdag. Vandaag volledig op threshold focussen.",
    meta: "Trainingsplan",
  },
  {
    id: "f2",
    type: "ai",
    author: "Sparki AI",
    time: "07:40",
    title: "Readiness +4 sinds gisteren",
    body: "Je HRV is hersteld boven baseline. Groen licht voor de volledige belasting.",
    meta: "Analyse",
  },
  {
    id: "f3",
    type: "team",
    author: "Team Vermeer",
    time: "Gisteren",
    title: "Selectie Amstel Gold bekend",
    body: "Je staat in de voorselectie. Bevestiging volgt na het testweekend.",
    meta: "Team",
  },
  {
    id: "f4",
    type: "video",
    author: "Sparki Academy",
    time: "Gisteren",
    title: "Threshold-techniek: ademhaling",
    body: "Korte analyse over ademcadans tijdens lange threshold-blokken.",
    meta: "Video · 6:12",
  },
  {
    id: "f5",
    type: "race",
    author: "KNWU",
    time: "2 dagen",
    title: "Inschrijving Ronde van Utrecht open",
    body: "Categorie Elite/Beloften. Sluiting inschrijving over 9 dagen.",
    meta: "Wedstrijd · 12 apr",
  },
  {
    id: "f6",
    type: "comment",
    author: "Coach Daan",
    time: "2 dagen",
    title: "Reactie op Sweet Spot 3×12",
    body: "Mooie uitvoering, vermogen bleef stabiel. Volgende keer cadans iets omhoog.",
    meta: "Training",
  },
  {
    id: "f7",
    type: "club",
    author: "WV Maartensdijk",
    time: "3 dagen",
    title: "Clubrit zondag · 09:00",
    body: "Tempo-rit van 90 km richting de Heuvelrug. Verzamelen bij het clubhuis.",
    meta: "Club",
  },
]

/* ─────────────────────────  LAB  ───────────────────────── */

// FTP development across the season (watts).
export const ftpHistory = {
  months: ["Sep", "Okt", "Nov", "Dec", "Jan", "Feb", "Mrt"],
  values: [318, 322, 325, 330, 334, 338, 342],
}

// Season form model — fitness (CTL), fatigue (ATL), form (TSB).
export const season = {
  weeks: ["W1", "W3", "W5", "W7", "W9", "W11"],
  ctl: [58, 62, 66, 71, 74, 78],
  atl: [60, 70, 64, 82, 70, 72],
  tsb: [-2, -8, 2, -11, 4, 6],
}

export const readinessHistory: Trend = recoveryTrend

/* ─────────────────────────  YOU  ───────────────────────── */

export const goals = [
  { name: "Amstel Gold Race", date: "12 apr", progress: 0.72 },
  { name: "FTP 350W", date: "Q2", progress: 0.84 },
  { name: "10.000 km seizoen", date: "Dec", progress: 0.41 },
]

export const youGroups = [
  {
    label: "Atleet",
    rows: [
      { k: "Profiel", v: "Marco Vel" },
      { k: "Atleetprofiel", v: "Elite · 5.03 W/kg" },
      { k: "Sportprofiel", v: "Weg · Threshold" },
      { k: "Doelen", v: "3 actief" },
    ],
  },
  {
    label: "Setup",
    rows: [
      { k: "Materiaal", v: "2 fietsen · 4 sensoren" },
      { k: "Voeding", v: "Koolhydraat-strategie" },
      { k: "Gekoppelde apps", v: "Garmin · Strava · Wahoo" },
    ],
  },
  {
    label: "Account",
    rows: [
      { k: "Gezondheid", v: "Baseline ingesteld" },
      { k: "Privacy", v: "Privé" },
      { k: "Voorkeuren", v: "NL · Metrisch" },
    ],
  },
]
