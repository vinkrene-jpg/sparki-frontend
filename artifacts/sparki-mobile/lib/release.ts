// Golf 14 — versiecheck en foutregistratie voor de mobiele app.
// Elke API-aanroep stuurt platform + appversie mee; antwoordt de server met
// 426 (versie te oud) dan verschijnt app-breed een blokkeerscherm. Onafge-
// vangen JS-fouten gaan (licht gededupliceerd) naar de server voor groepering.

import Constants from "expo-constants";
import {
  customFetch,
  setDefaultHeaders,
  setErrorStatusHandler,
} from "@workspace/api-client-react";

export const APP_VERSION: string =
  Constants.expoConfig?.version ?? "1.0.0";

// ---------------------------------------------------------------------------
// Versieblokkade (426)
// ---------------------------------------------------------------------------

type VersionBlockListener = (message: string) => void;
let blockListener: VersionBlockListener | null = null;
let blockedMessage: string | null = null;

// Golf 28 — tijdens een actieve rit tonen we NOOIT een blokkeerscherm:
// veiligheid gaat vóór versiehandhaving. De blokkade wordt gelatcht en pas
// gemeld zodra de rit voorbij is.
let rideActive = false;

export function setRideActive(active: boolean): void {
  rideActive = active;
  if (!active && blockedMessage) blockListener?.(blockedMessage);
}

export function onVersionBlocked(listener: VersionBlockListener): () => void {
  blockListener = listener;
  // Was de blokkade er al vóór de listener aanhaakte, meld die alsnog —
  // behalve tijdens een actieve rit (dan volgt de melding na afloop).
  if (blockedMessage && !rideActive) listener(blockedMessage);
  return () => {
    if (blockListener === listener) blockListener = null;
  };
}

// ---------------------------------------------------------------------------
// Rustig update-advies (aanbevolen versie, nooit blokkerend)
// ---------------------------------------------------------------------------

let updateAdviesMessage: string | null = null;
let updateAdviesListener: ((message: string | null) => void) | null = null;

export function onUpdateAdvies(
  listener: (message: string | null) => void,
): () => void {
  updateAdviesListener = listener;
  listener(updateAdviesMessage);
  return () => {
    if (updateAdviesListener === listener) updateAdviesListener = null;
  };
}

async function checkUpdateAdvies(): Promise<void> {
  try {
    const data = await customFetch<{
      ok: boolean;
      updateAdvies?: { recommendedVersion: string } | null;
    }>("/api/release/version-check", { responseType: "json" });
    const advies = data?.updateAdvies ?? null;
    updateAdviesMessage = advies
      ? `Er is een nieuwere versie van Sparki (${advies.recommendedVersion}). Updaten kan wanneer het jou uitkomt.`
      : null;
    updateAdviesListener?.(updateAdviesMessage);
  } catch {
    // Geen advies kunnen ophalen is geen fout voor de gebruiker.
  }
}

// ---------------------------------------------------------------------------
// Foutregistratie
// ---------------------------------------------------------------------------

const seen = new Set<string>();
let sentThisSession = 0;
const MAX_PER_SESSION = 20;

export function reportError(
  message: string,
  stack: string | null,
  severity: "fout" | "kritiek",
): void {
  const key = message.slice(0, 200);
  if (seen.has(key) || sentThisSession >= MAX_PER_SESSION) return;
  seen.add(key);
  sentThisSession += 1;
  void customFetch("/api/release/errors", {
    method: "POST",
    responseType: "json",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: message.slice(0, 1000),
      stack: stack?.slice(0, 4000) ?? null,
      severity,
      screen: null,
    }),
  }).catch(() => {
    // Foutrapportage mag zelf nooit een fout veroorzaken.
  });
}

// ---------------------------------------------------------------------------
// Installatie (één keer, bij het opstarten van de app)
// ---------------------------------------------------------------------------

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler?: () => GlobalErrorHandler | undefined;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
};

let installed = false;

export function installRelease(): void {
  if (installed) return;
  installed = true;

  // Golf 28 — het distributiekanaal (uit eas.json, EXPO_PUBLIC_CHANNEL) gaat
  // mee zodat de server het kanaal als plafond op de releasegroep kan leggen.
  const kanaal = process.env.EXPO_PUBLIC_CHANNEL ?? "";
  setDefaultHeaders({
    "x-sparki-app-version": APP_VERSION,
    "x-sparki-platform": "mobiel",
    ...(kanaal ? { "x-sparki-kanaal": kanaal } : {}),
  });

  setErrorStatusHandler((status, body) => {
    if (status !== 426) return;
    const data = (body ?? {}) as { error?: unknown };
    const message =
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : "Deze versie van Sparki is verouderd. Installeer de nieuwste update om verder te gaan.";
    if (!blockedMessage) {
      blockedMessage = message;
      // Tijdens een actieve rit stellen we het blokkeerscherm uit; de
      // melding volgt automatisch zodra de rit stopt (setRideActive(false)).
      if (!rideActive) blockListener?.(message);
    }
  });

  // Rustig update-advies ophalen (niet blokkerend, fout = stil overslaan).
  void checkUpdateAdvies();

  // React Native's globale fouthaak — bestaat niet op web; daar vangt de
  // webapp zelf al fouten via window-listeners.
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      const err = error instanceof Error ? error : null;
      reportError(
        err?.message ?? String(error ?? "Onbekende fout"),
        err?.stack ?? null,
        isFatal ? "kritiek" : "fout",
      );
      previous?.(error, isFatal);
    });
  }
}
