---
name: Sparki route loop quality (fewer lusjes / repeated roads)
description: Why generated round-trips backtracked, and the best-of-N candidate selection that fixes it.
---

# Generated loops repeated roads / small lusjes

Round-trip routes come from ORS `round_trip` (`OrsProvider.generateLoop`), which
returns ONE loop per (seed, points). On a sparse road network a single random
loop frequently doubles back on itself or stitches together little repeated
lusjes. The old code made exactly one ORS call with a random seed, so the user
got whatever that one loop happened to be.

**Fix (honest, no fabrication):** `lib/routing/loop-quality.ts`
- `pathOverlapFraction(path)` — grid-snaps each geometry segment (~55–65 m cell)
  to an undirected edge key and returns the fraction of total METRES ridden over
  edges used more than once. Direction-agnostic, so there-and-back counts as
  overlap. Clean square ≈ 0.0, pure out-and-back ≈ 0.5 (the return leg is half
  the distance).
- `generateVariedLoop(provider, req, {candidates=3})` — asks ORS for a few real
  candidates with well-separated seeds (`seed + i*7919`), scores each by
  `overlap + 0.5*distanceDrift`, keeps the best, early-exits when overlap < 0.08.
  Falls back to the only usable candidate; throws only when ALL fail (same
  contract as generateLoop).

**How to apply / gotchas:**
- Every loop caller must go through `generateVariedLoop`, NOT `provider.generateLoop`
  directly: manual planner (`routes/routes.ts` generate handler) and the
  autonomous plan engine (`lib/plan-routes.ts`). Both import it via the barrels
  (`engines/route` and `./routing` respectively) — it is re-exported from
  `lib/routing/index.ts`.
- Selection only CHOOSES among real ORS results; it never invents geometry —
  keeps the honesty contract intact. Distance/elevation/steps still come from ORS.
- Cost/latency: up to N sequential ORS calls per loop (early-exit keeps the common
  case cheap). Keep `candidates` ≤ 5.
- point-to-point and waypoint routes are unaffected (a user-shaped path is already
  intentional) — only round-trips get candidate selection.
