// Golf 14 — centrale foutregistratie vanuit de webapp.
// Onafgevangen fouten en promise-afwijzingen gaan (licht gededupliceerd) naar
// de server, waar ze per vingerafdruk worden gegroepeerd. Geen gevoelige data:
// alleen melding, stack-top, scherm en appversie.

import { API_BASE } from "@/lib/api";
import { APP_VERSION } from "@/lib/version";

const seen = new Set<string>();
let sentThisSession = 0;
const MAX_PER_SESSION = 20;

function report(message: string, stack: string | null, severity: "fout" | "kritiek"): void {
  const key = message.slice(0, 200);
  if (seen.has(key) || sentThisSession >= MAX_PER_SESSION) return;
  seen.add(key);
  sentThisSession += 1;
  void fetch(`${API_BASE}/api/release/errors`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Sparki-App-Version": APP_VERSION,
      "X-Sparki-Platform": "web",
    },
    body: JSON.stringify({
      message: message.slice(0, 1000),
      stack: stack?.slice(0, 4000) ?? null,
      severity,
      screen: window.location.pathname,
    }),
  }).catch(() => {
    // Foutrapportage mag zelf nooit een fout veroorzaken.
  });
}

export function installErrorReporting(): void {
  window.addEventListener("error", (event) => {
    const err = event.error as Error | undefined;
    report(
      err?.message ?? event.message ?? "Onbekende fout",
      err?.stack ?? null,
      "kritiek",
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    const err = reason instanceof Error ? reason : null;
    const message = err?.message ?? String(reason ?? "Onbekende afwijzing");
    // Netwerk-/laadfouten zijn ruis; registreer als gewone fout, niet kritiek.
    report(message, err?.stack ?? null, "fout");
  });
}
