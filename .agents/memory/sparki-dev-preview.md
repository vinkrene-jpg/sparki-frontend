---
name: Sparki Development Preview Mode
description: How auth/onboarding is bypassed in dev to preview the v0 frontend, and the rules that keep it out of production.
---

# Development Preview Mode

Lets the v0 frontend render directly (no login, no onboarding) while running the Vite
dev server, reusing the exact production page components — no duplication.

## How it works
- Frontend: `DEV_PREVIEW = import.meta.env.DEV`. `App.tsx` renders `<DevPreview>` instead
  of the auth-gated `<Switch>` when `DEV_PREVIEW`. `DevPreview` mounts production
  components, driven by wouter `useLocation`, with a fixed dev switcher bar.
- Data hooks gate on `enabled: isSignedIn === true || DEV_PREVIEW`. `UserContext` and
  `FeatureFlagContext` have a dev path that fetches without a Clerk session
  (UserContext skips Clerk sync, just calls `/api/auth/me`).
- Backend: `devAuthBypass` middleware (registered after clerkMiddleware, before `/api`)
  attaches `req.devClerkUserId` ONLY when there is no real Clerk session. `requireAuth`
  / `getClerkUserId` fall back to it. Dev user = `DEV_AUTH_CLERK_ID` env or first
  `user_profiles` row, cached for process lifetime.

## Production-safety rule (the important part)
**Why:** keying the bypass off `NODE_ENV` alone is brittle — a staging/misconfigured
deployment with non-production NODE_ENV would silently grant access as a fallback user.
**How to apply:** backend bypass requires BOTH `NODE_ENV !== "production"` AND
`DEV_AUTH_BYPASS === "true"` (defaults OFF, set only in the api-server `dev` script).
Frontend branch is dead-code-eliminated in prod builds via `import.meta.env.DEV`.
Never relax either condition.

## New pages need a DevPreview branch (easy to miss)
`DevPreview` does NOT defer to the production wouter `<Switch>` — it has its own
`if (location.startsWith(...))` chain. A route registered only in `App.tsx` will work
in prod but silently fall through to `DayHome` in dev preview (bottom-nav may still
highlight it). When adding a page, add a branch in `dev-preview.tsx` (and optionally a
`VIEWS` switcher entry) or it cannot be previewed in dev.
