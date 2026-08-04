-- MEETNIVEAU_EN_UITLEG_01 §3: laatst waargenomen meetsporen per sporter.
-- Waarneming, geen instelling — alleen gebruikt om het wegvallen van een
-- spoor te detecteren (één melding) en stil terug-groeien. Additief;
-- bestaande rijen blijven eerlijk NULL (nog nooit waargenomen).

ALTER TABLE athlete_profiles
  ADD COLUMN IF NOT EXISTS observed_sporen jsonb;
