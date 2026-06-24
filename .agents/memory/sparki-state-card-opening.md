---
name: Sparki State Card opening (Vandaag L1)
description: Why the glanceable metrics live in the State Engine and how the drill-in dedupe works on the Vandaag opening.
---

# Sparki State Card opening (Vandaag L1)

The Vandaag opening is a personal, inviting hero — greeting + living Core +
status + a glanceable real-data row + Sparki-voiced advice — NOT a stack of
identical frosted cards. Feedback that triggered this: "opening weinig
uitnodigend", "sporter wil data resultaten zien en doorklikken", "ik mis de
interactieve Sparki-persoonlijkheid, alleen kaarten".

## Glanceable metrics come from the State Engine, not the dashboard
`SparkiState.metrics` (Vorm/Conditie/Belasting from real `m.load` tsb/ctl/atl) is
produced by the engine and read via `/api/state`.
**Why:** the State Card is deliberately surface-agnostic (any surface can mount
it); coupling it to `useAthleteDashboard` would break that. The engine already
owns the real load, so the numbers stay self-consistent (Vorm = Conditie −
Belasting) and honest.
**How to apply:** never fetch dashboard data inside the State Card to show
numbers — extend `SparkiState` instead. `buildMetrics` returns `[]` when
`loadSessions < 1` (no fabricated zeros).

## Never two routes to the same drill-in
When real metrics exist, the metrics card itself is the tappable drill-in to the
full analysis; the standalone "Volledige analyse" button then renders ONLY when
`metrics.length === 0`.
**Why:** an earlier round already removed a duplicate check-in; duplicated
affordances to the same destination read as clutter.
**How to apply:** gate the fallback drill-in on `onShowDetails && metrics.length === 0`.
