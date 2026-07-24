---
name: Expo static build port + Metro watch traps
description: Why the mobile production build can hang/fail and why the expo dev workflow crashed on ENOENT watch
---

**Rule 1 — Metro port must be probed, never assumed.** The mobile production build (`scripts/build.js`) spawns `expo start` on a fixed port. When that port is busy, expo asks an interactive "Use port X instead?" question, gets skipped in non-interactive mode, and the script hangs until its 60s health-check timeout, then exits 1.
**Why:** the mockup-sandbox dev server sits on 8081 in dev; any co-running process can occupy it during a deploy build too.
**How to apply:** `ensureFreeMetroPort()` probes the default and falls back to 8090–8139; explicit `METRO_PORT` fails fast if busy; an already-healthy Metro on the port is reused.

**Rule 2 — Metro's file watcher must blockList volatile generated dirs.** Parallel api-server test runs delete/recreate `dist-tests/*`, and Metro's fs.watch on those paths throws ENOENT and kills the whole expo dev workflow.
**How to apply:** `metro.config.js` adds `resolver.blockList` regexes for `artifacts/*/dist*` output dirs.

**Also:** `static-build/` is partially tracked in git (only the sound wav assets). Any local run of the mobile build wipes it — restore tracked files afterwards. A deploy build with only 2 header log lines means it died before any artifact build ran (infra-side), not a code failure.
