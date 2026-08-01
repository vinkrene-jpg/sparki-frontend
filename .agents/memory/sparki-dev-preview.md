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

## Persona switcher (kijk als gebruiker)
The dev bar's "Kijk als gebruiker" switcher lists seeded personas grouped Atleten /
Abonnement / Rol & leeftijd (registry `lib/preview-athletes.ts` PREVIEW_PERSONAS; seed
`seed:preview`). Subscription personas are honestly fail-closed while
variant_feature_grants is empty; coach/ouder personas need seeded accepted links or
their screens are empty. Seed guard: hard-fail on email collision with a non-seed
clerkId (ensureAccount re-links by email!); consentConfirmedAt is a FIXED date for
deterministic re-runs. New roles (ploegleider, diëtist, …) get a registry row + spec
only once the role truly exists — never fake roles the app doesn't know.

## Dev athlete switching (preview multiple seeded profiles)
A dev-only `x-dev-clerk-id` request header lets the preview switch which seeded athlete
is the active user, resolved per-request (not the process-cached default).
**Why:** previewing personality/observation differences across athletes needs to flip
the resolved user live without restarting; must never become a prod auth hole.
**How to apply:** `devAuthBypass` honours the header ONLY when IS_DEV, there is no real
Clerk session, AND a `user_profiles` row actually exists for that id (fail-closed — an
unknown id falls back to the default dev user). Frontend attaches it from a localStorage
store in `lib/dev.ts` via `apiFetch`, guarded by `import.meta.env.DEV`. The
`/api/dev/*` routes are registered only when `NODE_ENV !== "production"`.

## Engine personality/basis strings are sentence fragments
`personality.basis` (and similar engine-resolved phrases) come back lowercase with no
terminal punctuation (e.g. "je rijdt op nationaal niveau"). The UI must capitalize +
punctuate at the render sink — do not assume engine strings are display-ready.

## New pages need a DevPreview branch (easy to miss)
`DevPreview` does NOT defer to the production wouter `<Switch>` — it has its own
`if (location.startsWith(...))` chain. A route registered only in `App.tsx` will work
in prod but silently fall through to `DayHome` in dev preview (bottom-nav may still
highlight it). When adding a page, add a branch in `dev-preview.tsx` (and optionally a
`VIEWS` switcher entry) or it cannot be previewed in dev.

## Flag-gated page VARIANTS are invisible in dev preview (browser-check trap)
The same-path flag switches in `App.tsx` (e.g. flag chooses new vs old page component)
are ALSO bypassed: DevPreview hardwires which component renders per path, so an
unauthenticated browser/screenshot session shows the OLD variant even when the flag is
provably ON server-side. Never conclude "flag is uit" from a dev-preview screenshot.
**How to verify instead:** (1) `curl /api/flags` under the dev bypass — note it resolves
the dev user as head tester, so nearly ALL flags come back true (early access), which is
more than a real user gets; (2) the flag row + overrides read-only in the dev DB;
(3) visual check via a dedicated `/_dev/*` preview branch if one exists; (4) page tests.
Signed-in users go through the real router and DO get the flag-routed variant.

## Dev-preview router is een APARTE route-tabel
DevPreview vervangt de hele App.tsx-Switch (incl. flag-switch pages). Nieuwe of hernoemde routes MOETEN ook in dev-preview.tsx worden bijgewerkt, anders valt de route in de StartPage-fallback of rendert de oude pagina — wat eruitziet als "feature flag staat uit" terwijl /api/flags gewoon true teruggeeft.
**Why:** commercial_shell-verificatie leek te falen op /analyse en /activiteiten; de vlag was in orde, de dev-preview route-tabel was verouderd.
**How to apply:** bij elk nieuw flag-switch-scherm: check zowel App.tsx als dev-preview.tsx.

## Persona-screenshots headless (audit-patroon)
Playwright + Nix-chromium met `addInitScript` die `localStorage["sparki.dev.previewAthlete"]` op een governor-fixture-clerkId zet vóór page.goto → apiFetch stuurt `x-dev-clerk-id` mee en alle schermen renderen als die rol. Werkt voor rol-audits zonder Clerk-login; kanttekening in bewijs: dev-preview-routetabel + head-tester-flags kunnen afwijken van echte sessie.
