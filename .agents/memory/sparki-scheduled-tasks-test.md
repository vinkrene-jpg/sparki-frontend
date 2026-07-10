---
name: Sparki scheduled-tasks overview test
description: How the /admin "Geplande taken" (scheduled jobs) overview is tested, and why route-level tests seed fresh traces.
---

# Scheduled-tasks (/admin) overview testing

The `GET /api/admin/scheduled-tasks` handler derives each job's last-run status
(green/orange/grey) from real data traces. Two test layers lock it in:

1. **Pure unit** — classification logic lives in `lib/scheduled-tasks.ts`
   (`classify(lastRunAt, staleAfterDays, now)` + `buildScheduledTasks(traces, now)`),
   extracted from the handler so `now` is injectable and thresholds are
   deterministic. Test: `tests/scheduled-tasks.ts`.

2. **DB-backed route** — `tests/scheduled-tasks-route.ts` boots the real app,
   acts as a dev admin via `x-dev-clerk-id`, and hits the endpoint.

**Key gotcha:** the handler's queries are GLOBAL aggregates
(`max(created_at)`, newest-first, `count(*)`), NOT per-user. You cannot force a
"no trace → grey" or "orange" state at route level without wiping shared tables.
So the route test instead seeds ONE fresh, newest trace per job (health batch
`triggeredBy='scheduler'`, goal proposal, `reminder:`-prefixed notification,
knowledge item) and asserts each job is detected green with `lastRunAt` echoing
the seeded instant. A fresh row is guaranteed newest → wins regardless of
pre-existing data, and if a column/table/dedupeKey-prefix drifts the seeded row
won't be found and the assertion fails. Branch/threshold coverage (orange, grey,
no-active-goals) stays in the pure unit test.

**Why:** the failure mode the feature guards against is silent query drift; a
pure-only test can't catch a renamed column or changed `dedupeKey LIKE 'reminder:%'`.

**How to apply:** to test any endpoint built on global `max()`/newest-first
queries, seed a fresh newest row and assert identity (matching timestamp), not
just colour; clean up only your own rows, never truncate shared tables.
