-- Besluitenpatch 2026-08-01 (hoofdstuk B): teammanager mag een
-- ploegleiderbesluit bij wedstrijdselecties overrulen (definitief).
-- Idempotent: veilig her-uitvoerbaar.
ALTER TABLE club_race_selections ADD COLUMN IF NOT EXISTS selected_by_clerk_id text;
ALTER TABLE club_race_selections ADD COLUMN IF NOT EXISTS selected_by_role text;
ALTER TABLE club_race_selections ADD COLUMN IF NOT EXISTS overruled_at timestamptz;
ALTER TABLE club_race_selections ADD COLUMN IF NOT EXISTS overruled_by_clerk_id text;
