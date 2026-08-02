// Centrale Analyse-omgeving (/analyse) — donkere datawerkruimte binnen de
// gedeelde cinematic app-shell (ScreenShell). Hergebruikt uitsluitend
// bestaande hooks, engines en berekeningen; geen nieuwe formules, geen mock-
// of seeddata.

// ── Semantische kleurset (SSOT voor alle grafieken) ──────────────────────────
// Elke kleur heeft één vaste betekenis. Nooit voor decoratie.
// Design-spec 29 jul 2026 (TrainingPeaks/WHOOP-niveau): verzadigde lijnen,
// CTL blijft ALTIJD de primaire lijn; ATL mag verzadigd maar krijgt minder
// visueel gewicht dan CTL en nooit een zwaardere area-fill.
export const CHART = {
  ctl:     "#2563EB", // blue-600   — fitheid (CTL), primaire lijn
  // Area-fill onder de CTL-lijn: aflopende gradient (Robinhood/Stripe-stijl,
  // addendum 30 jul 2026) — vol bovenaan, uitlopend naar 0 onderaan. Een
  // vlakke lage dekking oogt vlak; deze twee stops voeden de SVG-gradient.
  ctlFillTopOpacity: 0.28,
  ctlFillBottomOpacity: 0,
  atl:     "#EA580C", // orange-600 — vermoeidheid (ATL), minder gewicht dan CTL
  tsbPos:  "#16A34A", // green-600  — positieve vorm (TSB ≥ 0)
  tsbNeg:  "#DC2626", // red-600    — sterk negatieve vorm
  tsbNegLicht: "#FCA5A5", // red-300 — licht negatieve vorm
  grid:    "rgba(255,255,255,0.08)", // gridlijnen op donkere schil — laag-alpha wit, alleen horizontaal
  as:      "rgba(255,255,255,0.45)", // as-labels/datums op donkere schil — leesbaar wit, niet vaag
  volume:  "#8b5cf6", // violet-500 — trainingsvolume
  ftp:     "#06b6d4", // cyan-500   — vermogen / FTP
  goal:    "#10b981", // emerald-500 — doelen
  race:    "#ec4899", // pink-500   — wedstrijden
  warn:    "#f59e0b", // amber-500  — waarschuwing
  missing: "#94a3b8", // slate-400  — ontbrekend / onzeker
  verwacht: "#9333ea", // purple-600 — doelscenario / verwachting (vaste kleur)
} as const

// Tekstkleur bij een TSB-waarde (stat-tegels, tooltips): altijd de verzadigde
// variant — de lichte balk-tint is als tekst onleesbaar.
export function tsbKleur(tsb: number | null | undefined): string {
  if (tsb == null) return CHART.missing
  return tsb >= 0 ? CHART.tsbPos : CHART.tsbNeg
}

// Balkkleur met intensiteits-gradatie (spec §4): licht → donker naarmate de
// waarde verder van 0 ligt. Grens −10: klassieke "vermoeid maar productief"
// zone blijft licht, daaronder wordt het signaal zwaar.
export function tsbBalkKleur(tsb: number | null | undefined): string {
  if (tsb == null) return CHART.missing
  if (tsb >= 0) return CHART.tsbPos
  return tsb > -10 ? CHART.tsbNegLicht : CHART.tsbNeg
}

// ── Wegdek-/oppervlaktekleuren (routeplanner ondergrond) ─────────────────────
// Categoriale reeks voor wegtype-analyse (route-surfaces.tsx). Elke kleur heeft
// een vaste betekenis — nooit hergebruiken voor andere series. Bron:
// OpenStreetMap surface/highway tags, BGT-verificatie.
export const SURFACE_KLEUREN: Record<string, string> = {
  asfalt: "#5aa7e8",            // Asfalt — glad wegdek
  verhard_fietspad: "#4ecbc4",  // Verhard fietspad — gescheiden infra
  klinkers: "#c9a35a",          // Klinkers — hobbelig verhard
  kasseien: "#b0742f",          // Kasseien — ruw historisch wegdek
  compact_gravel: "#9aa86b",    // Compact gravel — aangestampt grind
  los_gravel: "#c2b280",        // Los gravel — losse steenslag
  onverhard: "#a5713f",         // Onverhard — zand/aarde
  bospad: "#4f9e5a",            // Bospad — natuurlijk pad
  singletrack: "#8a5fc9",       // Singletrack — smal MTB-spoor
  onbekend: "#8b93a5",          // Onbekend — geen OSM surface-tag
} as const
