---
name: Sparki releasegroepen & gecontroleerde uitrol
description: Golf 14 — releasegroepen, flags+rollout-%, kill switches, 426-versiecheck, foutregistratie, auto-stop guards
---

Rules that must hold for the release/rollout system:

- **Rollout auto-stop is per flag, never global.** `rollout_guards.flagKey` counts ONLY critical `error_events` with a matching `flag_key`; a global counter lets one broken feature kill unrelated flags.
  **Why:** architect flagged the global-count version as a blocking functional + DoS bug.
- **Anonymous error reports can never be "kritiek".** `/api/release/errors` is unauthenticated by design (crashed clients may lack a session); server downgrades anonymous kritiek→fout, and guard counting also requires `clerkId IS NOT NULL` — double barrier against forced auto-stops.
- **426 handling needs a latch, not just an event.** Web `api.ts` stores the block message in module state (`getVersionBlockMessage()`); `VersionBlockScreen` initializes from it so a 426 arriving before mount still blocks. Mobile uses the same latched pattern in `lib/release.ts`.
- **Shared fetch client extensions:** `lib/api-client-react` custom-fetch has `setDefaultHeaders` (lowest priority in header merge) and `setErrorStatusHandler` (called on !ok before ApiError, try/catch-wrapped). Mobile release wiring builds on these.
- Kill-switch guard sits on `router.use` prefix → every path under it 503s when active; cache is deliberately fail-open on DB read errors (availability over enforcement).
- Version cache + kill-switch cache are 10s in-process; tests must import `invalidateVersionCache`/`invalidateKillSwitchCache` in-process.
- Test: `test:rollout` (11 scenarios) — run via shell, workflow limit reached.
