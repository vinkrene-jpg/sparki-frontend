---
name: Sparki bronnenregister (source-quality engine)
description: Central per-datasource quality register shared by all analyses — honesty and enforcement rules.
---

One central register (engines/source-quality) assesses every data source (profiel…omstandigheden) with origin/meettijd/volledigheid/betrouwbaarheid/sensorstatus/valid. Pure `assessSources(input)` (deterministic, `today` passed in) over a DB `gather` step; injected as a DATABRONNEN block into the shared athlete context so every LLM analysis obeys the same rule.

Rules worth keeping:
- **Fail-closed, not silent:** if the register cannot be built, the prompt must explicitly say all sources are unverified and forbid firm conclusions — never silently drop the rule.
  **Why:** soft try/catch omission means analyses conclude from unknown-quality data, violating the honesty contract.
- **Sensorstatus "actief" needs proof:** a paired sensor or real channel data in recent rides. A merely-connected platform is NOT proof; connector `error` ⇒ "storing" and channel reliability "onbetrouwbaar"/invalid.
- **Per-analysis audit log:** `buildAthleteContext(clerkId, analysisLabel)` — every call site passes its own label (brief/ask/workout_explain/…) so used/excluded sources are logged per run, not one generic label.
- valid === reliability goed|matig only; "ontbreekt"/"onbetrouwbaar" sources must yield "data ontbreekt" statements, never values.
