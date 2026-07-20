---
name: Sparki mobile nav app
description: Expo/React Native Sparki app (artifact sparki-mobile) — turn-by-turn cycling navigation sharing the web backend.
---

# Sparki mobile navigation app

Expo Router app in `artifacts/sparki-mobile`, Mapbox tiles, Clerk email/password auth, shares `@workspace/api-client-react` + the same api-server/DB.

## react-native-maps has no working web build
A runtime `Platform.OS !== "web"` guard is NOT enough — Metro statically bundles every top-level import, so `require("react-native-maps")` crashes the web bundle (500).
**Fix:** platform-split component. `components/RouteMap.tsx` (native) holds the `react-native-maps` import + camera-follow (`animateCamera` via internal ref, driven by `following` prop + location); `components/RouteMap.web.tsx` returns null. Metro picks `.web.tsx` on web automatically. The screen renders `<RouteMap/>` only when `Platform.OS !== "web" && hasMapbox && hasGeometry`, else an honest `MapFallback` that still shows route facts + full turn list (never a dead-end).

## Project-reference libs need a dist rebuild after src export changes
`api-client-react` tsconfig is `composite` + `emitDeclarationOnly` → consumers resolve it via `dist/*.d.ts`, NOT `src`. After editing `lib/api-client-react/src/index.ts` (e.g. re-exporting `customFetch`), rebuild with `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json` or the stale dist declarations make downstream typecheck fail with "no exported member".
**Why:** the mobile tsconfig lists it under `references`, so tsc trusts the emitted declarations.

## Clerk expo error handling
`useSignIn/useSignUp` `errors.fields.x.message` is typed `{}` under strict TS (reference doc ignores this). Instead read the returned `{ error }` from `signIn.password()/verifyEmailCode()` and extract via a small `clerkErrorMessage(e)` (checks `errors[0].longMessage/message`, then `message`) into local `generalError` state.
