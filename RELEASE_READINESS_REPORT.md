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

- **HEAD:** `66fef2b` (`test(api): verify privacy sharing levels limit linked coach/parent reads`) — also the DB checkpoint taken before DB work.
- **Prior relevant commits:** `859c44d` (route empty-state button, = `gitsafe-backup/main`), `e62565f` / `13c02a8` / `40f706f` (isolation tests).
- **Uncommitted working changes** (6 files, +120/−7) — committed by the platform at task close: `activity-import-panel.tsx`, `route-panel.tsx`, `test-dashboard.tsx`, `tester-qr.tsx`, `vite.config.ts`, `sparki-world.ts`.

**Rollback plan:**
- Code: Replit checkpoints — restore to `66fef2b` (or `gitsafe-backup/main` @ `859c44d`).
- DB: the only DB change is a reversible constraint rename; no data migration to undo. Rename back to the truncated names if needed.

---

## 9. Constraints honored

- No production changes; no auto-publish. Never fabricated data. Plain Dutch, no user-facing "AI", neutral voice, honest empty states, RED-S/intelligent-werkblad doctrine untouched. Cinematic dark/cyan design preserved.
