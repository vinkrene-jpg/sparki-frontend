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
  featureFlagsTable,
  userFlagOverridesTable,
  COMMERCIAL_TIERS,
  BILLING_INTERVALS,
  type BillingSubscription,
  type CommercialTier,
  type BillingInterval,
} from "@workspace/db";
import { TIER_PRICING } from "./stripe-gateway";
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
  | "blocked";

export function isValidTier(v: unknown): v is CommercialTier {
  return typeof v === "string" && (COMMERCIAL_TIERS as readonly string[]).includes(v);
}
export function isPaidTier(v: unknown): v is Exclude<CommercialTier, "FREE"> {
  return v === "GO" || v === "COMPLETE";
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
      default:
        // Onbekende status ⇒ fail-closed (nooit betaald).
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
    .returning({ clerkId: billingSubscriptionsTable.clerkId });
  const canceledRows = await db
    .update(billingSubscriptionsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(billingSubscriptionsTable.status, "canceled"),
        lt(billingSubscriptionsTable.currentPeriodEnd, now),
      ),
    )
    .returning({ clerkId: billingSubscriptionsTable.clerkId });
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
  }
  return { expiredGrace: graceRows.length, expiredCanceled: canceledRows.length };
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
