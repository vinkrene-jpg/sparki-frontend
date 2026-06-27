// Web Push delivery channel — backed by the VAPID protocol (web-push).
//
// A push reaches the athlete's phone lock screen (and a paired watch) even when
// the app is closed. Tapping it opens the app at a deep link — a push can never
// contain an input field itself, so the nudge always opens ONE focused question.
//
// Honesty contract: this module never pretends push works when it does not.
// `pushChannelStatus()` reports the REAL state — "ready" only when both VAPID
// keys are present on the server, otherwise "not_configured" with a plain-Dutch
// reason. `sendPush` returns a structured result and never throws; it flags dead
// endpoints (404/410) so the caller can prune them.

import webpush from "web-push";

const DEFAULT_SUBJECT = "mailto:notificaties@sparki.app";

// Allowlist of legitimate Web Push service hosts. A push "endpoint" is an
// attacker-supplied URL the server later fetches (webpush.sendNotification), so
// without this gate any authenticated user could register an internal/arbitrary
// URL and turn reminder delivery into an SSRF primitive. We accept only HTTPS
// URLs whose host belongs to a known browser push service.
function isAllowedPushHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "fcm.googleapis.com" || // Chrome / Chromium
    h === "updates.push.services.mozilla.com" ||
    h.endsWith(".push.services.mozilla.com") || // Firefox
    h === "web.push.apple.com" || // Safari / iOS PWA
    h.endsWith(".notify.windows.com") || // Edge (WNS)
    h.endsWith(".push.microsoft.com")
  );
}

// Validates a push subscription endpoint: must be a well-formed HTTPS URL on an
// allowlisted push-service host. Returns false for anything else (http, IPs,
// internal hosts, malformed input).
export function isValidPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return isAllowedPushHost(url.hostname);
}

function readKeys():
  | { publicKey: string; privateKey: string; subject: string }
  | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject = process.env.VAPID_SUBJECT?.trim() || DEFAULT_SUBJECT;
  return { publicKey, privateKey, subject };
}

let configuredFor: string | null = null;
function ensureConfigured(): boolean {
  const keys = readKeys();
  if (!keys) return false;
  // Re-apply if the public key changed (e.g. rotated secrets between runs).
  if (configuredFor !== keys.publicKey) {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    configuredFor = keys.publicKey;
  }
  return true;
}

export type PushChannelStatus =
  | { state: "ready"; publicKey: string }
  | { state: "not_configured"; reason: string };

export function pushChannelStatus(): PushChannelStatus {
  const keys = readKeys();
  if (!keys) {
    return {
      state: "not_configured",
      reason:
        "Push-meldingen zijn nog niet ingesteld op de server. Meldingen blijven netjes in de app staan.",
    };
  }
  return { state: "ready", publicKey: keys.publicKey };
}

// The VAPID public key the browser needs to create a subscription. Null when the
// channel is not configured.
export function pushPublicKey(): string | null {
  return readKeys()?.publicKey ?? null;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type PushPayload = {
  title: string;
  body: string;
  // Base-relative deep link the service worker opens on tap (e.g. "/you?focus=ftp").
  url: string;
  // Coalesces repeated nudges for the same thing on the device.
  tag?: string;
};

export type PushResult =
  | { ok: true }
  | { ok: false; prune: boolean; error: string };

// Send one push. Never throws. `prune` is true when the endpoint is gone (the
// subscription expired or was revoked) so the caller can delete it.
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<PushResult> {
  if (!ensureConfigured()) {
    return { ok: false, prune: false, error: "push-not-configured" };
  }
  // Defense-in-depth: never fetch a non-allowlisted endpoint even if a bad row
  // somehow exists. Prune it so it stops being retried.
  if (!isValidPushEndpoint(target.endpoint)) {
    return { ok: false, prune: true, error: "push-endpoint-not-allowed" };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    const prune = statusCode === 404 || statusCode === 410;
    return {
      ok: false,
      prune,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
