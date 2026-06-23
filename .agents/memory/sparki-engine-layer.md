---
name: Sparki engine-first architecture
description: The 8-engine facade layer in api-server, the route→engine rule, and the smoke harness.
---

# Sparki engine layer

Domain logic lives behind 8 engines in `artifacts/api-server/src/engines/<engine>/index.ts`:
profile (hub), recovery-load, coaching, training-plan, route, onboarding, knowledge, integration.

**Rule:** routes (and jobs) import domain logic ONLY from `../engines/<engine>`,
never from `../lib/<helper>` directly. Engine index.ts files are curated facades
that re-export (or own) the public surface; the implementations still live in
`lib/`. Internal lib→lib calls are an engine's private detail.

**Infra stays in lib (NOT engines):** auth (`requireAuth`/`getClerkUserId`),
flags (`resolveFlags`/`isAdmin`), notifications, privacy, nutrition-rules, logger.
Cross-cutting tables (feature_flags, privacy, notifications, activity_imports,
nutrition, invitations, bug_reports, races) are intentionally not one of the 8.

**Owned-logic moved out of routes:** `computeZones` → profile engine,
`computeLoad` → recovery-load engine (were inline in routes/athlete.ts).
`computeReadiness` lives in lib/sharing but is exposed via recovery-load; the
coach/parent sharing-access fns from the same file are exposed via coaching.

**Smoke harness:** `src/tests/smoke.ts`, run `pnpm --filter @workspace/api-server
run test:smoke` (needs DATABASE_URL; added to build.mjs entryPoints). Pure checks
always run; read-only DB checks run against first `user_profiles` row (or
`DEV_AUTH_CLERK_ID`) and SKIP (not fail) when no seeded user. Never mutates.

**Why:** app read as "loose screens"; engines give each domain one testable
boundary. Full design + table ownership + per-user-OAuth decision in
`docs/engine-architecture.md`.
