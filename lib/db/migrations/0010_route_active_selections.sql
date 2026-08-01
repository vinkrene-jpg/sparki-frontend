-- ABONNEMENT_01 §1.3 — keuze "drie actieve routes" na downgrade naar Gratis.
-- Alleen de keuze; limiet/verval/opruiming volgen in ROUTE_PAKKET_02c.
CREATE TABLE IF NOT EXISTS route_active_selections (
  clerk_id TEXT NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clerk_id, route_id)
);
