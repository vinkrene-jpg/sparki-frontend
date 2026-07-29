// GET /api/core-prediction/:workoutId — Sparki's honest Core forecast for one
// planned training.
//
// Returns the immutable prediction snapshot for a workout the athlete owns: the
// current Core, the path it travels during the session, the end position, the
// recovery rebound, the determining factors with honest availability, a
// confidence that is never 1.0, and — once executed — a predicted-vs-actual
// comparison. Ownership is enforced; real data only, honest failure on error.

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { requireCommercialFeature } from "../lib/entitlements";
import { runCorePrediction } from "../engines/core-prediction";

const router = Router();

router.get("/:workoutId", requireAuth, requireCommercialFeature("performance_lab"), async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Niet ingelogd" });
    return;
  }
  const workoutId = Number.parseInt(String(req.params.workoutId), 10);
  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    res.status(400).json({ error: "Ongeldige training" });
    return;
  }
  try {
    const prediction = await runCorePrediction(clerkId, workoutId);
    if (!prediction) {
      res.status(404).json({ error: "Training niet gevonden" });
      return;
    }
    res.json(prediction);
  } catch (err) {
    console.error("core prediction failed", err);
    res
      .status(500)
      .json({ error: "Sparki kon de voorspelling nu niet maken" });
  }
});

export default router;
