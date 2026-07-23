---
name: Sparki route-match engine (off-route detection)
description: Shared segment-based map-matching + off-route state machine for web and mobile navigators.
---

# Route matching & afwijkingsdetectie

**Rule:** GPS must never be compared against loose route POINTS with a fixed threshold — sparse geometry (points far apart) makes an on-route rider look 50+ m "off". Always project onto route SEGMENTS.

**Why:** the original navigators used `nearestPointIndex` + fixed 60 m + single-reading flag → chronic false "Je wijkt af van de route" warnings.

**How to apply:**
- Pure engine `route-match.ts` is byte-identical mirrored in `artifacts/sparki-mobile/lib/` and `artifacts/sparki/src/lib/` — a test asserts byte-identity; edit mobile copy then `cp` to web.
- One position source: map marker, progress and deviation all derive from the same `matchToRoute` result; `displayPosition` snaps the marker to the matched point only within corridor, raw GPS otherwise (honesty).
- Off-route needs the full state machine (`updateOffRoute`): dynamic corridor (accuracy+speed), ≥3 readings + ≥6 s, progress guard, >35 m/s jump filter with second-reading confirm, hysteresis exit at 0.8×corridor, episode counter.
- React wiring: never mutate the hint ref inside `useMemo` — update it in a `useEffect` after commit.
- run-tsx-test.mjs can crash flakily for this test; `npx tsx --test` directly works.
