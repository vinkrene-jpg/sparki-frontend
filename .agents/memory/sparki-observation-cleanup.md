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

**Automatic runs (task "vanzelf opruimen"):** same rules, never delete. Two paths:
event-driven — derived-load-backfill self-heal fires `runAutomaticObservationCleanup(clerkId,
"ftp_achterhaald")` AFTER commit when it newly marks `[achterhaald]` rows (RETURNING id count);
periodic — `sweepObservationCleanup()` at api-server boot + daily setInterval over all users with
active observations. Event metadata carries `trigger` so auto vs manual runs are distinguishable.
Cleanup call must run after the tx commits or it won't see the freshly marked FTP rows.

**§4.1/§4.4 bevestigd geheugen (AI_COACH):** statuses `voorlopig`/`bevestigd`/`weerlegd`; in de
coach-prompt mag ALLEEN `bevestigd` een directief advies dragen — alle andere statussen krijgen
expliciet een vraag/continuïteit-only-tag. Bevestigingsvraag: max 1/Amsterdam-dag, idempotent,
atomair via `pg_advisory_xact_lock('memory-confirm:'+clerkId)`; antwoord alleen geldig op een rij
met een `confirm_question_shown`-event (anders 404). `klopt_niet` → weerlegd + correctie-observatie
(dedupeKey `correctie:<origineel>`, sourceType moet uit het bestaande enum komen — `manual_note`).
Vergeten: cleanup demoveert >365d nooit-bevestigd (alleen new/acknowledged/saved!) naar voorlopig;
voorlopig + her-voorlegging ≥14d geleden getoond → stil `outdated`. Cleanup-actief-set moet
voorlopig+bevestigd bevatten of bevestigde rijen ontsnappen aan regels A–C. NB: privacy
`ai_memory_enabled=false` slikt de correctie-persist stil in — by design, maar verwarrend bij testen.

**Why:** production user accumulated 120 "new" rows retelling the same FTP story; the fake
"terugval van 331W" came from an outdated derived FTP row, not a real decline.

**Gotchas (durable):**
- A job CLI guard `argv[1].includes("<name>")` also matches a TEST bundle with the same
  filename: match on the `jobs/` path segment instead.
- Production APPLY of any cleanup needs René's explicit akkoord; dry-run rapportage vooraf is
  the contract (see open-choices tracker).
