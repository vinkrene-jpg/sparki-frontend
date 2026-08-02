// Centrale Analyse-omgeving (/analyse) — datawerkruimte binnen de gedeelde
// app-shell (ScreenShell). Hergebruikt uitsluitend bestaande hooks, engines en
// berekeningen; geen nieuwe formules, geen mock- of seeddata.
//
// LICHT_THEMA_01 LT-03: de grafieken staan nu op een LICHTE ondergrond. As-
// labels en rasterlijnen zijn daarom doorschijnend DONKER (waren doorschijnend
// wit voor donker) en de reekskleuren zijn geverifieerd op wit — voldoende
// contrast en kleurenblind-veilig (verschillende tint én helderheid per reeks,
// nooit alleen kleur als betekenisdrager).

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
  tsbPos:  "#15803D", // green-700  — positieve vorm (TSB ≥ 0), donkerder voor wit
  tsbNeg:  "#DC2626", // red-600    — sterk negatieve vorm
  tsbNegLicht: "#EF7B7B", // red-400-getint — licht negatieve vorm, leesbaar op wit
  grid:    "rgba(20,24,31,0.28)", // gridlijnen op LICHTE schil — LT-13: alpha 0.10→0.28 (≈1.85:1 op card). Bewust ONDER 3:1: het raster is decoratief; de leesbare laag zijn de as-labels (`as`, ≥4.5:1). Zie contrast-meting.md.
  as:      "rgba(20,24,31,0.62)", // as-labels/datums op LICHTE schil — leesbaar donker, niet vaag
  volume:  "#7C3AED", // violet-600 — trainingsvolume, donkerder voor wit
  ftp:     "#0891B2", // cyan-600   — vermogen / FTP, donkerder voor wit
  goal:    "#059669", // emerald-600 — doelen, donkerder voor wit
  race:    "#DB2777", // pink-600   — wedstrijden, donkerder voor wit
  warn:    "#D97706", // amber-600  — waarschuwing, donkerder voor wit
  missing: "#64748B", // slate-500  — ontbrekend / onzeker, leesbaar op wit
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
// LICHT_THEMA_01 LT-03: geverifieerd op LICHTE ondergrond — de lichtste tinten
// zijn iets verdiept zodat elke categorie leesbaar contrasteert op wit terwijl
// de onderlinge herkenbaarheid (tint per wegtype) behouden blijft.
export const SURFACE_KLEUREN: Record<string, string> = {
  asfalt: "#2f7fd0",            // Asfalt — glad wegdek
  verhard_fietspad: "#159e96",  // Verhard fietspad — gescheiden infra
  klinkers: "#a97f2f",          // Klinkers — hobbelig verhard
  kasseien: "#9c5f1f",          // Kasseien — ruw historisch wegdek
  compact_gravel: "#78894a",    // Compact gravel — aangestampt grind
  los_gravel: "#9c8a4e",        // Los gravel — losse steenslag
  onverhard: "#8a5a2c",         // Onverhard — zand/aarde
  bospad: "#3d8449",            // Bospad — natuurlijk pad
  singletrack: "#7343b8",       // Singletrack — smal MTB-spoor
  onbekend: "#6b7385",          // Onbekend — geen OSM surface-tag
} as const
