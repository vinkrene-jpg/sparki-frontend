// Readiness — the single source of truth for turning a daily check-in into a
// readiness score + state + plain-Dutch advice. Pure and deterministic so both
// the homepage reactor (ReactorReadiness) and the day-advice engine share one
// definition and can never diverge.

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

export function computeReadiness(m: Metrics): Readiness | null {
  if (!m) return null
  const feel = m.feelScore != null ? m.feelScore / 5 : null
  const sleep = m.sleepQuality != null ? m.sleepQuality / 5 : null
  const fatigue = m.fatigueScore != null ? (10 - m.fatigueScore) / 9 : null
  const parts = [feel, sleep, fatigue].filter((v): v is number => v !== null)
  if (parts.length === 0) return null
  const score = Math.round((parts.reduce((s, v) => s + v, 0) / parts.length) * 100)
  const state =
    score >= 80 ? "PRIMED"
    : score >= 65 ? "GOED"
    : score >= 50 ? "MATIG"
    : "LAAG"
  const advice =
    score >= 80 ? "Training handhaven — condities zijn ideaal"
    : score >= 65 ? "Ga door — pas intensiteit aan indien nodig"
    : score >= 50 ? "Overweeg lagere intensiteit vandaag"
    : "Rust aanbevolen — herstel eerst"
  const detail =
    score >= 80
      ? "Je systeem is fris genoeg voor de volledige belasting. Geen aanpassing nodig."
      : score >= 65
        ? "Goed herstel zichtbaar. Luister naar je lichaam tijdens de opbouw."
        : score >= 50
          ? "Verlaag de doelbelasting met 10–15%. Matig herstel."
          : "Herstel heeft prioriteit. Actieve recovery of rust is de beste keuze."
  return { score, state, advice, detail }
}
