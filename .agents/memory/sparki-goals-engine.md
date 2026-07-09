---
name: Sparki Doelen-engine
description: Multi-year goals engine — derived goals never duplicated, proposals apply only on accept, concurrency-safe dedupe, Amsterdam-day idempotency.
---

# Sparki Doelen-engine

- Goal picture = manual rows (athlete_goals) + DERIVED goals composed at read time (A/B races, developmentGoal, nutrition season goal). Derived goals are NEVER duplicated into rows — derivedIds like `race:<id>`, `development`, `season_weight`.
- Proposals (goal_proposals) change nothing until explicitly accepted; on accept a whitelisted patch (targetDate/status) applies to the goal row and goal_events audit rows record everything.
- **Accepted steering proposals (load/recovery/nutrition) must have a REAL planning effect** — they become time-boxed (~35d from decidedAt) "Afgesproken bijsturing:"-directives appended to the goals context consumed by plan generation and coaching context. An accept that only flips a status is a silent no-op that breaks the honesty contract.
- Race-derived goals cover A/B/C priorities (A=1, B=2, C=3) — don't silently drop C.
- **Idempotency must be a DB constraint, not read-then-insert.** Unique index `(clerk_id, dedupe_key)` + `onConflictDoNothing({target:[...]})` with `.returning()` to count created vs skipped. Read-then-insert is not concurrency-safe under parallel job/API runs.
- **Per-day dedupe must compare Amsterdam LOCAL date**: `(created_at AT TIME ZONE 'Europe/Amsterdam')::date = <nl-date>::date` — never `createdAt >= '<date>T00:00:00Z'` (UTC midnight shifts around local midnight).
- **Doorvraagladder questions must be resolvable in the UI**: if `nextQuestion.goalId` points at an existing goal, the CTA must open an edit form for THAT goal (date/measure), not always a create-new form — otherwise the ladder stalls forever (architect caught this).
- Injections into coach analysis / athlete context / training plan are best-effort try/catch, never blocking.
