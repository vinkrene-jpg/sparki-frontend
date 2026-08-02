-- ROUTE_PAKKET_02c — bewaartermijn Gratis (30 dagen) + herstelbare
-- vervallen-status. Niet-destructief: alleen nullable kolommen toevoegen;
-- null = geen termijn / gewoon bewaard, dus bestaand gedrag verandert niet.
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "saved_until" timestamp with time zone;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "expired_at" timestamp with time zone;
