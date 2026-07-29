---
name: Sparki observation cleanup + persist-side strekking-dedupe
description: Creation-side content dedupe for ai_observations, achterhaald-FTP guard, and the auditable cleanup job.
---

# Observatie-opschoning & aanmaakpoorten

**Persist-side gates in `persistObservation` (lib/ai-memory.ts), non-`system` only:**
1. **Achterhaald-poort** — text citing a derived FTP watt marked `[achterhaald]` in ftp_history
   (e.g. "terugval van 331W") is a data artefact and is NOT stored; logged as
   `observation_suppressed` memory event (reason `achterhaalde_ftp_waarde`).
2. **Strekking-poort** — near-duplicate content vs active rows of last 45 days (word overlap ≥0.6
   OR ≥2 shared numbers, mirrored from web `dedupeObservationsByText`) returns the existing row
   instead of inserting; logged as `observation_suppressed` (reason `zelfde_strekking`).

Server-side heuristiek lives in `engines/observation/content-dedupe.ts` (mirror of
`artifacts/sparki/src/lib/insight-grouping.ts` helpers — keep in sync if thresholds change).

**Cleanup job** `src/jobs/observation-cleanup.ts` (`pnpm run job:observation-cleanup -- --clerk-id=… [--apply]`):
dry-run by default, sets status `outdated` (existing enum value — never hard delete), rules
achterhaalde_ftp_waarde → verouderd_doel (>14d old, "doel"+watts not matching current profile FTP)
→ zelfde_strekking (newest kept as representant). Reports ids before, re-counts after, logs
`observation_cleanup` event.

**Why:** production user accumulated 120 "new" rows retelling the same FTP story; the fake
"terugval van 331W" came from an outdated derived FTP row, not a real decline.

**Gotchas (durable):**
- A job CLI guard `argv[1].includes("<name>")` also matches a TEST bundle with the same
  filename: match on the `jobs/` path segment instead.
- Production APPLY of any cleanup needs René's explicit akkoord; dry-run rapportage vooraf is
  the contract (see open-choices tracker).
