// Development Preview Mode flag.
// True in the Vite dev server (`import.meta.env.DEV`) én in een acceptatiebuild
// (TESTDEPLOY_SYNC_01: bevroren productiebuild in de toetsomgeving, ingebakken
// via SPARKI_ACCEPT_MODE bij het bouwen). Altijd false in de echte
// productiepublicatie. De server blijft fail-closed: de `x-dev-clerk-id`-header
// wordt alleen gehonoreerd met NODE_ENV!=production én DEV_AUTH_BYPASS=true,
// dus deze client-vlag kan productie nooit beïnvloeden.
export const DEV_PREVIEW =
  import.meta.env.DEV ||
  (typeof __SPARKI_ACCEPT_MODE__ === "boolean" && __SPARKI_ACCEPT_MODE__);

// Dev-only selected preview athlete. Persisted so a full reload (used when
// switching athletes) keeps the choice. The clerkId is sent as the
// `x-dev-clerk-id` header by apiFetch in DEV only; the backend honours it solely
// in dev and only when the profile actually exists, so it can never affect
// production. Reads are guarded so this is a no-op outside the dev preview.
const DEV_ATHLETE_KEY = "sparki.dev.previewAthlete";

export function getDevAthleteId(): string | null {
  if (!DEV_PREVIEW) return null;
  try {
    return window.localStorage.getItem(DEV_ATHLETE_KEY);
  } catch {
    return null;
  }
}

export function setDevAthleteId(clerkId: string | null): void {
  if (!DEV_PREVIEW) return;
  try {
    if (clerkId) window.localStorage.setItem(DEV_ATHLETE_KEY, clerkId);
    else window.localStorage.removeItem(DEV_ATHLETE_KEY);
  } catch {
    // ignore storage failures — dev tooling only
  }
}
