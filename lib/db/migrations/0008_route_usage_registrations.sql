-- ROUTE_PAKKET_02A (SPARKI-BESLUIT-2026-003) — telling van routegebruik.
-- Alleen meten, niets blokkeren. Geen terugwerkende kracht: de tabel start
-- leeg; bestaande routes/exports/ritten worden NIET met terugwerkende kracht
-- geregistreerd. Niet-destructief en idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "route_usage_registrations" (
  "id" serial PRIMARY KEY,
  "clerk_id" text NOT NULL REFERENCES "user_profiles"("clerk_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  "route_id" integer NOT NULL,
  "usage_type" text NOT NULL,
  "occurred_at" timestamptz NOT NULL DEFAULT now(),
  "calendar_month" text NOT NULL,
  "subscription_tier" text NOT NULL,
  "source" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Uniciteit gebruiker+route+kalendermaand op databaseniveau: dubbele en
-- gelijktijdige verzoeken kunnen samen nooit twee registraties opleveren.
CREATE UNIQUE INDEX IF NOT EXISTS "route_usage_reg_user_route_month_idx"
  ON "route_usage_registrations" ("clerk_id", "route_id", "calendar_month");

CREATE INDEX IF NOT EXISTS "route_usage_reg_user_month_idx"
  ON "route_usage_registrations" ("clerk_id", "calendar_month");
