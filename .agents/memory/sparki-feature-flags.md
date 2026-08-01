---
name: Sparki Feature Flags
description: Feature flag system — DB schema, resolution precedence, and implementation gotchas.
---

# Sparki Feature Flag System

## Architecture
- `feature_flags` table: global defaults per key (`enabled_globally`, `enabled_roles[]`)
- `user_flag_overrides` table: composite PK `(clerk_id, flag_key)`, per-user `enabled` boolean
- `FEATURE_KEYS` constant exported from `lib/db/src/schema/feature-flags.ts` — single source of truth

## Flag keys (8 total)
`ai_observations`, `strava`, `garmin`, `route_planner`, `coach_portal`, `parent_portal`, `testing_tools`, `premium`

All seeded with `enabled_globally = false`, `enabled_roles = {}` — nothing is on by default.

## Resolution precedence (highest → lowest)
1. User override row in `user_flag_overrides` → wins unconditionally
2. User's `activeRole` in `flag.enabledRoles[]` → enabled for that role
3. `flag.enabledGlobally` → global default
4. `false`

## Admin access
Gated on `SPARKI_ADMIN_IDS` env var (comma-separated Clerk IDs, stored as Replit secret).
No admin role in DB — avoids chicken-and-egg bootstrap problem.

## Frontend
- `FeatureFlagContext` in `artifacts/sparki/src/contexts/FeatureFlagContext.tsx` — fetches `/api/flags` after sign-in
- `useFeatureFlag(key)` hook in `src/hooks/use-feature-flag.ts`
- `<FeatureGate flag="strava">` component in `src/components/sparki/feature-gate.tsx`
- `FeatureFlagProvider` sits inside `UserProvider` in `App.tsx`

## Shared constants package

`lib/feature-flags` (`@workspace/feature-flags`) holds FEATURE_KEYS, FeatureKey, FEATURE_DESCRIPTIONS — no drizzle/pg imports.
Both `@workspace/db` (backend) and `@workspace/sparki` (frontend) import from it.
Must run `pnpm --filter @workspace/feature-flags run build` before typecheck when constants change.
Root `tsconfig.json` references it; `lib/db/tsconfig.json` and `artifacts/sparki/tsconfig.json` both reference it.

## Gotchas

**Express params are `string | string[]`** — always cast with `String(req.params.foo)` before passing to Drizzle `eq()`. Drizzle's `eq()` overloads reject `string | string[]` even though Express params are always `string` at runtime. Never destructure `const { key } = req.params` and pass directly to eq without a cast.

**onConflictDoUpdate.set must not include PK columns** — for `userFlagOverridesTable`, the composite PK is `(clerkId, flagKey)`. The `set` object in `onConflictDoUpdate` must only contain non-PK columns (`enabled`, `setBy`, `reason`, `setAt`). Drizzle's TS types enforce this — including a PK column in `set` causes a "does not exist" overload error.

**Composite PK target syntax** — use `target: [table.col1, table.col2]` (column array, not constraint name) for `onConflictDoUpdate` with composite PKs. This compiles clean.

**Prod-activering van een flag (launch-switch):** géén schrijftoegang tot de prod-DB en geen flag-beheer-UI — de bestaande weg is het boot-seed-patroon in de intel-seed (insert definitierij `enabledGlobally: true` + `onConflictDoNothing` op key; 3e gebruik: commercial_shell, launch 27-07-2026). Rij ontstaat bij de eerstvolgende publish/boot; een latere admin-beslissing (uit) wordt nooit overschreven. Let op: FEATURE_DESCRIPTIONS beschreef de flag nog als de oude "lichte schil" — omschrijvingen verouderen stil.

## Fix: switch-pagina's moeten fail-open zijn

**Probleem:** `useFeatureFlag(key)` retourneert expliciet `false` zolang flags laden (zie jsdoc). Alle vijf switch-functies (VandaagPage, TrainSwitchPage, ActiviteitenSwitchPage, MeerSwitchPage, AnalyseSwitchPage) in App.tsx renderedden daardoor de ScreenShell-legacy-variant (géén DsMobileNav) totdat flags binnenkwamen.

**Fix (27 jul):** alle switch-functies lezen nu `{ flags, isLoading }` van `useFeatureFlags()` en renderen de CommercialShell-variant zodra `isLoading=true` óf `flags.commercial_shell=true`. Alleen als flags geladen zijn én `commercial_shell` expliciet uit staat, valt het terug op de legacy-pagina.

**Patroon:**
```tsx
const { flags, isLoading: flagsLoading } = useFeatureFlags();
if (flagsLoading || flags.commercial_shell) return <CoreXPage />;
return <LegacyPage />;
```

## Nieuwe flag-keys en e2e (01-08-2026)
- Nieuwe FEATURE_KEYS in lib/feature-flags werken pas na `pnpm --filter @workspace/feature-flags run build` ÉN een api-server-herstart — de server resolvet flags uit zijn eigen geladen kopie; anders blijft de key onzichtbaar in /api/flags en faalt e2e stil.
- E2e-flagactivatie per testidentiteit: seed feature_flags-rij + user_flag_overrides via psql (zie e2e/tests/routeplanner-mobiel-v2.mjs); override na afloop opruimen.

## Bindende regel René (01-08-2026): geen per-account-verschillen
- **Regel:** flags staan aan voor iedereen of uit voor iedereen. `user_flag_overrides` niet meer gebruiken; geen rol-/groep-/rollout-differentiatie tijdens de bouwfase. Verschil mag alleen bestaan tussen omgevingen (preview vs. productie).
- **Why:** René kan onduidelijke verschillen tussen accounts (testaccount vs. eigen account) niet hebben — iedereen bouwt en test hetzelfde product.
- **How to apply:** feature af + bewezen ⇒ direct `enabled_globally=true` (of key helemaal verwijderen zoals bij mobile_routeplanner_v2). E2e-tests die een flag nodig hebben zetten hem GLOBAAL en herstellen de oude waarde in finally — nooit een override per testidentiteit achterlaten. Op 01-08 zijn alle 11 dev-overrides verwijderd en rit_verhaal + media_uitleg_motion + media_uitleg_dieptekaart globaal aangezet; prod had 0 overrides.
