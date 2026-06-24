---
name: Sparki trainingsverloop & session readback
description: How "development over multiple trainings" and past-session readback are built honestly without new endpoints.
---

# Trainingsverloop (development over time) + session readback

Users wanted more than "analyse van nu" — readback of past trainings and the
trajectory of their development.

## Decision: derive from existing real series, no new endpoint
- The "Trainingsverloop" view (CTL fitness trajectory + N-week TSS volume bars +
  Dutch verdicts) is computed client-side from already-real backend data:
  `useLoad().chartData` (CTL/ATL/TSB time series) + `useSessions(n)`.
- **Why:** aggregating/visualising real series is presentation, not fabrication.
  It satisfies the never-mock rule without inventing a backend engine. Bucketing
  is Monday-based UTC weeks in `lib/progression.ts` (pure, testable:
  `weeklyBuckets`, `trendDir`, `volumeTrend`).
- **How to apply:** prefer reusing real series for trend/insight UI before
  adding endpoints. Keep verdict logic deterministic (relative dead-band so tiny
  fluctuations read "stabiel"); never narrate a trend the data doesn't show.

## Session readback
- "Recente sessies" rows open a `SessionDetailDrawer` (Sheet side="right") that
  shows ONLY real logged TrainingSession fields, omitting nulls and giving an
  honest fallback when only the basics were logged.

## Empty-state must route to the *cause's* flow
- A missing-sessions empty-state must NOT reuse an unrelated registry target
  (e.g. "checkin"). The cause is "no logged trainings", so the CTA is
  "Log een training" → `/train?focus=logsession` (train has a focus handler that
  opens + scrolls the log form) plus "Koppel een platform" →
  `/you?focus=connections`. MissingInputNotice renders `primary`/`actions` even
  with no `targets`, so this is dead-end-free.
