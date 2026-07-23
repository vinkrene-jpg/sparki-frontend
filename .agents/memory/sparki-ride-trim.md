---
name: Sparki rit-einde & rit-inkorten
description: Auto-pause/auto-end during mobile recording + reversible trim of saved rides.
---

- Recording-time auto behaviours live in a PURE engine (`ride-flow`), integrated at the 1Hz tick in the recorder hook — never scatter heuristics through UI code.
- Auto ride-end: strong confidence auto-stops and trims to the last likely bike point, but the FULL recording snapshot stays in component state so "Toch de hele opname bewaren" can undo it before save. Weak confidence only shows a confirm banner. Nothing is finalized without the rider.
- Auto-end/full-recording state must be cleared on every lifecycle exit (save success, discard, new start) or a stale correction notice leaks into the next ride.
- Saved-ride trim is metadata-only: additive jsonb `training_sessions.trim_edit` keeps `original` (FIRST snapshot wins across repeated trims) so restore is always exact; raw import in `activity_imports.parsed_summary` is never touched. Detail GET slices track/profile on read.
- **Why:** geometry has no timestamps, so trimmed duration is a distance-proportional estimate — always label it "geschat", and return null (not a fake ≥1 min) when the track has zero measurable distance.
- **How to apply:** any future trim/crop feature: validate index range server-side, ownership via clerkId filter (404), recompute only from real data (elevation needs ≥80% ele coverage else null).
