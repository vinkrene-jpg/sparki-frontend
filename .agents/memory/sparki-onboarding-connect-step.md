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

**Connect step redirects out (Strava OAuth) via a FULL page load — onboarding
local `useState` step is wiped, so it resets to step 0 and the freshly-imported
data never reaches the "very next" gap-fill.** Fix: persist step + selfType in
`sessionStorage` (`sparki_onboarding_step` / `sparki_onboarding_selftype`),
restore on mount, clamp (never resume past the self-type question without an
answer or finish() dead-ends), and clear on complete-v2 success.
The restore/clamp + post-OAuth import logic is extracted as pure functions in
`lib/onboarding-resume.ts` (storage-injected, DOM-free) so both components use it
and `lib/onboarding-resume.test.ts` (tsx, no jsdom) can drive the OAuth-return
path deterministically — resume-not-0, the self-type clamp, and "Verder" held
during the sync / released once it settles (deferred-promise harness).

**Why:** honour "gather first, then ask only the gaps" — the import must reach
the next screen. **How to apply:** on OAuth return (`?strava=connected`) the
connect step guarantees the initial import landed (best-effort callback import
may bring nothing / fail silently), so if `importedDataTypes` is empty it runs a
real Data Hub sync with an honest "gegevens worden opgehaald…" state (never
fake-green), and onboarding holds "Verder" (`onImportingChange`) until it
settles.
