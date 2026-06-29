// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for WHICH surface owns WHICH kind of insight, so the
// same insight never renders twice ("grafiek-eerst, minder tekst" ontdubbeling).
//
// Two systems derive insights from the SAME observation set:
//   - the daily coach (/api/coach/analysis)  → a synthesized day-advies block
//   - the over-time observations (/api/ai/observations) → grafiek-eerst kaarten
//
// Ownership (each insight appears once, on one surface):
//   - daily_advice      → the coach surface (CoachAnalysisCard). It owns ONLY
//                         the synthesized aanbeveling (intensiteit, kop, acties,
//                         "waarom dit advies"). It must NOT re-render the trend
//                         observations as prose — that is where the duplicate
//                         text came from.
//   - trend_observation → the graph-card surface (GraphInsightCard on Training
//                         "Wat over tijd opvalt" + Profiel/Core). Sole owner of
//                         the HRV/rusthart/slaap/FTP/CTL/vorm/frequentie reads,
//                         each leading with its real chart.
// ─────────────────────────────────────────────────────────────────────────────

export type InsightDomain = "daily_advice" | "trend_observation"
export type InsightSurface = "coach_daily" | "graph_cards"

export const INSIGHT_OWNER: Record<InsightDomain, InsightSurface> = {
  daily_advice: "coach_daily",
  trend_observation: "graph_cards",
}

export function ownerOf(domain: InsightDomain): InsightSurface {
  return INSIGHT_OWNER[domain]
}

/** True only if the coach surface owns trend observations — it never should. */
export function coachOwnsObservations(): boolean {
  return ownerOf("trend_observation") === "coach_daily"
}

// CoachAnalysis fields that are PROSE re-statements of the trend observations.
// They belong to the graph-card surface, so the coach card must render none of
// them. The dedup guard test asserts the coach card references none of these
// (`data.<field>`), catching a regression by test instead of by eye.
export const OBSERVATION_PROSE_FIELDS = [
  "watValtOp",
  "patronen",
  "beterDanVerwacht",
  "verdientAandacht",
] as const
