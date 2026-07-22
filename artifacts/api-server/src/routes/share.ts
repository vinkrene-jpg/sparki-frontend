// Rit delen — deeltekst + officiële Strava-upload.
//
// GET  /api/share/session/:id        → deeltekst (echte waarden) + mogelijkheden
// POST /api/share/session/:id/strava → upload naar het eigen Strava-account
//
// Eerlijkheid: Strava alleen via de officiële API met activity:write van de
// renner zelf; andere platforms lopen via het deelmenu van het apparaat en dat
// wordt ook zo benoemd (platformNote).

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  buildShareText,
  getShareCapabilities,
  loadOwnedSession,
  uploadSessionToStrava,
} from "../engines/share";

const router = Router();

function parseSessionId(raw: unknown): number | null {
  const id = parseInt(String(raw), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/session/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseSessionId(req.params["id"]);
  if (id == null) {
    res.status(400).json({ error: "Ongeldige rit" });
    return;
  }
  try {
    const session = await loadOwnedSession(clerkId, id);
    if (!session) {
      res.status(404).json({ error: "Rit niet gevonden" });
      return;
    }
    const [capabilities, share] = await Promise.all([
      getShareCapabilities(clerkId, session),
      buildShareText(session),
    ]);
    res.json({
      text: share.text,
      generated: share.generated,
      capabilities,
      session: {
        id: session.id,
        title: session.title,
        sessionDate: session.sessionDate,
        distanceKm: session.distanceKm,
        durationMin: session.durationMin,
        elevationM: session.elevationM,
        avgPower: session.avgPower,
        avgSpeedKph: session.avgSpeedKph,
      },
    });
  } catch (err) {
    req.log.error({ err }, "share.info failed");
    res.status(500).json({ error: "Delen kon niet worden voorbereid" });
  }
});

router.post("/session/:id/strava", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseSessionId(req.params["id"]);
  if (id == null) {
    res.status(400).json({ error: "Ongeldige rit" });
    return;
  }
  try {
    const session = await loadOwnedSession(clerkId, id);
    if (!session) {
      res.status(404).json({ error: "Rit niet gevonden" });
      return;
    }
    const rawDesc = (req.body as { description?: unknown } | null)?.description;
    const description = typeof rawDesc === "string" ? rawDesc : null;
    const result = await uploadSessionToStrava(clerkId, session, description);
    res.json({ ok: true, stravaActivityId: result.stravaActivityId, url: result.url });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Uploaden naar Strava is niet gelukt";
    req.log.warn({ err }, "share.strava failed");
    res.status(422).json({ error: message });
  }
});

export default router;
