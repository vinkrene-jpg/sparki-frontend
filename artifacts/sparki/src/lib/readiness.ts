// Readiness — the single source of truth for turning a daily check-in into a
// readiness score + state + plain-Dutch advice. Pure and deterministic.
//
// Golf 26: de rekenkern is geünificeerd met de backend (api-server
// lib/sharing.ts computeReadiness): zelfde /10-schalen, zelfde gemiddelde,
// zelfde grenzen (fresh ≥ 67, ok ≥ 40, tired < 40). Frontend en backend kunnen
// daardoor nooit een tegenstrijdig herstelbeeld geven.

export type Metrics = {
  feelScore?: number | null
  sleepQuality?: number | null
  fatigueScore?: number | null
  hrv?: number | null
} | null

export type Readiness = {
  score: number
  state: "PRIMED" | "GOED" | "MATIG" | "LAAG"
  advice: string
  detail: string
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function computeReadiness(m: Metrics): Readiness | null {
  if (!m) return null
  // Identiek aan backend: feel/fatigue/sleep zijn 1–10-zelfrapportages.
  const parts: number[] = []
  if (m.feelScore != null) parts.push(clamp01(m.feelScore / 10))
  if (m.fatigueScore != null) parts.push(clamp01(1 - m.fatigueScore / 10))
  if (m.sleepQuality != null) parts.push(clamp01(m.sleepQuality / 10))
  if (parts.length === 0) return null
  const score = Math.round((parts.reduce((s, v) => s + v, 0) / parts.length) * 100)
  // Backendgrenzen: ≥67 fris, ≥40 oké, <40 vermoeid. PRIMED is een
  // presentatielaag bovenop "fris" voor uitgesproken goede dagen.
  const state =
    score >= 80 ? "PRIMED"
    : score >= 67 ? "GOED"
    : score >= 40 ? "MATIG"
    : "LAAG"
  const advice =
    state === "PRIMED" ? "Training handhaven — condities zijn ideaal"
    : state === "GOED" ? "Ga door — pas intensiteit aan indien nodig"
    : state === "MATIG" ? "Overweeg lagere intensiteit vandaag"
    : "Rust aanbevolen — herstel eerst"
  const detail =
    state === "PRIMED"
      ? "Je systeem is fris genoeg voor de volledige belasting. Geen aanpassing nodig."
      : state === "GOED"
        ? "Goed herstel zichtbaar. Luister naar je lichaam tijdens de opbouw."
        : state === "MATIG"
          ? "Verlaag de doelbelasting met 10–15%. Matig herstel."
          : "Herstel heeft prioriteit. Actieve recovery of rust is de beste keuze."
  return { score, state, advice, detail }
}
