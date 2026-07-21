---
name: Power bests pipeline
description: How best-power windows are computed and why old sessions never backfill
---

Best-power windows (5s…20min) are computed ONLY at file parse time (FIT/TCX per-sample power) into `training_sessions.power_bests`.

**Why:** raw uploaded files are not retained (activity_imports stores no content), so there is no backfill path — bests exist only for rides imported after the feature landed. Strava's summary API carries no per-second power either.

**How to apply:** never "derive" bests from avg/NP; the UI must stay honest ("—" + re-import note). Gap seconds count as 0 W (conservative — a gap can only lower a best). A window longer than the ride is absent, not zero. Collector takes SECONDS, not ms (ms trips the 24h corrupt-span guard → null).
