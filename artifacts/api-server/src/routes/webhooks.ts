import { Router } from "express";
import { handleWebhookEvent } from "../engines/data-hub/webhooks";

// ── Inkomende webhooks (geen auth — externe platformen roepen dit aan) ──────
// Verificatie per platform:
//  • Strava: GET-abonnementshandshake met hub.verify_token (moet gelijk zijn
//    aan STRAVA_WEBHOOK_VERIFY_TOKEN) + hub.challenge-echo; POST-events dragen
//    geen secret (Strava-model), maar leiden alléén tot een sync voor een al
//    gekoppelde gebruiker — nooit tot datamutatie op basis van de payload zelf.
//  • Wahoo: ieder event bevat een webhook_token die gelijk moet zijn aan
//    WAHOO_WEBHOOK_TOKEN (mismatch ⇒ 403, niets vastgelegd).
//  • Garmin: pushes per gebruiker met userId; onbekende userId ⇒ eerlijk
//    "skipped", nooit een fout naar Garmin (die zou anders blijven herhalen).
// Alle events worden idempotent vastgelegd (unieke provider+eventId) en
// verwerkt via de reguliere Data Hub-sync — zelfde consent/dedupe/provenance.
// Endpoints antwoorden altijd snel met 200 zodat platformen niet eindeloos
// opnieuw afleveren; de uitkomst staat in webhook_events.

const router = Router();

// ── Strava ───────────────────────────────────────────────────────────────────
router.get("/strava", (req, res) => {
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");
  const expected = process.env["STRAVA_WEBHOOK_VERIFY_TOKEN"]?.trim();
  if (!expected || mode !== "subscribe" || token !== expected) {
    res.status(403).json({ error: "Verificatie mislukt" });
    return;
  }
  res.json({ "hub.challenge": challenge });
});

router.post("/strava", async (req, res) => {
  const body = req.body as {
    object_type?: string;
    object_id?: number | string;
    aspect_type?: string;
    owner_id?: number | string;
    event_time?: number;
  };
  // Antwoord meteen — Strava eist een snelle 200; verwerking is idempotent.
  res.status(200).json({ received: true });
  if (!body || body.object_type !== "activity" || body.object_id == null) return;
  const eventId = `activity:${body.object_id}:${body.aspect_type ?? "?"}:${body.event_time ?? 0}`;
  try {
    await handleWebhookEvent({
      provider: "strava",
      eventId,
      externalUserId: body.owner_id != null ? String(body.owner_id) : null,
      payload: body,
    });
  } catch (err) {
    req.log.error({ err }, "webhooks.strava failed");
  }
});

// ── Garmin ───────────────────────────────────────────────────────────────────
// Garmin Health push: { activities: [ { userId, summaryId, ... } ] } (of
// activityDetails). Per item één idempotent event.
router.post("/garmin", async (req, res) => {
  res.status(200).json({ received: true });
  const body = req.body as Record<string, unknown>;
  const items: Record<string, unknown>[] = [];
  for (const key of ["activities", "activityDetails", "manuallyUpdatedActivities"]) {
    const arr = body?.[key];
    if (Array.isArray(arr)) items.push(...(arr as Record<string, unknown>[]));
  }
  for (const item of items) {
    const summaryId = item["summaryId"] != null ? String(item["summaryId"]) : null;
    const userId = item["userId"] != null ? String(item["userId"]) : null;
    if (!summaryId) continue;
    try {
      await handleWebhookEvent({
        provider: "garmin",
        eventId: summaryId,
        externalUserId: userId,
        payload: item,
      });
    } catch (err) {
      req.log.error({ err }, "webhooks.garmin failed");
    }
  }
});

// ── Wahoo ────────────────────────────────────────────────────────────────────
// Wahoo stuurt bij ieder event een webhook_token mee die moet matchen.
router.post("/wahoo", async (req, res) => {
  const body = req.body as {
    webhook_token?: string;
    event_type?: string;
    user?: { id?: number | string };
    workout?: { id?: number | string };
  };
  const expected = process.env["WAHOO_WEBHOOK_TOKEN"]?.trim();
  if (!expected || body?.webhook_token !== expected) {
    res.status(403).json({ error: "Verificatie mislukt" });
    return;
  }
  res.status(200).json({ received: true });
  const workoutId = body?.workout?.id;
  if (workoutId == null) return;
  const eventId = `${body.event_type ?? "workout"}:${workoutId}`;
  try {
    await handleWebhookEvent({
      provider: "wahoo",
      eventId,
      externalUserId: body?.user?.id != null ? String(body.user.id) : null,
      payload: body,
    });
  } catch (err) {
    req.log.error({ err }, "webhooks.wahoo failed");
  }
});

export default router;
