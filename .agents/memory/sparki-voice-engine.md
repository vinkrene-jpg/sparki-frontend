---
name: Sparki Voice & Personality Engine
description: How Sparki's deterministic tone/trust/empathy engine is structured and the rules it must never break.
---

# Sparki Voice & Personality Engine

Central deterministic (NOT LLM) engine that gives Sparki one recognizable character.
Lives at `artifacts/api-server/src/engines/voice/` (types, phrases, trust, compose, index).

## Why deterministic
Chosen over an LLM because tone/empathy rules must be *guaranteed*, not probabilistic:
testable with assertions, no risk of leaking the word "AI" or English jargon, no risk of
joking on a setback. Matches the existing context-memory engine pattern.

## Non-negotiable rules baked in
- **Refuse to fabricate**: `composeVoice` returns `null` when an open-loop/pattern event
  has no `evidence===true`, or a `memory_followup` has no `memory`. The route then simply
  omits that block — never invents a pattern or a memory.
- **Empathy before humor**: setback events (`setback`, `fall`, `illness`, `injury`,
  `race_done_bad`) force `supportive` tone and suppress humor regardless of requested tone.
  A `fall` prepends a wellbeing check ("Alles oké?") via `safetyCheck`.
- **Trust gates tone** (`TIER_TONES`): nieuw=[observer,supportive], kennismaking +curious,
  vertrouwd +dry_humor, maat +cynical. Requesting a locked tone falls back to a safe one.

## Trust score
`computeTrust(clerkId)` reads REAL DB signals (profile age, onboarding complete, enabled
non-private memories, follow-ups answered/dismissed, positive memory events, daily metrics
count, accepted friend links). `computeScore` is pure, clamps 0..1, dismissals penalize.
Tier thresholds: nieuw<0.18, kennismaking<0.45, vertrouwd<0.72, maat.

## Surfaces
- Route `GET /api/voice` (auth-gated, owner-scoped) → trust + 5 styles (each with `unlocked`
  flag, rendered via `forceTone`) + memoryHook + openLoop + empathy example.
- Frontend: `hooks/use-voice.ts`, `components/sparki/sparki-voice.tsx`, section "04 Hoe
  Sparki klinkt" on the Profiel page (`pages/you.tsx`). Locked styles shown dimmed.

## Relationship model = trust tiers (do NOT build a parallel system)
The "Relationship Model / Coach Personality / Humor" spec (kennismaken → leren
kennen → vertrouwen → coachrelatie) is ALREADY this engine's 4 trust tiers
(nieuw → kennismaking → vertrouwd → maat). Humor is *earned*: gated by tier
(humor only at vertrouwd+) AND by evidence (composeVoice returns null without
real data). A new user (e.g. a first-time tester) is `nieuw` → observer/supportive
only, no humor — which is exactly "Fase 1: nieuwsgierig/respectvol, geen grappen".
**Why:** a past request asked to "build a relationship model" — the right move was
to map it onto the existing engine, not invent a second one. Onboarding copy is
the literal Fase-1 surface: it must stay curious/respectful with no jokes/teasing/
assumptions (the old narrative jokes were removed for this reason).

## Wedstrijdmodus / focus events
`EventConfig.focus: true` marks race build-up events (e.g. `race_upcoming`) where
humor (dry_humor/cynical) is suppressed regardless of trust — Sparki brings rust/
vertrouwen/focus. Enforced in `resolveTone` via a `speakable()` predicate; race
events carry no authored humor lines. NOTE: day-home pages render *static* calm
copy from the day-type registry (`day-type.ts`), they don't compose voice lines —
so the focus rule is an engine guardrail for when race lines ARE composed, not a
live race-day caller. Don't assume the homes use the voice engine.

## Build/test gotchas
- New api-server test files must be added to BOTH `build.mjs` entryPoints AND a
  `test:*` script in package.json (esbuild only bundles listed entry points).
- `test:voice` covers tones, tier gating, empathy-first, anti-fabrication,
  determinism, wedstrijdmodus/focus suppression, banned-word `\bai\b`/`a.i.`
  check, DB-backed trust.
