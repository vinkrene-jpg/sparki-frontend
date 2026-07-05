---
name: FTP floor derivation
description: Why exact FTP is not derivable from stored ride data and how the honest lower-bound recalibration works.
---

# FTP-ondergrens uit ritdata

**Rule:** Sessions store only whole-ride avg/normalized power — no intra-ride power curve (no best-20-min). An exact FTP can therefore NEVER be derived; only an honest LOWER BOUND can: a 45–120 min ride proves FTP ≥ its NP; a 20–<45 min ride proves FTP ≥ 0.95×NP (whole-ride NP ≤ best-segment NP, so conservative).

**Why:** User asked whether a rider's "real" FTP (~335W) could be derived; Garmin/app values were stale and provably too low (rider held NP 298 for 49 min while app said FTP 272). Fabricating an exact value would violate the honesty contract; the floor is deterministic and provable.

**How to apply:** `estimateFtpFloor` (pure, in derived-load) + `recalibrateEstimatedFtp` (backfill module). Only profiles with `ftpEstimated=true`, only RAISES, window ~120 days, keeps the estimated flag true so stronger efforts keep raising it. Records an `ftp_history` row `testType="derived"` at the proof-ride date — idempotent PER Day (update same-day derived row, never stack duplicates) because `ftpAtDate` needs a deterministic same-day tie-break (highest watts wins). Runs FIRST in both post-sync refresh and boot backfill so the corrected FTP feeds TSS derivation. A user-measured FTP is never touched — for an exact number the user sets it manually or does a real test.
