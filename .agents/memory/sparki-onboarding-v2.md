---
name: Sparki onboarding V2 + persona harness
description: How adaptive onboarding selects/validates questions, and the three durable product findings a 20-persona test proved.
---

# Adaptive onboarding — durable facts

The progressive onboarding gathers data gradually (never one long survey): physical
profile *facts* interleaved with begeleidings (coaching) *dimensions* at a fixed
2 profile : 1 coaching cadence. A new athlete is seeded with cycling/beginner
defaults, an **estimated** FTP + weekly-hours, and their self-claim; everything
else is gathered later. `coachingMode` ("Wie begeleidt je?") always surfaces first.

## Testing approach that works here
Pure-function simulation beats integration tests for the engine: drive the REAL
selection/validation/tally functions through a faithful copy of the route's
merge loop, no DB writes, assert invariants. Catches cadence/validation/termination
regressions cheaply. **Floor-not-equal** invariants (`>= 20 catalog questions`,
`accepted === order.length`) survive intentional catalog growth; a hardcoded
`=== 20` would falsely fail when questions are added.

## Three product findings (proven empirically, not bugs)
- **Nonsense answers fail honestly, no alternative path.** Out-of-range / invalid
  input → 400, the question is NOT snoozed so it resurfaces; the UI shows a plain
  generic Dutch retry line and "Overslaan" snoozes 3 days. Not a dead-end (skip is
  the escape) but there is no guided recovery and no separate fallback onboarding.
  **Free-text facts accept any non-empty string** — only empty text is rejectable.
- **The question catalog is FIXED.** A willing athlete who asks for intensive
  guidance does NOT get extra/deeper questions. `guidanceNeed=high` only feeds the
  coaching *directive/tone* (reaches high confidence after one direct answer,
  weight 5). Onboarding *breadth* never adapts to engagement or guidance need.
- **Q&A-only data quality is capped.** Even a fully-willing athlete leaves
  `weeklyHourTarget` permanently **estimated** (no progressive fact ever makes it
  real) and FTP stays an estimate until a number is typed. A connected sport app
  is what would supply measured FTP/weight/history instead of self-report/estimate.
  **Why:** `getMissingOnboardingData` treats an estimated FTP/hours as "present",
  so a plan builds and the manual fallback never re-asks — usable, but coarse.
