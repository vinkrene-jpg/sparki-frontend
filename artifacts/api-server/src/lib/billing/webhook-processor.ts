// ── Stripe-webhookverwerking (fase 2, TESTMODUS) ─────────────────────────────
// Contract (§5 fase-1-ontwerp):
//  • Elk event eerst als rij in stripe_webhook_events (event_id UNIQUE,
//    insert-on-conflict-do-nothing) — dubbele levering = no-op.
//  • Rechten worden uitsluitend in de succes-tak geschreven, binnen één
//    transactie met de eventregistratie; een verwerkingsfout rolt alles terug
//    zodat het event her-verwerkbaar blijft en NOOIT betaalde toegang geeft.
//  • Verkeerd geordende events: het event is een trigger, de actuele
//    Stripe-API-staat is de waarheid (altijd herlezen) + created-vergelijking.
//  • Onbekende status ⇒ fail-closed (geen rechten, wel loggen).
//  • Legacy-gebruikers worden nooit aangeraakt.

import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  billingSubscriptionsTable,
  stripeWebhookEventsTable,
  type CommercialTier,
} from "@workspace/db";
import {
  getStripeGateway,
  type SubscriptionState,
} from "./stripe-gateway";
import { GRACE_DAYS, isValidTier, isPaidTier, isValidInterval } from "./index";
import { logger } from "../logger";

export interface StripeEventLike {
  id: string;
  type: string;
  created: number; // epoch seconden (Stripe-brontijd)
  data: { object: Record<string, unknown> };
}

export type WebhookOutcome =
  | { outcome: "processed"; detail?: string }
  | { outcome: "duplicate" }
  | { outcome: "ignored"; detail: string };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Stripe-subscription.status → interne status. Onbekend ⇒ null (fail-closed). */
function mapStripeSubStatus(
  s: SubscriptionState,
): "active" | "canceled" | "expired" | null {
  switch (s.status) {
    case "active":
    case "trialing": // hoort niet voor te komen (proef is Sparki-zijdig)
      return s.cancelAtPeriodEnd ? "canceled" : "active";
    case "past_due":
    case "unpaid":
      // Grace wordt door invoice.payment_failed gezet; tot die tijd behouden
      // we de bestaande status — hier geen eigen besluit.
      return null;
    case "canceled":
    case "incomplete_expired":
      return "expired";
    case "incomplete":
    case "paused":
      return null;
    default:
      return null;
  }
}

/** Profieltier bijwerken — nooit voor legacy, alleen subscription-profielen. */
async function setProfileTier(
  tx: Tx,
  clerkId: string,
  tier: CommercialTier,
): Promise<void> {
  await tx
    .update(userProfilesTable)
    .set({ commercialTier: tier, updatedAt: new Date() })
    .where(
      and(
        eq(userProfilesTable.clerkId, clerkId),
        eq(userProfilesTable.entitlementMode, "subscription"),
      ),
    );
}

async function upsertFromSubscriptionState(
  tx: Tx,
  state: SubscriptionState,
  eventCreated: Date,
): Promise<string> {
  const clerkId = state.clerkId;
  if (!clerkId) return "genegeerd: subscription zonder clerk_id-metadata";
  const [profile] = await tx
    .select({ entitlementMode: userProfilesTable.entitlementMode })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  if (!profile) return `genegeerd: onbekende gebruiker ${clerkId}`;
  if (profile.entitlementMode === "legacy_unrestricted") {
    return "genegeerd: legacy-gebruiker wordt nooit aangeraakt";
  }
  const tier = isValidTier(state.tier) && isPaidTier(state.tier) ? state.tier : null;
  if (!tier) return "genegeerd: subscription zonder geldige tier-metadata (fail-closed)";
  const mapped = mapStripeSubStatus(state);

  const [existing] = await tx
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.stripeSubscriptionId, state.id));

  const interval = isValidInterval(state.interval) ? state.interval : "month";
  const now = new Date();

  if (!existing) {
    await tx.insert(billingSubscriptionsTable).values({
      clerkId,
      stripeCustomerId: state.customerId,
      stripeSubscriptionId: state.id,
      tier,
      interval,
      status: mapped ?? "expired", // onbekend ⇒ fail-closed, nooit betaald
      stripePriceId: state.priceId,
      currentPeriodEnd: state.currentPeriodEnd,
      lastEventCreated: eventCreated,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // blocked is terminaal via refund-handhaving; een subscription-event
    // heft dat nooit stilzwijgend op.
    if (existing.status === "blocked") return "genegeerd: subscription is blocked";
    await tx
      .update(billingSubscriptionsTable)
      .set({
        clerkId,
        stripeCustomerId: state.customerId,
        tier,
        interval,
        // Onbekende Stripe-status ⇒ bestaande status behouden (geen besluit).
        status: mapped ?? existing.status,
        stripePriceId: state.priceId ?? existing.stripePriceId,
        currentPeriodEnd: state.currentPeriodEnd ?? existing.currentPeriodEnd,
        // Betaald & actueel ⇒ grace-teller vervalt via invoice.paid; hier laten staan.
        lastEventCreated: eventCreated,
        updatedAt: now,
      })
      .where(eq(billingSubscriptionsTable.id, existing.id));
  }

  if (mapped === "active" || mapped === "canceled") {
    // canceled behoudt tier-toegang tot periode-einde (vervaljob zet FREE).
    await setProfileTier(tx, clerkId, tier);
  } else if (mapped === "expired") {
    await setProfileTier(tx, clerkId, "FREE");
  }
  return `subscription ${state.id} → ${mapped ?? "(status onbekend, fail-closed)"}`;
}

async function handleEvent(tx: Tx, event: StripeEventLike): Promise<string> {
  const gateway = getStripeGateway();
  const obj = event.data.object;
  const eventCreated = new Date(event.created * 1000);

  switch (event.type) {
    case "checkout.session.completed": {
      // Alleen koppeling clerk_id ↔ customer/subscription; nog géén rechten —
      // die volgen uit de subscription-/invoice-staat.
      const subId =
        typeof obj["subscription"] === "string" ? (obj["subscription"] as string) : null;
      if (!subId) return "genegeerd: checkout zonder subscription";
      const state = await gateway.getSubscription(subId);
      if (!state) return "genegeerd: subscription niet gevonden bij Stripe";
      // clerk_id komt uit metadata die wij server-side hebben gezet.
      const metaClerk =
        (obj["client_reference_id"] as string | undefined) ??
        ((obj["metadata"] as Record<string, string> | undefined)?.["clerk_id"]);
      if (state.clerkId && metaClerk && state.clerkId !== metaClerk) {
        return "genegeerd: clerk_id-mismatch tussen sessie en subscription (fail-closed)";
      }
      return await upsertFromSubscriptionState(tx, state, eventCreated);
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subId = typeof obj["id"] === "string" ? (obj["id"] as string) : null;
      if (!subId) return "genegeerd: event zonder subscription-id";
      if (event.type === "customer.subscription.deleted") {
        const [existing] = await tx
          .select()
          .from(billingSubscriptionsTable)
          .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subId));
        if (!existing) return "genegeerd: onbekende subscription";
        if (existing.status === "blocked") return "genegeerd: subscription is blocked";
        await tx
          .update(billingSubscriptionsTable)
          .set({ status: "expired", lastEventCreated: eventCreated, updatedAt: new Date() })
          .where(eq(billingSubscriptionsTable.id, existing.id));
        await setProfileTier(tx, existing.clerkId, "FREE");
        return `subscription ${subId} → expired (deleted)`;
      }
      // Herlezen bij Stripe: API-staat is de waarheid (lost out-of-order op).
      const state = await gateway.getSubscription(subId);
      if (!state) return "genegeerd: subscription niet gevonden bij Stripe";
      return await upsertFromSubscriptionState(tx, state, eventCreated);
    }

    case "invoice.paid": {
      const invId = typeof obj["id"] === "string" ? (obj["id"] as string) : null;
      if (!invId) return "genegeerd: invoice zonder id";
      const invoice = await gateway.getInvoice(invId);
      if (!invoice?.subscriptionId) return "genegeerd: invoice zonder subscription";
      const [existing] = await tx
        .select()
        .from(billingSubscriptionsTable)
        .where(
          eq(billingSubscriptionsTable.stripeSubscriptionId, invoice.subscriptionId),
        );
      if (!existing) {
        // Invoice vóór subscription-event: herlezen en aanmaken.
        const state = await gateway.getSubscription(invoice.subscriptionId);
        if (!state) return "genegeerd: subscription niet gevonden bij Stripe";
        return await upsertFromSubscriptionState(tx, state, eventCreated);
      }
      if (existing.status === "blocked") return "genegeerd: subscription is blocked";
      const state = await gateway.getSubscription(invoice.subscriptionId);
      await tx
        .update(billingSubscriptionsTable)
        .set({
          status: state?.cancelAtPeriodEnd ? "canceled" : "active",
          graceUntil: null, // betaling gelukt ⇒ grace-teller gewist
          currentPeriodEnd: state?.currentPeriodEnd ?? existing.currentPeriodEnd,
          lastEventCreated: eventCreated,
          updatedAt: new Date(),
        })
        .where(eq(billingSubscriptionsTable.id, existing.id));
      const tier = isPaidTier(existing.tier) ? existing.tier : null;
      if (tier) await setProfileTier(tx, existing.clerkId, tier);
      return `invoice ${invId} betaald → active`;
    }

    case "invoice.payment_failed": {
      const invId = typeof obj["id"] === "string" ? (obj["id"] as string) : null;
      if (!invId) return "genegeerd: invoice zonder id";
      const invoice = await gateway.getInvoice(invId);
      if (!invoice?.subscriptionId) return "genegeerd: invoice zonder subscription";
      const [existing] = await tx
        .select()
        .from(billingSubscriptionsTable)
        .where(
          eq(billingSubscriptionsTable.stripeSubscriptionId, invoice.subscriptionId),
        );
      if (!existing) return "genegeerd: onbekende subscription";
      if (existing.status === "blocked") return "genegeerd: subscription is blocked";
      // Grace = Stripe-brontijd van de EERSTE mislukte poging + 7 dagen —
      // invoice.created is vast per invoice, dus herleveringen berekenen
      // exact dezelfde waarde. Monotoon: nooit later zetten dan wat er staat.
      const candidate = new Date(
        invoice.created.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000,
      );
      const graceUntil =
        existing.graceUntil && existing.graceUntil <= candidate
          ? existing.graceUntil
          : candidate;
      await tx
        .update(billingSubscriptionsTable)
        .set({
          status: "grace",
          graceUntil,
          lastEventCreated: eventCreated,
          updatedAt: new Date(),
        })
        .where(eq(billingSubscriptionsTable.id, existing.id));
      // Rechten blijven tijdens grace intact (tier blijft staan); het
      // verlopen gebeurt in de dagelijkse vervaljob, niet hier.
      return `invoice ${invId} mislukt → grace tot ${graceUntil.toISOString()}`;
    }

    case "charge.refunded": {
      const chargeId = typeof obj["id"] === "string" ? (obj["id"] as string) : null;
      if (!chargeId) return "genegeerd: charge zonder id";
      // Besluit NOOIT op het eventdelta maar op de actuele geaggregeerde staat.
      const charge = await gateway.getCharge(chargeId);
      if (!charge) return "genegeerd: charge niet gevonden bij Stripe";
      if (charge.amountRefunded < charge.amount) {
        logger.info(
          { chargeId, amount: charge.amount, refunded: charge.amountRefunded },
          "billing: gedeeltelijke refund — entitlement behouden",
        );
        return "gedeeltelijke refund → entitlement behouden";
      }
      if (!charge.customerId) return "genegeerd: charge zonder customer";
      const [existing] = await tx
        .select()
        .from(billingSubscriptionsTable)
        .where(eq(billingSubscriptionsTable.stripeCustomerId, charge.customerId));
      if (!existing) return "genegeerd: geen subscription bij deze customer";
      await tx
        .update(billingSubscriptionsTable)
        .set({ status: "blocked", lastEventCreated: eventCreated, updatedAt: new Date() })
        .where(eq(billingSubscriptionsTable.id, existing.id));
      await setProfileTier(tx, existing.clerkId, "FREE");
      logger.warn(
        { chargeId, clerkId: existing.clerkId },
        "billing: volledige (cumulatieve) refund — entitlement ingetrokken (blocked)",
      );
      return "volledige refund → blocked";
    }

    default:
      return `genegeerd: onbehandeld eventtype ${event.type}`;
  }
}

/**
 * Idempotente verwerking van één geverifieerd Stripe-event.
 * Registratie + verwerking in één transactie; fout ⇒ volledige rollback
 * (event her-verwerkbaar, geen rechten toegekend).
 */
export async function processStripeEvent(
  event: StripeEventLike,
  rawPayload: Buffer | string,
): Promise<WebhookOutcome> {
  const digest = createHash("sha256")
    .update(typeof rawPayload === "string" ? Buffer.from(rawPayload) : rawPayload)
    .digest("hex");
  return await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(stripeWebhookEventsTable)
      .values({ eventId: event.id, type: event.type, payloadDigest: digest })
      .onConflictDoNothing({ target: stripeWebhookEventsTable.eventId })
      .returning({ eventId: stripeWebhookEventsTable.eventId });
    if (inserted.length === 0) {
      return { outcome: "duplicate" } as const;
    }
    const detail = await handleEvent(tx, event);
    await tx
      .update(stripeWebhookEventsTable)
      .set({ processedAt: new Date(), result: detail })
      .where(eq(stripeWebhookEventsTable.eventId, event.id));
    if (detail.startsWith("genegeerd:")) {
      return { outcome: "ignored", detail } as const;
    }
    return { outcome: "processed", detail } as const;
  });
}
