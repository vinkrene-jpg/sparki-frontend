// Development Preview Mode flag.
// True only in the Vite dev server (`import.meta.env.DEV`); always false in
// production builds. Used to bypass auth/onboarding gates so the v0 frontend is
// directly visible without signing in. Never gate production behavior on this.
export const DEV_PREVIEW = import.meta.env.DEV;

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
