---
name: pino worker-transport flakiness in short-lived processes
description: Why pino-pretty's worker transport intermittently crashes tests/jobs, and the sync-stream fix.
---

# pino worker-transport flakiness

`pino` with `transport: { target: "pino-pretty" }` runs the prettifier in a **worker thread** (via `thread-stream`). In short-lived processes (one-shot tests, CLI jobs) the worker races with process exit, throwing intermittently:
- `TypeError: worker is not a function` (worker failed to start)
- `Error: the worker has exited` (a log write lands after the worker already exited)

These are **flaky**, not deterministic — the same test passes when run again directly. So a single red validation run does not mean the test logic is broken; suspect the logger transport first.

**Fix (the durable rule):** in dev, attach pino-pretty as a **synchronous in-process stream** instead of a worker transport:
`pino(options, PinoPretty({ colorize: true, sync: true }))`. Production stays plain JSON `pino(options)`. No worker → no thread-stream → no race. Lives in `artifacts/api-server/src/lib/logger.ts`.

**Why:** the whole api-server (server + every test + every job) shares one logger module; the worker transport made every short-lived process a flake risk. The jobs had already hand-worked-around it with synchronous stdout summaries.

**How to apply:** never reintroduce a worker-thread `transport` in a logger imported by tests/jobs. If pretty dev logs are wanted, use the sync stream form. `esbuild-plugin-pino({ transports: [...] })` in `build.mjs` only matters if a worker transport is used — harmless to leave, but not required by the sync-stream approach.
