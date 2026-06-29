import { DEV_PREVIEW, getDevAthleteId } from "@/lib/dev";
import { APP_VERSION } from "@/lib/version";
import { SESSION_ID } from "@/lib/session";

export const API_BASE = import.meta.env.VITE_API_URL ?? "";

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
      "X-Sparki-Session": SESSION_ID,
      ...devHeader,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}
