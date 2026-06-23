---
name: Sparki memory graph (cross-domain connections)
description: How Sparki derives explainable cross-domain "verbanden" deterministically from real DB signals, and the honesty constraints that govern it.
---

# Memory graph — cross-domain connections

`engines/memory-graph/` derives **deterministic** connections across training,
recovery/sleep, races, feedback and prior observations — all read by `clerkId`
over a recent window. No model calls, no fabricated signals; every connection is
computed from real rows and carries the signals it used.

## The honesty contract (do not weaken)
- **Confidence is never 1.0.** `buildConfidence` clamps to `[0.1, 0.95]` and is
  computed from sample size + effect/consistency, not hardcoded. `scoreToConfidence`
  maps the numeric score to the enum the UI shows.
- **Rules stay silent on weak evidence.** A rule returns `null` rather than a
  weak/over-claimed connection. Reference: `ruleRecoveryRace` requires ≥3 usable
  races, computes a **median-split association** (above-median recovery vs. better
  result), and only fires when agreement ≥ 0.6 — effect and confidence are derived
  from the actual split, never constants. Mirror this shape for any new rule.
- **Every connection carries `signals[]` + `alternativeExplanations[]`** (≥2 alt
  explanations). The UI renders these verbatim under "Signalen die Sparki gebruikte"
  and "Andere mogelijke verklaringen". No "AI" wording anywhere user-facing; Dutch.

## Persist accounting (the bug to never reintroduce)
`runConnectionAnalysis` snapshots prior observation ids (by dedupeKey) **before**
persisting, then classifies each persist result against `persistObservation`'s
semantics: `null` → `gated` (privacy gate off), returned id already present →
`deduped`, otherwise → `created`. Invariant: `created + deduped + gated === derived`.
**Why:** an earlier version counted dedupes as newly persisted, over-reporting work.
The route returns `{windowDays, derived, created, deduped, gated, connections[]}`.

## Where
- Engine: `artifacts/api-server/src/engines/memory-graph/{index,gather,correlations,types}.ts`
- Route: `POST /api/ai/connections`; persist via extended `persistObservation`
  (`lib/ai-memory.ts`) accepting `signals`/`alternativeExplanations`/`confidenceScore`.
- Schema: `lib/db/src/schema/ai-memory.ts` — source type `connection_analysis`;
  cols `signals` (jsonb), `alternativeExplanations` (jsonb), `confidenceScore` (numeric 3,2).
- Frontend: `use-ai-memory.ts` (`useRunConnections`) + `ai-memory-panel.tsx`
  (ConfidenceMeter, "Verbanden zoeken" trigger, "Waarom?" toggle).
- Tests: `artifacts/api-server/src/tests/memory-graph.ts`
  (`pnpm --filter @workspace/api-server run test:memory-graph`). Rule tests use the
  in-memory `makeBundle()`; DB tests seed far-future 2099 dates and clean up.

## Pre-deploy debt
New `ai_observations` columns are **not yet pushed to prod** — push schema before
deploying or inserts fail in unmigrated environments.
