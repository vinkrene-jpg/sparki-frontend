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
- **Admin & gezondheidscheck** (`/admin`, `/admin/health/:checkKey`) — admin-only. An automated Health Check engine probes every dependency for real (auth, database, Sparki-denkkracht, routes/kaarten, connectors, meldingen, onboarding, uitnodigingen, ouder-toezicht, koppelingen, feedback, bugmeldingen, nachtelijke scan) and shows four honest statuses: groen (werkt) / oranje (let op) / rood (storing) / grijs (nog niet gekoppeld). Nothing is ever a fake green — unwired capabilities (e-mail, GPS, GPX-export, bestandsopslag, niet-beschikbare connectors) are GREY with a plain-language reason and detect presence rather than assume. Each failure has user-impact + remediation + a detail page with history, "Opnieuw testen" and "Markeer als opgelost". "Controleer nu" runs the full engine on demand. A CLI job (`pnpm --filter @workspace/api-server run job:health`, modes `daily`/`weekly`/`release` via `HEALTH_CHECK_MODE`) backs Scheduled Deployments; `release` mode exits non-zero on unresolved red failures (pre-release gate).
- **Development Preview Mode** — dev-only. When the Vite dev server runs (`import.meta.env.DEV`), `App.tsx` renders `<DevPreview>` instead of the auth-gated router, mounting the exact production components (no duplication) with a fixed dev switcher bar (Landing/Home/Train/Feed/Lab/You) driven by wouter location. Backend pairs this with `devAuthBypass` middleware that resolves a dev user when no real Clerk session exists. Fully disabled in production: frontend branch is dead-code in prod builds; backend bypass requires BOTH `NODE_ENV !== "production"` AND `DEV_AUTH_BYPASS=true` (fails closed otherwise).
- **Vraag Sparki chat** (`sparki-chat-overlay.tsx` + `sparki-input-center.tsx`) — the chat opens from the **SPARKI mark in the ScreenShell header** (blue-dot wordmark, every screen → a button), as a portal overlay (z-[80], above the bottom nav; X/backdrop/Escape close, body-scroll lock). Composer is two rows: row 1 = text input + send, row 2 = attachment options (foto/bestand/link). The **visible thread is session-scoped**: only turns from the current app-open are shown (module-level `SESSION_START` filters `createdAt >= SESSION_START`); the full history stays in the DB (Sparki's memory) for privacy-gated analysis and is never deleted to achieve a "fresh start". Newest turn stays in view (bottom anchor). It lives ONLY in the header overlay (removed from the Nieuws/Feed page).
- **Smart Missing Input Flow** — app-wide rule: a missing-data/empty-state message is NEVER a dead-end. Every empty-state explains what's missing in plain Dutch, offers ≥1 action button to the exact input flow, returns the user to where they came from, and retries the original action. A single registry (`lib/missing-input.ts`, `INPUT_TARGETS`) is the source of truth for each input target (label, route, `?focus` token, plain-Dutch why, and a `isSet(profile)` presence check). Navigation hooks (`hooks/use-missing-input.ts`): `useStartFix()` navigates `route?focus=&returnTo=&retry=`; `useCompleteFix()` returns to `returnTo?retry=`; `useRetryAction(key, fn)` fires the original action once on `?retry` match then strips the param. `components/sparki/missing-input-notice.tsx` is the reusable notice (targets→buttons, plus optional `actions`/`primary`); `ftp-estimate-wizard.tsx` lets users estimate FTP when they don't know it (saves `ftp` + `ftpEstimated=true`). `/you` reads `?focus` to auto-open + scroll + highlight the matching editor (ftp/weeklyHours/weight/sportProfile/goal/checkin/connections) and calls `completeFix()` on save. Flagship "Nog geen schema" lives in `three-week-plan.tsx` (canBuild gate; "Ik weet mijn FTP niet" → wizard; auto-runs generate on return). Wired across `/train`, `/lab`, `/races`, `/you` (≥15 situations). **Gotcha:** never pass a `targets` set that can be fully satisfied without also supplying `actions`/`primary` — when every target's `isSet` is true the notice renders zero buttons (a dead-end). `/train`'s "no workout" state branches on `missingTargets(...)`: incomplete profile → target buttons; complete profile → primary "Bouw mijn plan" that scrolls to `#three-week-plan`.

- **Wedstrijdkalender-import** (`/races` → "Uit kalender") — instead of typing every race by hand, athletes import from external calendars matched to their sport. Backend engine in `artifacts/api-server/src/lib/calendar/` (dependency-free regex parsers; honest empty/failure, never fabricated): **Fietssport** (fietssport.nl/toertochten — full, exact date resolved on select via detail `<title>`), **We-Tri** (we-tri.nl/competition — full, exact dates in the table), **KNWU** (knwu.nl/kalender — `status: "limited"`: only the ~5 server-rendered "Komende wedstrijden" are readable; the full calendar + personal inschrijvingen live in the `mijn.knwu.nl` SPA which exposes no reachable API/login, so it is NOT faked and carries a plain-Dutch note). Routes (`routes/calendar.ts`, `requireAuth`): `GET /api/calendar/sources` (+ `recommended` from athlete `sport`/`discipline`), `/search?source&q&type&from&to&limit` (30-min in-memory cache), `/event?source&url` (date/GPX enrich, SSRF host-allowlist in `lib/calendar/html.ts`). Frontend: `hooks/use-calendar.ts`, `components/sparki/import-from-calendar.tsx` (source pills defaulted to recommended, debounced search, real results, honest empty/error/limited states), `lib/calendar-types.ts`. Picking an event prefills `EMPTY_FORM` (name/raceDate/location/discipline/distanceKm + a "Geïmporteerd uit …" note) then opens the existing RaceForm for review before save — no auto-write.

## User preferences

- **Fix-before-review rule.** Any error discovered during a task that (a) crashes a page, (b) fails a build, (c) breaks an API contract, (d) throws a runtime exception, or (e) causes a TypeScript error MUST be fixed before the task is offered as "Ready for Review" — even if it is pre-existing or unrelated to the change. "Out of scope", "not caused by my changes", and "needs a separate task" are NOT acceptable when the fix lives in this same codebase. Only genuine exceptions: external systems outside the repo, missing access rights, paid external services, or dependencies owned by another repository. A task is Ready for Review only once every discovered crash/runtime exception in the touched functionality is resolved (or made explicitly technically impossible).
- **User-facing copy is plain Dutch — no English tech-jargon.** The audience spans youth riders, parents and coaches of varying ages/levels, so menu and UI labels must be plain Dutch (e.g. nav = Vandaag/Training/Races/Nieuws/Inzicht/Profiel, not Home/Feed/Lab/You). Every drill-in view needs an obvious top-anchored way back ("Terug"/"Sluiten"); never leave a form or page exitable only by scrolling to the bottom. Internal scene/route keys may stay English; rendered strings may not.
- **No user-facing "AI" wording — ever.** Never show the term "AI" (or "A.I.", "AI Coach", "AI brief", etc.) anywhere a user can read it — UI labels, copy, error messages, brand lines. Internal code identifiers/filenames may keep "ai" but no rendered string may.
- **Neutral voice — state the observation/advice directly; never narrate Sparki perceiving or thinking.** User-facing copy must NOT use third-person narrator framing like "Sparki ziet…", "Sparki denkt…", "Sparki leest je als…", "Sparki kijkt (na)…", "Sparki weet…", "Sparki merkt op", "Sparki zag…", "Sparki baseert dit op…", "Wat Sparki van je weet", "Sparki's beeld van jou". State the conclusion itself ("Je vorm stijgt", "Andere mogelijke verklaringen:", "Wat vandaag opvalt", "Gebaseerd op …", "Terugkerende patronen"). Loading states are neutral ("Bezig…", "… wordt opgesteld…"), never "Sparki denkt na…". The brand name "Sparki" still appears as a genuine label/CTA/direct address ("Vraag Sparki", "Sparki, eerlijk?", "Sparki Core", "Sparki-denkkracht") and in honest assistant-action/error lines ("Sparki kon nu geen voorstel maken", "Sparki neemt het mee"). This supersedes any earlier "everything framed as 'Sparki sees/thinks'" guidance — the no-"AI" rule stays, but the voice is neutral, not a perception narrator.
- **Never build static mock-UI in the frontend.** Every feature/screen must be backed by real, working backend data — no fabricated/placeholder content, no mock data files driving the UI. If real data isn't available yet, build the real source (DB/API/integration) for it.
- **Sparki is an intelligent assistant, not a registration app — every screen is an "intelligent werkblad", never a form (APP-WIDE LAW).** This is the single most important product doctrine and applies to EVERY surface (Training, Wedstrijden, Wedstrijdkalender, Profiel/Core, Gezondheid, Voeding, Slaap, Materiaal, Routes, Samen, Nieuws, Inzichten, Onboarding, Instellingen — no exceptions). The flow is always: **Sparki gathers everything available first → combines data from all connected sources → analyses it → draws conclusions → proposes → the user only checks, confirms, and fills the genuinely-missing gaps.** The user must NEVER be asked to re-enter data that already exists anywhere (profile, DB, connectors, or derivable from other fields). Before rendering, every screen must answer: (1) Which data can I fetch myself? (2) Which can I derive? (3) What is *genuinely* missing? (4) Which single question yields the most new knowledge? (5) What advice can I already give now? (6) How confident am I? Only *after* that may Sparki ask a question — one targeted question, not a blank form. Honesty contract still holds: when Sparki cannot find or derive something, it says so plainly (never fabricates) and asks for exactly that gap, with a way back. The `/you` Core page is the reference implementation of this doctrine.
- Keep the Sparki design language: dark, premium, cyan/neon accent oklch(0.82 0.16 200), Inter Variable font. The home/app background is a **cinematic blue-black** treatment (NOT flat black) — see "Cinematic background" below. Do not revert it to a flat #040506 wash or add white surfaces / pastel UI / generic card-dashboard styling.
- Do NOT touch existing training/AI/routes/events/nutrition/recovery/coach/parent feature pages.
- Phase 1 only: auth, accounts, roles, protected routes, role switching.

## Gotchas

- **`@layer clerk` must come before `@import 'tailwindcss'`** in `index.css` — and `tailwindcss({ optimize: false })` in `vite.config.ts`. Without this, Clerk UI breaks in prod builds.
- **`proxyUrl={clerkProxyUrl}` is unconditional** — the env var is empty in dev (intentional). Never gate it on `NODE_ENV`.
- **Clerk proxy middleware is prod-only** — in dev, Clerk talks to FAPI directly. Do not test the proxy in dev.
- **lib/db TypeScript declarations** — run `pnpm --filter @workspace/db run build` after schema changes for `tsc --noEmit` to pass in api-server. esbuild is unaffected.
- **API server port** — defaults to 8080 (Replit-assigned). Vite proxy uses `API_SERVER_PORT` env var with 8080 fallback.
- **`isAdmin()` is dev-bypass aware** — in dev with `DEV_AUTH_BYPASS=true` it returns `true` so the dev-preview user can preview admin-only screens (incl. `/admin`). In production it falls back to the `SPARKI_ADMIN_IDS` allowlist. Set `SPARKI_ADMIN_IDS=clerk_xxx,clerk_yyy` in prod Secrets to grant real admins. The health-check `release`-mode CLI exits non-zero on unresolved red checks — wire it before promoting a build.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.local/skills/clerk-auth/references/setup-and-customization.md` for Clerk wiring rules
