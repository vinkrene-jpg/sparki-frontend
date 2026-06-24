---
name: Sparki State Engine (generic service) + Vandaag dual-surface
description: The State Engine is a surface-agnostic service (Vandaag is only its first consumer); how the State Card decouples from Vandaag, plus the honesty contract.
---

# Sparki State Engine ("van dashboard naar coach")

A backend State Engine derives ONE honest `SparkiState` for an athlete today from
the SAME real signal intake the observation engine uses — it calls
`gatherSignals` and never re-gathers or fabricates. `computeState` is pure and
deterministic (smoke-tested). Confidence is capped at 0.9 (Sparki may doubt,
never pronounces); structural `weather` is excluded from the confidence
denominator so a permanent gap doesn't drag every athlete down, but it is still
shown in `missing`. Stress has no live source → never invented; HRV + resting-HR
+ feel act as a transparent recovery-strain proxy that only nudges tension when
those trends actually exist.

## The engine is a GENERIC service — Vandaag is just its first consumer
**Decision:** the State Engine belongs to NO screen. Backend (`engines/state/*`,
`runStateAnalysis(clerkId)`, `GET /api/state`) and the frontend client
(`hooks/use-sparki-state.ts`, `lib/state-to-core.ts`, `components/sparki/
state-card.tsx`) must have ZERO dependency on Vandaag modules so Training, Races,
Routeplanner, Live Ride, notifications, widgets, Sparki Display, coach views and
APIs can reuse them unchanged.

**Why:** explicit product directive — "de State Engine mag geen onderdeel van
Vandaag worden". A shared component reaching into a screen-specific context
quietly couples the engine to that screen and blocks reuse.

**How to apply / guardrail:** `StateCard` must NOT import `HomeViewContext` (or
any Vandaag module). Its drill-in is **injected by the host** via optional props
`onShowDetails?: () => void` + `detailsLabel?` (the L3 row renders only when
`onShowDetails` is given). Vandaag's `StateDayHome` (inside `HomeViewProvider`)
passes `onShowDetails={() => homeView?.setView("full")}`. Any future "this card
needs to do X on Vandaag" must be a prop the host injects, never an import the
card pulls from a screen.

## Vandaag two-surface pattern (no new route/screen)
**Decision:** Vandaag shows two surfaces under one route via `HomeViewContext`
(`view: "state" | "full"`), provided only around Vandaag. Default = calm State
Card; "Volledige analyse" → `setView("full")` shows the existing day-type home;
ScreenShell renders a top "Terug" on the full surface.

**Why:** the 2.0 brief forbids new screens/architecture layers and forbids
touching the existing day-home/coach components. A shared context lets the State
Card be default while reusing the untouched full analysis as a drill-in.

**How to apply:**
- `ScreenShell` reads `useHomeView()`. `stateSurface = isHome && view==="state"`
  suppresses the dashboard/coach cards (CoachAnalysisCard, CoachDecisionCard,
  CoachInputNeeds, HomeProfilePrompt, FollowUpPrompt) ONLY on Vandaag's state
  surface. **Gotcha:** gate suppression on `isHome` — outside Vandaag the
  provider is absent (`useHomeView()` null) so Train/Lab/Races keep their coach
  cards. Never suppress on `homeView == null`.
- `DayHome` = `HomeViewProvider` wrapping `DayHomeInner`; the inner branches on
  `view` only AFTER `useAthleteDashboard`/`useRaceContext` run (no conditional
  hooks). State surface renders before the dashboard/races loading gate so it
  never blocks on data it doesn't need.

## Check-in that "directly affects state"
Reuse the REAL follow-up endpoint: `POST /api/coach/followup` with
`questionId: "missing_checkin"` and answer `fris|oke|vermoeid` — the route
persists it as actual `athlete_daily_metrics` (feel/fatigue). The State Card's
`useStateCheckIn` then invalidates `state` + `athlete` + `coach.analysis` so the
Core recomputes from persisted data. Do NOT add a parallel check-in write path.

## Core rendering
Two `SparkiCore`s exist: the rich canvas `CoreVisualState` one at
`components/sparki/core/sparki-core.tsx` (used by the State Card) and a simpler
orb at `components/sparki/sparki-core.tsx`. `lib/state-to-core.ts` is the pure
map SparkiState → CoreVisualState (hue from y, drift from movement, breathing
from tension, haze from confidence).
