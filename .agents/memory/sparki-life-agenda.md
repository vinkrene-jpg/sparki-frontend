---
name: Sparki leefagenda (life events)
description: School/familie/werk events the plan generator builds around — overlap query semantics and impact rules.
---

The "privéleven" feature is a real DB-backed leefagenda: athlete-entered events (school/familie/werk/anders) with an impact level, read by the 3-week plan generator so the schedule is built AROUND real life.

**Rules:**
- Impact levels: `geen_training` (honest rest row titled "Vrij — <label>", rationale states the athlete's own reason), `alleen_licht` (day becomes a short recovery spin), `minder_tijd` (session capped ~45 min). Strongest impact wins on overlapping events.
- **Why:** a schedule that respects real life is kept; forcing sessions on busy days breaks trust and gets ignored.

**How to apply:**
- Any query listing events must use OVERLAP semantics (`coalesce(endDate, startDate) >= cutoff`), never `startDate >= cutoff` — otherwise long-running/ongoing events still steer the plan but become invisible and undeletable in the UI.
- Only athlete-entered events reach the generator — never inferred/assumed busy days.
- Reactive chat detection (context-memory kinds school/familie/werk) is separate and does NOT feed the planner.
