---
name: api-server test build race (shared dist)
description: Why parallel api-server test workflows flake with "The service was stopped", and the safe way to run/fix them.
---

# api-server test workflows flake when run concurrently

Every `test:*` workflow runs `pnpm run build` first, and `build.mjs` does `rm -rf dist`
then rebuilds ALL entry points into the SAME `dist/` folder via one esbuild call.

When two or more test workflows run at the same time, one process wipes/writes `dist/`
while another is building or executing from it → esbuild dies with
`Error: The service was stopped` and the workflow shows FAILED. This is a build-tooling
race, NOT a logic failure — each test passes when run alone.

**How to apply**
- To green these flaky checks, restart them STRICTLY sequentially: wait for each to fully
  finish before starting the next. Overlapping even the *build* phase of two of them
  re-triggers the race (observed: restarting a second workflow while the first was still
  building made the first fail with "service was stopped").
- Log files rotate per run; `ls -t` may surface a stale failed log. Trust the
  `system_log_status` (finished vs failed), not the newest file on disk.

**Root-cause fix (not yet done)**: give each workflow an isolated build
outdir, or add a build lock in `build.mjs`. Deploy-critical file — validate the prod
build after any change. Left unfixed intentionally rather than gambling a subtle
concurrency change on a freshly-published app.
