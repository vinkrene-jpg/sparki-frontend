---
name: Sparki Foundation (7 engines + orchestrator)
description: Flag-gated deterministic analysis foundation in engines/ai-foundation — contracts, DI, honesty rules, schema gotchas.
---

# Sparki Foundation

Additive analysis layer behind flag `ai_foundation` (default off, nothing auto-on): seven deterministic engines behind interfaces (Data, Knowledge, Athlete Model, Strategy, Pattern, Decision Support, Explainability) + routing-only orchestrator, DI container with per-engine test overrides.

**Rules baked into the contract:**
- Facades over existing SSOT math (computeLoadSeries/computeReadiness/computeZones) — never re-implement.
- Honest gaps: every snapshot carries an `ontbrekend` list; confidence always <100; Decision Support returns ≥2 scenarios, never one advice.
- Provenance goes through existing `engines/data-origin` `recordComputation` (`aiUsed: "nee"` — deterministic).
- Orchestrator pushes the explainability step trace BEFORE calling explain (else the chain shows 6/7 steps) and patches the measured duurMs back into `uitleg.berekeningsketen` afterwards.

**Schema gotchas:**
- `knowledge_evidence` idempotent upsert requires `unique(...).nullsNotDistinct()` on (subjectKind, knowledgeItemId, managedItemId) — a plain uniqueIndex never conflicts when managedItemId is NULL.
- `user_flag_overrides.flag_key` has an FK to `feature_flags.key`: a flag key added in code has NO DB row until seeded — tests must `insert ... onConflictDoNothing` the flag row first.

**Why:** foundation for later intelligence waves; keeping it deterministic + gated means it can ship dark and be extended per-engine via the DI container.
**How to apply:** any new engine joins via contracts.ts + container override; any new evidence subject kind must keep the nullsNotDistinct tuple valid.
