---
name: Sparki derived belastingscore (TSS)
description: TSS derivation from power+FTP at ingestion + startup self-heal backfill; estimated weekly-target recalibration from real riding.
---

# Derived belastingscore + weekly-target recalibration

**Rule:** Providers like Strava never send TSS. Sparki derives it deterministically (TSS = hours × IF² × 100, IF = NP/FTP fallback avgPower/FTP) at ingestion AND via an idempotent startup backfill (`backfillDerivedLoad`, fire-and-forget after `app.listen`, advisory-locked). Provider-supplied TSS always wins; no power or no FTP ⇒ stays honestly null; IF>2 or TSS outside 0–1000 ⇒ refused (wrong FTP / corrupt power must not poison the load model).

**Why:** 200 prod Strava rides had rich power data but tss NULL on every row → the whole CTL/vorm engine saw zero load despite months of riding. The prod DB is agent-read-only, so the only repair path is a runtime self-heal on boot (same pattern as world-seed).

**How to apply:**
- FTP-at-date comes from ftp_history (latest at-or-before ride date, else earliest, else profile ftp).
- Weekly-target recalibration ONLY when `weeklyHourTargetEstimated=true`: median hours over last 8 COMPLETE weeks with riding (current week excluded, ≥4 riding weeks required, empty weeks skipped so holidays don't drag it down). Flag stays true so it keeps tracking reality; user-set targets are never touched.
- Post-sync hook `refreshDerivedLoadForAthlete` (best-effort, never breaks a sync) re-derives after each import.

**Gotchas:**
- `pg_try_advisory_lock`/`unlock` are SESSION-bound — must run on ONE dedicated `pool.connect()` client (acquire + unlock + release on the same client), never via `pool.query`, or the lock sticks on another pooled session and every future run silently skips.
- `buildMergePatch` only merges fields in `MERGEABLE_FIELDS` (data-hub dedupe) — adding a new derived column to insert/merge paths requires adding it there too, or the merge path silently drops it.
- **Trainingsvolume-grafieken moeten TIJD plotten, niet TSS.** TSS bestaat alleen bij ritten met vermogensdata; een volume-grafiek op totalTss laat echte ritten zonder power als 0-hoge balken zien en lijkt "bevroren"/mock. Volume = totalMin (elke gelogde rit heeft duur), uren-notatie "4,5u"; TSS blijft de belastingsmaat, niet de volumemaat. UitlegDot-key moet meebewegen (aparte `trainingsvolume`-uitleg, niet de TSS-uitleg `belasting`).
