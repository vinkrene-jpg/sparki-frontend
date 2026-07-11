import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { deriveEngagement } from "../engines/engagement";

const router = Router();

// GET /api/engagement/rhythm — an HONEST, plain-Dutch read-out of what has been
// learned about WHEN this athlete tends to open the app and WHAT they use most,
// so the "er is iets nieuws voor je"-tik can land at a receptive moment. Every
// value is derived from the athlete's own real usage; when there is too little
// data yet, `confidence` says so plainly and the window is a calm evening
// default rather than an invented rhythm.
router.get("/rhythm", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rhythm = await deriveEngagement(clerkId);
    res.json({ rhythm });
  } catch (err) {
    req.log.error({ err }, "engagement.rhythm failed");
    res.status(500).json({ error: "Kon je ritme niet laden" });
  }
});

export default router;
