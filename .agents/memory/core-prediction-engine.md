---
name: Sparki Core-prediction engine
description: Per-workout Core forecast (nu→tijdens→eind→herstel) with immutable snapshots and predicted-vs-actual comparison.
---

# Core-prediction engine

Forecasts what ONE planned training does to the athlete's living Core, shown as a
panel ABOVE the workout (Today-layer + workout-detail-drawer). Filmstrip of the
living-shape SparkiCore at four moments: nu / tijdens / direct na / na herstel.

## Key design decisions

- **Reuse, don't reinvent.** Frames are built by projecting load (EWMA via
  `projectLoad`) then running the SAME `computeState` (state engine) on the
  projected metrics. The panel reuses the living-shape `SparkiCore`
  (`components/sparki/core/sparki-core`, CoreVisualState) via `frameToCore` →
  `stateToCore`. Never the orb (`components/sparki/sparki-core`).
- **"during" frame must be the midpoint of now→end, not a separate half-TSS EWMA
  step.** A half-TSS EWMA below baseline ATL paradoxically RAISES TSB, breaking
  monotonicity. Compute end first, then interpolate the during frame.
  **Why:** caught by the smoke test as a non-monotonic during frame.
- **Immutability:** while upcoming, recompute only when a pre-known input changes
  (djb2 `inputHash`). The hash MUST fingerprint EVERY input that moves the
  forecast or a factor — deep workout structure (block durationMin/reps/%FTP/
  zones, not just `blocks.length`), load base, readiness, health, sleep, HRV,
  resting HR, feel, fatigue, FTP trend, nutrition, race context, AND the
  signal-availability map (kind:status) so a factor flipping present/estimated/
  missing also supersedes. Exclude only volatile/derived fields (timestamps,
  athlete name). The old row is marked `supersededAt`, never mutated.
  **Why:** code review REJECTED a narrow hash (tss/dur/date/blocks-count +
  ctl/atl/tsb/readiness/health) — stale "frozen" predictions survived real
  sleep/HRV/nutrition/structure changes, breaking the honesty contract. Once executed
  (`status==="completed"` OR `sessionId!=null`) the snapshot is frozen forever;
  we only attach a live comparison.
- **Honesty:** confidence capped < ~0.85 (never 1.0). Missing factors render
  "niet beschikbaar" — never fabricated.
- **Factor coverage is exhaustive, not selective.** `buildFactors` lists EVERY
  pre-known domain (load, base, readiness, health, structure, herstel, slaap,
  gevoel/vermoeidheid, vermogen, voeding, wedstrijdplanning, weer, parcours).
  Availability is DETECTED from the real signal intake (`availFromSignal` maps
  IntakeSignal.status present/insufficient/missing → present/estimated/missing),
  never assumed. Permanently unwired channels (weer, parcours-voor-geplande-rit)
  are first-class "missing" rows with a plain-Dutch reason — listing the gap IS
  the honest move; silently dropping a domain is the failure.
  **Why:** code review rejected a partial factor list as dishonest about scope.
- **Comparison renders the REAL Core path beside the predicted one.** `actualPath`
  = start (frozen "now" frame, measured) → end (recomputed from real load) →
  recovery (today's live state once `daysSince ≥ RECOVERY_DAYS`, else pending).
  The panel draws two aligned filmstrips (VOORSPELD / WERKELIJK).
- **Coarse start→end fallback when no TSS logged.** `coarseTssFromDuration`
  (min/60·IF²·100, IF≈0.7) estimates load from session duration so the start→end
  comparison is ALWAYS possible; surfaced as `actualTssBasis="estimated"` and
  labelled "geschat" everywhere — never presented as a real number. Only fully
  missing (no TSS AND no duration) yields a pure honest "kan niet" with no end.

## Layout gotcha

Filmstrip MUST show all four frames at once (grid grid-cols-4), not an
`overflow-x-auto` strip — the recovery rebound (na herstel) is the payoff and was
getting scrolled out of view with fixed-width cards.

## Gotcha: MovementDirection is Dutch

`MovementDirection` = `"stijgend" | "stabiel" | "dalend" | "onbekend"` (NOT
English "stable"). Any pseudo-state built for the Core visual (incl. actual-frame
placeholders) must use the Dutch values or tsc fails.
