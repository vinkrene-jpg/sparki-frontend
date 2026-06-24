---
name: Adaptive Coach Engine (Coach Decision Engine V1)
description: The deterministic decision layer between sport profile and Home advice — how it's surfaced and dev-gated.
---

# Adaptive Coach Engine V1

`lib/coach-engine.ts` is the *decision layer* between the athlete profile and
Home's advice. `decideCoach(input)` is deterministic + synchronous (no network,
no storage) and returns `{ archetype, topic, hoofdonderwerp, advies, vraag,
prioriteit }`. Three archetypes: consistentiecoach / wedstrijdcoach /
prestatiecoach.

**Why deterministic in V1:** so no text generator can mask differences in the
decision logic. Splitting wording into an LLM text layer is explicitly V2 — do
not route engine output through the existing LLM brief.

**Differences must be real:** each archetype produces a different topic, advice,
question AND priority — never one sentence with swapped numbers. Day data
(check-in feel/fatigue + load TSB) is read *differently per archetype* so the
same day is interpreted differently (e.g. low recovery → wedstrijd gives rest
priority, prestatie holds course, consistentie says just keep moving).

## How it's surfaced (non-obvious wiring)
- The decision is carried from the `DayHome` dispatcher to the shared
  `ScreenShell` via `contexts/CoachDecisionContext.tsx` — NOT per day-home.
  ScreenShell renders `CoachDecisionCard` on every home day-type when a decision
  is present + `isHome`. This is why it works across general/training/race homes
  without touching each one.
- Live/prod path: `coachInputFromProfile(profile, realDay, race)` derives the
  input. There is no `experience` field on the profile — it's inferred from
  weekly hours (`inferExperience`); goal intent from keywords (`classifyGoal`).

## Dev override (fail-closed, same line as Development Preview Mode)
- Selector lives in `dev-preview.tsx` DevPanel (dead-code in prod). Two modes:
  Scenario (fully fictional profile+day+race, the default) and Profiel (scenario
  profile but REAL day data preserved). `resolveOverrideInput` handles the merge.
- DayHome only applies the override when `DEV_PREVIEW && devCoachOverride`, so
  production always runs the engine on the real profile.
