---
name: Sparki Race Intelligence Engine
description: Deterministic race prep/report/fuel/checklist engine over a Race record; honesty + degradation rules.
---

# Race Intelligence Engine

Turns an athlete-entered `Race` (+ optional `AthleteProfile`) into a phased prep
timeline, a race-day report, fuel advice, and a multi-day checklist. Lives in
`api-server/src/lib/race-intel.ts`; facade `engines/race/index.ts`; route
`GET /api/races/:id/intel` (ownership-checked). Frontend mirror types in
`sparki/src/lib/race-intel-types.ts`, hook `use-race-intel.ts`, UI in
`components/sparki/race/race-intel.tsx`, wired into the three race day-homes.

## Non-negotiable rules (why this engine exists)
- **Never fabricate race data.** Every value is taken from the Race record or
  derived by transparent arithmetic flagged `isEstimate`. Unknown fields surface
  as honest gaps (`dataGaps`, `known:false` items → "nog niet ingevuld"), never a
  guessed number.
- **Honest degradation, no Document Analysis Engine.** There is no guide parser,
  so the 3-days-out "technische gids" step just prompts the athlete to fill in
  race fields. `hasTechnicalGuide(race)` = presence of course/distance/elevation/
  technicalSections; drives `technicalGuideReceived` and the prompt vs ✓ state.
- **Budget alternatives, cheapest first.** Fuel tiers are `laag`/`midden`/`hoog`
  in that order — the priciest (kant-en-klaar gels) is never the default.
- Dutch copy only; the term "AI" appears nowhere user-facing (it's "Sparki ziet").

## Engine specifics
- Prep milestones: 7/5/3/2/1 days + race day = 6 phases. Active = largest
  `daysBefore` still ≤ `daysUntil`; past race (d<0) ⇒ all `done`.
- Duration is estimated only from `distanceKm` ÷ discipline speed
  (`DISCIPLINE_SPEED_KMH`, default 33). No distance ⇒ `durationKnown:false`,
  no totals, generic per-hour carb band (30–60 g/h).
- Carb band by duration: <75min 0–30, 75–150min 30–60, >150min 60–90 g/h.
- Checklist groups reuse the **same item ids as client `PREP_CHECKLIST`** so
  checked state persists via the existing `/api/races/:id/checklist` endpoint —
  `MultiDayChecklist` calls `useUpdateRaceChecklist`, no new persistence.

## Verification
Pure smoke checks added under "Race Intelligence" in `api-server/src/tests/smoke.ts`
(construct a full `Race` literal with a fixed `today` for deterministic status).
Always: `pnpm run typecheck` + `pnpm --filter @workspace/api-server run test:smoke`
+ full `pnpm run build` (esbuild + vite).
