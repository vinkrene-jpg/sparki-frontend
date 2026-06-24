---
name: Coach plan adoption
description: How a coach turns an athlete's Sparki advisory plan day into a real, coach-owned planned_workouts session.
---

# Coach adoption of advisory plan days

A coached athlete gets an **advisory-only** training plan (mode "advisory": plan_days
exist, but NO committed planned_workouts). The coach can adopt advised days into the
athlete's plan from the coach plan view.

## Rule
An adopted day writes a **planned_workouts row owned by the athlete** (`clerkId = athleteId`)
with `source = "coach"` (NOT "sparki"). It is NOT linked to the Sparki plan (`planId` left
null) — it's an independent coach-authored session that shows in the athlete's own schedule.

**Why:** The advisory plan must stay read-only/unchanged; adoption is the coach acting on
advice, so the resulting session is the coach's, distinguishable by `source` (the day-type
engine already branches on coach vs sparki, blueprint §4).

## How to apply
- Endpoint: `POST /api/coach/athletes/:athleteId/plan/adopt` body `{ planDayIds: number[] }`.
  Mirror the gating of `GET .../plan`: requireCoach + hasAcceptedCoachLink + sharing != none,
  and the plan must be `mode === "advisory"`.
- **Never overwrite / never auto-write:** only adopt the day ids sent; skip a day if a
  coach-sourced planned_workout already exists on that date (dedupe by date + source="coach").
  Returns `{ adopted: number[], skipped: [{dayId, reason}] }` (reasons: not_found|rest|already).
- GET `.../plan` augments each day with `adopted: boolean` (a coach workout exists on its date)
  so the UI shows an "Overgenomen" state and never offers to write the same day twice.
- Map plan-day `trainingType` → planned_workouts.type: interval→interval, tempo→tempo,
  herstel→recovery, wedstrijd→race, else ride. Title = day.workout?.title ?? day.focus.
