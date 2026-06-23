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

## Gotcha: the SetupForm + home picker live behind a feature flag
**Why:** `train.tsx` renders `<TrainingPlanPanel/>` (which holds the onboarding
SetupForm AND the home-location picker) ONLY when the `autonomous_training` flag
resolves true for the user. With the flag off the entire panel is absent from the
DOM — the picker/SetupForm is invisible and e2e tests "can't find the setup form".
Enable per-user via a `user_flag_overrides` row (enabled=true) — but the
`feature_flags` definition row for the key must exist first (override FK → key).
Separately, `<ThreeWeekPlan/>` (section "00 PLAN · 3 WEKEN") renders the plan
calendar INDEPENDENT of `needsSetup`, so seeing a plan calendar does NOT mean the
profile is complete — the SetupForm is a different, flag-gated section ("04").

## Gotcha: route attachment is one-way and fails silently
**Why:** debugging "no routes attached" wastes time otherwise.
**How to apply:** attachment sets `planned_workouts.route_id` → routes (one
direction); `routes.linked_planned_workout_id` is NOT used for plan coupling.
`generateAndSavePlanRoute` wraps everything in `try { } catch { return null }`, so
ANY failure (ORS error, or a `routes` INSERT hitting a missing column during schema
drift) degrades to null and the generate still returns 201 with an empty routes
table. An empty routes table + 201 = silent degrade, not "no steady days". ORS
`round_trip` directions is a different endpoint than geocode — verify directions
specifically (geocode working does not prove routing works).

## Coach advisory view (coach portal)
When an athlete has a coach, their plan is mode="advisory". The coach portal
surfaces it READ-ONLY via `loadPlanView(clerkId)` (exported from
`lib/training-plan.ts`) behind a coach route that gates on `requireCoach` +
`hasAcceptedCoachLink` + `coachSharingLevel != "none"`. It only returns the plan
when `mode === "advisory"` (autonomous = self-coached, nothing to advise). It
NEVER touches the coach's planned_workouts. UI labels everything "Sparki-advies"
(no "AI"), with an explicit "jouw eigen planning blijft ongewijzigd" notice.

## Gotcha: plan-routes uses the routing/ provider, not standalone modules
**Why:** task #17's autonomous-training code was originally merged against old
standalone modules (`route-generator`, `ors`, `route-geometry`) that a parallel
refactor had already replaced with the `lib/routing/` provider abstraction — the
build was broken on arrival. **How to apply:** `lib/plan-routes.ts` uses
`lib/routing` for everything — `getRoutingProvider`, `selectRoutingProfile`,
`profileToSurface`, `profileCruisingSpeedKmh`, `activityLabel`, and `type BikeType`
all come FROM `./routing` (NOT defined locally, NOT from `@workspace/db`), plus
`summarizeTrack` from `gpx-parse`. Do not reintroduce imports of the deleted
standalone modules, a local `BikeType`/`TrainingType`, or `@workspace/db`
`BikeType`/`RoutePoint`.

## Gotcha: dev DB drifts from schema files; drizzle push prompts a TTY
**Why:** task #17 added `training_plans` + `plan_days` tables and
`planned_workouts.plan_id`/`route_id` columns to the schema files but they were
NEVER pushed to the dev DB, so any plan feature throws "relation/column does not
exist" at runtime even though tsc passes. Worse, `generatePlan` runs inside
`regeneratePlanSafely`, which swallows ALL errors and logs
`onboarding.plan.regenerate failed` — so quick-start still returns `201 ok` while
NO plan/plan_days/planned_workouts rows are written. `pnpm --filter @workspace/db
run push` fails non-interactively ("Interactive prompts require a TTY" — drizzle's
column-rename disambiguation), and a blind `--force` can DROP columns on unrelated
drifted tables. **How to apply:** if a Sparki feature returns success but its DB
rows are empty, suspect schema-vs-DB drift first — compare `pgTable(...)`
names/columns in `lib/db/src/schema/*` against `information_schema`, then create
only what's missing with targeted `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ...
ADD COLUMN IF NOT EXISTS` matching the schema exactly (not a full push). Don't
trust an `ok` response — verify the rows landed.

## Gotcha: vite production build needs env vars
`pnpm run build` (and per-artifact `vite build`) FAILS in a bare shell because
`artifacts/sparki/vite.config.ts` throws unless `PORT` AND `BASE_PATH` are set —
those are provided by the workflow runtime, not an ad-hoc shell. Use `pnpm run
typecheck` for validation; the vite build failing for missing PORT/BASE_PATH in a
plain shell is environmental, not a code regression.
