import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getAudioPrefs,
  updateAudioPrefs,
  sanitizeAudioPatch,
} from "../engines/audio";

const router = Router();

// GET /api/audio/preferences — the athlete's Sound Studio + wekker preferences.
router.get("/preferences", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const preferences = await getAudioPrefs(clerkId);
    res.json({ preferences });
  } catch (err) {
    req.log.error({ err }, "audio.preferences.get failed");
    res.status(500).json({ error: "Kon geluidsvoorkeuren niet laden" });
  }
});

// PUT /api/audio/preferences — update (partial). Malformed fields are ignored.
router.put("/preferences", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch = sanitizeAudioPatch(body);
  try {
    const preferences = await updateAudioPrefs(clerkId, patch);
    res.json({ preferences });
  } catch (err) {
    req.log.error({ err }, "audio.preferences.put failed");
    res.status(500).json({ error: "Kon geluidsvoorkeuren niet opslaan" });
  }
});

export default router;
