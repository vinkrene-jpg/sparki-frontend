---
name: Sparki per-session duration caps
description: Why the plan engine caps single-session minutes per DayKind×experience instead of only clamping to 6h.
---

# Per-session duration caps in the training-plan engine

The 3-week plan builder splits a weekly-minute budget (`weeklyHourTarget × factor`)
across the week by relative `KIND_WEIGHT`. The weekly-hour target is very often an
ESTIMATE (Q&A onboarding leaves it estimated). When a rider trains only 2–3 days,
that quota used to be crammed into few sessions and hit only the hard 6h clamp —
producing absurd rides (e.g. an intermediate getting a ~6h long ride).

**Rule:** cap each session by `SESSION_CAP_MIN[kind][experienceTier]` (a real
coach's ceiling), NOT by a single global 360-min clamp. Minutes that don't fit are
simply left unscheduled — honest underfill beats an unrealistic single-session
overload.

**Why:** a mathematically-tidy weekly total is worthless if it prescribes a
session no real athlete of that level would do. Realism > exact quota.

**How to apply:** the caps live in `training-plan.ts` (`SESSION_CAP_MIN` +
`sessionCapMin()`), used in `buildSkeleton`'s second pass. `wedstrijd` keeps 360 as
a race-tier constant (the race is the race). If you ever want to preserve the
weekly total, redistribute the overflow to other days — do NOT raise the caps.
