// ── Billing-kernlaag (fase 2, Stripe-TESTMODUS) ──────────────────────────────
// Ontwerp: docs/SPARKI_STRIPE_SUBSCRIPTIONS_PHASE1_ARCHITECTURE.md.
// Abonnementstaat (billing_subscriptions) is gescheiden van rechten; rechten
// lopen uitsluitend via de bestaande entitlement-resolver. clerk_id komt
// altijd server-side uit de geauthenticeerde sessie — nooit uit client-input.

import { eq, and, lt, inArray } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  userEntitlementsTable,
  billingSubscriptionsTable,
  billingTestAccountsTable,
  clubSubscriptionsTable,
  featureFlagsTable,
  userFlagOverridesTable,
  subscriptionChoiceIntentsTable,
  COMMERCIAL_TIERS,
  BILLING_INTERVALS,
  type BillingSubscription,
  type CommercialTier,
  type BillingInterval,
} from "@workspace/db";
import { TIER_PRICING } from "./stripe-gateway";
import { createNotification } from "../notifications";
import { logger } from "../logger";

export const GRACE_DAYS = 7;

export type BillingLifecycleStatus =
  | "legacy_unrestricted"
  | "free"
  | "trialing"
  | "active"
  | "grace"
  | "canceled"
  | "expired"
  | "blocked"
  // ABONNEMENT_01: eerste betaling niet afgerond (geen rechten).
  | "incomplete"
  // ABONNEMENT_01: gepauzeerd bij Stripe (rechten bevroren, data behouden).
  | "paused";

export function isValidTier(v: unknown): v is CommercialTier {
  return typeof v === "string" && (COMMERCIAL_TIERS as readonly string[]).includes(v);
}
export function isPaidTier(v: unknown): v is Exclude<CommercialTier, "FREE"> {
  return v === "GO" || v === "COMPLETE" || v === "TEAM";
}
export function isValidInterval(v: unknown): v is BillingInterval {
  return typeof v === "string" && (BILLING_INTERVALS as readonly string[]).includes(v);
}

/** Trial-entitlementkey: `tier:GO` | `tier:COMPLETE`. */
export function trialKeyForTier(tier: Exclude<CommercialTier, "FREE">): string {
  return `tier:${tier}`;
}
export function tierFromTrialKey(key: string): Exclude<CommercialTier, "FREE"> | null {
  const m = /^tier:(GO|COMPLETE)$/.exec(key);
  return m ? (m[1] as "GO" | "COMPLETE") : null;
}

/**
 * Extra commerciële grendel (AND): alléén accounts op de expliciete
 * allowlist zien in testmodus checkout/portal/trial — ook als flags aan
 * staan. Fout ⇒ fail-closed false.
 */
export async function isBillingTestAccount(clerkId: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ clerkId: billingTestAccountsTable.clerkId })
      .from(billingTestAccountsTable)
      .where(eq(billingTestAccountsTable.clerkId, clerkId));
    return !!row;
  } catch (err) {
    logger.error({ err, clerkId }, "billing allowlist read failed");
    return false;
  }
}

/**
 * Lichtgewicht flag-gate voor de resolver (die geen rolcontext heeft):
 * per-gebruiker override wint, anders de globale flag-rij. Rollen/groepen/
 * percentages tellen hier bewust NIET mee — dit pad is strikter dan
 * resolveFlags, nooit ruimer. Fout ⇒ fail-closed false.
 */
export async function isBillingFlagEnabledFor(
  clerkId: string | null,
  key: "commercial_tiers" | "stripe_checkout" | "stripe_webhooks" | "stripe_portal",
): Promise<boolean> {
  try {
    if (clerkId) {
      const [override] = await db
        .select({ enabled: userFlagOverridesTable.enabled })
        .from(userFlagOverridesTable)
        .where(
          and(
            eq(userFlagOverridesTable.clerkId, clerkId),
            eq(userFlagOverridesTable.flagKey, key),
          ),
        );
      if (override) return override.enabled;
    }
    const [flag] = await db
      .select({ enabledGlobally: featureFlagsTable.enabledGlobally })
      .from(featureFlagsTable)
      .where(eq(featureFlagsTable.key, key));
    return flag?.enabledGlobally === true;
  } catch (err) {
    logger.error({ err, key }, "billing flag read failed");
    return false;
  }
}

export interface BillingStateView {
  status: BillingLifecycleStatus;
  tier: CommercialTier | null;
  interval: BillingInterval | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
  plannedDowngradeTier: CommercialTier | null;
  hasStripeSubscription: boolean;
}

interface TrialRow {
  entitlementKey: string;
  entitlementType: string;
  status: string;
  startsAt: Date;
  endsAt: Date | null;
}

/**
 * Pure afleiding van de lifecyclestatus (contracttabel uit het ontwerp).
 * Onbekend/corrupt ⇒ fail-closed als `free`, nooit als betaald.
 */
export function deriveBillingState(args: {
  entitlementMode: string;
  commercialTier: string | null;
  subscription: BillingSubscription | null;
  trialRows: TrialRow[];
  now?: Date;
}): BillingStateView {
  const now = args.now ?? new Date();
  const sub = args.subscription;
  const profileTier: CommercialTier | null = isValidTier(args.commercialTier)
    ? args.commercialTier
    : null;

  const base: BillingStateView = {
    status: "free",
    tier: profileTier ?? (args.commercialTier != null ? "FREE" : null),
    interval: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    graceUntil: null,
    plannedDowngradeTier: null,
    hasStripeSubscription: !!sub,
  };

  if (args.entitlementMode === "legacy_unrestricted") {
    return { ...base, status: "legacy_unrestricted", tier: profileTier };
  }

  // Sparki-beheerde proef (zonder Stripe-object).
  const trials = args.trialRows
    .filter((t) => t.entitlementType === "trial" && tierFromTrialKey(t.entitlementKey))
    .sort((a, b) => (b.endsAt?.getTime() ?? 0) - (a.endsAt?.getTime() ?? 0));
  const activeTrial = trials.find(
    (t) =>
      t.status === "active" &&
      (!t.startsAt || t.startsAt <= now) &&
      t.endsAt != null &&
      t.endsAt > now,
  );

  if (sub) {
    const interval = isValidInterval(sub.interval) ? sub.interval : null;
    const tier = isValidTier(sub.tier) ? sub.tier : null;
    const view: BillingStateView = {
      ...base,
      tier: tier ?? base.tier,
      interval,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      graceUntil: sub.graceUntil?.toISOString() ?? null,
      plannedDowngradeTier: isValidTier(sub.plannedDowngradeTier)
        ? sub.plannedDowngradeTier
        : null,
    };
    switch (sub.status) {
      case "blocked":
        return { ...view, status: "blocked" };
      case "grace":
        if (sub.graceUntil && sub.graceUntil > now) return { ...view, status: "grace" };
        return { ...view, status: "expired", tier: "FREE" };
      case "active":
        return { ...view, status: "active" };
      case "canceled":
        if (sub.currentPeriodEnd && sub.currentPeriodEnd > now)
          return { ...view, status: "canceled" };
        return { ...view, status: "expired", tier: "FREE" };
      case "expired":
        return { ...view, status: "expired", tier: "FREE" };
      case "incomplete":
        // Betaling nog niet rond ⇒ geen rechten, wel eerlijke status.
        return { ...view, status: "incomplete", tier: "FREE" };
      case "paused":
        // Bevroren: geen betaalde rechten, gegevens behouden; de tier blijft
        // zichtbaar zodat de UI eerlijk kan zeggen wát er gepauzeerd is.
        return { ...view, status: "paused" };
      default:
        // Onbekende status (incl. expliciet "unknown") ⇒ fail-closed.
        return { ...view, status: "free", tier: "FREE" };
    }
  }

  if (activeTrial) {
    return {
      ...base,
      status: "trialing",
      tier: tierFromTrialKey(activeTrial.entitlementKey),
      trialEndsAt: activeTrial.endsAt!.toISOString(),
    };
  }
  if (trials.length > 0) {
    // Proef gehad, verlopen of ingetrokken ⇒ terugval FREE.
    return { ...base, status: "expired", tier: "FREE" };
  }
  return base;
}

/** Volledige status voor de ingelogde gebruiker (server is bron van waarheid). */
export async function getBillingState(clerkId: string): Promise<BillingStateView> {
  const [profile] = await db
    .select({
      entitlementMode: userProfilesTable.entitlementMode,
      commercialTier: userProfilesTable.commercialTier,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  if (!profile) {
    return deriveBillingState({
      entitlementMode: "subscription",
      commercialTier: null,
      subscription: null,
      trialRows: [],
    });
  }
  const subs = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.clerkId, clerkId));
  // Meerdere rijen (her-abonneren): neem de meest recent bijgewerkte.
  const sub =
    subs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
  const trialRows = await db
    .select({
      entitlementKey: userEntitlementsTable.entitlementKey,
      entitlementType: userEntitlementsTable.entitlementType,
      status: userEntitlementsTable.status,
      startsAt: userEntitlementsTable.startsAt,
      endsAt: userEntitlementsTable.endsAt,
    })
    .from(userEntitlementsTable)
    .where(
      and(
        eq(userEntitlementsTable.clerkId, clerkId),
        eq(userEntitlementsTable.entitlementType, "trial"),
      ),
    );
  return deriveBillingState({
    entitlementMode: profile.entitlementMode,
    commercialTier: profile.commercialTier,
    subscription: sub,
    trialRows,
  });
}

/**
 * Start de Sparki-beheerde proef (zonder betaalkaart, zonder Stripe-object).
 * Eén proef per tier per gebruiker, ooit — idempotent en fail-closed.
 */
export async function startTrial(
  clerkId: string,
  tier: Exclude<CommercialTier, "FREE">,
): Promise<
  | { ok: true; endsAt: string }
  | { ok: false; reason: "al_gehad" | "al_betaald" | "legacy" }
> {
  const [profile] = await db
    .select({ entitlementMode: userProfilesTable.entitlementMode })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  if (!profile || profile.entitlementMode === "legacy_unrestricted") {
    // Legacy heeft al volledige toegang; een proef zou alleen verwarren.
    return { ok: false, reason: "legacy" };
  }
  const key = trialKeyForTier(tier);
  const existing = await db
    .select({ id: userEntitlementsTable.id })
    .from(userEntitlementsTable)
    .where(
      and(
        eq(userEntitlementsTable.clerkId, clerkId),
        eq(userEntitlementsTable.entitlementKey, key),
        eq(userEntitlementsTable.entitlementType, "trial"),
      ),
    );
  if (existing.length > 0) return { ok: false, reason: "al_gehad" };
  const [sub] = await db
    .select({ status: billingSubscriptionsTable.status })
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.clerkId, clerkId));
  if (sub && (sub.status === "active" || sub.status === "grace")) {
    return { ok: false, reason: "al_betaald" };
  }
  const endsAt = new Date(
    Date.now() + TIER_PRICING[tier].trialDays * 24 * 60 * 60 * 1000,
  );
  await db.insert(userEntitlementsTable).values({
    clerkId,
    entitlementKey: key,
    entitlementType: "trial",
    status: "active",
    source: "sparki_trial",
    endsAt,
    createdBy: "billing:trial",
    metadata: { tier, trialDays: TIER_PRICING[tier].trialDays, phase: "test" },
  });
  return { ok: true, endsAt: endsAt.toISOString() };
}

/**
 * Dagelijkse vervaljob (geen webhook-afhankelijkheid): grace verlopen of
 * canceled-periode om ⇒ status expired + profieltier terug naar FREE.
 * Idempotent; raakt uitsluitend rijen in het nieuwe stelsel.
 */
export async function expireBillingStates(now = new Date()): Promise<{
  expiredGrace: number;
  expiredCanceled: number;
}> {
  const graceRows = await db
    .update(billingSubscriptionsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(billingSubscriptionsTable.status, "grace"),
        lt(billingSubscriptionsTable.graceUntil, now),
      ),
    )
    .returning({
      clerkId: billingSubscriptionsTable.clerkId,
      stripeSubscriptionId: billingSubscriptionsTable.stripeSubscriptionId,
      tier: billingSubscriptionsTable.tier,
    });
  const canceledRows = await db
    .update(billingSubscriptionsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(billingSubscriptionsTable.status, "canceled"),
        lt(billingSubscriptionsTable.currentPeriodEnd, now),
      ),
    )
    .returning({
      clerkId: billingSubscriptionsTable.clerkId,
      stripeSubscriptionId: billingSubscriptionsTable.stripeSubscriptionId,
      tier: billingSubscriptionsTable.tier,
    });
  // TEAM: verlopen facturatie moet óók de gekoppelde club sluiten, anders
  // blijft een opgezegd team stilzwijgend leden toelaten.
  const teamRefs = [...graceRows, ...canceledRows]
    .filter((r) => r.tier === "TEAM" && r.stripeSubscriptionId)
    .map((r) => r.stripeSubscriptionId);
  if (teamRefs.length > 0) {
    await db
      .update(clubSubscriptionsTable)
      .set({ status: "ended", updatedAt: now })
      .where(
        and(
          inArray(clubSubscriptionsTable.billingRef, teamRefs),
          eq(clubSubscriptionsTable.packageKey, "team"),
        ),
      );
  }
  const affected = [
    ...new Set([...graceRows, ...canceledRows].map((r) => r.clerkId)),
  ];
  if (affected.length > 0) {
    // Terugval FREE — nooit legacy-profielen aanraken (die staan hier per
    // definitie niet in, maar de guard is expliciet).
    await db
      .update(userProfilesTable)
      .set({ commercialTier: "FREE", updatedAt: now })
      .where(
        and(
          inArray(userProfilesTable.clerkId, affected),
          eq(userProfilesTable.entitlementMode, "subscription"),
        ),
      );
    logger.info(
      { affected: affected.length },
      "billing: verlopen abonnementen teruggezet naar FREE",
    );
    // Eerlijke melding per overgang (ABONNEMENT_01 §1.8): best-effort ná de
    // updates; dedupeKey maakt de dagelijkse sweep meldings-idempotent.
    for (const row of [...graceRows, ...canceledRows]) {
      await createNotification({
        clerkId: row.clerkId,
        type: "system",
        title: "Je abonnement is gestopt",
        body:
          "Je account staat nu op Gratis. Al je gegevens, ritten en routes zijn er nog gewoon. Opnieuw abonneren kan altijd via Abonnement.",
        source: "billing",
        dedupeKey: `billing:${row.stripeSubscriptionId}:expired`,
      }).catch((err) =>
        logger.error({ err, clerkId: row.clerkId }, "billing: expiry-melding mislukt"),
      );
    }
  }
  return { expiredGrace: graceRows.length, expiredCanceled: canceledRows.length };
}

/**
 * ABONNEMENT_01 §1.7 — proefperiode-einde: bij afloop vervalt de begeleiding,
 * NIET de data (er wordt hier nooit iets verwijderd — de trial-entitlement
 * verloopt vanzelf op endsAt). Deze sweep stuurt alleen twee rustige
 * meldingen: één vóór afloop en één ná afloop. Idempotent via dedupeKey.
 */
export async function sweepTrialNotices(now = new Date()): Promise<{
  endingSoon: number;
  ended: number;
}> {
  const soonWindow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const recentPast = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const trials = await db
    .select({
      id: userEntitlementsTable.id,
      clerkId: userEntitlementsTable.clerkId,
      entitlementKey: userEntitlementsTable.entitlementKey,
      status: userEntitlementsTable.status,
      endsAt: userEntitlementsTable.endsAt,
    })
    .from(userEntitlementsTable)
    .where(
      and(
        eq(userEntitlementsTable.entitlementType, "trial"),
        eq(userEntitlementsTable.status, "active"),
        lt(userEntitlementsTable.endsAt, soonWindow),
      ),
    );
  let endingSoon = 0;
  let ended = 0;
  for (const t of trials) {
    const tier = tierFromTrialKey(t.entitlementKey);
    if (!tier || !t.endsAt) continue;
    const tierNaam = tier === "COMPLETE" ? "Compleet" : "Go";
    if (t.endsAt > now) {
      const dagen = Math.max(1, Math.ceil((t.endsAt.getTime() - now.getTime()) / (24 * 3600 * 1000)));
      const created = await createNotification({
        clerkId: t.clerkId,
        type: "system",
        title: `Je ${tierNaam}-proefperiode loopt binnenkort af`,
        body:
          `Over ${dagen === 1 ? "1 dag" : `${dagen} dagen`} eindigt je proefperiode van Sparki ${tierNaam}. ` +
          "Daarna gaat je account gewoon verder als Gratis — al je gegevens, ritten en routes blijven bewaard. Wil je doorgaan met " +
          `${tierNaam}, dan kan dat via Abonnement.`,
        source: "billing",
        dedupeKey: `billing:trial:${t.id}:ending`,
      });
      if (created) endingSoon++;
    } else if (t.endsAt > recentPast) {
      const created = await createNotification({
        clerkId: t.clerkId,
        type: "system",
        title: `Je ${tierNaam}-proefperiode is afgelopen`,
        body:
          "Je account gaat verder als Gratis. Alles wat je zelf hebt ingevoerd of gesynchroniseerd is er nog gewoon — er is niets verdwenen. " +
          `Opnieuw kiezen voor ${tierNaam} kan altijd via Abonnement.`,
        source: "billing",
        dedupeKey: `billing:trial:${t.id}:ended`,
      });
      if (created) ended++;
    }
  }
  return { endingSoon, ended };
}

/**
 * Boot-seed: de vier betaalflags bestaan als rijen, default UIT. Een latere
 * beheerbeslissing wordt nooit overschreven (onConflictDoNothing).
 */
export async function ensureBillingFlagSeed(): Promise<void> {
  const flags: { key: string; description: string }[] = [
    {
      key: "commercial_tiers",
      description:
        "Commercieel tier-stelsel (FREE/GO/COMPLETE) — resolver kijkt naar commercial_tier + tier_feature_grants. Default uit.",
    },
    {
      key: "stripe_checkout",
      description: "Stripe Checkout (TESTMODUS) — alleen allowlist-accounts. Default uit.",
    },
    {
      key: "stripe_webhooks",
      description: "Stripe-webhookendpoint (TESTMODUS). Default uit.",
    },
    {
      key: "stripe_portal",
      description: "Stripe Customer Portal (TESTMODUS) — alleen allowlist-accounts. Default uit.",
    },
  ];
  await db
    .insert(featureFlagsTable)
    .values(flags.map((f) => ({ ...f, enabledGlobally: false })))
    .onConflictDoNothing({ target: featureFlagsTable.key });
}

// ── Keuze zonder betaalstap (productie-bevinding punt 4) ─────────────────────
// Legt uitsluitend de KEUZE van de gebruiker vast (welke laag wil ik) zolang de
// echte betaling nog niet beschikbaar is. Kent NOOIT zelf rechten toe: de
// entitlement-resolver blijft de enige bron van toegang. Eén open keuze per
// gebruiker; een nieuwe keuze vervangt de vorige.
export interface SubscriptionChoiceView {
  desiredTier: Exclude<CommercialTier, "FREE" | "TEAM" | "TRAINER"> | null;
  interval: BillingInterval;
  status: string;
  updatedAt: string;
}

export async function recordSubscriptionChoice(
  clerkId: string,
  tier: "GO" | "COMPLETE",
  interval: BillingInterval,
): Promise<SubscriptionChoiceView> {
  const now = new Date();
  await db
    .insert(subscriptionChoiceIntentsTable)
    .values({
      clerkId,
      desiredTier: tier,
      interval,
      status: "in_afwachting",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: subscriptionChoiceIntentsTable.clerkId,
      set: {
        desiredTier: tier,
        interval,
        status: "in_afwachting",
        updatedAt: now,
      },
    });
  logger.info({ clerkId, tier, interval }, "subscription choice recorded (no payment step)");
  return { desiredTier: tier, interval, status: "in_afwachting", updatedAt: now.toISOString() };
}

export async function getSubscriptionChoice(
  clerkId: string,
): Promise<SubscriptionChoiceView | null> {
  const [row] = await db
    .select()
    .from(subscriptionChoiceIntentsTable)
    .where(eq(subscriptionChoiceIntentsTable.clerkId, clerkId));
  if (!row || row.status !== "in_afwachting") return null;
  const tier =
    row.desiredTier === "GO" || row.desiredTier === "COMPLETE"
      ? row.desiredTier
      : null;
  if (!tier) return null;
  return {
    desiredTier: tier,
    interval: isValidInterval(row.interval) ? row.interval : "month",
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Directe downgrade naar Gratis — rechten OMLAAG vereist geen betaling.
 * Owner-scoped (clerkId komt server-side uit de sessie). Zet het profiel terug
 * naar de gratis laag en trekt lopende betaalde rechten in:
 *   • commercial_tier → FREE, product_variant → NULL;
 *   • actieve trial-entitlements → revoked (proefrechten vervallen direct);
 *   • een openstaande keuze-intentie → geannuleerd.
 * legacy_unrestricted wordt NOOIT aangeraakt (die carve-out heeft geen betaalde
 * laag om te verlaten). Een lopend Stripe-abonnement wordt NIET stilzwijgend
 * opgezegd — dat loopt via de portal/webhook; we melden dat eerlijk terug.
 */
export async function downgradeToFree(clerkId: string): Promise<
  | { ok: true; revokedTrials: number }
  | { ok: false; reason: "legacy" | "actief_abonnement" }
> {
  const [profile] = await db
    .select({ entitlementMode: userProfilesTable.entitlementMode })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  if (!profile || profile.entitlementMode === "legacy_unrestricted") {
    return { ok: false, reason: "legacy" };
  }
  const [sub] = await db
    .select({ status: billingSubscriptionsTable.status })
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.clerkId, clerkId))
    .orderBy(billingSubscriptionsTable.updatedAt);
  if (sub && (sub.status === "active" || sub.status === "grace")) {
    // Een echt betaald abonnement zeg je op via de betaalprovider (portal),
    // nooit door hier de rechten weg te halen terwijl de facturatie doorloopt.
    return { ok: false, reason: "actief_abonnement" };
  }
  const now = new Date();
  await db
    .update(userProfilesTable)
    .set({ commercialTier: "FREE", productVariant: null, updatedAt: now })
    .where(
      and(
        eq(userProfilesTable.clerkId, clerkId),
        eq(userProfilesTable.entitlementMode, "subscription"),
      ),
    );
  const revoked = await db
    .update(userEntitlementsTable)
    .set({ status: "revoked", updatedAt: now })
    .where(
      and(
        eq(userEntitlementsTable.clerkId, clerkId),
        eq(userEntitlementsTable.entitlementType, "trial"),
        eq(userEntitlementsTable.status, "active"),
      ),
    )
    .returning({ id: userEntitlementsTable.id });
  await db
    .update(subscriptionChoiceIntentsTable)
    .set({ status: "geannuleerd", updatedAt: now })
    .where(
      and(
        eq(subscriptionChoiceIntentsTable.clerkId, clerkId),
        eq(subscriptionChoiceIntentsTable.status, "in_afwachting"),
      ),
    );
  logger.info(
    { clerkId, revokedTrials: revoked.length },
    "downgrade to free applied (rights lowered, no payment needed)",
  );
  return { ok: true, revokedTrials: revoked.length };
}
