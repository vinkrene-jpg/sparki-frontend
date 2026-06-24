// GET /api/state — today's honest Sparki toestand for the signed-in athlete.
//
// Drives the State Card (the living Sparki Core + status + coach action + the
// 2–3 signals behind it) on Vandaag. Real data only; honest failure on error.

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { runStateAnalysis } from "../engines/state";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Niet ingelogd" });
    return;
  }
  try {
    const state = await runStateAnalysis(clerkId);
    res.json(state);
  } catch (err) {
    console.error("state analysis failed", err);
    res.status(500).json({ error: "Sparki kon je toestand nu niet bepalen" });
  }
});

export default router;
