---
name: Sparki Insights origin & migration audit
description: Where the original Sparki Insights app lives and which docs track the migration gap.
---

- The original **Sparki Insights** app (Next.js 16, single mock source `lib/sparki-data.ts`, no auth/backend) is preserved at `.migration-backup/`. It is the **content source-of-truth**; the new frontend (`artifacts/sparki/`) is the presentation/UX layer only.
- **Why:** the user mandated that no Insights functionality may disappear in the migration; the new app is full-stack (Clerk auth + Express + Postgres) so mock data must become a real data model.
- Migration gap is tracked in repo-root `SPARKI_MIGRATION_AUDIT.md` (comparison table + phased plan) and the consolidated target in `SPARKI_MASTER_BLUEPRINT.md`.
- **Known missing in new frontend** (verified): power/duration curve (Lab), route planner (elevation/climbs/turn-by-turn), fueling schedule, prep checklist, interval-block visualization, gear + connected-apps in You; feed data is static (no posts table); goals reduced to a single text field.
- **How to apply:** before building new athlete features, check the audit so you complete a partially-migrated feature rather than duplicating or overwriting it.
