-- MOBILE_ROUTE_WALKING_01: sportfamilie expliciet op routes.
-- Nullable: bestaande/geïmporteerde routes blijven eerlijk "onbekend".
ALTER TABLE routes ADD COLUMN IF NOT EXISTS sport text;
