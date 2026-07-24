# Achtergrondprocessen — Sparki (24 juli 2026)

## Geplande jobs (Scheduled Deployments; CLI in `artifacts/api-server/src/jobs/`)

| Job | Script | Cadans (aanbevolen, Europe/Amsterdam) | Doet |
|---|---|---|---|
| Connector-sync | `job:sync` → `jobs/connector-sync.ts` | dagelijks 05:00 (`0 5 * * *`) | Inhaalsync voor álle gekoppelde platforms via `runScheduledConnectorSync` (zelfde `shouldCatchUp`-regels als per-gebruiker; sequentieel; busy=overslaan; `SYNC_JOB_MAX_CONNECTIONS`). |
| Doelen-review | `job:goal-review` → `jobs/goal-review.ts` | maandelijks (`0 6 1 * *`) | Maandelijkse doelen-review per sporter (`GOAL_REVIEW_MAX_ATHLETES` klep). |
| Health check | `jobs/health-check.ts` | periodiek | Draait de echte admin-probes; release-modus faalt op rood. |
| Kennisscan | `jobs/knowledge-scan.ts` | periodiek | Literatuur-/bronneningest met word-boundary relevantie-guard. |
| Herinneringen | `jobs/reminders.ts` | dagelijks | E-mailherinneringen; idempotent via notifications dedupeKey+sentAt; slaat eerlijk over zonder geverifieerd maildomein. |

Alle vijf zichtbaar in het admin-overzicht "Geplande taken" (`lib/scheduled-tasks.ts`): eerlijke status per job (groen/grijs met reden), cadansbewaking op echte traces.

## In-proces achtergrondmechanismen

- **Per-gebruiker Strava-inhaalsync** (`maybeScheduleStravaCatchUp`): bij app-gebruik, incrementeel met overlap.
- **Webhook-verwerking** (`routes/webhooks.ts`): Strava push-events → gerichte `runSync` per activiteit; fail-closed secrets.
- **Boot self-heal**: afgeleide belastingscore-backfill (`lib/derived-load-backfill.ts`) bij het opstarten.
- **Lazy refresh op leespad**: nieuwsversheid ververst zichzelf bij lezen (geen stille rot als een Scheduled Deployment ontbreekt).
- **Busy-/lock-mechanismen**: pg advisory locks (sync per gebruiker+platform, ticket find-or-create, TSS-backfill).

## Wat er bewust NIET is

Geen cron-daemon in de webserver, geen queues/workers buiten bovenstaande, geen fire-and-forget die stil kan falen (audits zijn de bewuste uitzondering en zijn gelogd).
