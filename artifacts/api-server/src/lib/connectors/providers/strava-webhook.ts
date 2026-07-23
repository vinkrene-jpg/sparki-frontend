// Strava webhook-abonnement (push subscriptions API).
//
// Webhook-eerst betekent: na een geslaagde koppeling zorgt de server er zelf
// voor dat er een Strava-abonnement bestaat dat naar ons endpoint wijst.
// Eerlijk en fail-closed: zonder STRAVA_WEBHOOK_VERIFY_TOKEN (of zonder
// client-credentials) wordt er niets geregistreerd en melden we dat als
// niet-actief — nooit doen alsof pushmeldingen werken terwijl ze dat niet doen.

import { publicBaseUrl } from "./strava-oauth";

const SUBSCRIPTIONS_API = "https://www.strava.com/api/v3/push_subscriptions";

export interface StravaWebhookStatus {
  /** Abonnement bestaat en wijst naar ons callback-adres. */
  active: boolean;
  /** Eerlijke reden wanneer niet actief. */
  reason: string | null;
  callbackUrl: string | null;
}

export function stravaWebhookCallbackUrl(): string {
  return `${publicBaseUrl()}/api/webhooks/strava`;
}

function credentials(): {
  clientId: string;
  clientSecret: string;
  verifyToken: string;
} | null {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!clientId || !clientSecret || !verifyToken) return null;
  return { clientId, clientSecret, verifyToken };
}

interface StravaSubscription {
  id?: number;
  callback_url?: string;
}

async function listSubscriptions(
  clientId: string,
  clientSecret: string,
): Promise<StravaSubscription[]> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${SUBSCRIPTIONS_API}?${params}`);
  if (!res.ok) {
    throw new Error(`Strava-abonnementen opvragen mislukte (${res.status}).`);
  }
  const body = (await res.json()) as unknown;
  return Array.isArray(body) ? (body as StravaSubscription[]) : [];
}

/**
 * Zorg (idempotent) dat er een Strava-webhookabonnement bestaat voor ons
 * endpoint. Bestaat er al één met exact ons callback-adres, dan gebeurt er
 * niets. Strava valideert bij aanmaak het endpoint live via de GET-handshake
 * (hub.challenge) — die route staat in routes/webhooks.ts.
 */
export async function ensureStravaWebhookSubscription(): Promise<StravaWebhookStatus> {
  const creds = credentials();
  const callbackUrl = stravaWebhookCallbackUrl();
  if (!creds) {
    return {
      active: false,
      reason:
        "Pushmeldingen staan uit: STRAVA_WEBHOOK_VERIFY_TOKEN (of client-instellingen) ontbreekt.",
      callbackUrl,
    };
  }
  const existing = await listSubscriptions(creds.clientId, creds.clientSecret);
  if (existing.some((s) => s.callback_url === callbackUrl)) {
    return { active: true, reason: null, callbackUrl };
  }

  // Strava staat één abonnement per API-app toe. Wijst het bestaande abonnement
  // naar een ander (oud) adres, dan ruimen we dat eerst op.
  for (const sub of existing) {
    if (sub.id == null) continue;
    const del = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });
    const delRes = await fetch(`${SUBSCRIPTIONS_API}/${sub.id}?${del}`, {
      method: "DELETE",
    });
    if (!delRes.ok && delRes.status !== 404) {
      return {
        active: false,
        reason: `Bestaand abonnement kon niet worden vervangen (${delRes.status}).`,
        callbackUrl,
      };
    }
  }

  const form = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    callback_url: callbackUrl,
    verify_token: creds.verifyToken,
  });
  const res = await fetch(SUBSCRIPTIONS_API, { method: "POST", body: form });
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 300);
    return {
      active: false,
      reason: `Strava accepteerde het webhook-abonnement niet (${res.status}). ${text}`.trim(),
      callbackUrl,
    };
  }
  return { active: true, reason: null, callbackUrl };
}

// Eén poging per proces-start is genoeg: het abonnement is app-breed (niet
// per gebruiker) en idempotent. Bij een mislukking mag een volgende koppeling
// het opnieuw proberen.
let ensuredOnce: Promise<StravaWebhookStatus> | null = null;

export function ensureStravaWebhookSubscriptionOnce(): Promise<StravaWebhookStatus> {
  if (!ensuredOnce) {
    ensuredOnce = ensureStravaWebhookSubscription().then((status) => {
      if (!status.active) ensuredOnce = null; // volgende poging toegestaan
      return status;
    });
    ensuredOnce.catch(() => {
      ensuredOnce = null;
    });
  }
  return ensuredOnce;
}
