---
name: Sparki Observation & Coach Engine
description: Design contracts for the deterministic coach brain (engines/observation) that future work must stay consistent with.
---

# Observation & Coach Engine V1

Deterministic (no-LLM) coach brain at `artifacts/api-server/src/engines/observation/`
(types, intake, personality, observations, contradiction, advice, analysis, feedback, index facade).
Tests: `test:observation`; harness: `seed:virtual-athletes` (28 athletes). Both registered in build.mjs + package.json.

## Honesty contracts (must stay true)
- **No single-datapoint conclusions.** An observation needs ≥2 *distinct* signal kinds agreeing, or a
  multi-day trend. The ONE exception is a declared fact: `healthStatus` (injured/sick) is allowed as a
  single-datapoint urgent observation. Two signals of the *same* kind (e.g. tsb + acwr both from
  training_load) do NOT satisfy the guard — dedupe by kind.
- **Confidence never reaches 100.** Formula clamps to 5..92; <40 low, <70 medium, else high.
  **Why:** Sparki must never present certainty it cannot have.
- **Missing is first-class.** `buildSignals` emits present/insufficient/missing per kind with a plain-Dutch
  reason. `weather` is ALWAYS missing (no live feed wired). `health` is always present (default "ok").
- **No fabricated content.** Thin-data athletes yield null analysis parts + a populated `missing` list, not invented prose.

## Copy contract
- Plain Dutch, never the word "AI" (framed as Sparki). The test scans every rendered string with
  `/\bai\b/` (word-boundary, so "training"/"detail" are fine). Any new user-facing string must pass this.

## Surfacing layer (V1.1 — engine made visible in web app)
- Advice carries `confidence` (computeConfidence, same 5..92 clamp) + `actions: CoachAction[]`
  (buildActions — every advice yields ≥1 next step, never a dead end).
- **Follow-up loop is the only way advice changes from the UI.** `followups.ts` is the SSOT:
  FOLLOWUP_OPTIONS + optionsFor (only when readiness unknown / on doubt, max 3),
  isValidFollowUpAnswer (invalid answers are silently ignored, never applied),
  checkInFromAnswer (fris{8,3}/oke{6,5}/vermoeid{3,7}), applyFollowUpAnswers (re-feeds intake → advice flips).
  **Why:** keeps the "answers SAVED + re-fed so advice CHANGES" contract deterministic and tamper-proof.
- Athlete-facing routes in `routes/coach.ts` (NO role gate): GET /api/coach/analysis,
  POST /api/coach/followup (persists missing_checkin to `athleteDailyMetricsTable` + stores answer in
  `coach_followup_answers` + reruns), POST /api/coach/feedback. Answers persisted in
  `lib/db/src/schema/coach-followup-answers.ts`.
- Frontend: `hooks/use-coach-analysis.ts` + `components/sparki/coach/coach-analysis-card.tsx`,
  injected in `screen-shell.tsx` gated to sections {home,train,lab,races}, athlete-only via activeRole.
  "Waarom zegt Sparki dit?" reveals signalsUsed / signalsMissing / confidence.

## Gotcha
- `ensureAccount` already provisions an `athlete_profiles` row. Seeding/tests must UPDATE or
  `onConflictDoUpdate` that row — a plain `insert` collides on the unique clerkId.
- Observation type is `signalsUsed`/`signalsMissing` (NOT `missingSignals`). The global
  `FollowUpPrompt` modal (context-memory) overlays every section except `/samen` — it can mask the
  coach card in screenshots; that's the personal-context feature, not the coach follow-up loop.
