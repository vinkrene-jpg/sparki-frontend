---
name: Non-destructive unique-constraint migration + verification
description: How to add a UNIQUE constraint safely/idempotently on a populated table and prove nothing changed, plus a safe drizzle-kit sync check.
---

# Non-destructive constraint migration pattern

When asked to add a UNIQUE (or similar) constraint on a populated table without any data loss, use a **single atomic, guarded, idempotent** SQL migration and prove immutability with a fingerprint.

**Migration shape (one transaction):**
1. `LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE` — blocks concurrent INSERT/UPDATE/DELETE for the (sub-second) duration, still allows reads.
2. NULL guard + duplicate guard on the **exact** future-constraint expression, each `RAISE EXCEPTION` on violation — so it can never silently need a destructive dedup.
3. `ADD CONSTRAINT` wrapped in `IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=… AND conrelid='…'::regclass)` — idempotent; a no-op when already present.
4. Post-check `pg_get_constraintdef` equals the expected definition.
5. `COMMIT`. Never `TRUNCATE`/`DELETE`/reset/regenerate.
Run atomically via `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f file.sql` (executeSql/one-statement tools can't hold a LOCK across calls — the transaction must be one script).

**Proof-of-immutability:** compute a whole-table fingerprint before and after and require equality:
`SELECT md5(string_agg(t::text,'' ORDER BY id)) FROM tbl t;` — identical md5 + identical row count ⇒ zero records changed/deleted. Take a real `pg_dump -t table` snapshot first for recoverability.

**Behaviour tests:** deliberate duplicate insert must be REJECTED (`duplicate key value violates unique constraint`, psql exit 3); a valid new row must be ACCEPTED — both inside `BEGIN…ROLLBACK` so no data changes.

**Safe drizzle-kit sync check (no dry-run flag exists):** `drizzle-kit push --strict --verbose` prints the full pending-statement diff and then **aborts at the interactive TTY confirm prompt when stdin isn't a terminal** — so it applies NOTHING while still revealing the diff. If your constraint name is absent from that diff, schema ↔ DB is in sync for it. Verify afterwards that md5/rowcount/constraint are unchanged.

**Why explicit short constraint names matter:** Postgres truncates auto-generated identifiers at 63 chars; the truncated name in the DB never matches drizzle's full expected name, so `drizzle-kit push` perpetually wants to drop+re-add it (cosmetic, non-destructive, but noisy). Constraints given an explicit ≤63-char name (e.g. `virtual_rel_athlete_related_kind_uq`) stay stable and never appear in the drift.
