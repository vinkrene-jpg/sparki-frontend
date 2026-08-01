// ROUTE_PAKKET_02A — uitleesbare teller van routegebruik (alleen meten).
//
// GET /api/route-usage → { calendarMonth, used, registrations[] } voor de
// ingelogde gebruiker in de huidige Amsterdamse kalendermaand. Dit endpoint
// blokkeert of beperkt niets; het bestaat zodat Mirror (en later de app) de
// telling kan controleren.
import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  amsterdamCalendarMonth,
  isRiddenTriggerEnabled,
  listRouteUsage,
} from "../lib/route-usage-metering";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const calendarMonth = amsterdamCalendarMonth();
    const registrations = await listRouteUsage(clerkId, calendarMonth);
    res.json({
      calendarMonth,
      used: registrations.length,
      riddenTriggerEnabled: isRiddenTriggerEnabled(),
      registrations,
    });
  } catch (err) {
    req.log.error({ err }, "routeUsage.read failed");
    res.status(500).json({ error: "Kon routegebruik niet uitlezen" });
  }
});

export default router;
