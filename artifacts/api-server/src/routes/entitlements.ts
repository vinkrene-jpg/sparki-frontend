// GET /api/entitlements — commerciële rechten van de INGELOGDE gebruiker.
// Alleen eigen gegevens; beheer loopt via de bestaande adminrouter.

import { Router, type IRouter } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { resolveEntitlements } from "../lib/entitlements";

const router: IRouter = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const resolved = await resolveEntitlements(clerkId);
    res.json({
      entitlement_mode: resolved.entitlementMode,
      product_variant: resolved.productVariant,
      active_entitlements: resolved.activeEntitlements.map((e) => ({
        id: e.id,
        entitlement_key: e.entitlementKey,
        entitlement_type: e.entitlementType,
        source: e.source,
        starts_at: e.startsAt.toISOString(),
        ends_at: e.endsAt ? e.endsAt.toISOString() : null,
      })),
      commercial_features: resolved.commercialFeatures,
      degraded: resolved.degraded,
    });
  } catch (err) {
    req.log.error({ err }, "entitlements.me failed");
    res.status(500).json({ error: "Kon rechten niet laden" });
  }
});

export default router;
