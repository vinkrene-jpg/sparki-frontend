-- 0006 — Routeplanner-weergaveniveau (besluit B6, 30/31-07-2026).
-- Handmatige weergavekeuze van de rijder: gratis | go_fietser | go_sport |
-- wedstrijd. NULL = automatisch voorstellen op basis van het profiel.
-- Volledig los van het abonnement; veiligheid geldt op elk niveau.
-- Puur additief: geen bestaande kolommen worden gewijzigd.

ALTER TABLE athlete_profiles
  ADD COLUMN IF NOT EXISTS planner_view text;
