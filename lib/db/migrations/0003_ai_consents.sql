-- OPDRACHT 0B — aparte, intrekbare AI-toestemmingen (puur additief).
-- Ontbrekend bewijs = geen toestemming: alle nieuwe kolommen standaard false.
-- Bestaande kolommen krijgen alleen een nieuwe DEFAULT voor toekomstige rijen;
-- bestaande rijwaarden (expliciete keuzes) blijven onaangetast.

ALTER TABLE privacy_settings
  ADD COLUMN IF NOT EXISTS ai_health_analysis_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_vision_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_document_analysis_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_coaching_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE privacy_settings
  ALTER COLUMN ai_memory_enabled SET DEFAULT false,
  ALTER COLUMN ai_sensitive_analysis_enabled SET DEFAULT false;
