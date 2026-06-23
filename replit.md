# Sparki — Performance Center

A Sparki-powered cycling performance app for athletes, coaches, and parents — migrated from Next.js/Vercel to a Replit pnpm monorepo.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/sparki run dev` — run the Sparki web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run build` — generate TypeScript declarations for lib/db
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — auto-provisioned by Clerk setup
- Dev-only env: `DEV_AUTH_BYPASS=true` — enables Development Preview Mode (auth/onboarding bypass). Set by the api-server `dev` script. Optional `DEV_AUTH_CLERK_ID` pins which dev user to resolve (defaults to first `user_profiles` row).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + TanStack Query + Tailwind v4
- API: Express 5 + `@clerk/express` + Drizzle ORM
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Auth: Replit-managed Clerk (cookie-based, no Bearer tokens in web)
- Font: Inter Variable (`@fontsource-variable/inter`)
- Build: esbuild (CJS bundle for api-server)

## Where things live

- `artifacts/sparki/` — React+Vite frontend (`@workspace/sparki`)
- `artifacts/api-server/` — Express API server (`@workspace/api-server`)
- `lib/db/src/schema/` — Drizzle schema: `users.ts`, `athlete-profiles.ts`, `links.ts`
- `artifacts/sparki/src/App.tsx` — ClerkProvider, routing, protected routes
- `artifacts/sparki/src/contexts/UserContext.tsx` — user profile context (sync, role switching)
- `artifacts/sparki/src/components/sparki/screen-shell.tsx` — shared shell with role-switcher
- `artifacts/api-server/src/routes/auth.ts` — `/api/auth/sync`, `/api/auth/me`, `/api/auth/me/role`
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — Clerk FAPI proxy (prod only)

## Architecture decisions

- **Auth is cookie-based** on web — never add `Authorization: Bearer` or `setAuthTokenGetter` to frontend API calls. Clerk session cookie is sent automatically via Vite proxy (dev) or same-origin (prod).
- **Roles stored in own DB** (`user_profiles.roles[]`, `active_role`) — NOT in Clerk metadata. Roles: `athlete` (default), `coach`, `parent`.
- **JIT provisioning** via `POST /api/auth/sync` — called automatically from `UserContext` on first sign-in. Frontend sends email + displayName; backend upserts `user_profiles` + `athlete_profiles`.
- **`publishableKeyFromHost`** is used on both server (`clerkMiddleware`) and client — never raw `VITE_CLERK_PUBLISHABLE_KEY`. Required for multi-domain/custom-domain support.
- **Vite proxy** (`/api` → `http://localhost:8080`) handles dev API calls so cookies work without CORS. Set `API_SERVER_PORT` env var to override if API port changes.
- **`lib/db` must be built** (`pnpm --filter @workspace/db run build`) for TypeScript project references to resolve types in `api-server`. esbuild works without it; `tsc --noEmit` needs it.

## Product

- **Landing page** (`/`) — public, unauthenticated users see branded Sparki landing with sign-in/sign-up CTAs. Authenticated users see the Training Day Home directly.
- **Sign-in / Sign-up** (`/sign-in`, `/sign-up`) — custom Clerk-themed pages matching the dark Sparki design language (dark bg, cyan accent, Inter Variable font, Sparki bolt logo).
- **Protected app routes** (`/train`, `/feed`, `/lab`, `/you`) — redirect to `/sign-in` when not authenticated.
- **Role switcher** — in the `ScreenShell` header for users with multiple roles; cycles through `athlete`/`coach`/`parent`. Sign-out button alongside.
- **Cinematic background** — lives in `ScreenShell` (shared by Home/Train/Feed/Lab/You). A `fixed` layer keeps the cyclist (`/concept-lab.png`) visible behind the whole page with subtle parallax: image ~0.56 opacity, softened blue-black gradient overlay, drifting atmospheric haze, bottom vignette for nav legibility, OLED-safe base `#05070e`. Text over the background uses soft dark scrims (not boxes). Cards are frosted glass `bg-[#070d16]/[0.82] backdrop-blur-md` with subtle light borders so the background shows through (~18%).
- **Development Preview Mode** — dev-only. When the Vite dev server runs (`import.meta.env.DEV`), `App.tsx` renders `<DevPreview>` instead of the auth-gated router, mounting the exact production components (no duplication) with a fixed dev switcher bar (Landing/Home/Train/Feed/Lab/You) driven by wouter location. Backend pairs this with `devAuthBypass` middleware that resolves a dev user when no real Clerk session exists. Fully disabled in production: frontend branch is dead-code in prod builds; backend bypass requires BOTH `NODE_ENV !== "production"` AND `DEV_AUTH_BYPASS=true` (fails closed otherwise).

## User preferences

- **Fix-before-review rule.** Any error discovered during a task that (a) crashes a page, (b) fails a build, (c) breaks an API contract, (d) throws a runtime exception, or (e) causes a TypeScript error MUST be fixed before the task is offered as "Ready for Review" — even if it is pre-existing or unrelated to the change. "Out of scope", "not caused by my changes", and "needs a separate task" are NOT acceptable when the fix lives in this same codebase. Only genuine exceptions: external systems outside the repo, missing access rights, paid external services, or dependencies owned by another repository. A task is Ready for Review only once every discovered crash/runtime exception in the touched functionality is resolved (or made explicitly technically impossible).
- **User-facing copy is plain Dutch — no English tech-jargon.** The audience spans youth riders, parents and coaches of varying ages/levels, so menu and UI labels must be plain Dutch (e.g. nav = Vandaag/Training/Races/Nieuws/Inzicht/Profiel, not Home/Feed/Lab/You). Every drill-in view needs an obvious top-anchored way back ("Terug"/"Sluiten"); never leave a form or page exitable only by scrolling to the bottom. Internal scene/route keys may stay English; rendered strings may not.
- **No user-facing "AI" wording — ever.** Everything is framed as Sparki itself: "Sparki sees", "Sparki thinks", "Sparki coaching", "Sparki news", "Sparki memory". Never show the term "AI" (or "A.I.", "AI Coach", "AI brief", etc.) anywhere a user can read it — UI labels, copy, error messages, brand lines. Internal code identifiers/filenames may keep "ai" but no rendered string may.
- **Never build static mock-UI in the frontend.** Every feature/screen must be backed by real, working backend data — no fabricated/placeholder content, no mock data files driving the UI. If real data isn't available yet, build the real source (DB/API/integration) for it.
- Keep the Sparki design language: dark, premium, cyan/neon accent oklch(0.82 0.16 200), Inter Variable font. The home/app background is a **cinematic blue-black** treatment (NOT flat black) — see "Cinematic background" below. Do not revert it to a flat #040506 wash or add white surfaces / pastel UI / generic card-dashboard styling.
- Do NOT touch existing training/AI/routes/events/nutrition/recovery/coach/parent feature pages.
- Phase 1 only: auth, accounts, roles, protected routes, role switching.

## Gotchas

- **`@layer clerk` must come before `@import 'tailwindcss'`** in `index.css` — and `tailwindcss({ optimize: false })` in `vite.config.ts`. Without this, Clerk UI breaks in prod builds.
- **`proxyUrl={clerkProxyUrl}` is unconditional** — the env var is empty in dev (intentional). Never gate it on `NODE_ENV`.
- **Clerk proxy middleware is prod-only** — in dev, Clerk talks to FAPI directly. Do not test the proxy in dev.
- **lib/db TypeScript declarations** — run `pnpm --filter @workspace/db run build` after schema changes for `tsc --noEmit` to pass in api-server. esbuild is unaffected.
- **API server port** — defaults to 8080 (Replit-assigned). Vite proxy uses `API_SERVER_PORT` env var with 8080 fallback.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.local/skills/clerk-auth/references/setup-and-customization.md` for Clerk wiring rules
