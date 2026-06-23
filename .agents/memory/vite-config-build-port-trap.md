---
name: Vite config PORT/BASE_PATH build trap
description: Why module-level throws on PORT/BASE_PATH in vite.config.ts break deploy builds.
---

# vite.config.ts must not hard-throw on PORT/BASE_PATH at module load

Several artifact `vite.config.ts` files read `process.env.PORT` / `BASE_PATH` at
module top-level and `throw` when missing. These vars are injected for the **dev
server** (workflow), but NOT during `vite build`. So `pnpm run build` (the deploy
build, which runs `vite build` for every artifact) crashes with
"PORT environment variable is required" before any bundling happens → publish fails.

**Rule:** Gate env requirements on build command. Use the function form
`defineConfig(({ command }) => { const isServe = command === "serve"; ... })` and
only `throw` for missing PORT/BASE_PATH when `isServe`. Provide build-time
fallbacks: `Number(process.env.PORT ?? "5173")` and `base: process.env.BASE_PATH ?? "/"`.

**Gotchas when refactoring:**
- Keep the config function **synchronous** (return a plain object). An
  `async ({command}) => Promise<...>` does NOT match vite's `defineConfig`
  overloads here → TS2769. Move dev-only `await import(...)` plugins (cartographer,
  dev-banner) to a module-scope `const devPlugins = ... ? [await import...] : []`
  (top-level await is allowed in ESM config) and spread them into `plugins`.

**Why:** `vite build` runs for ALL artifacts in the monorepo recursively, including
dev-only ones like `mockup-sandbox`. Any single artifact whose config throws at load
fails the whole deploy build.

**How to apply:** When adding/auditing any artifact's vite.config.ts, never throw on
env at module top-level — gate on `command === "serve"`.
