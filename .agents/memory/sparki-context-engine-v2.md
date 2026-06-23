---
name: Sparki Context Engine V2
description: Where Sparki's coaching "reasoning" actually lives and how to extend/validate it
---

# Sparki Context Engine V2

Sparki's coaching intelligence (multi-signal weighing, probabilistic cause ranking,
uncertainty→ask-questions, contradiction detection, calibrated confidence/no-absolutes,
fact vs observation vs hypothesis) is produced by **two levers**, not bespoke logic:

1. The `SPARKI_SYSTEM` prompt (a "reasoning framework" section) in `routes/ai.ts`.
2. The richness of `buildAthleteContext` — the model can only weigh signals that the
   context string actually surfaces from the DB.

**Why:** the heavy per-athlete reasoning is the model's job; the engine's job is to
feed it every real signal and instruct *how* to reason. A V2 "feature" that sounds like
logic (probability model, confidence, patterns) is mostly prompt + context.

**How to apply:**
- To make Sparki consider a new signal, FIRST add it to `buildAthleteContext` (real DB
  data only — never invent fields). Available-but-easy-to-forget real signals: FTP
  history (power dev), nutrition/hydration logs, race calendar, age via `birthYear`,
  competition/experience level, injury/health status, HRV/restingHR/sleep trends.
- The `ai_observations` table already carries `confidence`, `detectedPattern`,
  `recommendedAction`, `expiresAt` — so fact/observation/hypothesis-with-expiry and
  pattern memory need NO migration; just use these columns.
- The `/brief` instruction is no longer a rigid "2-3 sentences": it may instead ask
  1–3 clarifying questions when signals are contradictory or a deciding datum is
  missing. Keep that escape hatch when editing — a fixed sentence count breaks
  uncertainty/question-mode.
- The self-learning confidence loop (evaluate whether past advice was right, then adjust
  stored confidence over time) is the one genuinely logic-heavy piece and is NOT built —
  scope it as its own task, don't half-build it inside the prompt.

**Validation pattern:** faithful test = temp harness in `src/jobs/`, add as build.mjs
entrypoint, paste the exact `SPARKI_SYSTEM` + `/brief` instruction, feed N synthetic
athletes with mixed/contradictory contexts in the same format `buildAthleteContext`
emits, call `claude-sonnet-4-6`, then DELETE harness + revert build.mjs. A 10-athlete
mixed-signal run confirmed V2 behaviour (question-mode fired only on missing/ambiguous
data; contradictions named; no "AI", no English, no markdown).
