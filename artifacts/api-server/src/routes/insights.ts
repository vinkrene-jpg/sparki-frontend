// Sparki Insights — HTTP surface for the curiosity open-loops and the honest
// ("Sparki, eerlijk?") observation. Both are strictly evidence-gated: Sparki only
// opens a loop or makes a pointed claim when real data backs it. Owner-scoped:
// every read is for the signed-in athlete only.

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  computeInsightSignals,
  computeOpenLoops,
  composeHonest,
} from "../engines/insights";
import { computeTrust } from "../engines/voice";

const router = Router();

// GET /api/open-loops — the curiosity teasers Sparki has earned the right to
// open, given the athlete's real signals. Empty array when there is nothing
// honest to tease yet (a brand-new athlete sees none).
router.get("/open-loops", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [signals, trust] = await Promise.all([
      computeInsightSignals(clerkId),
      computeTrust(clerkId),
    ]);
    res.json({ loops: computeOpenLoops(signals, trust.tier) });
  } catch (err) {
    req.log.error({ err }, "insights.openLoops failed");
    res.status(500).json({ error: "Kon Sparki's observaties niet laden." });
  }
});

// GET /api/honest — one honest observation founded on real signals, or an
// explicit "onvoldoende bewijs" when the data does not support a claim yet.
router.get("/honest", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [signals, trust] = await Promise.all([
      computeInsightSignals(clerkId),
      computeTrust(clerkId),
    ]);
    const obs = composeHonest(signals, trust.tier);
    res.json({ observation: obs });
  } catch (err) {
    req.log.error({ err }, "insights.honest failed");
    res.status(500).json({ error: "Kon Sparki's oordeel niet laden." });
  }
});

export default router;
