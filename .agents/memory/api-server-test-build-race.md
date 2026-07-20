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

**Root-cause fix (DONE)**: each api-server `test:*` now runs `node ./scripts/run-test.mjs <name>`,
which builds ONLY that test into its own isolated `dist-tests/<name>` dir (via `build.mjs`
env `DIST_DIR` + `BUILD_ENTRIES`) and then runs it. Parallel tests no longer share/wipe
`./dist` or touch the running server's build → race gone, and single-entry builds are far
faster/lighter (also killed the thread-exhaustion `errno=11`).

**Why:** the shared-`./dist` full rebuild was the sole cause; isolating output per test is
the durable fix, not sequential restarts.

**How to apply:**
- New api-server test scripts MUST use `node ./scripts/run-test.mjs <name>` — never reintroduce
  `pnpm run build && node ./dist/tests/<name>.mjs`.
- `run-test.mjs` recursively locates the emitted `<name>.mjs` because the pino esbuild plugin
  perturbs output layout — don't assume a fixed path.
- Non-test scripts (jobs/seeds/scan/start) still use the full `pnpm run build` into `./dist`.
