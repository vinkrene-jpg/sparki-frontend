import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// ── Web Push (frontend) ───────────────────────────────────────────────────────
// Subscribes this device so profile nudges (and other reminders) reach the phone
// lock screen — mirrored on a paired watch — even when the app is closed.
//
// Honesty contract: every state the UI shows is REAL. We never claim push works
// when the browser can't do it, when the server has no VAPID keys, when the user
// blocked notifications, or when iOS needs the app installed to the home screen
// first. Each case carries a plain-Dutch reason.

export type PushState =
  | "loading"
  | "unsupported" // browser has no service worker / Push API
  | "ios_needs_install" // iOS Safari: only works as an installed PWA
  | "not_configured" // server has no VAPID keys (honest-limited)
  | "blocked" // user denied notification permission
  | "off" // supported + allowed, but not subscribed yet
  | "on"; // actively subscribed on this device

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports as Mac but has touch.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    // iOS Safari legacy flag.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function supportsPush(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!supportsPush()) {
      if (isIos() && !isStandalone()) {
        setState("ios_needs_install");
        setReason(
          "Op de iPhone werken meldingen alleen als je Sparki eerst toevoegt aan je beginscherm (Deel-knop → 'Zet op beginscherm').",
        );
      } else {
        setState("unsupported");
        setReason(
          "Deze browser kan geen push-meldingen versturen. Meldingen blijven in de app staan.",
        );
      }
      return;
    }

    // Server must have VAPID keys, otherwise push is honest-limited.
    let configured = false;
    try {
      const res = await apiFetch<{ configured: boolean; reason?: string }>(
        "/api/notifications/push/key",
      );
      configured = res.configured;
      if (!configured) {
        setState("not_configured");
        setReason(
          res.reason ??
            "Push-meldingen zijn nog niet ingesteld op de server. Meldingen blijven in de app staan.",
        );
        return;
      }
    } catch {
      setState("not_configured");
      setReason(
        "Push-meldingen zijn nog niet beschikbaar. Meldingen blijven in de app staan.",
      );
      return;
    }

    if (Notification.permission === "denied") {
      setState("blocked");
      setReason(
        "Meldingen zijn geblokkeerd in je browserinstellingen. Zet ze daar weer aan om push te gebruiken.",
      );
      return;
    }

    const reg = await getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    setState(sub ? "on" : "off");
    setReason(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("blocked");
        setReason(
          "Zonder toestemming voor meldingen kan push niet aangezet worden.",
        );
        return;
      }
      const keyRes = await apiFetch<{ configured: boolean; publicKey?: string }>(
        "/api/notifications/push/key",
      );
      if (!keyRes.configured || !keyRes.publicKey) {
        setState("not_configured");
        setReason(
          "Push-meldingen zijn nog niet ingesteld op de server. Meldingen blijven in de app staan.",
        );
        return;
      }
      const reg = await getRegistration();
      if (!reg) {
        setState("unsupported");
        setReason("Kon de meldingsdienst niet starten in deze browser.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          keyRes.publicKey,
        ) as BufferSource,
      });
      const json = sub.toJSON();
      await apiFetch("/api/notifications/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });
      setState("on");
      setReason(null);
    } catch (err) {
      setReason(
        err instanceof Error
          ? `Aanmelden voor push lukte niet: ${err.message}`
          : "Aanmelden voor push lukte niet.",
      );
      void refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await apiFetch("/api/notifications/push/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState("off");
      setReason(null);
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, reason, busy, enable, disable, refresh };
}
