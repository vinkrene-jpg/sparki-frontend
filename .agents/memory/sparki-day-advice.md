---
name: Sparki general-day concrete advice
description: How the no-plan (general) Home day produces one concrete, explainable training recommendation instead of generic dashboard tips.
---

# General-day concrete advice

The no-plan ("general") Home day must show ONE concrete, explainable session — not
generic dashboard text. The advice is a pure, deterministic client-side engine
(`lib/day-advice.ts`, `computeDayAdvice`) that weighs the athlete's real signals
into one recommendation with concrete numbers and a "waarom" that cites each signal.

**Why client-side deterministic:** mirrors the established readiness pattern
(`computeReadiness`), keeps numbers deterministic and prose-free (no fabrication),
needs no new endpoint, and consumes only real dashboard/race API data — so it is not
"mock UI". Backend `lib/training-plan.ts` is the richer engine but its helpers aren't
exposed as a single-day endpoint and that surface is off-limits to touch.

**How it works / gotchas:**
- Readiness is the core driver and now lives in `lib/readiness.ts` (SSOT, shared by
  the homepage reactor and the advice engine — they must never diverge). If there is
  no check-in, `computeDayAdvice` returns null and the homepage prompts for one.
- Intensity = readiness band, then a **form (TSB) guard** pulls quality back when
  fatigued (TSB ≤ −12 demotes intervals→tempo→endurance; ≤ −25 forces recovery) and
  opens a tempo prikkel when fresh. This is why a PRIMED 86% check-in with TSB −16
  yields tempo, not intervals.
- On the general day the nearest race is ALWAYS outside its race-week window (those
  windows route to race day-homes), so race framing is base/build only. Compute the
  nearest race from the raw `useRaces()` list via `daysUntil`, NOT
  `resolveRaceContext` (which returns null outside the window).
- Duration = weeklyHourTarget×60 / trainingDaysPerWeek (clamped per intensity).
  `trainingDaysPerWeek` is in the DB + full-row dashboard select; it had to be added
  to the frontend `AthleteProfile` type (was missing).
- Power band = standard Coggan % of FTP; dropped (not the advice) when FTP is unknown.
