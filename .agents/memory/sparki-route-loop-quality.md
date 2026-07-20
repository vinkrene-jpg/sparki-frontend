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
- `generateVariedLoop(provider, req, {candidates})` — asks ORS for a few real
  candidates with well-separated seeds (`seed + i*7919`) and keeps the best by a
  multi-signal score: overlap + distance-drift + elevation-match, where each
  signal ranks REAL provider results only (never fabricates geometry/elevation).
  Falls back to the only usable candidate; throws only when ALL fail.

**Elevation preference + distance adherence (the "prefs ignored" fix):**
The original report: pick Vlak + 50 km → got 74 km / 2286 m (both ignored). Two
root causes and their durable fixes:
- Distance was barely weighted (drift ×0.5) and early-exit fired on overlap
  ALONE, so a "clean but far-too-long" loop won. Distance drift now carries real
  weight and the early-exit is gated on ALL signals together (near-clean AND
  close-to-target AND elevation-matched), never overlap alone.
- `elevationPreference` "flat" did NOTHING for cycling — `selectRoutingProfile`
  only reacts to "hilly" (→ wantsTrail) and ORS round_trip has no "prefer flat"
  knob. **The honest lever is candidate SELECTION, not the ORS request:** thread
  `elevationPreference` into `LoopRequest`, generate MORE candidates when a
  flat/hilly wish is set, and rank by ascent-per-km (flattest for flat, hilliest
  for hilly). ORS cannot be told to route flat; we can only pick the flattest of
  several real loops — so in genuinely mountainous terrain a "flat" loop may
  still climb (honest limit, not a bug).

**ORS `summary.ascent` is null (critical gotcha):** ORS GeoJSON `properties.summary.ascent` comes back `null` even with `elevation:true`, so `RouteResult.ascentM` is null. The REAL climb lives in the per-point `ele` values (which ORS does return — every point) and is summed by `summarizeTrack` (that's the elevation the user sees). So any elevation-based candidate ranking MUST derive ascent from the track points (`trackAscentM` in loop-quality.ts), never from `ascentM` — the first "flat preference" fix silently did nothing because it read the null `ascentM`. Verified live at Freiburg (Black Forest): flat now picks ~57 km / ~1019 m vs a single-shot 74–83 km / 2286–3372 m. Distance drift (×1.2) intentionally outranks elevation (×0.8): in terrain where every hilly loop is 80 km+, a 50 km request correctly gets the closest-distance loop rather than a far-too-long hilly one (honest, ORS round_trip length is only approximate — ~14% over is normal in sparse/mountainous networks).

**Candidate pool size gates flat/hilly quality:** in hilly terrain the genuinely flat loops appear only in LATER ORS seeds, so a small sample silently returns a hillier route even after the ascent fix. `generateVariedLoop` samples `preference==="any"?3:8` candidates, capped at 10; the early-exit still stops as soon as a clean+on-distance+on-elevation loop appears, so the wider ceiling only costs extra calls when a good match is genuinely hard to find. Verified Freiburg 45 km flat: 5-candidate cap gave 814 m; 8-candidate pool finds ~548 m / 10.8 m/km. Do NOT drop the pool back to 5 for flat/hilly.

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
