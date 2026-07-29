import { Router } from "express";
import { handleWebhookEvent } from "../engines/data-hub/webhooks";
import { isBillingFlagEnabledFor } from "../lib/billing";
import {
  processStripeEvent,
  type StripeEventLike,
} from "../lib/billing/webhook-processor";
import { verifyStripeWebhook } from "../lib/billing/stripe-gateway";

// ── Inkomende webhooks (geen auth — externe platformen roepen dit aan) ──────
// Verificatie per platform:
//  • Strava: GET-abonnementshandshake met hub.verify_token (moet gelijk zijn
//    aan STRAVA_WEBHOOK_VERIFY_TOKEN) + hub.challenge-echo; POST-events dragen
//    geen secret (Strava-model), maar leiden alléén tot een sync voor een al
//    gekoppelde gebruiker — nooit tot datamutatie op basis van de payload zelf.
//  • Wahoo: ieder event bevat een webhook_token die gelijk moet zijn aan
//    WAHOO_WEBHOOK_TOKEN (mismatch ⇒ 403, niets vastgelegd).
//  • Garmin: het Health-pushmodel draagt geen signature per event. Daarom is
//    het endpoint verified via een geheim in de geregistreerde URL zelf:
//    POST /garmin?token=<GARMIN_WEBHOOK_TOKEN>. Fail-closed: geen token
//    geconfigureerd of mismatch ⇒ 403 en er wordt niets vastgelegd. Onbekende
//    userId ⇒ eerlijk "skipped", nooit een fout naar Garmin terug.
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
  // Verified webhook: het geheim zit in de geregistreerde URL (?token=…).
  // Fail-closed — zonder geconfigureerd token wordt niets geaccepteerd.
  const expected = process.env["GARMIN_WEBHOOK_TOKEN"]?.trim();
  const provided = String(req.query["token"] ?? "");
  if (!expected || provided !== expected) {
    res.status(403).json({ error: "Verificatie mislukt" });
    return;
  }
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

// ── Stripe (fase 2, TESTMODUS) ───────────────────────────────────────────────
// Dubbel vergrendeld: featureflag `stripe_webhooks` (default uit) én verplichte
// signatuurverificatie (STRIPE_WEBHOOK_SECRET). Fail-closed: flag uit ⇒ 503,
// geen secret ⇒ 503, ongeldige signatuur ⇒ 400 — er wordt dan niets vastgelegd.
// Verwerking is idempotent (event_id UNIQUE) en een verwerkingsfout geeft
// nooit betaalde toegang (rollback ⇒ event her-verwerkbaar, dan 500 zodat
// Stripe opnieuw levert).
router.post("/stripe", async (req, res) => {
  const flagOn = await isBillingFlagEnabledFor(null, "stripe_webhooks");
  if (!flagOn) {
    res.status(503).json({ error: "Stripe-webhooks staan uit" });
    return;
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    req.log.error("webhooks.stripe: STRIPE_WEBHOOK_SECRET ontbreekt");
    res.status(503).json({ error: "Stripe-webhooks zijn niet geconfigureerd" });
    return;
  }
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  const signature = req.headers["stripe-signature"];
  if (!rawBody || typeof signature !== "string") {
    res.status(400).json({ error: "Ongeldige webhook-aanroep" });
    return;
  }
  let event: StripeEventLike;
  try {
    event = verifyStripeWebhook(
      rawBody,
      signature,
      secret,
    ) as unknown as StripeEventLike;
  } catch {
    res.status(400).json({ error: "Signatuurverificatie mislukt" });
    return;
  }
  try {
    const outcome = await processStripeEvent(event, rawBody);
    res.status(200).json(outcome);
  } catch (err) {
    req.log.error({ err, eventId: event.id }, "webhooks.stripe processing failed");
    // 500 ⇒ Stripe levert opnieuw; registratie is teruggerold dus de retry
    // wordt gewoon opnieuw verwerkt (idempotent, geen rechten toegekend).
    res.status(500).json({ error: "Verwerking mislukt" });
  }
});

export default router;
