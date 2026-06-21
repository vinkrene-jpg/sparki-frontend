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
