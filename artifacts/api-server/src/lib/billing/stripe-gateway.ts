// ── Stripe-gateway (fase 2, uitsluitend TESTMODUS) ───────────────────────────
// Eén dunne poort naar Stripe. Alles achter een interface zodat de
// geautomatiseerde testmatrix een fake kan injecteren (setStripeGatewayForTests,
// dev-only). Fail-closed: geen sleutel of géén sk_test_-sleutel ⇒ niet
// geconfigureerd ⇒ eerlijke 503 in de routes, nooit een live-call.

import Stripe from "stripe";
import type { BillingInterval, CommercialTier } from "@workspace/db";

export const TIER_PRICING: Record<
  Exclude<CommercialTier, "FREE">,
  { month: number; year: number; trialDays: number; productName: string }
> = {
  GO: { month: 299, year: 2990, trialDays: 7, productName: "sparki_go_tier" },
  COMPLETE: {
    month: 999,
    year: 9990,
    trialDays: 14,
    productName: "sparki_complete_tier",
  },
  // TEAM_ABONNEMENT_01: Sparki Team — €149/maand of €1.490/jaar, centrale
  // facturatie voor een teamorganisatie (prijzen in eurocenten).
  TEAM: {
    month: 14900,
    year: 149000,
    trialDays: 14,
    productName: "sparki_team_tier",
  },
  // SPARKI_BUILD_04 / besluitenpatch 01-08-2026 hoofdstuk E: Sparki Trainer
  // basistier €99 p/mnd · €990 p/jr tot 25 sporters. De tweede staffel
  // (€179/€1.790 tot 50) en €9,90 per sporter vanaf nr. 51 zijn afhankelijk
  // van het aantal actieve koppelingen en horen bij de facturatie-/
  // koppelingslaag (F3/F9), niet bij deze vaste prijsconfiguratie.
  TRAINER: {
    month: 9900,
    year: 99000,
    trialDays: 14,
    productName: "sparki_trainer_tier",
  },
};

export interface SubscriptionState {
  id: string;
  customerId: string;
  status: string; // Stripe-status; onbekend ⇒ fail-closed door de verwerker
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  created: Date;
  priceId: string | null;
  tier: string | null; // uit metadata.tier
  interval: string | null;
  clerkId: string | null; // uit metadata.clerk_id
  clubId?: number | null; // uit metadata.club_id (TEAM_ABONNEMENT_01, centrale facturatie)
}

export interface InvoiceState {
  id: string;
  subscriptionId: string | null;
  customerId: string | null;
  created: Date; // vast per invoice — bron voor de monotone grace-teller
  status: string | null;
  attemptCount: number;
}

export interface ChargeState {
  id: string;
  customerId: string | null;
  amount: number;
  amountRefunded: number; // CUMULATIEF — besluit nooit op het eventdelta
}

// TEAM_ABONNEMENT_01: club_id-metadata is alleen geldig als positief geheel
// getal; al het andere is expliciet null (fail-closed: geen club-koppeling).
export function parseClubIdMeta(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export interface StripeGateway {
  isConfigured(): boolean;
  createCheckoutSession(args: {
    clerkId: string;
    tier: Exclude<CommercialTier, "FREE">;
    interval: BillingInterval;
    successUrl: string;
    cancelUrl: string;
    clubId?: number; // TEAM: koppelt de subscription aan één teamorganisatie
  }): Promise<{ id: string; url: string }>;
  createPortalSession(args: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
  getSubscription(id: string): Promise<SubscriptionState | null>;
  getInvoice(id: string): Promise<InvoiceState | null>;
  getCharge(id: string): Promise<ChargeState | null>;
  /** Upgrade nu (proratering) of downgrade op periode-einde. */
  changeSubscriptionTier(args: {
    subscriptionId: string;
    tier: Exclude<CommercialTier, "FREE">;
    interval: BillingInterval;
    when: "now" | "period_end";
  }): Promise<void>;
}

function testKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  // Fase 2 is uitsluitend testmodus: een live-sleutel wordt geweigerd.
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) return null;
  return key;
}

function toDate(epoch: number | null | undefined): Date | null {
  return typeof epoch === "number" ? new Date(epoch * 1000) : null;
}

class RealStripeGateway implements StripeGateway {
  private client: Stripe | null = null;
  private priceCache = new Map<string, string>();

  private stripe(): Stripe {
    const key = testKey();
    if (!key) throw new Error("Stripe-testmodus is niet geconfigureerd");
    if (!this.client) this.client = new Stripe(key);
    return this.client;
  }

  isConfigured(): boolean {
    return testKey() !== null;
  }

  /** Idempotent: product + price per (tier, interval) via lookup_key. */
  private async ensurePrice(
    tier: Exclude<CommercialTier, "FREE">,
    interval: BillingInterval,
  ): Promise<string> {
    const lookupKey = `sparki_${tier.toLowerCase()}_tier_${interval}`;
    const cached = this.priceCache.get(lookupKey);
    if (cached) return cached;
    const stripe = this.stripe();
    const existing = await stripe.prices.list({
      lookup_keys: [lookupKey],
      active: true,
      limit: 1,
    });
    if (existing.data[0]) {
      this.priceCache.set(lookupKey, existing.data[0].id);
      return existing.data[0].id;
    }
    const cfg = TIER_PRICING[tier];
    const products = await stripe.products.search({
      query: `name:'${cfg.productName}' AND active:'true'`,
      limit: 1,
    });
    const product =
      products.data[0] ??
      (await stripe.products.create({
        name: cfg.productName,
        metadata: { commercial_tier: tier, app: "sparki", phase: "test" },
      }));
    const price = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: cfg[interval],
      recurring: { interval },
      lookup_key: lookupKey,
      metadata: { commercial_tier: tier, interval, app: "sparki", phase: "test" },
    });
    this.priceCache.set(lookupKey, price.id);
    return price.id;
  }

  async createCheckoutSession(args: {
    clerkId: string;
    tier: Exclude<CommercialTier, "FREE">;
    interval: BillingInterval;
    successUrl: string;
    cancelUrl: string;
    clubId?: number;
  }): Promise<{ id: string; url: string }> {
    const stripe = this.stripe();
    const priceId = await this.ensurePrice(args.tier, args.interval);
    const clubMeta: Record<string, string> =
      args.clubId != null ? { club_id: String(args.clubId) } : {};
    // Zonder Stripe-trial: de proef is Sparki-zijdig (user_entitlements).
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: args.clerkId,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: {
        clerk_id: args.clerkId,
        tier: args.tier,
        interval: args.interval,
        app: "sparki",
        phase: "test",
        ...clubMeta,
      },
      subscription_data: {
        metadata: {
          clerk_id: args.clerkId,
          tier: args.tier,
          app: "sparki",
          phase: "test",
          ...clubMeta,
        },
      },
    });
    if (!session.url) throw new Error("Stripe gaf geen checkout-URL terug");
    return { id: session.id, url: session.url };
  }

  async createPortalSession(args: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const session = await this.stripe().billingPortal.sessions.create({
      customer: args.customerId,
      return_url: args.returnUrl,
    });
    return { url: session.url };
  }

  async getSubscription(id: string): Promise<SubscriptionState | null> {
    try {
      const s = await this.stripe().subscriptions.retrieve(id);
      const item = s.items?.data?.[0];
      return {
        id: s.id,
        customerId: typeof s.customer === "string" ? s.customer : s.customer.id,
        status: s.status,
        cancelAtPeriodEnd: s.cancel_at_period_end === true,
        currentPeriodEnd: toDate(item?.current_period_end),
        created: new Date(s.created * 1000),
        priceId: item?.price?.id ?? null,
        tier: (s.metadata?.tier as string | undefined) ?? null,
        interval: item?.price?.recurring?.interval ?? null,
        clerkId: (s.metadata?.clerk_id as string | undefined) ?? null,
        clubId: parseClubIdMeta(s.metadata?.club_id),
      };
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404) return null;
      throw err;
    }
  }

  async getInvoice(id: string): Promise<InvoiceState | null> {
    try {
      const inv = await this.stripe().invoices.retrieve(id);
      const line = inv.lines?.data?.[0] as
        | { subscription?: string | { id: string } }
        | undefined;
      const parent = (inv as unknown as {
        parent?: { subscription_details?: { subscription?: string | { id: string } } };
      }).parent;
      const rawSub =
        parent?.subscription_details?.subscription ?? line?.subscription ?? null;
      return {
        id: inv.id ?? id,
        subscriptionId:
          typeof rawSub === "string" ? rawSub : rawSub ? rawSub.id : null,
        customerId:
          typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null,
        created: new Date(inv.created * 1000),
        status: inv.status ?? null,
        attemptCount: inv.attempt_count ?? 0,
      };
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404) return null;
      throw err;
    }
  }

  async getCharge(id: string): Promise<ChargeState | null> {
    try {
      const c = await this.stripe().charges.retrieve(id);
      return {
        id: c.id,
        customerId:
          typeof c.customer === "string" ? c.customer : c.customer?.id ?? null,
        amount: c.amount,
        amountRefunded: c.amount_refunded,
      };
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404) return null;
      throw err;
    }
  }

  async changeSubscriptionTier(args: {
    subscriptionId: string;
    tier: Exclude<CommercialTier, "FREE">;
    interval: BillingInterval;
    when: "now" | "period_end";
  }): Promise<void> {
    const stripe = this.stripe();
    const priceId = await this.ensurePrice(args.tier, args.interval);
    const sub = await stripe.subscriptions.retrieve(args.subscriptionId);
    const itemId = sub.items.data[0]?.id;
    if (!itemId) throw new Error("Abonnement heeft geen items");
    if (args.when === "now") {
      // Upgrade: direct, met proratering.
      await stripe.subscriptions.update(args.subscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: { ...sub.metadata, tier: args.tier },
      });
    } else {
      // Downgrade: pas op periode-einde via een subscription schedule.
      const scheduleId =
        typeof sub.schedule === "string"
          ? sub.schedule
          : (
              await stripe.subscriptionSchedules.create({
                from_subscription: args.subscriptionId,
              })
            ).id;
      const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
      const currentPhase = schedule.phases[schedule.phases.length - 1];
      await stripe.subscriptionSchedules.update(scheduleId, {
        phases: [
          {
            items: currentPhase!.items.map((i) => ({
              price: typeof i.price === "string" ? i.price : i.price.id,
              quantity: i.quantity ?? 1,
            })),
            start_date: currentPhase!.start_date,
            end_date: currentPhase!.end_date,
          },
          {
            items: [{ price: priceId, quantity: 1 }],
            metadata: { tier: args.tier },
          },
        ],
      });
    }
  }
}

let gateway: StripeGateway = new RealStripeGateway();

export function getStripeGateway(): StripeGateway {
  return gateway;
}

/** Alleen voor de geautomatiseerde testmatrix — nooit in productie. */
export function setStripeGatewayForTests(fake: StripeGateway): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("setStripeGatewayForTests is verboden in productie");
  }
  gateway = fake;
}

/**
 * Signatuurverificatie van een webhook-payload. Puur HMAC via de Stripe-SDK —
 * geen netwerk, geen API-sleutel nodig. Gooit bij een ongeldige signatuur.
 */
export function verifyStripeWebhook(
  rawBody: Buffer | string,
  signature: string,
  secret: string,
): Stripe.Event {
  const verifier = new Stripe("sk_test_signature_verification_only");
  return verifier.webhooks.constructEvent(rawBody, signature, secret);
}
