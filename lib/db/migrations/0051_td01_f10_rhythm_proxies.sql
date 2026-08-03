-- TRAINEN_DOELEN_SEIZOEN_01 F10: ritme-proxy's (max 2, vaste catalogus).
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS rhythm_proxies jsonb;
