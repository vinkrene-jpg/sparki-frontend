---
name: Sparki plan lifecycle single-current-plan
description: Training-plan pause/resume/delete must be scoped to one deterministic current plan, shared with the view.
---
Rule: all plan lifecycle reads and writes (view, pause, resume, delete) go through ONE selector — `resolveCurrentPlan` (newest active, else newest paused). Never do status-wide bulk updates (`WHERE status='active'`) for lifecycle actions.

**Why:** bulk status updates could flip/delete multiple plans at once (historic paused plans, double actives after resume); architect FAIL caught this. Resume defensively archives other paused plans so a single-active invariant holds.

**How to apply:** any new lifecycle endpoint or job on training_plans resolves the current plan id first and scopes the mutation to that id + clerkId. Delete removes plan_days + still-planned workouts only; completed workouts are detached (planId null) and training_sessions are never touched. Regression: test:plan-lifecycle scenarios 11–13 (multi-plan).
