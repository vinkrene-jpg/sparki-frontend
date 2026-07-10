-- Controlled, non-destructive migration.
-- Adds UNIQUE (athlete_id, related_athlete_id, kind) on
-- public.virtual_athlete_relationships as constraint
-- "virtual_rel_athlete_related_kind_uq".
--
-- Properties:
--  * Idempotent   — ADD CONSTRAINT only runs if not already present.
--  * Guarded      — aborts (RAISE EXCEPTION) if any NULLs or duplicates exist
--                   under the EXACT constraint expression, so it can never
--                   silently need a destructive dedup.
--  * Atomic       — whole thing is one transaction; any failure rolls back.
--  * Lock-safe    — SHARE ROW EXCLUSIVE blocks concurrent writes (INSERT/
--                   UPDATE/DELETE) for the (sub-second) duration, while still
--                   allowing concurrent reads.
--  * Never uses TRUNCATE / DELETE / reset / table regeneration.
--
-- Run with:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql

BEGIN;

-- Prevent concurrent conflicting writes during the migration.
LOCK TABLE public.virtual_athlete_relationships IN SHARE ROW EXCLUSIVE MODE;

-- Guard 1: no NULLs in the constrained columns.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n
  FROM public.virtual_athlete_relationships
  WHERE athlete_id IS NULL OR related_athlete_id IS NULL OR kind IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Afgebroken: % rij(en) met NULL in constraint-kolommen', n;
  END IF;
END $$;

-- Guard 2: no duplicates under the EXACT future-constraint expression.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1
    FROM public.virtual_athlete_relationships
    GROUP BY athlete_id, related_athlete_id, kind
    HAVING count(*) > 1
  ) d;
  IF n > 0 THEN
    RAISE EXCEPTION 'Afgebroken: % duplicaat-groep(en) op (athlete_id, related_athlete_id, kind)', n;
  END IF;
END $$;

-- Idempotent add.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'virtual_rel_athlete_related_kind_uq'
      AND conrelid = 'public.virtual_athlete_relationships'::regclass
  ) THEN
    ALTER TABLE public.virtual_athlete_relationships
      ADD CONSTRAINT virtual_rel_athlete_related_kind_uq
      UNIQUE (athlete_id, related_athlete_id, kind);
    RAISE NOTICE 'Constraint aangemaakt.';
  ELSE
    RAISE NOTICE 'Constraint al aanwezig — no-op (idempotent).';
  END IF;
END $$;

-- Post-check: constraint exists with the exact expected definition.
DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conname = 'virtual_rel_athlete_related_kind_uq'
    AND conrelid = 'public.virtual_athlete_relationships'::regclass;
  IF def IS NULL THEN
    RAISE EXCEPTION 'Post-check faalde: constraint ontbreekt na migratie';
  END IF;
  IF def <> 'UNIQUE (athlete_id, related_athlete_id, kind)' THEN
    RAISE EXCEPTION 'Post-check faalde: onverwachte definitie: %', def;
  END IF;
  RAISE NOTICE 'Post-check OK: %', def;
END $$;

COMMIT;
