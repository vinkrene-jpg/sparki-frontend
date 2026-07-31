// ── Billing-routes (fase 2, Stripe-TESTMODUS) ────────────────────────────────
// Alles dubbel vergrendeld (AND): operationele flag (default uit) ÉN de
// expliciete billing-testallowlist. Geen allowlist-rij ⇒ gedrag alsof alle
// betaalflags uit staan. clerk_id komt uitsluitend server-side uit de sessie;
// de frontend kent nooit zelf rechten toe en leest alleen de geresolvede staat.

import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, billingSubscriptionsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getBillingState,
  startTrial,
  isBillingTestAccount,
  isBillingFlagEnabledFor,
  isPaidTier,
  isValidInterval,
} from "../lib/billing";
import { getStripeGateway } from "../lib/billing/stripe-gateway";

const router: IRouter = Router();

function appBaseUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  return domain ? `https://${domain}` : "http://localhost:5000";
}

async function billingAccess(clerkId: string): Promise<{
  allowlisted: boolean;
  checkout: boolean;
  portal: boolean;
  configured: boolean;
}> {
  const [allowlisted, checkoutFlag, portalFlag] = await Promise.all([
    isBillingTestAccount(clerkId),
    isBillingFlagEnabledFor(clerkId, "stripe_checkout"),
    isBillingFlagEnabledFor(clerkId, "stripe_portal"),
  ]);
  const configured = getStripeGateway().isConfigured();
  return {
    allowlisted,
    checkout: allowlisted && checkoutFlag,
    portal: allowlisted && portalFlag,
    configured,
  };
}

// Server-geresolvede status — de enige bron waar de UI op mag varen.
router.get("/status", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const [state, access] = await Promise.all([
      getBillingState(clerkId),
      billingAccess(clerkId),
    ]);
    res.json({
      ...state,
      available: {
        // Trial loopt Sparki-zijdig en heeft geen Stripe-configuratie nodig.
        trial: access.checkout && state.status === "free",
        checkout: access.checkout && access.configured,
        portal: access.portal && access.configured && state.hasStripeSubscription,
        test_mode: true,
      },
    });
  } catch (err) {
    req.log.error({ err }, "billing.status failed");
    res.status(500).json({ error: "Kon abonnementstatus niet laden" });
  }
});

// Sparki-beheerde proef zonder betaalkaart — géén Stripe-object.
router.post("/trial", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const access = await billingAccess(clerkId);
    if (!access.checkout) {
      res.status(403).json({ error: "Niet beschikbaar voor dit account" });
      return;
    }
    const tier = (req.body as { tier?: unknown })?.tier;
    // TEAM is club-facturatie; persoonlijke trial is daarvoor niet zinnig.
    if (!isPaidTier(tier) || tier === "TEAM") {
      res.status(400).json({ error: "Ongeldige tier (GO of COMPLETE)" });
      return;
    }
    const result = await startTrial(clerkId, tier);
    if (!result.ok) {
      const msg =
        result.reason === "al_gehad"
          ? "Je hebt deze proef al gebruikt"
          : result.reason === "al_betaald"
            ? "Je hebt al een lopend abonnement"
            : "Niet beschikbaar voor dit account";
      res.status(409).json({ error: msg, reason: result.reason });
      return;
    }
    res.json({ ok: true, ends_at: result.endsAt });
  } catch (err) {
    req.log.error({ err }, "billing.trial failed");
    res.status(500).json({ error: "Kon proefperiode niet starten" });
  }
});

// Checkout-sessie (testmodus): server-side aangemaakt met sessie-clerk_id.
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const access = await billingAccess(clerkId);
    if (!access.checkout) {
      res.status(403).json({ error: "Niet beschikbaar voor dit account" });
      return;
    }
    if (!access.configured) {
      res.status(503).json({
        error: "Stripe-testmodus is niet geconfigureerd (STRIPE_SECRET_KEY sk_test_… ontbreekt)",
      });
      return;
    }
    const body = req.body as { tier?: unknown; interval?: unknown };
    // TEAM loopt uitsluitend via de club-checkout (centrale facturatie met
    // club-koppeling); persoonlijk afsluiten zou een team zonder organisatie geven.
    if (!isPaidTier(body?.tier) || body.tier === "TEAM" || !isValidInterval(body?.interval)) {
      res.status(400).json({ error: "Ongeldige tier of interval" });
      return;
    }
    const base = appBaseUrl();
    const session = await getStripeGateway().createCheckoutSession({
      clerkId,
      tier: body.tier,
      interval: body.interval,
      successUrl: `${base}/you?billing=success`,
      cancelUrl: `${base}/you?billing=cancel`,
    });
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "billing.checkout failed");
    res.status(500).json({ error: "Kon checkout niet starten" });
  }
});

// Customer Portal (facturen/betaalmethoden/annuleren/heractiveren).
router.post("/portal", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const access = await billingAccess(clerkId);
    if (!access.portal) {
      res.status(403).json({ error: "Niet beschikbaar voor dit account" });
      return;
    }
    if (!access.configured) {
      res.status(503).json({ error: "Stripe-testmodus is niet geconfigureerd" });
      return;
    }
    const [sub] = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.clerkId, clerkId))
      .orderBy(desc(billingSubscriptionsTable.updatedAt))
      .limit(1);
    if (!sub) {
      res.status(404).json({ error: "Geen abonnement gevonden" });
      return;
    }
    const session = await getStripeGateway().createPortalSession({
      customerId: sub.stripeCustomerId,
      returnUrl: `${appBaseUrl()}/you`,
    });
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "billing.portal failed");
    res.status(500).json({ error: "Kon portal niet openen" });
  }
});

// Up-/downgrade gebeurt in Sparki (portal heeft dit bewust uitgezet).
// Upgrade GO→COMPLETE: direct met proratering. Downgrade COMPLETE→GO: pas op
// periode-einde (planned-change veld, geen onmiddellijke rechtenwijziging).
router.post("/change", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const access = await billingAccess(clerkId);
    if (!access.checkout) {
      res.status(403).json({ error: "Niet beschikbaar voor dit account" });
      return;
    }
    if (!access.configured) {
      res.status(503).json({ error: "Stripe-testmodus is niet geconfigureerd" });
      return;
    }
    const body = req.body as { tier?: unknown; interval?: unknown };
    // TEAM kan hier niet als doel (alleen via club-checkout) …
    if (!isPaidTier(body?.tier) || body.tier === "TEAM") {
      res.status(400).json({ error: "Ongeldige tier (GO of COMPLETE)" });
      return;
    }
    const [sub] = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.clerkId, clerkId))
      .orderBy(desc(billingSubscriptionsTable.updatedAt))
      .limit(1);
    if (!sub || (sub.status !== "active" && sub.status !== "grace")) {
      res.status(409).json({ error: "Geen actief abonnement om te wijzigen" });
      return;
    }
    // … en een gekoppeld TEAM-abonnement kan hier niet als bron worden
    // weggewijzigd — dat zou de club actief laten op een persoonlijke tier.
    if (sub.tier === "TEAM") {
      res.status(409).json({ error: "Een Team-abonnement wijzig je via het clubbeheer." });
      return;
    }
    if (sub.tier === body.tier) {
      res.status(409).json({ error: "Je zit al op deze tier" });
      return;
    }
    const interval = isValidInterval(body?.interval)
      ? body.interval
      : isValidInterval(sub.interval)
        ? sub.interval
        : "month";
    const isUpgrade = sub.tier === "GO" && body.tier === "COMPLETE";
    await getStripeGateway().changeSubscriptionTier({
      subscriptionId: sub.stripeSubscriptionId,
      tier: body.tier,
      interval,
      when: isUpgrade ? "now" : "period_end",
    });
    if (!isUpgrade) {
      // Downgrade: alleen het planned-change veld — rechten wijzigen pas op
      // periode-einde via het subscription.updated-webhookpad.
      await db
        .update(billingSubscriptionsTable)
        .set({ plannedDowngradeTier: body.tier, updatedAt: new Date() })
        .where(eq(billingSubscriptionsTable.id, sub.id));
    }
    res.json({
      ok: true,
      applied: isUpgrade ? "direct_met_proratering" : "op_periode_einde",
    });
  } catch (err) {
    req.log.error({ err }, "billing.change failed");
    res.status(500).json({ error: "Kon abonnement niet wijzigen" });
  }
});

export default router;
