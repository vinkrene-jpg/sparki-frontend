---
name: Sparki Clerk Auth Wiring
description: Phase 1 auth decisions — cookie auth, JIT provisioning, roles in own DB, lib/db TypeScript declarations.
---

# Sparki Clerk Auth — Phase 1 Decisions

## Rule: Auth is cookie-based, never Bearer tokens on web
`@clerk/express` + session cookie on all browser API calls. `requireAuth` uses `getAuth(req).userId`. No `setAuthTokenGetter`, no `Authorization: Bearer` in frontend. Mobile (Expo) would use bearer tokens only.

**Why:** Clerk web auth is fully cookie-managed. Adding token auth to web requests causes double-auth bugs and 401 loops.

**How to apply:** If a web API call returns 401, debug cookies/middleware ordering — never add token handling to fix it.

## Rule: Roles stored in own Postgres DB, not Clerk metadata
`user_profiles` table: `clerk_id PK, email, display_name, roles text[], active_role text`. Valid roles: `athlete` (default), `coach`, `parent`.

**Why:** Clerk metadata has limited querying, no relational integrity, and adds Clerk API round-trips on every request.

**How to apply:** Use `PUT /api/auth/me/role` to switch; `UserContext.switchRole()` on frontend. Never write roles to Clerk publicMetadata.

## Rule: JIT provisioning via POST /api/auth/sync
Called automatically by `UserContext` (`artifacts/sparki/src/contexts/UserContext.tsx`) on every sign-in. Body: `{ email, displayName }`. Uses `onConflictDoNothing()` so it's safe to call multiple times. Also creates `athlete_profiles` row.

**Why:** Avoids needing a webhook from Clerk; simpler and works with dev/prod parity.

## Rule: lib/db must be built before api-server tsc passes
`pnpm --filter @workspace/db run build` generates `.d.ts` into `lib/db/dist/`. Without this, `tsc --noEmit` on api-server fails with "Module '@workspace/db' has no exported member X". esbuild (runtime) is unaffected — it reads source directly.

**How to apply:** Run after any schema change. Already added to lib/db's package.json scripts.

## Rule: Vite proxy for dev API calls
`artifacts/sparki/vite.config.ts` proxies `/api` → `http://localhost:${API_SERVER_PORT ?? 8080}`. This makes all `/api/...` calls same-origin so Clerk session cookies are sent automatically without CORS complications.

## Clerk wiring constants (copy verbatim)
```ts
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL; // empty in dev, auto-set in prod
```

## CSS layer order (Tailwind v4)
`index.css` must have `@layer theme, base, clerk, components, utilities;` BEFORE `@import 'tailwindcss'`. `vite.config.ts` must use `tailwindcss({ optimize: false })`. Without this, Clerk UI breaks in prod builds.

## Wouter route syntax (exact, no substitutions)
```tsx
<Route path="/sign-in/*?" component={SignInPage} />
<Route path="/sign-up/*?" component={SignUpPage} />
```
`/*?` is the only syntax matching both bare URL and Clerk OAuth sub-paths.

## SignIn / SignUp must have routing="path" and full path
```tsx
<SignIn routing="path" path={`${basePath}/sign-in`} ... />
```
`path` must be the full browser path (including basePath) because Clerk reads `window.location.pathname` directly.
