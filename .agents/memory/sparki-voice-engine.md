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

## Build/test gotchas
- New api-server test files must be added to BOTH `build.mjs` entryPoints AND a
  `test:*` script in package.json (esbuild only bundles listed entry points).
- `test:voice` → 69 scenarios (tones, gating, empathy-first, anti-fabrication, determinism,
  banned-word `\bai\b`/`a.i.` check, DB-backed trust).
