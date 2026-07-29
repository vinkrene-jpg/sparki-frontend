// Centrale Analyse-omgeving (/analyse) — lichte datawerkruimte binnen de
// donkere app-shell. Hergebruikt uitsluitend bestaande hooks, engines en
// berekeningen; geen nieuwe formules, geen mock- of seeddata.

// ── Semantische kleurset (SSOT voor alle grafieken) ──────────────────────────
// Elke kleur heeft één vaste betekenis. Nooit voor decoratie.
export const CHART = {
  ctl:     "#0ea5e9", // sky-500    — fitheid (CTL)
  atl:     "#f97316", // orange-500 — vermoeidheid (ATL)
  tsbPos:  "#22c55e", // green-500  — positieve vorm (TSB ≥ 0)
  tsbNeg:  "#ef4444", // red-500    — negatieve vorm (TSB < 0)
  volume:  "#8b5cf6", // violet-500 — trainingsvolume
  ftp:     "#06b6d4", // cyan-500   — vermogen / FTP
  goal:    "#10b981", // emerald-500 — doelen
  race:    "#ec4899", // pink-500   — wedstrijden
  warn:    "#f59e0b", // amber-500  — waarschuwing
  missing: "#94a3b8", // slate-400  — ontbrekend / onzeker
  verwacht: "#9333ea", // purple-600 — doelscenario / verwachting (vaste kleur)
} as const

export function tsbKleur(tsb: number | null | undefined): string {
  if (tsb == null) return CHART.missing
  return tsb >= 0 ? CHART.tsbPos : CHART.tsbNeg
}
