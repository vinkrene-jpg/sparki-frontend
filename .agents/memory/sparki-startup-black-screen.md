---
name: Sparki startup black screen
description: Why prod PWA startup showed pure black and the layered guardrails that prevent it
---

Rule: the web app must NEVER be able to show a pure black viewport at startup.

**Why:** In production nothing rendered until clerk-js was fully loaded — Clerk `<Show>` components return `null` while loading, and the body background is #040506. Any slow/failed clerk-js load (Android PWA cold start, flaky mobile network) or any crash before/during React mount produced an indefinite black screen with no error, and pre-mount crashes are never reported to `/api/release/errors` because error reporting installs inside the bundle.

**How to apply (three layers, keep all of them):**
1. Static Dutch splash lives inside `#root` in `index.html`, plus an inline pre-React `window.error` handler that swaps the splash for a Dutch "kon niet opstarten" screen with a reload button. Never remove the splash — React replaces it on mount.
2. Root-level `ErrorBoundary` wraps `<App/>` in `main.tsx` (in addition to the inner one).
3. `ClerkStartupGate` in `App.tsx` shows a spinner while `useUser().isLoaded` is false, and after ~12s an honest slow-load message + reload button. It wraps the route `<Switch>` (not the DevPreview branch).

Also: the "Clerk has been loaded with development keys" console warning appears in prod too (Replit-managed Clerk proxy tenant) — it is expected, not the bug.
