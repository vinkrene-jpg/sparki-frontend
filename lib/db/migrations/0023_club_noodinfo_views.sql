-- BUILD_03 Noodinformatie (besluitenpatch hoofdstuk D). Idempotent.
CREATE TABLE IF NOT EXISTS club_noodinfo_views (
  id serial PRIMARY KEY,
  club_id integer NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_clerk_id text NOT NULL,
  viewer_clerk_id text NOT NULL,
  viewer_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_noodinfo_views_member_idx
  ON club_noodinfo_views (club_id, member_clerk_id);
