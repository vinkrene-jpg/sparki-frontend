-- WEDSTRIJDDOELEN_15 hfst 18 (volhoudbaarheid): compacte vermogensdata op
-- ingest-moment — totale arbeid (kJ) + best-vermogens per venster gesplitst
-- per arbeidsniveau. Additief; oude rijen blijven eerlijk NULL (geen backfill).

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS power_durability jsonb;
