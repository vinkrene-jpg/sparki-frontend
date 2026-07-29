#!/bin/bash
set -e
pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
pnpm --filter db push

# Build checks: catch merges that removed a package/module the app still
# imports (previously caused a silent hanging load screen in the web app).
# 1) Fast esbuild resolve checks: sparki web entrypoint + sparki-mobile
#    sources (RN-native resolution; bare packages verified in node_modules).
node scripts/post-merge-build-check.mjs
# 2) api-server esbuild build catches stale cross-task imports server-side.
pnpm --filter @workspace/api-server run build
