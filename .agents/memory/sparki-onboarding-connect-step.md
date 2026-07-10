---
name: Sparki mandatory onboarding connect step
description: Durable decisions behind the mandatory connect + gap-fill onboarding step.
---

# Mandatory onboarding connect step + gap-fill

Onboarding ends in a mandatory connect step BEFORE the first plan, then a gap-fill
that asks ONLY the required fields still missing after import.

**The step is mandatory; connecting is not.** Honesty model: most platforms
aren't wireable, so forcing a real connection would be a dead-end. Proceeding
without connecting is allowed; the gap-fill is the always-present manual override.
**Why:** never a dead-end + never fake-green.

**Order of truth: connection import > manual gap-fill > estimated defaults.**
complete-v2 only seeds still-null fields, so gap-fill values win. Manual
FTP/hours must be written with their `*Estimated=false` flag or the progressive
question engine re-asks them (double-ask).

**weight in gap-fill is a MEASUREMENT, not steering** — needed for W/kg, so it is
NOT age-gated. RED-S <17 only blocks weight-LOSS steering (season goal), a
separate feature.

**Discipline values must be canonical registry values.** The gap-fill field
options and any validation must both come from `getSubdisciplines("cycling")`
(values `Road/Gravel/Mountain/Track`), because `isValidSubdiscipline` only
accepts those. Hardcoding lowercase (`road`, `mtb`) silently fails validation and
the field can't be saved. **How to apply:** derive discipline options from the
shared sport registry, never hand-write them.
