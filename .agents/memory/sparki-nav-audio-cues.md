---
name: Sparki live nav audio & waypoint honesty
description: Waypoint arrivals sanitized server-side; mobile cue engine + audio rules (silent-mode respect, dedupe, settings shared with web).
---

- Waypoints are shape-givers, never destinations. ORS emits per-segment arrive/depart steps; sanitize at the SOURCE (extractSteps) AND on every read path (old saved nav arrays still contain them). Keep only first depart + last arrive; a detour-via gets a silent "Tussenstop" row, never an arrival.
  - **Why:** riders got finish flags/sounds mid-route at each waypoint.
  - **How to apply:** any new route read/generation path must run `sanitizeNavSteps`; mobile keeps its own copy for offline-saved routes.
- Cue engine must be a pure function (`decideCues`) tested with node:test — dedupe per step:phase (GPS jitter re-triggers otherwise), speed-dependent announce distances, off-route cue once per episode, max one step at a time.
- Audio honesty: `playsInSilentMode:false` (never force sound past the phone's silent switch), `shouldPlayInBackground:true`, duckOthers; all playback best-effort (nav never crashes on audio failure).
- Sound/voice toggles live in `/api/nav-settings` (`soundCues`/`voiceCues`, absent=true so old rows stay on); mobile caches in AsyncStorage and PUTs the FULL settings shape (server validates whole object). `customFetch<T>` returns parsed JSON, not a Response.
- api-server standalone unit tests go in `src/tests/<name>.ts` + `run-test.mjs` script (node:test works there); running tsx directly on a `src/lib/**.test.ts` hits ERR_MODULE_NOT_FOUND/esbuild pressure in this env.
