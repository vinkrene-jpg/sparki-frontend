import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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

// ── HERSTEL_EN_AANVULLING_01 F7 (HA-28…HA-30): betaler ≠ gebruiker ──────────
// Bouwt door op het bestaande drie-entiteitenmodel (klant/sporter/betaler,
// trainer-clients.ts) — dit is de platformkant voor de vier combinaties:
// sporter betaalt zichzelf (géén rij; de bestaande billing_subscriptions-rij
// op eigen clerkId is die combinatie al), club betaalt voor een lid, ouder
// betaalt voor een jeugdlid, club betaalt voor een jeugdlid mét toestemming
// van de ouder. Rechten blijven uitsluitend via de bestaande entitlement-
// resolver lopen; dit is administratie van WIE betaalt, geen tweede
// rechtenlaag.
export const PAYER_TYPES = ["club", "ouder"] as const;
export type PayerType = (typeof PAYER_TYPES)[number];

export const PAYER_ARRANGEMENT_STATUSES = [
  // Aangeboden maar nog niet door het lid aanvaard (club) of nog zonder
  // oudertoestemming (jeugdlid).
  "aangeboden",
  "actief",
  // Lid heeft geweigerd — telt als zelf opzeggen van de aangeboden dekking
  // (HA-30); de club ziet dit alleen als aantal, nooit als naam.
  "geweigerd",
  "beeindigd",
] as const;
export type PayerArrangementStatus = (typeof PAYER_ARRANGEMENT_STATUSES)[number];

export const subscriptionPayerArrangementsTable = pgTable(
  "subscription_payer_arrangements",
  {
    id: serial("id").primaryKey(),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    payerType: text("payer_type").notNull(), // PayerType
    // Bij payerType=club: de betalende club.
    clubId: integer("club_id"),
    // Bij payerType=ouder: de betalende ouder (met eigen account).
    payerClerkId: text("payer_clerk_id"),
    tier: text("tier").notNull(), // GO | COMPLETE
    status: text("status").notNull().default("aangeboden"),
    // Jeugdlid + club betaalt ⇒ oudertoestemming verplicht (fail-closed):
    // activeren kan pas als parentConsentAt gezet is.
    parentConsentRequired: boolean("parent_consent_required").notNull().default(false),
    parentConsentAt: timestamp("parent_consent_at", { withTimezone: true }),
    parentConsentByClerkId: text("parent_consent_by_clerk_id"),
    offeredByClerkId: text("offered_by_clerk_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedReason: text("ended_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payer_arrangements_athlete_idx").on(t.athleteClerkId),
    index("payer_arrangements_club_idx").on(t.clubId),
    // Hooguit één lopende (aangeboden/actieve) dekking per sporter — geen
    // dubbele betalers voor hetzelfde abonnement.
    uniqueIndex("payer_arrangements_open_uq")
      .on(t.athleteClerkId)
      .where(sql`status IN ('aangeboden', 'actief')`),
  ],
);
export type SubscriptionPayerArrangement =
  typeof subscriptionPayerArrangementsTable.$inferSelect;

// HA-30: bij overname door de club wordt het resterende deel van de eigen
// betaling terugbetaald, met bericht. De verplichting wordt hier vastgelegd;
// de uitvoering (Stripe-refund) is een aparte, controleerbare stap — nooit
// stilzwijgend "geregeld".
export const payerRefundObligationsTable = pgTable(
  "payer_refund_obligations",
  {
    id: serial("id").primaryKey(),
    arrangementId: integer("arrangement_id")
      .notNull()
      .references(() => subscriptionPayerArrangementsTable.id, { onDelete: "cascade" }),
    athleteClerkId: text("athlete_clerk_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    status: text("status").notNull().default("open"), // open | uitgevoerd | vervallen
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("payer_refund_arrangement_uq").on(t.arrangementId)],
);
export type PayerRefundObligation = typeof payerRefundObligationsTable.$inferSelect;

// HA-30: maandelijkse clubfacturatie met staffelkorting in VASTE TREDES.
// De tredes zijn configuratie (instelbaar zonder schemawijziging); dit zijn
// de standaardwaarden tot een commercieel besluit ze wijzigt.
export const CLUB_STAFFEL_TREDES = [
  { vanafLeden: 1, kortingPct: 0 },
  { vanafLeden: 5, kortingPct: 10 },
  { vanafLeden: 10, kortingPct: 15 },
  { vanafLeden: 20, kortingPct: 20 },
] as const;

// ── Abonnement-keuze zonder betaalstap (productie-bevinding punt 4) ──────────
// Zolang de echte betaling (Stripe-testsleutels) nog niet beschikbaar is, moet
// het up-/downgradepad tot AAN de betaalstap wél testbaar zijn. Deze tabel legt
// uitsluitend de KEUZE van de gebruiker vast (welke laag wil ik) — het kent
// NOOIT zelf rechten toe. Rechten blijven volledig via de entitlement-resolver
// lopen. Eén open (in_afwachting) keuze per gebruiker; een nieuwe keuze
// vervangt de vorige (onConflictDoUpdate op clerk_id). Bij een echte checkout
// wordt deze rij niet gebruikt — dan loopt alles via billing_subscriptions.
export const SUBSCRIPTION_CHOICE_STATUSES = [
  "in_afwachting", // gekozen, wacht op de (nog ontbrekende) betaalstap
  "geannuleerd",
] as const;
export type SubscriptionChoiceStatus =
  (typeof SUBSCRIPTION_CHOICE_STATUSES)[number];

export const subscriptionChoiceIntentsTable = pgTable(
  "subscription_choice_intents",
  {
    clerkId: text("clerk_id")
      .primaryKey()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Gewenste laag: GO | COMPLETE (FREE loopt via de directe downgrade, niet
    // via een keuze-intentie). Nooit vrij verzonnen — gevalideerd server-side.
    desiredTier: text("desired_tier").notNull(),
    interval: text("interval").notNull().default("month"), // month | year
    status: text("status").notNull().default("in_afwachting"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);
export type SubscriptionChoiceIntent =
  typeof subscriptionChoiceIntentsTable.$inferSelect;
