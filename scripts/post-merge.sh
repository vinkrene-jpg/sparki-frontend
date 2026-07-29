#!/bin/bash
set -e
pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
pnpm --filter db push

# Build checks: catch merges that removed a package/module the app still
# imports (previously caused a silent hanging load screen in the web app).
# 1) Fast esbuild resolve check over the sparki web entrypoint.
node scripts/post-merge-build-check.mjs
# 2) api-server esbuild build catches stale cross-task imports server-side.
pnpm --filter @workspace/api-server run build
