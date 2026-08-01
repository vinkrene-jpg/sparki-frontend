// Stripe-testomgeving (fase 2) — geautomatiseerde testmatrix (14 scenario's
// uit §7 van docs/SPARKI_STRIPE_SUBSCRIPTIONS_PHASE1_ARCHITECTURE.md).
//
// Volledig offline: een fake StripeGateway (setStripeGatewayForTests) plus
// ECHTE signatuurverificatie — payloads worden ondertekend met de officiële
// Stripe-SDK-helper (generateTestHeaderString) tegen een test-webhooksecret,
// dus het verificatie- en rawBody-pad wordt integraal bewezen.
//
// Run: `pnpm --filter @workspace/api-server run test:stripe-billing`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import Stripe from "stripe";
import { eq, and, inArray, like } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  userEntitlementsTable,
  billingSubscriptionsTable,
  billingTestAccountsTable,
  stripeWebhookEventsTable,
  notificationsTable,
  tierFeatureGrantsTable,
  featureFlagsTable,
  userFlagOverridesTable,
  routesTable,
} from "@workspace/db";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { resolveEntitlements, resolveFeatureAccess } from "../lib/entitlements";
import {
  expireBillingStates,
  ensureBillingFlagSeed,
  getBillingState,
  sweepTrialNotices,
} from "../lib/billing";
import {
  setStripeGatewayForTests,
  type StripeGateway,
  type SubscriptionState,
  type InvoiceState,
  type ChargeState,
} from "../lib/billing/stripe-gateway";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
async function scenario(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Fake Stripe-gateway ──────────────────────────────────────────────────────
class FakeGateway implements StripeGateway {
  subs = new Map<string, SubscriptionState>();
  invoices = new Map<string, InvoiceState>();
  charges = new Map<string, ChargeState>();
  lastChange: { when: string; tier: string } | null = null;
  failNextGetSubscription = false;

  isConfigured() {
    return true;
  }
  async createCheckoutSession(args: {
    clerkId: string;
    tier: "GO" | "COMPLETE" | "TEAM";
    interval: "month" | "year";
  }) {
    return {
      id: `cs_${args.tier}_${args.interval}`,
      url: `https://checkout.stripe.test/${args.tier}/${args.interval}`,
    };
  }
  async createPortalSession() {
    return { url: "https://portal.stripe.test/session" };
  }
  async getSubscription(id: string) {
    if (this.failNextGetSubscription) {
      this.failNextGetSubscription = false;
      throw new Error("gesimuleerde Stripe-API-fout");
    }
    return this.subs.get(id) ?? null;
  }
  async getInvoice(id: string) {
    return this.invoices.get(id) ?? null;
  }
  async getCharge(id: string) {
    return this.charges.get(id) ?? null;
  }
  async changeSubscriptionTier(args: {
    subscriptionId: string;
    tier: "GO" | "COMPLETE";
    interval: "month" | "year";
    when: "now" | "period_end";
  }) {
    this.lastChange = { when: args.when, tier: args.tier };
    const sub = this.subs.get(args.subscriptionId);
    if (sub && args.when === "now") {
      sub.tier = args.tier;
      sub.interval = args.interval;
      sub.priceId = `price_${args.tier}_${args.interval}`;
    }
    // period_end: fake laat de tier staan tot de test zelf het periode-einde
    // simuleert (nieuwe updated-event met gewijzigde tier).
  }
}
const fake = new FakeGateway();
setStripeGatewayForTests(fake);

// ── Webhook-hulpen: echte signatuur via de officiële SDK-helper ──────────────
const WEBHOOK_SECRET = "whsec_sparki_testmatrix_secret";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
const signer = new Stripe("sk_test_signing_helper_only");
let eventSeq = 0;

async function sendWebhook(
  type: string,
  object: Record<string, unknown>,
  opts: { eventId?: string; created?: number; badSignature?: boolean } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const id = opts.eventId ?? `evt_test_${RUN}_${++eventSeq}`;
  const payload = JSON.stringify({
    id,
    object: "event",
    type,
    created: opts.created ?? Math.floor(Date.now() / 1000),
    data: { object },
  });
  const signature = opts.badSignature
    ? "t=1,v1=deadbeef"
    : signer.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const res = await fetch(`${baseUrl}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function api(
  actor: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_billing_${Date.now()}`;
const userA = `${RUN}_a`; // allowlist + subscription
const userB = `${RUN}_b`; // subscription, GEEN allowlist
const legacyUser = `${RUN}_legacy`; // legacy_unrestricted
const trialUser = `${RUN}_trial`; // allowlist, verse gebruiker
const ALL = [userA, userB, legacyUser, trialUser];
const FLAG_KEYS = ["commercial_tiers", "stripe_checkout", "stripe_portal", "stripe_webhooks"];

let baseUrl = "";
let server: Server | null = null;
let webhookFlagWasSeeded = false;

function seedSub(
  id: string,
  clerkId: string,
  tier: "GO" | "COMPLETE",
  interval: "month" | "year",
  overrides: Partial<SubscriptionState> = {},
): SubscriptionState {
  const state: SubscriptionState = {
    id,
    customerId: `cus_${id}`,
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    created: new Date(),
    priceId: `price_${tier}_${interval}`,
    tier,
    interval,
    clerkId,
    ...overrides,
  };
  fake.subs.set(id, state);
  return state;
}

async function setup() {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("no port"));
    });
  });
  for (const id of ALL) {
    await ensureAccount(id, `${id}@test.sparki.local`, id, silentLogger);
  }
  await db
    .update(userProfilesTable)
    .set({ entitlementMode: "subscription" })
    .where(inArray(userProfilesTable.clerkId, [userA, userB, trialUser]));
  await db
    .update(userProfilesTable)
    .set({ entitlementMode: "legacy_unrestricted" })
    .where(eq(userProfilesTable.clerkId, legacyUser));

  await ensureBillingFlagSeed();
  // Allowlist: alleen A en trialUser.
  await db
    .insert(billingTestAccountsTable)
    .values([
      { clerkId: userA, addedBy: "testmatrix", reason: "scenario's 1-11" },
      { clerkId: trialUser, addedBy: "testmatrix", reason: "scenario 2" },
    ])
    .onConflictDoNothing({ target: billingTestAccountsTable.clerkId });
  // Flags per gebruiker aan (overrides) — óók voor B en legacy, om te bewijzen
  // dat de allowlist de extra grendel is en legacy byte-identiek blijft.
  const overrideValues = [];
  for (const clerkId of ALL) {
    for (const flagKey of ["commercial_tiers", "stripe_checkout", "stripe_portal"]) {
      overrideValues.push({ clerkId, flagKey, enabled: true, setBy: "testmatrix" });
    }
  }
  await db
    .insert(userFlagOverridesTable)
    .values(overrideValues)
    .onConflictDoNothing();
  // Webhookflag is endpoint-breed (geen usercontext) ⇒ tijdelijk globaal aan.
  const flipped = await db
    .update(featureFlagsTable)
    .set({ enabledGlobally: true })
    .where(
      and(eq(featureFlagsTable.key, "stripe_webhooks"), eq(featureFlagsTable.enabledGlobally, false)),
    )
    .returning({ key: featureFlagsTable.key });
  webhookFlagWasSeeded = flipped.length > 0;
  // Tier-projectie: GO → premium; COMPLETE → premium + knowledge_base.
  await db
    .insert(tierFeatureGrantsTable)
    .values([
      { commercialTier: "GO", featureKey: "premium" },
      { commercialTier: "COMPLETE", featureKey: "premium" },
      { commercialTier: "COMPLETE", featureKey: "knowledge_base" },
    ])
    .onConflictDoNothing();
}

async function cleanup() {
  try {
    await db
      .delete(stripeWebhookEventsTable)
      .where(like(stripeWebhookEventsTable.eventId, `evt_test_${RUN}_%`));
    await db
      .delete(tierFeatureGrantsTable)
      .where(inArray(tierFeatureGrantsTable.featureKey, ["premium", "knowledge_base"]));
    if (webhookFlagWasSeeded) {
      await db
        .update(featureFlagsTable)
        .set({ enabledGlobally: false })
        .where(eq(featureFlagsTable.key, "stripe_webhooks"));
    }
    // user_entitlements / overrides / allowlist / billing_subscriptions
    // verdwijnen via ON DELETE CASCADE met de profielen.
    await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
  } catch (err) {
    console.error("cleanup failed", err);
  }
  if (server) await new Promise<void>((r) => server!.close(() => r()));
}

// ── Scenario's ───────────────────────────────────────────────────────────────
async function main() {
  await setup();

  // 1. Checkout GO/COMPLETE × maand/jaar ⇒ active, juiste tier/interval, rechten.
  await scenario("1. checkout 4 combinaties → active + rechten via resolver", async () => {
    const combos: ["GO" | "COMPLETE", "month" | "year"][] = [
      ["GO", "month"],
      ["GO", "year"],
      ["COMPLETE", "month"],
      ["COMPLETE", "year"],
    ];
    for (const [tier, interval] of combos) {
      const checkout = await api(userA, "POST", "/api/billing/checkout", { tier, interval });
      assert(checkout.status === 200 && checkout.body.url, `checkout ${tier}/${interval}: ${checkout.status}`);
      const subId = `sub_${RUN}_${tier}_${interval}`;
      seedSub(subId, userA, tier, interval);
      const r1 = await sendWebhook("checkout.session.completed", {
        id: `cs_${subId}`,
        subscription: subId,
        client_reference_id: userA,
        metadata: { clerk_id: userA },
      });
      assert(r1.status === 200, `checkout.completed ${r1.status}`);
      await sendWebhook("customer.subscription.created", { id: subId });
      const state = await getBillingState(userA);
      assert(state.status === "active", `status ${state.status} ≠ active`);
      assert(state.tier === tier && state.interval === interval, `tier/interval mis: ${state.tier}/${state.interval}`);
      const ent = await resolveEntitlements(userA);
      assert(ent.commercialFeatures["premium"]?.source === `tier:${tier}`, `premium niet via tier:${tier}`);
      if (tier === "COMPLETE") assert(ent.commercialFeatures["knowledge_base"], "COMPLETE mist knowledge_base");
      // Opruimen tussen combos: subscription-rij weg, tier terug naar null.
      await db.delete(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.clerkId, userA));
      await db.update(userProfilesTable).set({ commercialTier: null }).where(eq(userProfilesTable.clerkId, userA));
    }
  });

  // 2. Proef zonder kaart: trialing zonder Stripe-object; na ends_at expired/FREE.
  await scenario("2. Sparki-proef zonder kaart → trialing, daarna expired/FREE", async () => {
    const start = await api(trialUser, "POST", "/api/billing/trial", { tier: "COMPLETE" });
    assert(start.status === 200, `trial start ${start.status}: ${JSON.stringify(start.body)}`);
    const state = await getBillingState(trialUser);
    assert(state.status === "trialing" && state.tier === "COMPLETE", `status ${state.status}/${state.tier}`);
    assert(!state.hasStripeSubscription, "trial mag géén Stripe-object hebben");
    // 14 dagen COMPLETE-proef.
    const ends = new Date(state.trialEndsAt!);
    const days = (ends.getTime() - Date.now()) / (24 * 3600 * 1000);
    assert(days > 13.9 && days < 14.1, `COMPLETE-proef ≠ 14 dagen (${days.toFixed(2)})`);
    const ent = await resolveEntitlements(trialUser);
    assert(ent.commercialFeatures["premium"]?.source === "trial:tier:COMPLETE", "trial projecteert geen tier-features");
    // Tweede keer ⇒ idempotent geweigerd.
    const again = await api(trialUser, "POST", "/api/billing/trial", { tier: "COMPLETE" });
    assert(again.status === 409, `tweede proef moest 409 zijn, was ${again.status}`);
    // Verlopen ⇒ expired/FREE, geen rechten meer.
    await db
      .update(userEntitlementsTable)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(and(eq(userEntitlementsTable.clerkId, trialUser), eq(userEntitlementsTable.entitlementType, "trial")));
    const after = await getBillingState(trialUser);
    assert(after.status === "expired" && after.tier === "FREE", `na verloop: ${after.status}/${after.tier}`);
    const entAfter = await resolveEntitlements(trialUser);
    assert(!entAfter.commercialFeatures["premium"], "verlopen proef geeft nog rechten");
  });

  // Basis voor 3-8: actieve GO-maand subscription voor userA.
  const mainSubId = `sub_${RUN}_main`;
  seedSub(mainSubId, userA, "GO", "month");
  await sendWebhook("customer.subscription.created", { id: mainSubId });

  // 3. Upgrade GO→COMPLETE: direct, met proratering.
  await scenario("3. upgrade GO→COMPLETE direct met proratering", async () => {
    const res = await api(userA, "POST", "/api/billing/change", { tier: "COMPLETE" });
    assert(res.status === 200 && res.body.applied === "direct_met_proratering", JSON.stringify(res.body));
    assert(fake.lastChange?.when === "now", "upgrade moest 'now' zijn");
    await sendWebhook("customer.subscription.updated", { id: mainSubId });
    const state = await getBillingState(userA);
    assert(state.status === "active" && state.tier === "COMPLETE", `${state.status}/${state.tier}`);
    const ent = await resolveEntitlements(userA);
    assert(ent.commercialFeatures["knowledge_base"], "rechten niet direct COMPLETE");
  });

  // 4. Downgrade COMPLETE→GO: pas op periode-einde, planned-downgrade zichtbaar.
  await scenario("4. downgrade COMPLETE→GO pas op periode-einde", async () => {
    const res = await api(userA, "POST", "/api/billing/change", { tier: "GO" });
    assert(res.status === 200 && res.body.applied === "op_periode_einde", JSON.stringify(res.body));
    assert(fake.lastChange?.when === "period_end", "downgrade moest 'period_end' zijn");
    let state = await getBillingState(userA);
    assert(state.tier === "COMPLETE", "tot periode-einde COMPLETE-rechten");
    assert(state.plannedDowngradeTier === "GO", "planned-downgrade niet zichtbaar");
    // Periode-einde: Stripe past de tier toe en stuurt updated.
    fake.subs.get(mainSubId)!.tier = "GO";
    await sendWebhook("customer.subscription.updated", { id: mainSubId });
    state = await getBillingState(userA);
    assert(state.tier === "GO" && state.status === "active", `${state.status}/${state.tier}`);
  });

  // 5. Annuleren + heractiveren via Portal.
  await scenario("5. annuleren (toegang tot periode-einde) + heractiveren", async () => {
    const portal = await api(userA, "POST", "/api/billing/portal");
    assert(portal.status === 200 && portal.body.url, `portal ${portal.status}`);
    fake.subs.get(mainSubId)!.cancelAtPeriodEnd = true;
    await sendWebhook("customer.subscription.updated", { id: mainSubId });
    let state = await getBillingState(userA);
    assert(state.status === "canceled" && state.tier === "GO", `${state.status}/${state.tier}`);
    const ent = await resolveEntitlements(userA);
    assert(ent.commercialFeatures["premium"], "canceled moet toegang houden tot periode-einde");
    fake.subs.get(mainSubId)!.cancelAtPeriodEnd = false;
    await sendWebhook("customer.subscription.updated", { id: mainSubId });
    state = await getBillingState(userA);
    assert(state.status === "active", `heractiveren gaf ${state.status}`);
  });

  // 6. Mislukte betaling: grace exact 7 dagen vanaf Stripe-brontijd, monotoon.
  await scenario("6. mislukte betaling → grace exact 7d, monotoon, daarna expired", async () => {
    const invoiceCreated = new Date(Date.now() - 3600 * 1000); // een uur geleden
    fake.invoices.set(`in_${RUN}_fail`, {
      id: `in_${RUN}_fail`,
      subscriptionId: mainSubId,
      customerId: `cus_${mainSubId}`,
      created: invoiceCreated,
      status: "open",
      attemptCount: 1,
    });
    await sendWebhook("invoice.payment_failed", { id: `in_${RUN}_fail` });
    let state = await getBillingState(userA);
    assert(state.status === "grace", `status ${state.status}`);
    const expected = invoiceCreated.getTime() + 7 * 24 * 3600 * 1000;
    assert(new Date(state.graceUntil!).getTime() === expected, "grace ≠ eerste-poging-tijd + 7d");
    const ent = await resolveEntitlements(userA);
    assert(ent.commercialFeatures["premium"], "rechten moeten in grace intact blijven");
    // Herlevering (nieuw event-id, later `created`) mag grace NIET opschuiven.
    await sendWebhook("invoice.payment_failed", { id: `in_${RUN}_fail` }, { created: Math.floor(Date.now() / 1000) + 999 });
    state = await getBillingState(userA);
    assert(new Date(state.graceUntil!).getTime() === expected, "grace is opgeschoven (niet monotoon)");
    // Grace voorbij ⇒ dagelijkse job zet expired + FREE.
    await db
      .update(billingSubscriptionsTable)
      .set({ graceUntil: new Date(Date.now() - 1000) })
      .where(eq(billingSubscriptionsTable.stripeSubscriptionId, mainSubId));
    await expireBillingStates();
    state = await getBillingState(userA);
    assert(state.status === "expired" && state.tier === "FREE", `${state.status}/${state.tier}`);
    // Herstel voor vervolg-scenario's: betaling alsnog gelukt.
    fake.invoices.set(`in_${RUN}_paid`, {
      id: `in_${RUN}_paid`,
      subscriptionId: mainSubId,
      customerId: `cus_${mainSubId}`,
      created: new Date(),
      status: "paid",
      attemptCount: 2,
    });
    await sendWebhook("invoice.paid", { id: `in_${RUN}_paid` });
    state = await getBillingState(userA);
    assert(state.status === "active" && state.graceUntil === null, "invoice.paid moest grace wissen");
  });

  // 7+8. Refunds: cumulatief besluit.
  await scenario("7. volledige refund → entitlement ingetrokken (blocked)", async () => {
    // Eerst gedeeltelijk (scenario 8 verweven: zelfde charge, cumulatief).
    fake.charges.set(`ch_${RUN}`, {
      id: `ch_${RUN}`,
      customerId: `cus_${mainSubId}`,
      amount: 299,
      amountRefunded: 100,
    });
    await sendWebhook("charge.refunded", { id: `ch_${RUN}` });
    let state = await getBillingState(userA);
    assert(state.status === "active", `gedeeltelijke refund wijzigde status: ${state.status}`);
    // Tweede gedeeltelijke refund maakt het CUMULATIEF volledig.
    fake.charges.get(`ch_${RUN}`)!.amountRefunded = 299;
    await sendWebhook("charge.refunded", { id: `ch_${RUN}` });
    state = await getBillingState(userA);
    assert(state.status === "blocked", `cumulatief volledig moest blocked geven, was ${state.status}`);
    const ent = await resolveEntitlements(userA);
    assert(!ent.commercialFeatures["premium"], "blocked mag geen betaalde features geven");
  });

  await scenario("8. gedeeltelijke refund → entitlement behouden", async () => {
    // Aparte subscription voor een schone gedeeltelijke-refundcontrole.
    const subId = `sub_${RUN}_partial`;
    seedSub(subId, userA, "GO", "month");
    await db.delete(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.clerkId, userA));
    await sendWebhook("customer.subscription.created", { id: subId });
    fake.charges.set(`ch_${RUN}_p`, {
      id: `ch_${RUN}_p`,
      customerId: `cus_${subId}`,
      amount: 299,
      amountRefunded: 50,
    });
    await sendWebhook("charge.refunded", { id: `ch_${RUN}_p` });
    const state = await getBillingState(userA);
    assert(state.status === "active" && state.tier === "GO", `${state.status}/${state.tier}`);
    const ent = await resolveEntitlements(userA);
    assert(ent.commercialFeatures["premium"], "gedeeltelijke refund moest rechten behouden");
  });

  // 9. Dubbele webhook (zelfde event-ID) ⇒ no-op.
  await scenario("9. dubbele webhook (zelfde event-ID) is idempotent", async () => {
    const subId = `sub_${RUN}_dup`;
    seedSub(subId, userA, "GO", "month");
    const eventId = `evt_test_${RUN}_dup`;
    const r1 = await sendWebhook("customer.subscription.created", { id: subId }, { eventId });
    assert(r1.body.outcome === "processed", `eerste levering: ${JSON.stringify(r1.body)}`);
    fake.subs.get(subId)!.tier = "COMPLETE"; // zou bij herverwerking zichtbaar worden
    const r2 = await sendWebhook("customer.subscription.created", { id: subId }, { eventId });
    assert(r2.body.outcome === "duplicate", `tweede levering: ${JSON.stringify(r2.body)}`);
    const [row] = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subId));
    assert(row?.tier === "GO", "duplicate is tóch verwerkt");
    fake.subs.get(subId)!.tier = "GO";
  });

  // 10. Verkeerd geordende webhooks: updated vóór created ⇒ eindstaat correct.
  await scenario("10. out-of-order (updated vóór created) → correcte eindstaat", async () => {
    await db.delete(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.clerkId, userA));
    const subId = `sub_${RUN}_ooo`;
    seedSub(subId, userA, "COMPLETE", "year");
    await sendWebhook("customer.subscription.updated", { id: subId }, { created: Math.floor(Date.now() / 1000) });
    await sendWebhook("customer.subscription.created", { id: subId }, { created: Math.floor(Date.now() / 1000) - 60 });
    const state = await getBillingState(userA);
    assert(state.status === "active" && state.tier === "COMPLETE" && state.interval === "year", `${state.status}/${state.tier}/${state.interval}`);
    const rows = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subId));
    assert(rows.length === 1, `dubbele rijen: ${rows.length}`);
  });

  // 11. Webhook-verwerkingsfout ⇒ geen rechten, event her-verwerkbaar.
  await scenario("11. verwerkingsfout → rollback, geen rechten, her-verwerkbaar", async () => {
    await db.delete(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.clerkId, userA));
    await db.update(userProfilesTable).set({ commercialTier: null }).where(eq(userProfilesTable.clerkId, userA));
    const subId = `sub_${RUN}_err`;
    seedSub(subId, userA, "GO", "month");
    const eventId = `evt_test_${RUN}_err`;
    fake.failNextGetSubscription = true;
    const r1 = await sendWebhook("customer.subscription.created", { id: subId }, { eventId });
    assert(r1.status === 500, `fout moest 500 geven, was ${r1.status}`);
    const [evRow] = await db
      .select()
      .from(stripeWebhookEventsTable)
      .where(eq(stripeWebhookEventsTable.eventId, eventId));
    assert(!evRow, "eventregistratie moest teruggerold zijn");
    const ent = await resolveEntitlements(userA);
    assert(!ent.commercialFeatures["premium"], "fout gaf tóch rechten");
    // Retry (zelfde event-ID, Stripe levert opnieuw) slaagt nu wél.
    const r2 = await sendWebhook("customer.subscription.created", { id: subId }, { eventId });
    assert(r2.status === 200 && r2.body.outcome === "processed", JSON.stringify(r2.body));
    const state = await getBillingState(userA);
    assert(state.status === "active", `retry gaf ${state.status}`);
    // Ongeldige signatuur wordt geweigerd zonder registratie.
    const bad = await sendWebhook("customer.subscription.created", { id: subId }, { badSignature: true });
    assert(bad.status === 400, `ongeldige signatuur: ${bad.status}`);
  });

  // 12. Accountisolatie: buiten allowlist geen checkout; A's betaling geeft B niets.
  await scenario("12. accountisolatie (allowlist + clerk_id-koppeling)", async () => {
    const status = await api(userB, "GET", "/api/billing/status");
    assert(status.status === 200, `status ${status.status}`);
    const avail = status.body.available as Record<string, boolean>;
    assert(!avail.checkout && !avail.trial && !avail.portal, "B (geen allowlist) zag betaalflows");
    const checkout = await api(userB, "POST", "/api/billing/checkout", { tier: "GO", interval: "month" });
    assert(checkout.status === 403, `checkout buiten allowlist: ${checkout.status}`);
    const trial = await api(userB, "POST", "/api/billing/trial", { tier: "GO" });
    assert(trial.status === 403, `trial buiten allowlist: ${trial.status}`);
    // A heeft een actieve subscription (scenario 11) — B heeft daar niets van.
    const entB = await resolveEntitlements(userB);
    assert(Object.keys(entB.commercialFeatures).length === 0, "B kreeg rechten van A's betaling");
    const [profileB] = await db
      .select({ commercialTier: userProfilesTable.commercialTier })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, userB));
    assert(profileB?.commercialTier == null, "B's profieltier is aangeraakt");
  });

  // 13. Legacy-gebruiker: byte-identiek gedrag, ongeacht alle nieuwe flags.
  await scenario("13. legacy-gebruiker blijft byte-identiek", async () => {
    // Flags voor legacy staan al aan via overrides (setup) — juist dan moet
    // het gedrag gelijk blijven aan het bestaande legacy-pad.
    const access = await resolveFeatureAccess(
      { clerkId: legacyUser, activeRole: "athlete" },
      "premium",
    );
    assert(access.commercial_entitled === true, "legacy verloor commercieel recht");
    assert(access.source === "legacy_unrestricted", `source ${access.source}`);
    assert(access.entitlement_mode === "legacy_unrestricted", "mode gewijzigd");
    const ent = await resolveEntitlements(legacyUser);
    assert(ent.activeEntitlements.length === 0, "legacy kreeg entitlement-rijen");
    const state = await getBillingState(legacyUser);
    assert(state.status === "legacy_unrestricted", `billing status ${state.status}`);
    // Trial voor legacy wordt geweigerd, ook mét allowlist.
    await db
      .insert(billingTestAccountsTable)
      .values({ clerkId: legacyUser, addedBy: "testmatrix", reason: "scenario 13" })
      .onConflictDoNothing({ target: billingTestAccountsTable.clerkId });
    const trial = await api(legacyUser, "POST", "/api/billing/trial", { tier: "GO" });
    assert(trial.status === 409 && trial.body.reason === "legacy", JSON.stringify(trial.body));
  });

  // 14. Onbekende/corrupte status ⇒ fail-closed als FREE.
  await scenario("14. corrupte tier/status → fail-closed FREE", async () => {
    await db
      .update(userProfilesTable)
      .set({ commercialTier: "PLATINUM_ULTRA" })
      .where(eq(userProfilesTable.clerkId, userB));
    const state = await getBillingState(userB);
    assert(state.status === "free" && state.tier === "FREE", `${state.status}/${state.tier}`);
    const ent = await resolveEntitlements(userB);
    assert(Object.keys(ent.commercialFeatures).length === 0, "corrupte tier gaf rechten");
    // Corrupte subscription-status ⇒ nooit betaald.
    await db.insert(billingSubscriptionsTable).values({
      clerkId: userB,
      stripeCustomerId: "cus_corrupt",
      stripeSubscriptionId: `sub_${RUN}_corrupt`,
      tier: "GO",
      interval: "month",
      status: "super_active_forever",
    });
    const state2 = await getBillingState(userB);
    assert(state2.status === "free" && state2.tier === "FREE", `corrupte substatus: ${state2.status}/${state2.tier}`);
  });

  // ── ABONNEMENT_01: uitgebreide statusvertaling + meldingen ────────────────

  // 15. past_due/unpaid via subscription-status → grace (zelfde route als
  //     invoice.payment_failed), monotoon, rechten intact tijdens grace.
  await scenario("15. past_due-subscriptionstatus → grace, monotoon, rechten intact", async () => {
    await db.delete(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.clerkId, userA));
    const subId = `sub_${RUN}_pastdue`;
    seedSub(subId, userA, "GO", "month");
    await sendWebhook("customer.subscription.created", { id: subId });
    const eventCreated = Math.floor(Date.now() / 1000) - 3600;
    fake.subs.get(subId)!.status = "past_due";
    await sendWebhook("customer.subscription.updated", { id: subId }, { created: eventCreated });
    let state = await getBillingState(userA);
    assert(state.status === "grace", `status ${state.status} ≠ grace`);
    const expected = eventCreated * 1000 + 7 * 24 * 3600 * 1000;
    assert(new Date(state.graceUntil!).getTime() === expected, "grace ≠ eventtijd + 7d");
    const ent = await resolveEntitlements(userA);
    assert(ent.commercialFeatures["premium"], "rechten moeten tijdens grace intact blijven");
    // Latere her-levering mag grace niet opschuiven (monotoon).
    await sendWebhook("customer.subscription.updated", { id: subId }, { created: eventCreated + 9999 });
    state = await getBillingState(userA);
    assert(new Date(state.graceUntil!).getTime() === expected, "grace opgeschoven (niet monotoon)");
    // Herstel: betaling gelukt.
    fake.subs.get(subId)!.status = "active";
    await sendWebhook("customer.subscription.updated", { id: subId });
    state = await getBillingState(userA);
    assert(state.status === "active", `herstel gaf ${state.status}`);
  });

  // 16. incomplete → geen rechten; paused → bevroren maar data behouden; active herstelt.
  await scenario("16. incomplete geen rechten; paused bevriest en hervatten herstelt", async () => {
    await db.delete(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.clerkId, userA));
    const subId = `sub_${RUN}_pause`;
    seedSub(subId, userA, "COMPLETE", "month", { status: "incomplete" });
    await sendWebhook("customer.subscription.created", { id: subId });
    let state = await getBillingState(userA);
    assert(state.status === "incomplete" && state.tier === "FREE", `${state.status}/${state.tier}`);
    let ent = await resolveEntitlements(userA);
    assert(!ent.commercialFeatures["premium"], "incomplete gaf rechten");
    // Betaling rond → active.
    fake.subs.get(subId)!.status = "active";
    await sendWebhook("customer.subscription.updated", { id: subId });
    ent = await resolveEntitlements(userA);
    assert(ent.commercialFeatures["knowledge_base"], "active herstelde COMPLETE-rechten niet");
    // Pauzeren: rechten bevroren, subscription-rij (data) blijft bestaan.
    fake.subs.get(subId)!.status = "paused";
    await sendWebhook("customer.subscription.updated", { id: subId });
    state = await getBillingState(userA);
    assert(state.status === "paused", `status ${state.status} ≠ paused`);
    assert(state.tier === "COMPLETE", "paused moet tonen wát er gepauzeerd is");
    ent = await resolveEntitlements(userA);
    assert(!ent.commercialFeatures["premium"], "paused gaf tóch betaalde rechten");
    const rows = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subId));
    assert(rows.length === 1 && rows[0].tier === "COMPLETE", "paused raakte gegevens kwijt");
    // Hervatten via webhook herstelt de rechten volledig.
    fake.subs.get(subId)!.status = "active";
    await sendWebhook("customer.subscription.updated", { id: subId });
    state = await getBillingState(userA);
    ent = await resolveEntitlements(userA);
    assert(state.status === "active" && ent.commercialFeatures["knowledge_base"], "hervatten herstelde niet");
  });

  // 17. Onbekende Stripe-status → fail-closed "unknown" (geen rechten), nooit
  //     stilzwijgend de oude status behouden.
  await scenario("17. onbekende Stripe-status → unknown, fail-closed, gelogd besluit", async () => {
    await db.delete(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.clerkId, userA));
    const subId = `sub_${RUN}_unknown`;
    seedSub(subId, userA, "GO", "month");
    await sendWebhook("customer.subscription.created", { id: subId });
    let ent = await resolveEntitlements(userA);
    assert(ent.commercialFeatures["premium"], "voorbereiding: active gaf geen rechten");
    fake.subs.get(subId)!.status = "some_future_stripe_status" as SubscriptionState["status"];
    await sendWebhook("customer.subscription.updated", { id: subId });
    const [row] = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subId));
    assert(row?.status === "unknown", `DB-status ${row?.status} ≠ unknown (stil behouden?)`);
    const state = await getBillingState(userA);
    assert(state.status === "free" && state.tier === "FREE", `${state.status}/${state.tier}`);
    ent = await resolveEntitlements(userA);
    assert(!ent.commercialFeatures["premium"], "unknown gaf tóch rechten");
  });

  // 18. Meldingen bij overgangen: aangemaakt ná commit, idempotent via dedupeKey.
  await scenario("18. statusovergang maakt één melding; her-levering geen tweede", async () => {
    await db.delete(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.clerkId, userA));
    const subId = `sub_${RUN}_notify`;
    seedSub(subId, userA, "GO", "month");
    await sendWebhook("customer.subscription.created", { id: subId });
    fake.subs.get(subId)!.status = "paused";
    await sendWebhook("customer.subscription.updated", { id: subId });
    const key = `billing:${subId}:paused`;
    let rows = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.clerkId, userA), eq(notificationsTable.dedupeKey, key)));
    assert(rows.length === 1, `verwacht 1 paused-melding, kreeg ${rows.length}`);
    assert(rows[0].title.includes("gepauzeerd"), `titel: ${rows[0].title}`);
    assert(!/\d+\s*(uur|minuten) over|nog maar/.test(rows[0].body ?? ""), "melding bevat aftel-urgentie");
    // Her-levering (nieuw event-id, zelfde staat): geen tweede melding.
    await sendWebhook("customer.subscription.updated", { id: subId });
    rows = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.clerkId, userA), eq(notificationsTable.dedupeKey, key)));
    assert(rows.length === 1, `her-levering maakte extra melding (${rows.length})`);
    // Verwerkingsfout ⇒ rollback ⇒ óók geen NIEUWE melding over de mislukte
    // overgang (de eerdere created→active-melding telt niet mee).
    const countBefore = (
      await db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.clerkId, userA))
    ).length;
    fake.subs.get(subId)!.status = "grace" as SubscriptionState["status"];
    fake.subs.get(subId)!.status = "past_due";
    fake.failNextGetSubscription = true;
    const r = await sendWebhook("customer.subscription.updated", { id: subId });
    assert(r.status === 500, `fout moest 500 geven, was ${r.status}`);
    const countAfter = (
      await db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.clerkId, userA))
    ).length;
    assert(countAfter === countBefore, "rollback liet tóch een melding achter");
    await db.delete(notificationsTable).where(eq(notificationsTable.clerkId, userA));
  });

  // 19. Downgrade van routes (§1.3): alles blijft zichtbaar, niets verdwijnt,
  //     keuzeflow max. drie actieve routes, eigendom afgedwongen.
  await scenario("19. downgrade-keuzeflow: routes blijven, keuze max 3, eigendom afgedwongen", async () => {
    // userA is na scenario 17 effectief FREE met een Stripe-historie (unknown).
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      const [r] = await db
        .insert(routesTable)
        .values({ clerkId: userA, name: `Downgrade-test route ${i + 1}` })
        .returning({ id: routesTable.id });
      ids.push(r!.id);
    }
    const [vreemde] = await db
      .insert(routesTable)
      .values({ clerkId: userB, name: "Route van B" })
      .returning({ id: routesTable.id });
    try {
      let state = await api(userA, "GET", "/api/routes/downgrade-state");
      assert(state.status === 200, `downgrade-state ${state.status}`);
      assert(state.body.vanToepassing === true, "downgrade niet van toepassing terwijl A gedowngraded is");
      assert(state.body.keuzeVereist === true, "keuzeVereist moest true zijn (>3 routes, geen keuze)");
      assert(Number(state.body.totaalRoutes) >= 5, `routes verdwenen? totaal=${state.body.totaalRoutes}`);
      // Meer dan drie kiezen ⇒ 400; route van een ander ⇒ 403.
      const teVeel = await api(userA, "PUT", "/api/routes/active-selection", { routeIds: ids.slice(0, 4) });
      assert(teVeel.status === 400, `4 routes moest 400 zijn, was ${teVeel.status}`);
      const nietVanJou = await api(userA, "PUT", "/api/routes/active-selection", { routeIds: [ids[0], vreemde!.id] });
      assert(nietVanJou.status === 403, `andermans route moest 403 zijn, was ${nietVanJou.status}`);
      // Geldige keuze van drie ⇒ keuzeVereist vervalt, en er is niets verwijderd.
      const keuze = await api(userA, "PUT", "/api/routes/active-selection", { routeIds: ids.slice(0, 3) });
      assert(keuze.status === 200, `keuze ${keuze.status}`);
      assert(keuze.body.keuzeVereist === false, "na geldige keuze moest keuzeVereist false zijn");
      assert((keuze.body.gekozenRouteIds as number[]).length === 3, "keuze niet opgeslagen");
      const rows = await db
        .select({ id: routesTable.id })
        .from(routesTable)
        .where(and(eq(routesTable.clerkId, userA), inArray(routesTable.id, ids)));
      assert(rows.length === 5, `downgrade verwijderde routes: ${rows.length}/5 over`);
      // Bewerken blijft op Gratis geweigerd (alleen-lezen), óók voor gekozen routes.
      const bewerk = await api(userA, "PUT", `/api/routes/${ids[0]}`, { name: "Nieuwe naam" });
      assert(bewerk.status === 403 && bewerk.body.code === "upgrade_required", `bewerken op Gratis: ${bewerk.status}`);
    } finally {
      await db.delete(routesTable).where(inArray(routesTable.id, [...ids, vreemde!.id]));
    }
  });

  // 20. Webhook voor een onbekende gebruiker: gelogd-als-genegeerd, niets geraden.
  await scenario("20. webhook onbekende gebruiker → genegeerd + gelogd, niets aangemaakt", async () => {
    const subId = `sub_${RUN}_ghost`;
    seedSub(subId, `${RUN}_bestaat_niet`, "GO", "month");
    const eventId = `evt_test_${RUN}_ghost`;
    const r = await sendWebhook("customer.subscription.created", { id: subId }, { eventId });
    assert(r.status === 200 && r.body.outcome === "ignored", JSON.stringify(r.body));
    const [ev] = await db
      .select()
      .from(stripeWebhookEventsTable)
      .where(eq(stripeWebhookEventsTable.eventId, eventId));
    assert(ev?.result?.includes("onbekende gebruiker"), `resultaat niet gelogd: ${ev?.result}`);
    const rows = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subId));
    assert(rows.length === 0, "er is tóch een subscription-rij geraden");
  });

  // 21. Proefperiode-einde (§1.7): rustige melding vóór en ná afloop; data blijft.
  await scenario("21. trial-einde: melding vooraf en achteraf, idempotent, data onaangeraakt", async () => {
    // trialUser heeft in scenario 2 een verlopen COMPLETE-trial.
    const before = await db
      .select()
      .from(userEntitlementsTable)
      .where(eq(userEntitlementsTable.clerkId, trialUser));
    const r1 = await sweepTrialNotices();
    assert(r1.ended >= 1, `verwachtte ≥1 afloop-melding, kreeg ${r1.ended}`);
    const meldingen = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.clerkId, trialUser));
    const ended = meldingen.find((m) => m.dedupeKey?.endsWith(":ended"));
    assert(ended, "afloop-melding ontbreekt");
    assert(/blijft bewaard|is er nog|niets verdwenen/.test(ended!.body ?? ""), "afloop-melding stelt data niet gerust");
    assert(!/nog maar|laatste kans|verloopt over \d+ (minuten|uur)!/i.test(ended!.body ?? ""), "misleidende urgentie");
    // Idempotent: tweede sweep maakt geen tweede melding.
    const r2 = await sweepTrialNotices();
    assert(r2.ended === 0, `tweede sweep maakte ${r2.ended} extra meldingen`);
    // Vooraf-melding: zet de einddatum 2 dagen vooruit.
    await db
      .update(userEntitlementsTable)
      .set({ endsAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) })
      .where(and(eq(userEntitlementsTable.clerkId, trialUser), eq(userEntitlementsTable.entitlementType, "trial")));
    const r3 = await sweepTrialNotices();
    assert(r3.endingSoon >= 1, "vooraf-melding niet aangemaakt");
    // Data onaangeraakt: entitlement-rijen bestaan nog exact.
    const after = await db
      .select()
      .from(userEntitlementsTable)
      .where(eq(userEntitlementsTable.clerkId, trialUser));
    assert(after.length === before.length, "trial-einde raakte gebruikersdata");
    await db.delete(notificationsTable).where(eq(notificationsTable.clerkId, trialUser));
  });

  // 22. Verlate invoice.paid herstelt NOOIT rechten als de actuele Stripe-staat
  // niet betaald-actief is (review 31-07-2026, fail-closed).
  await scenario("22. verlate invoice.paid: paused/unknown/verdwenen sub herstelt geen rechten", async () => {
    const user = `${RUN}_late_invoice`;
    await ensureAccount(user, `${user}@test.sparki.local`, user, silentLogger);
    await db
      .update(userProfilesTable)
      .set({ entitlementMode: "subscription" })
      .where(eq(userProfilesTable.clerkId, user));
    const subId = `sub_${RUN}_late`;
    seedSub(subId, user, "GO", "month");
    await sendWebhook("customer.subscription.created", { id: subId });
    // Zet actuele Stripe-staat op paused; profiel wordt FREE.
    fake.subs.get(subId)!.status = "paused";
    await sendWebhook("customer.subscription.updated", { id: subId });
    let state = await getBillingState(user);
    assert(state.status === "paused", `voorbereiding faalde: ${state.status}`);
    // Verlate betaalde invoice komt binnen terwijl de sub nog paused is.
    fake.invoices.set(`in_${RUN}_late_paused`, {
      id: `in_${RUN}_late_paused`,
      subscriptionId: subId,
      customerId: `cus_${subId}`,
      created: new Date(),
      status: "paid",
      attemptCount: 1,
    });
    await sendWebhook("invoice.paid", { id: `in_${RUN}_late_paused` });
    state = await getBillingState(user);
    assert(state.status === "paused", `invoice.paid overschreef paused met ${state.status}`);
    let ent = await resolveEntitlements(user);
    assert(!ent.commercialFeatures["premium"], "verlate invoice gaf tóch betaalde rechten (paused)");
    // Onbekende actuele status ⇒ unknown, geen rechten.
    fake.subs.get(subId)!.status = "toekomstige_status_xyz";
    fake.invoices.set(`in_${RUN}_late_unknown`, {
      id: `in_${RUN}_late_unknown`,
      subscriptionId: subId,
      customerId: `cus_${subId}`,
      created: new Date(),
      status: "paid",
      attemptCount: 1,
    });
    await sendWebhook("invoice.paid", { id: `in_${RUN}_late_unknown` });
    // Rij fail-closed op "unknown"; de klantweergave valt terug op free/FREE.
    let [row] = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subId));
    assert(row?.status === "unknown", `onbekende staat werd rij-status ${row?.status}`);
    state = await getBillingState(user);
    assert(state.status === "free" && state.tier === "FREE", `onbekende staat gaf weergave ${state.status}/${state.tier}`);
    ent = await resolveEntitlements(user);
    assert(!ent.commercialFeatures["premium"], "verlate invoice gaf tóch rechten (unknown)");
    // Subscription niet meer vindbaar bij Stripe ⇒ genegeerd, niets hersteld.
    fake.subs.delete(subId);
    fake.invoices.set(`in_${RUN}_late_gone`, {
      id: `in_${RUN}_late_gone`,
      subscriptionId: subId,
      customerId: `cus_${subId}`,
      created: new Date(),
      status: "paid",
      attemptCount: 1,
    });
    const r = await sendWebhook("invoice.paid", { id: `in_${RUN}_late_gone` });
    assert(r.status === 200, `webhook gaf ${r.status}`);
    [row] = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subId));
    assert(row?.status === "unknown", `verdwenen sub veranderde rij-status naar ${row?.status}`);
    ent = await resolveEntitlements(user);
    assert(!ent.commercialFeatures["premium"], "verdwenen sub gaf tóch rechten");
  });

  await cleanup();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("testmatrix crashte:", err);
  await cleanup();
  process.exit(1);
});
