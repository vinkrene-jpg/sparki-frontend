---
name: Post-merge integration breaks (concurrent task agents)
description: Why publish/build can fail right after several task agents merge, and how to catch it.
---

When multiple task agents merge concurrently, an earlier task's code can reference
modules, exports, or DB columns that a later task refactored or renamed. esbuild
(api-server) only fails on missing *module* paths; type-only imports and missing
DB columns slip past esbuild but fail `tsc`. So a green dev server is NOT proof a
publish will succeed.

**Why:** A real incident — the route generator task reorganized flat routing files
(`ors.ts`, `route-generator.ts`, `route-geometry.ts`) into a provider-based
`lib/routing/` module (`getRoutingProvider()`, `RoutingProvider` interface,
`selectRoutingProfile`, `summarizeTrack` in `gpx-parse.ts`). The autonomous training
schedule task, written earlier, still imported the old paths/symbols and old
`routes` columns (`startName`, `bikeType`, `trainingType`). Publish failed at the
api-server build step (4 "Could not resolve") before any deployment logs existed.

**How to apply:** After any batch of concurrent task-agent merges, before suggesting
deploy, run BOTH `pnpm run typecheck` (needs `pnpm --filter @workspace/db run build`
first for project-reference declarations) AND `pnpm --filter @workspace/api-server run build`.
"No deployment logs found" from the logs tool means the failure is at build time,
not runtime — look at the build step, not production logs.

- Post-merge check dekt nu ook sparki-mobile: esbuild resolve over alle app/components/hooks/lib/constants-bronnen met RN-native resolveExtensions (.native.* eerst, .web.* nooit); bare packages worden niet gebundeld (RN Flow/JSX breekt esbuild) maar geverifieerd als node_modules-symlink in het mobiele artifact. Let op: een onResolve-plugin draait vóór esbuild's `alias`-optie — "@/…" moet de plugin zelf via build.resolve afhandelen.
- Na een taak-merge draait het platform alle test-workflows automatisch opnieuw; die groene runs gelden als bewijs — alleen niet-workflow (shell)tests hoeven dan nog handmatig.
