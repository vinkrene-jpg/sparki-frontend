-- 0036 — Abonnement-keuze zonder betaalstap (subscription_choice_intents)
-- Zolang de echte betaling (Stripe-testsleutels) nog niet beschikbaar is, legt
-- deze tabel uitsluitend de KEUZE van de gebruiker vast (welke laag wil ik).
-- Kent NOOIT zelf rechten toe — rechten blijven volledig via de entitlement-
-- resolver lopen. Eén open (in_afwachting) keuze per gebruiker: clerk_id is de
-- primaire sleutel, een nieuwe keuze vervangt de vorige (onConflictDoUpdate).
-- Puur additief en niet-destructief: veilig her-uitvoerbaar.

CREATE TABLE IF NOT EXISTS subscription_choice_intents (
  clerk_id     text PRIMARY KEY
    REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  desired_tier text NOT NULL,
  interval     text NOT NULL DEFAULT 'month',
  status       text NOT NULL DEFAULT 'in_afwachting',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
