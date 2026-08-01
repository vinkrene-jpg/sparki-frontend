// TEAM_ABONNEMENT_01 — geautomatiseerde testmatrix voor het Sparki
// Team-abonnement (€149/maand of €1.490/jaar, centrale facturatie).
//
// Volledig offline: fake StripeGateway + ECHTE signatuurverificatie
// (zelfde harnas als test:stripe-billing). Bewijst:
//  1. prijsstelling en tier TEAM in het billing-fundament;
//  2. eigenaar-only checkout met club-koppeling (server-side 403 voor rest);
//  3. webhook activeert het clubabonnement (pakket team, 50 leden);
//  4. fail-closed eigendomscheck in de webhook (metadata ≠ autorisatie);
//  5. niet-actuele betaling blokkeert nieuwe leden, data blijft staan;
//  6. configureerbare ledenlimiet wordt afgedwongen;
//  7. rollen soigneur/medic: toewijsbaar, géén beheer, géén sportdata.
//
// Run: `pnpm --filter @workspace/api-server run test:team-abonnement`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import Stripe from "stripe";
import { and, eq, inArray, like } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  billingSubscriptionsTable,
  billingTestAccountsTable,
  stripeWebhookEventsTable,
  clubsTable,
  clubMembersTable,
  clubSubscriptionsTable,
  notificationsTable,
  featureFlagsTable,
  userFlagOverridesTable,
} from "@workspace/db";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { ensureBillingFlagSeed } from "../lib/billing";
import {
  setStripeGatewayForTests,
  TIER_PRICING,
  parseClubIdMeta,
  type StripeGateway,
  type SubscriptionState,
} from "../lib/billing/stripe-gateway";
import {
  getClubContext,
  canManageClub,
  canViewConsentedData,
  checkCapacityByClubId,
} from "../lib/club-permissions";

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

// ── Fake gateway (checkout legt club-metadata vast zoals de echte) ───────────
class FakeGateway implements StripeGateway {
  subs = new Map<string, SubscriptionState>();
  lastCheckout: { tier: string; interval: string; clubId?: number } | null = null;
  isConfigured() {
    return true;
  }
  async createCheckoutSession(args: {
    clerkId: string;
    tier: "GO" | "COMPLETE" | "TEAM";
    interval: "month" | "year";
    clubId?: number;
  }) {
    this.lastCheckout = { tier: args.tier, interval: args.interval, clubId: args.clubId };
    return {
      id: `cs_${args.tier}_${args.interval}`,
      url: `https://checkout.stripe.test/${args.tier}/${args.interval}`,
    };
  }
  async createPortalSession() {
    return { url: "https://portal.stripe.test/session" };
  }
  async getSubscription(id: string) {
    return this.subs.get(id) ?? null;
  }
  async getInvoice() {
    return null;
  }
  async getCharge() {
    return null;
  }
  async changeSubscriptionTier() {
    /* niet nodig in deze matrix */
  }
}
const fake = new FakeGateway();
setStripeGatewayForTests(fake);

// ── Webhook-hulpen ───────────────────────────────────────────────────────────
const WEBHOOK_SECRET = "whsec_sparki_team_testmatrix";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
const signer = new Stripe("sk_test_signing_helper_only");
let eventSeq = 0;

async function sendWebhook(
  type: string,
  object: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const id = `evt_team_${RUN}_${++eventSeq}`;
  const payload = JSON.stringify({
    id,
    object: "event",
    type,
    created: Math.floor(Date.now() / 1000) + eventSeq,
    data: { object },
  });
  const signature = signer.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
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
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_team_${Date.now()}`;
const owner = `${RUN}_owner`; // clubeigenaar, allowlisted
const manager = `${RUN}_manager`; // teammanager — géén checkout-recht
const soigneur = `${RUN}_soigneur`;
const medic = `${RUN}_medic`; // rol: medical_staff (herstel rolmapping)
const rider1 = `${RUN}_rider1`;
const rider2 = `${RUN}_rider2`;
const stranger = `${RUN}_stranger`; // eigenaar van een ANDERE club
const ALL = [owner, manager, soigneur, medic, rider1, rider2, stranger];

let baseUrl = "";
let server: Server | null = null;
let clubId = 0;
let strangerClubId = 0;
let webhookFlagWasSeeded = false;
const SUB_ID = `sub_team_${Date.now()}`;

function seedTeamSub(overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  const state: SubscriptionState = {
    id: SUB_ID,
    customerId: `cus_${SUB_ID}`,
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    created: new Date(),
    priceId: "price_TEAM_month",
    tier: "TEAM",
    interval: "month",
    clerkId: owner,
    clubId,
    ...overrides,
  };
  fake.subs.set(state.id, state);
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
    .where(inArray(userProfilesTable.clerkId, ALL));
  await ensureBillingFlagSeed();
  await db
    .insert(billingTestAccountsTable)
    .values([{ clerkId: owner, reason: RUN }])
    .onConflictDoNothing();
  // Betaalflags voor de eigenaar aan, zodat scenario 9 de tier-guards zelf
  // raakt (en niet alleen de allowlist-poort).
  await db
    .insert(userFlagOverridesTable)
    .values(
      ["commercial_tiers", "stripe_checkout", "stripe_portal"].map((flagKey) => ({
        clerkId: owner,
        flagKey,
        enabled: true,
        setBy: "team-testmatrix",
      })),
    )
    .onConflictDoNothing();
  // Webhookflag is endpoint-breed (geen usercontext) ⇒ tijdelijk globaal aan;
  // cleanup zet hem alleen terug als wíj hem hebben aangezet.
  const flipped = await db
    .update(featureFlagsTable)
    .set({ enabledGlobally: true })
    .where(
      and(eq(featureFlagsTable.key, "stripe_webhooks"), eq(featureFlagsTable.enabledGlobally, false)),
    )
    .returning({ key: featureFlagsTable.key });
  webhookFlagWasSeeded = flipped.length > 0;

  // Club van de eigenaar (teamorganisatie) + club van de vreemde.
  const mk = await api(owner, "POST", "/api/clubs", { name: `Team ${RUN}` });
  assert(mk.status === 201, `club aanmaken faalde: ${mk.status}`);
  clubId = Number(mk.body.id);
  const mk2 = await api(stranger, "POST", "/api/clubs", { name: `Vreemd ${RUN}` });
  assert(mk2.status === 201, `vreemde club aanmaken faalde: ${mk2.status}`);
  strangerClubId = Number(mk2.body.id);

  // Leden erbij: teammanager, soigneur, medic, renner1.
  const joinCode = String(mk.body.joinCode);
  for (const [who, role] of [
    [manager, "teammanager"],
    [soigneur, "soigneur"],
    [medic, "medical_staff"],
    [rider1, "member"],
  ] as const) {
    const j = await api(who, "POST", "/api/clubs/join", { code: joinCode });
    assert(j.status === 200 || j.status === 201, `${who} join faalde: ${j.status}`);
    if (role !== "member") {
      const [m] = await db
        .select()
        .from(clubMembersTable)
        .where(eq(clubMembersTable.clerkId, who));
      const r = await api(owner, "PUT", `/api/clubs/${clubId}/members/${m!.id}/role`, {
        role,
      });
      assert(r.status === 200, `rol ${role} zetten faalde: ${r.status} ${JSON.stringify(r.body)}`);
    }
  }
}

async function cleanup() {
  try {
    if (webhookFlagWasSeeded) {
      await db
        .update(featureFlagsTable)
        .set({ enabledGlobally: false })
        .where(eq(featureFlagsTable.key, "stripe_webhooks"));
    }
    await db.delete(stripeWebhookEventsTable).where(like(stripeWebhookEventsTable.eventId, `evt_team_${RUN}_%`));
    await db.delete(billingSubscriptionsTable).where(inArray(billingSubscriptionsTable.clerkId, ALL));
    await db.delete(billingTestAccountsTable).where(inArray(billingTestAccountsTable.clerkId, ALL));
    await db.delete(notificationsTable).where(inArray(notificationsTable.clerkId, ALL));
    const ids = [clubId, strangerClubId].filter((n) => n > 0);
    if (ids.length) await db.delete(clubsTable).where(inArray(clubsTable.id, ids));
    await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
  } catch (err) {
    console.error("cleanup failed", err);
  }
  if (server) server.close();
}

async function main() {
  await setup();

  await scenario("1. Prijsstelling: TEAM €149/maand en €1.490/jaar", async () => {
    assert(TIER_PRICING.TEAM.month === 14900, `maandprijs ${TIER_PRICING.TEAM.month}`);
    assert(TIER_PRICING.TEAM.year === 149000, `jaarprijs ${TIER_PRICING.TEAM.year}`);
    assert(parseClubIdMeta("12") === 12, "club_id-metadata parse faalt");
    assert(parseClubIdMeta("12x") === null && parseClubIdMeta(undefined) === null, "ongeldige metadata moet null zijn");
  });

  await scenario("2. Alleen de eigenaar kan Team-checkout starten (server-side)", async () => {
    const r1 = await api(manager, "POST", `/api/clubs/${clubId}/team-subscription/checkout`, { interval: "month" });
    assert(r1.status === 403, `teammanager kreeg ${r1.status}, verwacht 403`);
    const r2 = await api(rider1, "POST", `/api/clubs/${clubId}/team-subscription/checkout`, { interval: "month" });
    assert(r2.status === 403, `renner kreeg ${r2.status}, verwacht 403`);
    const r3 = await api(owner, "POST", `/api/clubs/${clubId}/team-subscription/checkout`, { interval: "year" });
    assert(r3.status === 200, `eigenaar kreeg ${r3.status}: ${JSON.stringify(r3.body)}`);
    assert(typeof r3.body.url === "string", "geen checkout-url");
    assert(fake.lastCheckout?.tier === "TEAM" && fake.lastCheckout?.clubId === clubId, "checkout mist TEAM-tier of club-koppeling");
    const bad = await api(owner, "POST", `/api/clubs/${clubId}/team-subscription/checkout`, { interval: "week" });
    assert(bad.status === 400, `ongeldig interval kreeg ${bad.status}`);
  });

  await scenario("3. Webhook activeert clubabonnement: pakket team, 50 leden", async () => {
    seedTeamSub();
    const r = await sendWebhook("customer.subscription.updated", { id: SUB_ID, object: "subscription" });
    assert(r.status === 200, `webhook ${r.status}`);
    const [sub] = await db.select().from(clubSubscriptionsTable).where(eq(clubSubscriptionsTable.clubId, clubId));
    assert(sub?.packageKey === "team", `pakket is ${sub?.packageKey}`);
    assert(sub?.status === "active", `status is ${sub?.status}`);
    assert(sub?.maxMembers === 50, `maxMembers is ${sub?.maxMembers}`);
    assert(sub?.billingRef === SUB_ID, "billingRef mist subscription-koppeling");
    const [row] = await db.select().from(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.stripeSubscriptionId, SUB_ID));
    assert(row?.tier === "TEAM" && row.status === "active", "billing-rij niet actief TEAM");
    const st = await api(owner, "GET", `/api/clubs/${clubId}/team-subscription`);
    assert(st.status === 200 && st.body.isTeam === true, "statusendpoint toont geen actief team");
  });

  await scenario("4. Fail-closed: metadata met andermans club wordt genegeerd", async () => {
    const rogueId = `sub_rogue_${Date.now()}`;
    fake.subs.set(rogueId, { ...seedTeamSub(), id: rogueId, clubId: strangerClubId });
    const r = await sendWebhook("customer.subscription.updated", { id: rogueId, object: "subscription" });
    assert(r.status === 200, `webhook ${r.status}`);
    const [sub] = await db.select().from(clubSubscriptionsTable).where(eq(clubSubscriptionsTable.clubId, strangerClubId));
    assert(sub?.packageKey !== "team", `vreemde club kreeg pakket ${sub?.packageKey} — eigendomscheck lek`);
  });

  await scenario("5. Niet-actuele betaling blokkeert nieuwe leden; data blijft", async () => {
    seedTeamSub({ status: "paused" });
    const r = await sendWebhook("customer.subscription.updated", { id: SUB_ID, object: "subscription" });
    assert(r.status === 200, `webhook ${r.status}`);
    const [sub] = await db.select().from(clubSubscriptionsTable).where(eq(clubSubscriptionsTable.clubId, clubId));
    assert(sub?.status === "blocked", `status is ${sub?.status}, verwacht blocked`);
    const cap = await checkCapacityByClubId(clubId, "member");
    assert(cap.ok === false, "capaciteitscheck laat nieuwe leden toe bij geblokkeerd abonnement");
    const members = await db.select().from(clubMembersTable).where(eq(clubMembersTable.clubId, clubId));
    assert(members.length >= 5, "bestaande leden verdwenen — dat mag nooit");
    // Herstel: actief event zet de club weer open, limieten blijven staan.
    seedTeamSub({ status: "active" });
    await sendWebhook("customer.subscription.updated", { id: SUB_ID, object: "subscription" });
    const [sub2] = await db.select().from(clubSubscriptionsTable).where(eq(clubSubscriptionsTable.clubId, clubId));
    assert(sub2?.status === "active" && sub2.maxMembers === 50, "herstel naar actief faalde");
  });

  await scenario("6. Ledenlimiet is configureerbaar en wordt afgedwongen", async () => {
    // Configureer een krappe limiet (5 = huidig ledental) — webhook mag die
    // bij een team-pakket niet terugzetten naar 50.
    await db.update(clubSubscriptionsTable).set({ maxMembers: 5 }).where(eq(clubSubscriptionsTable.clubId, clubId));
    await sendWebhook("customer.subscription.updated", { id: SUB_ID, object: "subscription" });
    const [sub] = await db.select().from(clubSubscriptionsTable).where(eq(clubSubscriptionsTable.clubId, clubId));
    assert(sub?.maxMembers === 5, `geconfigureerde limiet overschreven naar ${sub?.maxMembers}`);
    const cap = await checkCapacityByClubId(clubId, "member");
    assert(cap.ok === false, "limiet vol maar capaciteitscheck laat nog toe");
    const mk = await api(owner, "GET", `/api/clubs/${clubId}`);
    const code = String((mk.body as { joinCode?: unknown }).joinCode ?? "");
    const j = await api(rider2, "POST", "/api/clubs/join", { code });
    assert(j.status !== 200 && j.status !== 201, `zesde lid kwam binnen (${j.status}) boven de limiet`);
    await db.update(clubSubscriptionsTable).set({ maxMembers: 50 }).where(eq(clubSubscriptionsTable.clubId, clubId));
  });

  await scenario("7. Soigneur en medische staf: toegewezen, géén beheer, géén sportdata", async () => {
    for (const who of [soigneur, medic]) {
      const ctx = await getClubContext(clubId, who);
      assert(ctx, `${who} heeft geen clubcontext`);
      assert(!canManageClub(ctx!), `${who} heeft beheerrechten — least privilege geschonden`);
      assert(!canViewConsentedData(ctx!), `${who} zou consent-sportdata kunnen zien`);
      const r = await api(who, "PUT", `/api/clubs/${clubId}`, { name: "Gekaapt" });
      assert(r.status === 403, `${who} kon de club bewerken (${r.status})`);
      const chk = await api(who, "POST", `/api/clubs/${clubId}/team-subscription/checkout`, { interval: "month" });
      assert(chk.status === 403, `${who} kon checkout starten (${chk.status})`);
    }
  });

  await scenario("8. Exclusiviteit: tweede/verlate subscription kaapt de club niet", async () => {
    const otherId = `sub_second_${Date.now()}`;
    fake.subs.set(otherId, { ...seedTeamSub(), id: otherId });
    const r = await sendWebhook("customer.subscription.updated", { id: otherId, object: "subscription" });
    assert(r.status === 200, `webhook ${r.status}`);
    const [sub] = await db.select().from(clubSubscriptionsTable).where(eq(clubSubscriptionsTable.clubId, clubId));
    assert(sub?.billingRef === SUB_ID, `billingRef gekaapt naar ${sub?.billingRef}`);
    const chk = await api(owner, "POST", `/api/clubs/${clubId}/team-subscription/checkout`, { interval: "month" });
    assert(chk.status === 409, `tweede checkout kreeg ${chk.status}, verwacht 409`);
  });

  await scenario("9. Persoonlijke paden geblokkeerd: trial/checkout/change nooit TEAM", async () => {
    for (const path of ["/api/billing/trial", "/api/billing/checkout", "/api/billing/change"]) {
      const r = await api(owner, "POST", path, { tier: "TEAM", interval: "month" });
      // 400 = tier geweigerd; 403 = betaalpad niet opengesteld; 409 = TEAM-bron
      // beschermd — in álle gevallen komt er geen persoonlijke TEAM-flow door.
      assert([400, 403, 409].includes(r.status), `${path} met TEAM kreeg ${r.status}`);
    }
    const ch = await api(owner, "POST", "/api/billing/change", { tier: "GO", interval: "month" });
    assert(ch.status === 409, `TEAM-sub wegwijzigen naar GO kreeg ${ch.status}, verwacht 409`);
  });

  await scenario("10. Opzegging (deleted) sluit ook de club", async () => {
    const r = await sendWebhook("customer.subscription.deleted", { id: SUB_ID, object: "subscription" });
    assert(r.status === 200, `webhook ${r.status}`);
    const [sub] = await db.select().from(clubSubscriptionsTable).where(eq(clubSubscriptionsTable.clubId, clubId));
    assert(sub?.status === "ended", `clubstatus is ${sub?.status}, verwacht ended`);
    const cap = await checkCapacityByClubId(clubId, "member");
    assert(cap.ok === false, "beëindigd team laat nog nieuwe leden toe");
    const members = await db.select().from(clubMembersTable).where(eq(clubMembersTable.clubId, clubId));
    assert(members.length >= 5, "leden verdwenen bij opzegging — mag nooit");
  });

  await cleanup();
  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed++;
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await cleanup();
  process.exit(1);
});
