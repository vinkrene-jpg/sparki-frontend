---
name: Sparki wedstrijdexport naar fietscomputers
description: GPX/FIT export engine — honesty rules, FIT encoding, guide-diff reconfirm lifecycle
---

# Wedstrijdexport (race-export)

- Engine `artifacts/api-server/src/lib/race-export/` + dep-free FIT writer `lib/fit-encode.ts`; round-trip parser `fit-course-parse.ts` verifies CRC, fileType (6=course, 5=workout), counts and distance BEFORE any file is released. Downloads always rebuild deterministically from current points/route (history rows are records, not stored blobs).
- **Honesty rules:** only `bevestigd|aangepast` points exported; unplaced/off-route points are validation errors/warnings, never fabricated positions; FIT Workout only when a real warmup (≥5 min) or linked planned workout exists (`buildWorkoutSteps` → null otherwise); elevation only from track or real stored profile. Wahoo/Karoo = explanatory copy only, NO sync button.
- **Guide-diff lifecycle** (`guide-diff.ts`): match same kind within 1.0 km; >0.2 km shift on an active point ⇒ `needsReconfirm` + note (never auto-move); shift >1 km falls outside match ⇒ old point "disappeared" (reconfirm) + new candidate proposal — that split is by design. Old *proposals* get silently updated (not yet a rider choice). Manual points (sourceAnalysisId null) untouched by disappearance. New guide flips actueel race_exports to "verouderd" with staleReason.
- Reconfirm cleared only by race-points PATCH to bevestigd/aangepast; export POST 409s while reconfirm pending.
- **Why:** confirmed points are rider decisions; a guide is a proposal source, never authoritative over them.
- Gotcha: `CandidateRacePoint` has no `label` field (description/page/lat/lng); preflight `hasRoute` must use the same ≥10-point minimum as §8 validation or UI status contradicts the block.
