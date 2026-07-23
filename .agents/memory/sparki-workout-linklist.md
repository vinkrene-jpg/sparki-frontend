---
name: Workout koppellijst honesty
description: Why the rit→training link picker showed "mock" workouts and the contracts that keep it honest
---

**Rule:** The rit→training koppellijst may only read from the central calendar API (planned_workouts); every workout list query shares one invalidation key prefix, and pickers must filter out soft-cancelled rows.

**Why:** The "fictieve trainingen" bug had two real causes, neither of which was frontend mock code: (1) seeded dev-QA planned_workouts rows for the DEV_AUTH_BYPASS default user polluted the dev DB; (2) create/update mutations didn't invalidate the windowed list query, so new trainings stayed invisible (looked like a stale/fake list). Also: workout DELETE is a soft cancel — the row stays with status="cancelled" for history — so any picker that treats "not deleted" as linkable will show ghost trainings.

**How to apply:**
- Linkable = sessionId == null AND status not in completed/skipped/cancelled.
- Any new workout mutation must invalidate the shared workouts list key prefix.
- Date windows must use LOCAL calendar dates, not toISOString (UTC drift).
- API errors show honest Dutch copy; never substitute data.
- When "mock data" is reported, check seeded dev-DB rows and query-cache staleness before hunting for frontend fallbacks.
