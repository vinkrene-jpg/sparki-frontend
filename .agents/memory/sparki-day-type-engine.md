---
name: Sparki day-type homepage engine
description: How Home resolves to a day-type homepage (blueprint §4) and the detection precedence rules.
---

# Day-type homepage engine

`detectDayType(ctx)` in `artifacts/sparki/src/lib/day-type.ts` resolves exactly one
DayType; `DayHome` dispatches to a registered homepage component. Each homepage only
presents — it never detects.

## Detection precedence (high → low)
1. Emergency — athlete-set `healthStatus` sick/injured (blocks training).
2–4. Race window — `useRaceContext` → `resolveRaceContext` picks the nearest race and
   its phase; sits just below emergency. Maps to day types:
   race_day/day_before/race_week_*/travel/post_race homepages.
5. Explicit **rest** workout → `rest` (rest is NOT training, so it precedes coach/sparki).
6. Coach-planned workout → `coach_training` (grondregel 4: coach leads, incl. coach recovery).
7. Non-coach recovery workout → `recovery`.
8. Any other workout → `sparki_training`.
9. **No workout at all → `general`** (rich No-Training fallback).

**Why:** a stricter validation review rejected the old logic that mapped
`hasProfile && no-workout → rest`. Rest (explicitly planned complete-rest day) and the
No-Training fallback (nothing planned) are distinct modes with different content.

**How to apply:** never reintroduce a profile-based rest mapping. Rest requires an
explicit rest-type workout; absence of any workout is always `general`.

## Health status (sick/injury) is end-to-end
- DB: `athlete_profiles.health_status` (text, default "ok"; ok/sick/injured).
- API: `PUT /api/athlete/health-status` (enum-validated). Dashboard/profile GET already
  return the row, so the field flows automatically.
- Frontend: `useSetHealthStatus` invalidates dashboard+profile; `HealthStatusControl`
  (secondary, never a primary action — grondregel 5) sits on training/recovery/rest/general
  homes; `EmergencyDayHome` shows the calm recovery view and a single "mark recovered"
  action that clears the status back to ok.

## Race-context resolver precedence
`resolveRaceContext` builds ALL applicable candidates per race then sorts by a phase
priority map (race_day < day_before < travel < taper < build < post_race), closest race
breaking ties. A travel-day candidate (travelDate today + race ahead) must be ADDED
alongside the normal `phaseFromDaysUntil` candidate — never `continue`/early-return after
pushing travel, or it suppresses day_before/race_day for the same race.
**Why:** if travel short-circuits, a race tomorrow whose travelDate is today wrongly
resolves to `travel` instead of `day_before` — the urgent phase must always win.
**How to apply:** keep candidate generation additive; let the priority sort decide.

## Ground rules baked in
- Grondregel 3: external/derived data (weather/route/departure, planner timeline, team
  ETAs) is shown as explicit labeled placeholders or tagged `EST`, never fabricated.
- Grondregel 5: ≤1 primary action, ≤3 observations/recommendations per home.
