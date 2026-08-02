import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

// ── Stripe-abonnementslaag (fase 2, TESTMODUS) ───────────────────────────────
// Ontwerp: docs/SPARKI_STRIPE_SUBSCRIPTIONS_PHASE1_ARCHITECTURE.md.
// Abonnementstaat is GESCHEIDEN van rechten: rechten lopen uitsluitend via de
// bestaande entitlement-resolver (commercial_tier → tier_feature_grants en
// Sparki-beheerde trial-rijen in user_entitlements). Alles hier is additief;
// legacy-gebruikers (commercial_tier = NULL) gedragen zich byte-identiek.

// TRAINER (SPARKI_BUILD_04 BB-60): het abonnement van de zelfstandige trainer.
// Loopt door dezelfde resolver en tier_feature_grants; grants blijven leeg tot
// de verkoopstart. Prijzen/staffels (besluitenpatch hoofdstuk E) zijn
// configuratie van de checkout-laag, niet van dit schema.
export const COMMERCIAL_TIERS = ["FREE", "GO", "COMPLETE", "TEAM", "TRAINER"] as const;
export type CommercialTier = (typeof COMMERCIAL_TIERS)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

// Interne abonnementstatussen (afgeleid uit Stripe via het webhookcontract).
// Onbekende status ⇒ fail-closed als "free" behandelen, nooit als betaald.
export const BILLING_STATUSES = [
  "active",
  "grace",
  "canceled",
  "expired",
  "blocked",
  // ABONNEMENT_01: eerste betaling niet afgerond — geen rechten, wel een
  // begrijpelijke melding dat de betaling nog niet rond is.
  "incomplete",
  // ABONNEMENT_01: door de gebruiker gepauzeerd bij Stripe — rechten bevroren,
  // gegevens blijven volledig behouden, hervatten herstelt de rechten.
  "paused",
  // ABONNEMENT_01: een Stripe-status die wij niet kennen — fail-closed
  // (geen rechten) en gelogd, nooit stilzwijgend behouden.
  "unknown",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

// Eén rij per Stripe-subscription. Bron voor status/periode/planned-downgrade;
// entitlements blijven via de resolver lopen (profiel.commercial_tier).
export const billingSubscriptionsTable = pgTable(
  "billing_subscriptions",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    tier: text("tier").notNull(), // GO | COMPLETE
    interval: text("interval").notNull(), // month | year
    status: text("status").notNull(), // BillingStatus
    // Grandfathering: het price-ID waarop dit abonnement loopt wordt
    // vastgelegd en nooit stilzwijgend vervangen bij prijswijzigingen.
    stripePriceId: text("stripe_price_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    // Monotoon: eenmaal gezet wordt grace_until nooit LATER gezet (vertraagde
    // of opnieuw geleverde webhooks mogen grace niet opschuiven).
    graceUntil: timestamp("grace_until", { withTimezone: true }),
    plannedDowngradeTier: text("planned_downgrade_tier"),
    // Stripe event.created van de laatst verwerkte staat (out-of-order-guard;
    // de actuele API-staat blijft de waarheid).
    lastEventCreated: timestamp("last_event_created", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("billing_subscriptions_clerk_idx").on(t.clerkId),
    uniqueIndex("billing_subscriptions_stripe_sub_uq").on(
      t.stripeSubscriptionId,
    ),
  ],
);

export type BillingSubscription =
  typeof billingSubscriptionsTable.$inferSelect;

// Idempotente webhook-registratie: event_id UNIQUE; insert-on-conflict-do-
// nothing maakt dubbele leveringen no-ops. Rechten worden uitsluitend in de
// succes-tak geschreven, binnen één transactie met deze registratie — een
// verwerkingsfout rolt de registratie terug zodat het event her-verwerkbaar is.
export const stripeWebhookEventsTable = pgTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  payloadDigest: text("payload_digest").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  result: text("result"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StripeWebhookEvent = typeof stripeWebhookEventsTable.$inferSelect;

// Koppeling commercial_tier → feature. Analoog aan variant_feature_grants en
// BEWUST LEEG opgeleverd: vullen is onderdeel van de latere verkoopstart.
export const tierFeatureGrantsTable = pgTable(
  "tier_feature_grants",
  {
    commercialTier: text("commercial_tier").notNull(),
    featureKey: text("feature_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.commercialTier, t.featureKey] })],
);

export type TierFeatureGrant = typeof tierFeatureGrantsTable.$inferSelect;

// Testaccount-allowlist: alléén accounts in deze lijst kunnen in testmodus
// checkout/portal/trial zien, óók als alle betaalflags aan staan. Geen rij ⇒
// gedrag alsof alle betaalflags uit staan (extra commerciële grendel, AND).
export const billingTestAccountsTable = pgTable("billing_test_accounts", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  addedBy: text("added_by"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BillingTestAccount = typeof billingTestAccountsTable.$inferSelect;
