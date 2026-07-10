# Sparki — Release-Readiness Report

_Generated: 10 July 2026 · Environment: development (no production changes made · no auto-publish)_

## 1. Verdict — GO / NO-GO

| Scope | Verdict |
|---|---|
| **This task's directive scope** (privacy re-validation of merged tests, DB drift fix, UX items, bundle investigation) | **GO** — all green |
| **Full production release** | **NO-GO (conditional)** — blocked only by the in-flight unlink/revocation privacy series (see §3) which is separate task-agent work not owned or mergeable here |

**Recommendation:** Do not publish yet. Everything in this task's scope is complete, verified and non-destructive. Full release GO should wait until the revocation/unlink privacy series (#187, #189–#192) merges and cross-account isolation is re-run post-merge.

---

## 2. Build / Typecheck / Smoke

| Check | Command | Result |
|---|---|---|
| Full typecheck (4 projects) | `pnpm run typecheck` | **exit 0** — api-server, sparki, mockup-sandbox, scripts all Done |
| Frontend production build | `pnpm --filter @workspace/sparki run build` | **exit 0** |
| API server build (esbuild) | `pnpm --filter @workspace/api-server run build` | **exit 0** |

Re-run twice (before and after the two architect-flagged fixes) — both green.

**Flaky-test fix (found during validation):** `test-scheduled-tasks-route` and `test-feedback-adjust` failed the validation run with a `thread-stream`/pino error ("worker is not a function" / "the worker has exited") — the pino-pretty **worker-thread transport** racing with process exit in short-lived (test/job) processes. Confirmed flaky (both tests pass when run directly). Fixed at root in `artifacts/api-server/src/lib/logger.ts`: dev now uses a **synchronous in-process pino-pretty stream** instead of the worker transport (prod still plain JSON). Both tests then pass **4/4** consecutive runs; api-server dev workflow restarts clean.

---

## 3. Privacy / Cross-Account Isolation — negative-test evidence

All three **merged** isolation suites re-run fresh against the dev DB. Each combines negative assertions (denied / no-read / no-mutation) with positive controls (owner still allowed).

| Suite | Result |
|---|---|
| `test:cross-account-isolation` | **19/19 PASS** (exit 0) — sessions, imports, nutrition photos, material photos: non-owner denied read + mutation; owner positive controls pass |
| `test:coach-parent-link-isolation` | **10/10 PASS** (exit 0) — coach/parent see only linked athletes; unlinked/pending → 403 no read, adopt → 403 zero mutation; cross-role denied |
| `test:coach-parent-sharing-levels` | **13/13 PASS** (exit 0) — sharing tiers (none/summary/full, safety_only) cap exactly what each role reads; no metric/memory/schedule leaks; empty shapes never 500 |

**Still in-flight (NOT in this task — separate isolated task agents):** revocation/unlink series #187, #189, #190, #191, #192. These were not duplicated or touched here. Full release requires them to merge, after which cross-account isolation must be re-run.

---

## 4. Database — schema drift (fixed non-destructively)

**Blocking issue resolved:** `drizzle-kit push` previously showed a data-truncating interactive prompt. Root cause = PostgreSQL 63-character identifier truncation causing name mismatches on two unique constraints.

- **Fix:** gave the constraints explicit short names in schema (`lib/db/src/schema/sparki-world.ts`) and applied a matching rename to the live dev constraints. **`push` now exits 0 with NO prompt.**
- **Verified constraints:** `virtual_rel_athlete_related_kind_uq`, `nutrition_season_goals_clerk_id_unique`.
- **Non-destructive:** a pure constraint rename — no table rewrite, no data migration, fully reversible.

### Controlled SQL migration & verification — `virtual_rel_athlete_related_kind_uq` (2026-07-10)

Re-executed as a **controlled, idempotent, guarded SQL migration** to produce an auditable record. The constraint was already present from the rename above, so the migration is a **verified no-op** (it only `ADD`s when absent) — nothing was created, changed or deleted.

**Exact target**
| | |
|---|---|
| Table | `public.virtual_athlete_relationships` |
| Columns | `(athlete_id, related_athlete_id, kind)` |
| Constraint name | `virtual_rel_athlete_related_kind_uq` |
| Type | `UNIQUE` |

**Migration SQL:** `lib/db/manual/2026-07-10_virtual_rel_unique.sql` — one atomic transaction: `LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE` (blocks concurrent writes, allows reads) → NULL guard → duplicate guard (both `RAISE EXCEPTION` on violation) → idempotent `ADD CONSTRAINT` (only if missing) → post-check on `pg_get_constraintdef` → `COMMIT`. No `TRUNCATE`/`DELETE`/reset/regeneration.
Run with: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/manual/2026-07-10_virtual_rel_unique.sql`

**Pre-flight (exact constraint expression)**
- Duplicates on `(athlete_id, related_athlete_id, kind)`: **0** groups (also 0 under `lower(btrim(kind))` normalization).
- NULLs in the three columns: **0**.
- Normalization: 3 distinct `kind` values (`friend, rival, teammate`), **0** untrimmed, `distinct = distinct_normalized = 3` → no normalization differences.
- Recoverable snapshot: `pg_dump` of the full table → `.local/backups/virtual_athlete_relationships_2026-07-10.sql` (322,550 bytes, 3668 data rows, incl. `CREATE TABLE`).
- Integrity fingerprint **before**: `md5 = 67d5e4adb71506045b25a2ae23f66ab9`, rows = 3668.

**Verification output**
| Check | Result |
|---|---|
| Migration | `exit 0`; `NOTICE: Constraint al aanwezig — no-op (idempotent)`; `NOTICE: Post-check OK: UNIQUE (athlete_id, related_athlete_id, kind)` |
| Row count before → after | **3668 → 3668** (exact) |
| No records changed/deleted | `md5` after = `67d5e4adb71506045b25a2ae23f66ab9` — **identical** to before |
| Constraint exists | `UNIQUE (athlete_id, related_athlete_id, kind)` present on the table |
| Deliberate duplicate insert | **REJECTED** — `ERROR: duplicate key value violates unique constraint "virtual_rel_athlete_related_kind_uq"` (psql exit 3), rolled back |
| Valid new relation `(1, 4, 'friend')` | **ACCEPTED** — `INSERT 0 1`, count 3669 in-tx, then `ROLLBACK` → 3668 (no data change) |
| Drizzle ↔ DB in sync | `drizzle-kit push --strict --verbose` diff does **NOT** list `virtual_rel_athlete_related_kind_uq` → in sync. Nothing was applied (aborted at the TTY confirm prompt before executing); post-run `md5`/rowcount/constraint all unchanged. |

**Note on remaining `drizzle-kit` diff:** the strict-push output still lists the pre-existing cosmetic drift below (6 truncated-name FK drop/re-adds — including this table's `related_athlete_id` **FK**, a different object — and 3 array `'{}'` default churns). Those are **not** our unique constraint and are **not** destructive (no `TRUNCATE`/`DELETE`); they are deliberately out of scope for this constraint task.

### Residual non-idempotency — documented, NOT fixed (non-destructive, non-blocking)
`push` still reports "Changes applied" on every run because it drops+re-adds 6 further Postgres-truncated FK names (activity_imports, connector_activities, group_training_invitees ×2, group_training_proposals, virtual_athlete_relationships FK) and churns 3 array `'{}'` defaults (feature_flags.enabled_roles, knowledge_items.authors/disciplines). This is **cosmetic** — the FK/default definitions are identical each run; nothing is lost. A full 6-FK rename refactor was **deliberately declined** as higher-risk than the cosmetic churn it would remove.

---

## 5. No-data-deleted confirmation

Row counts on the two constraint-touched tables, unchanged before → after:

| Table | Rows |
|---|---|
| `virtual_athlete_relationships` | **3668** (unchanged) |
| `nutrition_season_goals` | **1** (unchanged) |

**0 rows lost.** No `TRUNCATE`, `DROP TABLE`, `DROP COLUMN`, or destructive migration was executed at any point.

---

## 6. Bundle investigation ("7.3 MB") — safe code-splitting only

**Finding:** the 7.3 MB figure is the **api-server esbuild SERVER bundle**, which runs on the server only and is **never shipped to browsers**. It bundles Express + Drizzle + all engines + the Anthropic/Google generative SDKs. It affects cold-start weight only, not user download or page load.

**The browser bundle** (what users actually download) was a single 1.42 MB JS chunk (377 KB gzip) + 186 KB CSS (31 KB gzip).

**Action taken — behavior-neutral vendor code-splitting** (`vite.config.ts` `manualChunks`, no `React.lazy`/Suspense, zero runtime behavior change):

| Chunk | Size (raw) | gzip |
|---|---|---|
| index (app) | 1,235 KB _(was 1,422)_ | 319 KB _(was 377)_ |
| vendor-map (leaflet) | 149 KB | 43 KB |
| vendor-react | 17.5 KB | 6.7 KB |
| vendor-qr | 16.4 KB | 6.1 KB |
| vendor-charts / vendor-motion | ~1 KB each | — |

**Honest caveat:** total first-load bytes are ~unchanged — these screens are still statically imported, so this is a **caching/organization win** (vendor code cached separately across deploys), **not a first-load size cut**. A real size reduction needs route-level lazy loading of the heavy, rarely-first-seen screens (maps, charts, QR). That is **recommended as a follow-up** and was deliberately deferred here to stay within "safe code-splitting only."

---

## 7. UX items (all implemented + reviewed)

1. **Activity import** empty state → direct "+ importeer je eerste bestand" button (opens file picker; no dead-end).
2. **Test dashboard** empty state → "Nodig een tester uit" button navigating to `/tester-qr`.
3. **Route planner** default distance now seeded from the nearest planned workout's duration (editable, guarded by `distanceTouched`), with honest "Geschat op basis van je geplande trainingsduur — pas gerust aan." framing.
4. **Tester QR** prefills tester name once from profile (guarded so it never overwrites typed input), and base URL now honors a `VITE_PUBLIC_APP_URL` config override (localStorage manual override still wins → env → origin).

**Architect code review:** ran on all changes. Two flagged items **fixed before sign-off**: (a) tester-name prefill could overwrite fast-typed admin input → now gated on empty field; (b) route distance lacked estimate framing → added honest "Geschat…" label. Runtime sanity: `/you` renders clean, no console errors.

---

## 8. Commits, working state & rollback

- **Baseline HEAD before this migration record:** `131d27a`. The migration artifact (`lib/db/manual/2026-07-10_virtual_rel_unique.sql`) + this report update are committed by the platform at task close (this task's checkpoint commit).
- **Earlier constraint/DB checkpoint:** `66fef2b` — DB checkpoint taken before the original DB drift work.
- **Prior relevant commits:** `859c44d` (route empty-state button, = `gitsafe-backup/main`), `e62565f` / `13c02a8` / `40f706f` (isolation tests).

**Rollback plan:**
- Code / migration artifact: Replit checkpoints — restore to `131d27a` (pre-record) or `66fef2b`; or delete `lib/db/manual/2026-07-10_virtual_rel_unique.sql`.
- Constraint: the migration is a non-destructive `ADD CONSTRAINT` (idempotent). To reverse a *fresh* add, run `ALTER TABLE public.virtual_athlete_relationships DROP CONSTRAINT virtual_rel_athlete_related_kind_uq;`. (In this run it was already present and unchanged, so there is nothing to reverse.)
- Data snapshot: `.local/backups/virtual_athlete_relationships_2026-07-10.sql` (full `pg_dump`, 3668 rows). Restore with `psql "$DATABASE_URL" -f .local/backups/virtual_athlete_relationships_2026-07-10.sql` (drop/recreate the table first if it exists). No data was mutated, so restore is only a contingency.

---

## 9. Constraints honored

- No production changes; no auto-publish. Never fabricated data. Plain Dutch, no user-facing "AI", neutral voice, honest empty states, RED-S/intelligent-werkblad doctrine untouched. Cinematic dark/cyan design preserved.
