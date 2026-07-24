# DATAMODEL — Sparki (24 juli 2026)

- **Database:** PostgreSQL (Replit-managed), Drizzle ORM. Schema-SSOT: `lib/db/src/schema/` (63 bestanden). Live: **162 tabellen** (volledige lijst: `export/current-state/DB_TABLES.txt`).
- **Migraties:** dev via `drizzle-kit push` (additief, migratieveilig — vaste afbouwregel); expliciete SQL-migraties in `lib/db/migrations/` (0001–0003: legal/ai_consents). Constraints altijd idempotent-guarded toegevoegd.

## Domeinclusters (tabelgroepen)

| Cluster | Kerntabellen |
|---|---|
| Identiteit & rollen | `user_profiles` (clerkId-identiteit, roles[], active_role), `athlete_profiles`, `coach_athlete_links`, `parent_athlete_links` |
| Activiteiten (Data Hub) | `training_sessions` (incl. `merge_log`, streams, bests, afgeleide TSS, dedupe_key), `connector_connections`, `connector_activities`, `sync_runs`, `webhook_events`, `activity_imports` |
| Planning | `training_plans`, `plan_days`, `planned_workouts`, `workout_feedback`, `life_events` (leefagenda) |
| Coaching-intelligentie | `ai_observations` (confidence, expiresAt, pattern), `ai_call_logs` (metadata-only), `core_predictions`, `athlete_daily_metrics`, `context_memories`, memory-graph-tabellen |
| Sportpaspoort | `passport_value_events` (waarde+event in één transactie), `passport_proposals` |
| Gezondheid & voeding | `health_complaints` (raises-only status), `nutrition_*`, seizoensdoel-tabellen, `ftp_history` |
| Wedstrijden | `races` (incl. localLaps), `race_points`, `race_exports`, `document_analyses` |
| Routes & navigatie | `routes` (versies), `route_shares` (nullsNotDistinct), `route_proposals`, `road_objects` (zelflerende verkeerslichten), `volgauto_*` |
| Sociaal | `friend_links`, feed-/share-tabellen, `live_location_*` (één positie-rij = geen historie), blokkades |
| Club | 16 `club_*`-tabellen (leden/rollen, trainingen, teams, selecties, berichten, audit) |
| Journey | `journey_*` (composed timeline, dossier, media) |
| Kennis & intel | `managed_knowledge_*` (versie-gepind, publish=tx+snapshot), `intel_*` |
| World (fictief) | `virtual_*`, `world_*` (harde muur naar echte data; media-cache met promptKey UNIQUE) |
| Doelen | `athlete_goals`, `goal_*` (afgeleide voorstellen via DB unique index + onConflict) |
| Meldingen | `notifications` (resolutionKey-dedupe, dedupeKey+sentAt), `push_subscriptions`, `reminder_preferences` |
| Beheer & release | `feature_flags` (composite PK), `kill_switches`, releasegroepen/uitrol, `health_check_*`, `error_*`, tester-/telemetrietabellen, invitations |
| Privacy & audit | `privacy_settings` (17 categorieën), `consent_audit_log`, `security_audit_log`, verwijderregister |
| Materiaal | `garage_*` (km afgeleid), `bike_scans`, `material_analyses`, foto's in object storage |
| Onboarding & support | `onboarding_state`, `support_*`, `helpdesk_turns` |

## Vaste datamodel-principes

1. **Additief & migratieveilig** — nooit bestaande data/relaties/historie verwijderen.
2. **Herkomst** — paspoort-events, merge_log, bronnenregister: elke waarde is herleidbaar.
3. **Dedupe op DB-niveau** — unique indexes + onConflict (nooit read-then-insert); partial-index-gotcha's gedocumenteerd.
4. **Eigenaarschap** — athlete-owned rijen altijd via clerkId-filter; coach-schrijfbare resources hebben eigen owner-kolom.
5. **Consent & audits als data** — consents, audit-logs en verwijdervensters zijn eersteklas tabellen.
