// Centrale commerciële entitlementlaag — GESCHEIDEN van operationele
// feature-flags (lib/flags.ts). Eén waarheid voor toegang:
//
//   effective_access = commercial_entitlement
//                      AND role_permission
//                      AND operational_feature_enabled
//                      AND no_active_kill_switch
//
// - legacy_unrestricted: gedrag exact zoals vóór entitlements — lege
//   entitlementtabellen veranderen niets, flags blijven operationeel bepalend.
// - subscription: fail-closed — ontbrekend/onbekend/vervallen recht = geen
//   commerciële toegang. Een gewone operationele flag creëert nooit een
//   commercieel recht. Een fout in deze laag zet nooit alles aan.

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  userEntitlementsTable,
  variantFeatureGrantsTable,
  tierFeatureGrantsTable,
  COMMERCIAL_TIERS,
  type CommercialTier,
  ENTITLEMENT_MODES,
  PRODUCT_VARIANTS,
  ENTITLEMENT_TYPES,
  type EntitlementMode,
  type ProductVariant,
  type UserEntitlement,
  type FeatureKey,
  type ReleaseGroup,
} from "@workspace/db";
import { resolveFlags, type ClientPlatform } from "./flags";
import { getClerkUserId } from "./auth";
import { isBillingFlagEnabledFor, tierFromTrialKey } from "./billing";
import { isKilled, type KillSwitchKey } from "./kill-switches";
import { logger } from "./logger";

export function isValidMode(v: unknown): v is EntitlementMode {
  return typeof v === "string" && (ENTITLEMENT_MODES as readonly string[]).includes(v);
}
export function isValidVariant(v: unknown): v is ProductVariant {
  return typeof v === "string" && (PRODUCT_VARIANTS as readonly string[]).includes(v);
}
export function isValidEntitlementType(v: unknown): boolean {
  return typeof v === "string" && (ENTITLEMENT_TYPES as readonly string[]).includes(v);
}

export interface ActiveEntitlement {
  id: number;
  entitlementKey: string;
  entitlementType: string;
  source: string;
  startsAt: Date;
  endsAt: Date | null;
}

export interface ResolvedEntitlements {
  entitlementMode: EntitlementMode;
  productVariant: ProductVariant | null;
  /** Actieve persoonlijke rechten (status active, binnen geldigheidsperiode). */
  activeEntitlements: ActiveEntitlement[];
  /** Rechten die door ends_at verlopen zijn (informatief, geen toegang). */
  expiredEntitlements: ActiveEntitlement[];
  /**
   * Effectieve commerciële feature-rechten per featureKey.
   * legacy_unrestricted ⇒ elke key geldt als commercieel toegestaan (gedrag
   * van vóór entitlements); commercialFeatures bevat dan alleen expliciete
   * persoonlijke rechten (informatief).
   */
  commercialFeatures: Record<
    string,
    { source: string; expiresAt: string | null }
  >;
  /** true wanneer de entitlementgegevens niet gelezen konden worden. */
  degraded: boolean;
}

function isEntitlementActive(e: UserEntitlement, now: Date): boolean {
  if (e.status !== "active") return false; // onbekende status ⇒ fail-closed
  if (e.startsAt && e.startsAt > now) return false;
  if (e.endsAt && e.endsAt <= now) return false;
  return true;
}

function isEntitlementExpired(e: UserEntitlement, now: Date): boolean {
  return e.status === "active" && !!e.endsAt && e.endsAt <= now;
}

function toActive(e: UserEntitlement): ActiveEntitlement {
  return {
    id: e.id,
    entitlementKey: e.entitlementKey,
    entitlementType: e.entitlementType,
    source: e.source,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
  };
}

/**
 * Centrale server-side resolver van commerciële rechten voor één gebruiker.
 * Leest modus + variant uit user_profiles en persoonlijke rechten uit
 * user_entitlements; variant-features komen uit variant_feature_grants.
 */
export async function resolveEntitlements(
  clerkId: string,
): Promise<ResolvedEntitlements> {
  const [profile] = await db
    .select({
      entitlementMode: userProfilesTable.entitlementMode,
      productVariant: userProfilesTable.productVariant,
      commercialTier: userProfilesTable.commercialTier,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  if (!profile) {
    // Onbekende gebruiker ⇒ fail-closed subscription zonder rechten.
    return {
      entitlementMode: "subscription",
      productVariant: null,
      activeEntitlements: [],
      expiredEntitlements: [],
      commercialFeatures: {},
      degraded: false,
    };
  }

  const mode: EntitlementMode = isValidMode(profile.entitlementMode)
    ? profile.entitlementMode
    : "subscription"; // onbekende modus ⇒ fail-closed
  const variant: ProductVariant | null = isValidVariant(profile.productVariant)
    ? profile.productVariant
    : null; // onbekende variant ⇒ geen variantrechten

  const now = new Date();
  let rows: UserEntitlement[] = [];
  let degraded = false;
  try {
    rows = await db
      .select()
      .from(userEntitlementsTable)
      .where(eq(userEntitlementsTable.clerkId, clerkId));
  } catch (err) {
    // Fout in de entitlementlaag mag nooit rechten verzinnen. Legacy blijft
    // werken (rechten daar niet nodig); subscription blijft fail-closed leeg.
    degraded = true;
    logger.error({ err, clerkId }, "entitlements read failed");
  }

  const active = rows.filter((e) => isEntitlementActive(e, now)).map(toActive);
  const expired = rows
    .filter((e) => isEntitlementExpired(e, now))
    .map(toActive);

  const commercialFeatures: ResolvedEntitlements["commercialFeatures"] = {};

  // Variant-features (alleen zinvol bij subscription met geldige variant).
  if (mode === "subscription" && variant) {
    try {
      const grants = await db
        .select()
        .from(variantFeatureGrantsTable)
        .where(
          and(
            eq(variantFeatureGrantsTable.productVariant, variant),
            eq(variantFeatureGrantsTable.enabled, true),
          ),
        );
      for (const g of grants) {
        commercialFeatures[g.featureKey] = {
          source: `variant:${variant}`,
          expiresAt: null,
        };
      }
    } catch (err) {
      degraded = true;
      logger.error({ err, clerkId }, "variant grants read failed");
    }
  }

  // ── Nieuw commercieel stelsel (fase ≥2, Stripe-testmodus) ──────────────
  // Middenterm uit het fase-1-ontwerp: commercial_tier → tier_feature_grants,
  // plus Sparki-beheerde trials (entitlement_key `tier:GO|COMPLETE`) die
  // exact dezelfde feature-set projecteren als de tier waarop de proef loopt.
  // Gates: alleen bij mode=subscription, alleen wanneer de operationele flag
  // `commercial_tiers` voor deze gebruiker aan staat (fail-closed helper),
  // en commercial_tier=NULL laat deze term volledig wegvallen — legacy en
  // bestaand subscription-gedrag blijven dan byte-identiek. Onbekende of
  // corrupte tierwaarde ⇒ als FREE-zonder-rechten behandeld, nooit betaald.
  if (mode === "subscription") {
    const validTier: CommercialTier | null =
      typeof profile.commercialTier === "string" &&
      (COMMERCIAL_TIERS as readonly string[]).includes(profile.commercialTier)
        ? (profile.commercialTier as CommercialTier)
        : null;
    const trialTiers = active
      .filter((e) => e.entitlementType === "trial")
      .map((e) => ({ tier: tierFromTrialKey(e.entitlementKey), entitlement: e }))
      .filter((t): t is { tier: "GO" | "COMPLETE"; entitlement: ActiveEntitlement } =>
        t.tier !== null,
      );
    const wantsTierExpansion =
      (validTier === "GO" || validTier === "COMPLETE" || trialTiers.length > 0) &&
      (profile.commercialTier != null || trialTiers.length > 0);
    if (wantsTierExpansion && (await isBillingFlagEnabledFor(clerkId, "commercial_tiers"))) {
      try {
        const tiersToExpand = new Set<string>();
        if (validTier === "GO" || validTier === "COMPLETE") tiersToExpand.add(validTier);
        for (const t of trialTiers) tiersToExpand.add(t.tier);
        for (const tier of tiersToExpand) {
          const grants = await db
            .select()
            .from(tierFeatureGrantsTable)
            .where(
              and(
                eq(tierFeatureGrantsTable.commercialTier, tier),
                eq(tierFeatureGrantsTable.enabled, true),
              ),
            );
          const trial = trialTiers.find((t) => t.tier === tier);
          const viaTrial = tier !== validTier && trial != null;
          for (const g of grants) {
            const existing = commercialFeatures[g.featureKey];
            const expiresAt =
              viaTrial && trial?.entitlement.endsAt
                ? trial.entitlement.endsAt.toISOString()
                : null;
            // Permanent (betaalde tier) recht wint van tijdelijk (trial).
            if (!existing || (existing.expiresAt && !expiresAt)) {
              commercialFeatures[g.featureKey] = {
                source: viaTrial ? `trial:tier:${tier}` : `tier:${tier}`,
                expiresAt,
              };
            }
          }
        }
      } catch (err) {
        degraded = true;
        logger.error({ err, clerkId }, "tier grants read failed");
      }
    }
  }

  // Persoonlijke feature-rechten: add-ons, proefrechten en tijdelijke
  // pakketten dragen een featureKey als entitlement_key. route_content is een
  // contentrecht (blijft in activeEntitlements, geen feature-key).
  for (const e of active) {
    if (
      e.entitlementType === "permanent_addon" ||
      e.entitlementType === "temporary_addon" ||
      e.entitlementType === "trial" ||
      e.entitlementType === "temporary_package"
    ) {
      const existing = commercialFeatures[e.entitlementKey];
      const expiresAt = e.endsAt ? e.endsAt.toISOString() : null;
      // Permanent recht wint van tijdelijk recht op dezelfde key.
      if (!existing || (existing.expiresAt && !expiresAt)) {
        commercialFeatures[e.entitlementKey] = {
          source: `entitlement:${e.entitlementType}:${e.source}`,
          expiresAt,
        };
      }
    }
  }

  return {
    entitlementMode: mode,
    productVariant: variant,
    activeEntitlements: active,
    expiredEntitlements: expired,
    commercialFeatures,
    degraded,
  };
}

// ── Commerciële onderdelen per variant ───────────────────────────────────────
// Productbesluit: Besluit René 31-07-2026 (SPARKI-BESLUIT-2026-001). De vier
// onderstaande onderdelen horen bij Sparki Compleet (DB-variant "sparki_pro").
// Sparki Go krijgt eigen sleutels; die verzameling is bewust nog leeg totdat
// René de grens gratis/Go bevestigt (Opdracht 2). Veiligheids-/gezondheids-
// kritieke informatie valt nooit onder een commerciële poort. De sleutels
// leven als commerciële feature-keys in variant_feature_grants; operationele
// flags blijven daarnaast met EN gelden.
export const COMPLEET_FEATURE_KEYS = [
  "autonomous_training", // Trainingsplan-engine — automatische plannen & aanpassingen
  "race_intel", // Race-intelligentie — wedstrijdvoorbereiding, voeding, dossier
  "ai_observations", // Coach-observaties & dagelijkse briefing
  "performance_lab", // Performance Lab — diepe analyse & trends
] as const;
export type CompleetFeatureKey = (typeof COMPLEET_FEATURE_KEYS)[number];

// Alle commerciële sleutels samen; groeit in Opdracht 2 met de Go-sleutels.
export type CommercialFeatureKey = CompleetFeatureKey;
// Bestaande signatuur van requireCommercialFeature blijft hierop steunen.
export type GoFeatureKey = CommercialFeatureKey;

// Go-sleutels: bewust leeg tot Besluit-Opdracht 2 (grens gratis/Go) door René
// is bevestigd. Compleet blijft altijd een superset van Go (zie hieronder).
export const GO_FEATURE_KEYS: readonly CommercialFeatureKey[] = [];

export const GO_FEATURE_LABELS: Record<CommercialFeatureKey, string> = {
  autonomous_training: "Trainingsplan-engine",
  race_intel: "Race-intelligentie",
  ai_observations: "Coach-observaties & dagelijkse briefing",
  performance_lab: "Performance Lab",
};

/**
 * Productlijn (bindend besluit): Gratis · Sparki Go · Sparki Compleet.
 * Expliciete toewijzing per variant (Besluit René 31-07-2026,
 * SPARKI-BESLUIT-2026-001): sparki_go krijgt de Go-sleutels; sparki_pro
 * (klantlabel: Sparki Compleet) krijgt de Go-sleutels PLUS de
 * Compleet-sleutels — Compleet is daarmee aantoonbaar een superset van Go en
 * een Compleet-gebruiker mag nooit naar Go worden verwezen voor een
 * Go-onderdeel. "sparki_basic" en "sparki_performance" zijn oude interne
 * testtiers (géén productaanbod) en blijven bewust zonder rechten
 * (fail-closed).
 */
export const VARIANT_FEATURE_KEYS: Record<
  "sparki_go" | "sparki_pro",
  readonly CommercialFeatureKey[]
> = {
  sparki_go: GO_FEATURE_KEYS,
  sparki_pro: [...GO_FEATURE_KEYS, ...COMPLEET_FEATURE_KEYS],
};

/**
 * Klantveilige weergave van een bron-string (bv. "variant:sparki_go").
 * Vervangt interne variantnamen door klantlabels; alleen presentatie.
 */
export function customerSourceLabel(source: string): string {
  return source
    .replace(/sparki_go/g, "Sparki Go")
    .replace(/sparki_pro/g, "Sparki Compleet")
    .replace(/sparki_(basic|performance)/g, "intern");
}

/**
 * Klantgericht productlabel. Interne variantnamen (sparki_pro, sparki_basic,
 * sparki_performance) mogen NOOIT in een klantantwoord verschijnen — alleen de
 * productlijn Gratis · Sparki Go · Sparki Compleet. Interne testtiers hebben
 * geen commerciële rechten en heten voor de klant dus eerlijk "Gratis".
 * Alleen presentatie: verandert niets aan de entitlementwerking.
 */
export function customerProductLabel(resolved: ResolvedEntitlements): string {
  switch (resolved.productVariant) {
    case "sparki_go":
      return "Sparki Go";
    case "sparki_pro":
      return "Sparki Compleet";
    default:
      return "Gratis";
  }
}

/**
 * Idempotente seed van de variantrechten volgens de expliciete toewijzing in
 * VARIANT_FEATURE_KEYS (Besluit René 31-07-2026, SPARKI-BESLUIT-2026-001):
 * sparki_go = Go-sleutels, sparki_pro (Sparki Compleet) = Go + Compleet.
 * Interne tiers bewust niets (afwezigheid = geen recht, fail-closed).
 * onConflictDoNothing — een latere beheerbeslissing (bijv. enabled=false
 * zetten) wordt nooit overschreven.
 *
 * Migratie in dezelfde functie (idempotent): de oude seed gaf sparki_go de
 * vier Compleet-sleutels; die rijen worden hier verwijderd zolang sparki_go
 * die sleutels niet in zijn eigen verzameling heeft. Het aantal verwijderde
 * rijen wordt gelogd (na de eerste run: 0).
 */
export async function ensureGoVariantGrantSeed(): Promise<void> {
  const values = (
    Object.entries(VARIANT_FEATURE_KEYS) as Array<
      [string, readonly CommercialFeatureKey[]]
    >
  ).flatMap(([productVariant, keys]) =>
    keys.map((featureKey) => ({ productVariant, featureKey })),
  );
  if (values.length > 0) {
    await db
      .insert(variantFeatureGrantsTable)
      .values(values)
      .onConflictDoNothing();
  }
  const staleGoKeys = COMPLEET_FEATURE_KEYS.filter(
    (k) => !VARIANT_FEATURE_KEYS.sparki_go.includes(k),
  );
  if (staleGoKeys.length > 0) {
    const removed = await db
      .delete(variantFeatureGrantsTable)
      .where(
        and(
          eq(variantFeatureGrantsTable.productVariant, "sparki_go"),
          inArray(variantFeatureGrantsTable.featureKey, staleGoKeys),
        ),
      )
      .returning({ featureKey: variantFeatureGrantsTable.featureKey });
    logger.info(
      { removed: removed.length, keys: removed.map((r) => r.featureKey) },
      "variant_feature_grants-migratie (Besluit 31-07-2026): oude sparki_go-rijen verwijderd",
    );
  }
}

/**
 * Heeft deze resolutie commercieel recht op dit onderdeel?
 * legacy_unrestricted ⇒ ja (bewuste carve-out, gedrag exact als vóór
 * entitlements); subscription ⇒ alleen bij een expliciet recht (fail-closed,
 * óók bij degraded reads).
 */
export function hasCommercialFeature(
  resolved: ResolvedEntitlements,
  featureKey: string,
): boolean {
  if (resolved.entitlementMode === "legacy_unrestricted") return true;
  return !!resolved.commercialFeatures[featureKey];
}

/**
 * Express-poort voor Go-only endpoints. Altijd NA requireAuth monteren.
 * Fail-closed: geen recht, onbekende gebruiker of een fout in deze laag ⇒ 403
 * met code "upgrade_required" (legacy-gebruikers hangen niet van deze tabellen
 * af en blijven bij een leesfout gewoon werken — zie resolveEntitlements).
 */
export function requireCommercialFeature(
  featureKey: GoFeatureKey,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clerkId = getClerkUserId(req);
      if (!clerkId) {
        res.status(401).json({ error: "Niet ingelogd" });
        return;
      }
      const resolved = await resolveEntitlements(clerkId);
      if (hasCommercialFeature(resolved, featureKey)) {
        next();
        return;
      }
      res.status(403).json({
        error: `${GO_FEATURE_LABELS[featureKey]} hoort bij Sparki Go.`,
        code: "upgrade_required",
        feature: featureKey,
      });
    } catch (err) {
      logger.error({ err, featureKey }, "commercial gate failed");
      res.status(403).json({
        error: "Commerciële toegang kon niet worden vastgesteld.",
        code: "upgrade_required",
        feature: featureKey,
      });
    }
  };
}

export interface FeatureAccessResult {
  allowed: boolean;
  commercial_entitled: boolean;
  operationally_enabled: boolean;
  role_allowed: boolean;
  blocked_by_kill_switch: boolean;
  source: string;
  reason: string;
  expires_at: string | null;
  variant: ProductVariant | null;
  entitlement_mode: EntitlementMode;
}

export interface FeatureAccessContext {
  clerkId: string;
  activeRole: string;
  isHeadTester?: boolean;
  releaseGroup?: ReleaseGroup;
  platform?: ClientPlatform;
  /** Bestaande rol-/privacyregels blijven daarnaast gelden; standaard true. */
  roleAllowed?: boolean;
  /** Kill-switchdomein waaronder deze feature valt (indien van toepassing). */
  killSwitchKey?: KillSwitchKey;
}

/**
 * Eén centrale toegangsevaluator — geen tweede waarheid hiernaast.
 * Combineert: commercieel recht, rolrecht, operationele flag, kill-switch.
 */
export async function resolveFeatureAccess(
  ctx: FeatureAccessContext,
  featureKey: FeatureKey,
): Promise<FeatureAccessResult> {
  const [entitlements, flags, killed] = await Promise.all([
    resolveEntitlements(ctx.clerkId),
    resolveFlags(ctx.clerkId, ctx.activeRole, {
      isHeadTester: ctx.isHeadTester,
      releaseGroup: ctx.releaseGroup,
      platform: ctx.platform,
    }),
    ctx.killSwitchKey ? isKilled(ctx.killSwitchKey) : Promise.resolve(false),
  ]);

  const roleAllowed = ctx.roleAllowed !== false;
  const operationallyEnabled = flags[featureKey] === true;

  let commercialEntitled = false;
  let source = "none";
  let expiresAt: string | null = null;
  if (entitlements.entitlementMode === "legacy_unrestricted") {
    // Bewuste uitzondering (productbesluit): legacy-gebruikers behouden hun
    // huidige toegang exact — óók bij een leesfout in de entitlementtabellen,
    // want hun toegang hangt daar per definitie niet van af. Een fout kan zo
    // nooit iets EXTRA ontgrendelen (flags blijven bepalend), alleen bestaande
    // toegang beschermen. Subscription blijft fail-closed: bij degraded zijn
    // er geen rechten en dus geen toegang.
    commercialEntitled = true;
    source = "legacy_unrestricted";
  } else {
    const grant = entitlements.commercialFeatures[featureKey];
    if (grant) {
      commercialEntitled = true;
      source = grant.source;
      expiresAt = grant.expiresAt;
    }
  }

  const allowed =
    commercialEntitled && roleAllowed && operationallyEnabled && !killed;

  let reason: string;
  if (killed) reason = "geblokkeerd door actieve kill-switch";
  else if (!commercialEntitled) reason = "geen commercieel recht";
  else if (!roleAllowed) reason = "rol geeft geen toegang";
  else if (!operationallyEnabled) reason = "operationele flag staat uit";
  else reason = "toegestaan";

  return {
    allowed,
    commercial_entitled: commercialEntitled,
    operationally_enabled: operationallyEnabled,
    role_allowed: roleAllowed,
    blocked_by_kill_switch: killed,
    source,
    reason,
    expires_at: expiresAt,
    variant: entitlements.productVariant,
    entitlement_mode: entitlements.entitlementMode,
  };
}
