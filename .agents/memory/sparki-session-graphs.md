---
name: Sparki session graphs & stream analysis
description: How ride graphs/analyses work — streams at ingest only, honest gaps, comparability gate, estimated maxHR labeling.
---

- Per-sample streams (≤720 buckets) are harvested ONLY at FIT/TCX/GPX ingest into `parsedSummary.streams`; raw files are not retained, so older sessions are honestly `streams:null` — UI must keep the honest empty state, never backfill.
- Charts must keep `connectNulls={false}` (recharts): sensor dropouts stay visible gaps. **Why:** the no-fabrication contract — interpolating hides sensor failure.
- Session comparison is gated by `assessComparability` (type / duration ×1.35 / shared meetbasis / terrain m-per-km). Not comparable ⇒ show the plain-Dutch reasons, zero numbers.
- Profile has NO measured max heart rate; HR zones use Tanaka (208 − 0.7×age) from birthDate and MUST be labeled as leeftijdsschatting in the chart meta.
- Interval-vs-plan uses `planned_workouts.structure.blocks` joined via `planned_workouts.sessionId`; returned inside GET /sessions/:id as `plannedWorkout`.
- api-server test harness needs `DEV_AUTH_BYPASS=true` env when run via shell (`DEV_AUTH_BYPASS=true node ./scripts/run-test.mjs <name>`), else all requests 401.
