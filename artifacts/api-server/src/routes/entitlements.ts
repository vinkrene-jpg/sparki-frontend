// GET /api/entitlements — commerciële rechten van de INGELOGDE gebruiker.
// Alleen eigen gegevens; beheer loopt via de bestaande adminrouter.

import { Router, type IRouter } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  resolveEntitlements,
  customerProductLabel,
  customerSourceLabel,
} from "../lib/entitlements";

const router: IRouter = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const resolved = await resolveEntitlements(clerkId);
    res.json({
      entitlement_mode: resolved.entitlementMode,
      // Klantgericht label — de interne variantnaam (sparki_pro e.d.) blijft
      // bewust buiten dit antwoord; beheer ziet die via de adminrouter.
      product_label: customerProductLabel(resolved),
      active_entitlements: resolved.activeEntitlements.map((e) => ({
        id: e.id,
        entitlement_key: e.entitlementKey,
        entitlement_type: e.entitlementType,
        source: customerSourceLabel(e.source),
        starts_at: e.startsAt.toISOString(),
        ends_at: e.endsAt ? e.endsAt.toISOString() : null,
      })),
      commercial_features: Object.fromEntries(
        Object.entries(resolved.commercialFeatures).map(([key, v]) => [
          key,
          { ...v, source: customerSourceLabel(v.source) },
        ]),
      ),
      degraded: resolved.degraded,
    });
  } catch (err) {
    req.log.error({ err }, "entitlements.me failed");
    res.status(500).json({ error: "Kon rechten niet laden" });
  }
});

export default router;
