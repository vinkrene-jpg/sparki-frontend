---
name: Test-workflow boot storm (EAGAIN/SIGABRT)
description: Why parallel test-workflow boots crash with esbuild EAGAIN/exit 134 and how the build semaphore + retry runner fix it
---

# Test-workflow resource race on environment boot

The `.replit` runButton ("Project", `mode = "parallel"`) fans out ALL ~20 one-shot
test workflows at once via `workflow.run`, and validation runs can do the same.
Each spawns its own esbuild/tsx build. Booting that many builds simultaneously
exhausts the OS process/thread budget → `spawn ... EAGAIN` and esbuild SIGABRT
(exit 134 / "The service was stopped"). Each test passes fine in isolation — it's
purely a concurrent-boot resource race, not test logic.

**Why not just edit `.replit`:** direct edits to `.replit` are blocked by the
platform ("Direct edits to .replit are not allowed"). So the storm is fixed at the
build layer, not the workflow-orchestration layer. This is more robust anyway — it
holds regardless of whether the storm comes from the parallel run button OR a
parallel validation run.

**Fix (two layers, both in `scripts/`):**
- `scripts/build-semaphore.mjs` — cross-process filesystem counting semaphore
  (slot files in `os.tmpdir()/sparki-build-sem`, default max 3, override via
  `SPARKI_BUILD_MAX_CONCURRENCY`). Every test runner acquires a slot before it
  builds, so only a few esbuild builds compile at once no matter how many
  workflows boot. Stale slots (dead PID or >5min) are reclaimed so a crash never
  deadlocks the rest; on acquire timeout it proceeds rather than block forever.
- `scripts/run-tsx-test.mjs` — resilient tsx runner for the frontend/mobile tests.
  Runs the test, and ONLY on a detected infra crash (SIGABRT/SIGSEGV, exit 134, or
  output matching EAGAIN / "service was stopped" / esbuild-crash signatures)
  retries up to 4× with backoff. A genuine assertion failure (test's own non-zero
  exit + printed report) is passed straight through — never hidden or weakened.

**How to apply / gotchas:**
- Frontend (`@workspace/sparki`) + mobile (`@workspace/sparki-mobile`) test scripts
  call `node ../../scripts/run-tsx-test.mjs <args>` instead of raw `tsx`.
- api-server tests already build via `scripts/run-test.mjs` (isolated `dist-tests/`);
  it now wraps its esbuild build in `acquireBuildSlot` too.
- If you add a new tsx-based test, route it through `run-tsx-test.mjs` so it inherits
  both the concurrency cap and the crash-retry.
