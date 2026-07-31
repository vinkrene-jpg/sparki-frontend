-- 0007 — Persoonlijke routekandidaten uit gekoppelde ritgeschiedenis
-- (opdracht René 31-07-2026, canoniek in docs/route-candidates.md).
-- Drie nieuwe tabellen; puur additief en idempotent (IF NOT EXISTS overal),
-- bestaande tabellen worden niet gewijzigd.

CREATE TABLE IF NOT EXISTS route_candidates (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL REFERENCES user_profiles(clerk_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  fingerprint text NOT NULL,
  geometry jsonb NOT NULL,
  cells jsonb NOT NULL,
  start_lat real NOT NULL,
  start_lon real NOT NULL,
  end_lat real NOT NULL,
  end_lon real NOT NULL,
  is_loop boolean NOT NULL DEFAULT false,
  distance_km real NOT NULL,
  elevation_m real,
  sport text NOT NULL DEFAULT 'cycling',
  ride_count integer NOT NULL DEFAULT 1,
  first_ridden_at timestamptz,
  last_ridden_at timestamptz,
  auto_labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_labels jsonb,
  favorite boolean NOT NULL DEFAULT false,
  excluded boolean NOT NULL DEFAULT false,
  quality jsonb,
  overlap_avg real,
  trimmed_start_m real,
  trimmed_end_m real,
  saved_route_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_route_candidate UNIQUE (clerk_id, fingerprint)
);

-- Lijst- en matchqueries filteren altijd per gebruiker.
CREATE INDEX IF NOT EXISTS route_candidates_clerk_id_idx
  ON route_candidates (clerk_id);

CREATE TABLE IF NOT EXISTS route_candidate_rides (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL REFERENCES user_profiles(clerk_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  candidate_id integer NOT NULL REFERENCES route_candidates(id)
    ON DELETE CASCADE,
  session_id integer NOT NULL,
  ridden_at timestamptz,
  overlap real,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_route_candidate_ride UNIQUE (clerk_id, session_id)
);

CREATE INDEX IF NOT EXISTS route_candidate_rides_candidate_id_idx
  ON route_candidate_rides (candidate_id);

CREATE TABLE IF NOT EXISTS route_candidate_scans (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL UNIQUE REFERENCES user_profiles(clerk_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  last_session_id integer NOT NULL DEFAULT 0,
  last_scan_at timestamptz,
  activities_seen integer NOT NULL DEFAULT 0,
  activities_with_track integer NOT NULL DEFAULT 0,
  onboarding_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
