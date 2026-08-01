-- BB-11 (besluitenpatch 2026-08-01, versoepeld): VOG-registratie op
-- clublidmaatschappen. Alleen aanvinken-met-afgiftedatum, geen upload.
-- Idempotent: veilig her-uitvoerbaar.
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS vog_issued_on date;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS vog_recorded_at timestamptz;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS vog_recorded_by_clerk_id text;
