-- ROUTE_OVERPASS_STABILITEIT_01: persistente Overpass-antwoordcache.
-- Idempotent: veilig her-uitvoerbaar.
CREATE TABLE IF NOT EXISTS overpass_query_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
