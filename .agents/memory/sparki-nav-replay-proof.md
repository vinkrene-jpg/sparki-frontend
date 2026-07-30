---
name: Sparki nav GPX-replay proof harness
description: End-to-end replay of GPX rides through the route-match + off-route chain as executable promise evidence.
---

# GPX-replay-bewijsharnas navigatie

- Harness: `artifacts/sparki-mobile/lib/nav-replay.test.ts` + deterministische fixtures in `lib/nav-replay-fixtures/` (generator `generate.ts`, vaste seeds — regenerate + commit only on deliberate change). Run: `pnpm --filter @workspace/sparki-mobile run test:nav-replay` (workflow limit 34/10 ⇒ shell, geen workflow).
- **Replay must mirror the exact screen chain** matchToRoute (met hint) → updateOffRoute → shouldShowOffRoutePrompt → offRouteOptions; anything else proves nothing.
- **Re-prompt na "negeren" is by design**: a 500 m ride-away legitimately re-prompts once at ≥2× én ≥+150 m growth. Assert the threshold, don't assert "exactly 1 prompt forever" — that test fails correctly. Prove silence with a ride truncated before the growth threshold.
- Route-immutability proof = Object.freeze (deep) + JSON byte-compare before/after replay.
- Calibration doc counterexamples (ROUTES_MOBIELE_NAVIGATIE_001 + ROUTES_WEDSTRIJDMODUS_001) are now proof_stage `executed`/`passed` referencing this harness — keep them in sync if thresholds change.
