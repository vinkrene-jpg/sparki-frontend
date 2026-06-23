---
name: Sparki autonomous training schedule
description: How Sparki builds a real training plan for athletes without a coach (engine design, honesty rules, coach gating).
---

# Autonomous training schedule

Sparki coaches an athlete who has NO accepted coach by building a real, persisted,
validated training plan (concrete committed week + ~2-week provisional preview),
adapting it over time, and attaching real ORS routes to route-needed sessions.

## Hard honesty rules (non-negotiable)
- Every NUMBER (weekly volume, per-session duration, intensity zone, rest days,
  taper/deload factors) comes from the DETERMINISTIC guardrail engine. The AI is
  given the finished skeleton and writes PROSE ONLY (titles, descriptions, summary).
  There is always a deterministic fallback if the AI call fails or returns junk.
  AI output is never read back for numbers/types — only title/description/summary.
- Routes are real ORS routes or honestly absent. Each route gen failure degrades
  to "no route" (null), never a fabricated one. Home location required for routes.
- Only steady outdoor rides get a route (duur/long/tempo). Intervals, recovery,
  race day, and rest never get an auto-generated route.

## Coach gating (the safety boundary)
**Why:** must never write or overwrite a human coach's workouts.
**How to apply:** the route layer checks for ANY accepted `coach_athlete_links`
row for the athlete. If present → mode="advisory": the plan is persisted for
display only and the engine writes ZERO `planned_workouts` (committed=false on all
plan_days). No coach link → mode="autonomous": first committed-week non-rest days
are written as `planned_workouts` (source "sparki", planId set) and routed.

## Engine shape
- Inputs gathered from real data: athlete profile (experience, availableDays,
  weeklyHourTarget, loadCapacity), latest daily metric → readiness, recent
  sessions, upcoming races → phase (taper/peak/build/base by days-to-race).
- Health gate: healthStatus sick/injured → ALL days rest, no routes, honest summary.
- Persistence: transaction archives prior active plan + deletes its future planned
  rows, inserts plan + plan_days. Route coupling happens AFTER the tx commits (ORS
  is a slow network call — never hold a DB tx open across it).
- Adapt: rebuilds skeleton on the plan's OWN weekStartDate anchor (so dates line
  up), rewrites only provisional (committed=false, future) plan_days vs current
  readiness/health, stamping each changed day with an adaptationReason.

## Gotcha: vite production build needs env vars
`pnpm run build` (and per-artifact `vite build`) FAILS in a bare shell because
`artifacts/sparki/vite.config.ts` throws unless `PORT` AND `BASE_PATH` are set —
those are provided by the workflow runtime, not an ad-hoc shell. Use `pnpm run
typecheck` for validation; the vite build failing for missing PORT/BASE_PATH in a
plain shell is environmental, not a code regression.
