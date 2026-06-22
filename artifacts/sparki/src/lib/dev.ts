// Development Preview Mode flag.
// True only in the Vite dev server (`import.meta.env.DEV`); always false in
// production builds. Used to bypass auth/onboarding gates so the v0 frontend is
// directly visible without signing in. Never gate production behavior on this.
export const DEV_PREVIEW = import.meta.env.DEV;
