// GET /api/state — today's honest Sparki toestand for the signed-in athlete.
//
// The generic State Engine's HTTP surface: the living Sparki Core position +
// status + coach action + the 2–3 signals behind it. Any consumer reads it
// (Vandaag is the first; Training, Races, widgets, Sparki Display, coach views,
// external APIs read the same payload). Real data only; honest failure on error.

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
    res.status(500).json({ error: "Je toestand kon nu niet bepaald worden" });
  }
});

export default router;
