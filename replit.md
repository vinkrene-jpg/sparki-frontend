# Sparki — AI Performance Center

An AI-powered cycling performance app for athletes, coaches, and parents — migrated from Next.js/Vercel to a Replit pnpm monorepo.

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
- **Development Preview Mode** — dev-only. When the Vite dev server runs (`import.meta.env.DEV`), `App.tsx` renders `<DevPreview>` instead of the auth-gated router, mounting the exact production components (no duplication) with a fixed dev switcher bar (Landing/Home/Train/Feed/Lab/You) driven by wouter location. Backend pairs this with `devAuthBypass` middleware that resolves a dev user when no real Clerk session exists. Fully disabled in production: frontend branch is dead-code in prod builds; backend bypass requires BOTH `NODE_ENV !== "production"` AND `DEV_AUTH_BYPASS=true` (fails closed otherwise).

## User preferences

- Do NOT redesign UI or change the Sparki design language (dark bg #040506, cyan accent oklch(0.82 0.16 200), Inter Variable font).
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
