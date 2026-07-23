---
name: Add-training flow split
description: Chooser-first Training toevoegen modal; plan vs log data separation; contextDate wiring lesson
---
- The "Training toevoegen" modal is chooser-first (plan / log / blokken); a calendar day context preselects plan (future) or log (past), today/none stays a choice (pure `chooseInitialMode`).
- Plan-only fields live in `planned_workouts.plan_details` (jsonb) behind a server whitelist that 400's executed-experience keys; executed data stays on sessions. **Why:** keeps voorspelling vs werkelijkheid honestly separated.
- **Lesson:** a prop-based context feature (contextDate) is worthless until a real caller passes it — architect FAILed the first round because no calendar entry point wired it. Always wire at least one real entry point (here: DayDetailDrawer in the 3-week plan) in the same wave.
- Labels only: "Rit"→"Fietstraining", run/swim = "Crosstraining — …"; DB type values stay English per dutch-copy-exceptions.
