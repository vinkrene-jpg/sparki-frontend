import { DEV_PREVIEW, getDevAthleteId } from "@/lib/dev";
import { APP_VERSION } from "@/lib/version";
import { SESSION_ID } from "@/lib/session";

export const API_BASE = import.meta.env.VITE_API_URL ?? "";

// Golf 14 — versiecheck. Wanneer de server 426 antwoordt is deze appversie te
// oud; we melden dat één keer app-breed zodat het blokkeerscherm verschijnt.
export const VERSION_BLOCKED_EVENT = "sparki:version-blocked";
let versionBlockNotified = false;
let versionBlockMessage: string | null = null;
/** Vergrendelde 426-boodschap: late listeners nemen de blokkade hiermee over. */
export function getVersionBlockMessage(): string | null {
  return versionBlockMessage;
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // Dev preview only: pin which seeded athlete the backend resolves. Stripped
  // entirely from production builds (DEV_PREVIEW is statically false there).
  const devHeader: Record<string, string> = {};
  if (DEV_PREVIEW) {
    const devAthlete = getDevAthleteId();
    if (devAthlete) devHeader["x-dev-clerk-id"] = devAthlete;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Sparki-App-Version": APP_VERSION,
      "X-Sparki-Platform": "web",
      "X-Sparki-Session": SESSION_ID,
      ...devHeader,
      ...init?.headers,
    },
  });
  if (res.status === 426) {
    let message =
      "Deze versie van Sparki is verouderd. Ververs de pagina om verder te gaan.";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // standaardtekst volstaat
    }
    // Vergrendel de boodschap in module-state zodat een later gemount
    // blokkeerscherm de blokkade altijd overneemt, ook als het event al weg is.
    versionBlockMessage = message;
    if (!versionBlockNotified) {
      versionBlockNotified = true;
      window.dispatchEvent(
        new CustomEvent(VERSION_BLOCKED_EVENT, { detail: { message } }),
      );
    }
    throw new Error(message);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    const err = new Error(text) as Error & { status?: number };
    // Structurele statuscode voor callers die 404 ≠ netwerkfout moeten
    // onderscheiden (o.a. de generatie-jobpolling) — tekst-matchen is broos.
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

// F7 — beveiligde bijlagen. Serve-endpoints geven de bytes met een download-
// header terug (nooit inline). Voor een afbeeldingspreview of download halen we
// de bytes met dezelfde auth (cookies + dev-header) op en maken er een lokale
// object-URL van. Een geweigerd/ingetrokken bestand levert een nette fout met
// statuscode (bv. 410) die de aanroeper kan tonen.
export async function apiFetchBlob(path: string): Promise<Blob> {
  const devHeader: Record<string, string> = {};
  if (DEV_PREVIEW) {
    const devAthlete = getDevAthleteId();
    if (devAthlete) devHeader["x-dev-clerk-id"] = devAthlete;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "X-Sparki-App-Version": APP_VERSION,
      "X-Sparki-Platform": "web",
      "X-Sparki-Session": SESSION_ID,
      ...devHeader,
    },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // val terug op statusText
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.blob();
}
