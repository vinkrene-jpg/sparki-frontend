---
name: Sparki mobile background ride recording
description: How the Expo ride recorder keeps recording GPS while backgrounded/locked
---

Ride recording must keep capturing GPS when the phone is locked/backgrounded.
`useLiveLocation` (foreground `watchPositionAsync`) alone stops the track.

Design:
- `lib/ride-tracker.ts` (native) defines a module-scope `TaskManager.defineTask`
  fed by `Location.startLocationUpdatesAsync` (BestForNavigation + Android
  `foregroundService`). It keeps an in-memory buffer of real fixes and a
  subscriber set. `lib/ride-tracker.web.ts` is a no-op stub (browsers have no
  background task) reporting `background:false`.
- `useRideRecorder` picks ONE path automatically: background buffer
  (subscribe + rebuild filtered track each emit) when bg permission granted,
  else the foreground `location` prop path. Never both (double-count guard via
  `backgroundActiveRef`).
- Permissions: request foreground (required) then background (optional).
  Distinguish `backgroundDenied` (explicit deny → honest "alleen met scherm aan"
  note) from unavailable (web/capability) which must NOT over-warn.

**Why:** riders lock the phone mid-ride; foreground-only silently truncated the
track. Honesty contract: no fixes ⇒ empty track, never fabricated.

**Gotchas:**
- `defineTask` executor must be `async` (return Promise) or tsc errors.
- app.json needs iOS `infoPlist.UIBackgroundModes:["location"]`, Android
  background+foreground-service permissions, and the `expo-location` config
  plugin (`isAndroidBackgroundLocationEnabled`/`isAndroidForegroundServiceEnabled`).
- Real background behavior only testable in a device dev build, not Expo Go web.

Crash recovery (implemented): fixes persist incrementally to AsyncStorage
(`sparki:active-ride`, `{startedAt,points}`, throttled ~4s + flush on stop).
Module hydrates buffer from disk once at load and the background task `await`s
that BEFORE appending — otherwise a headless OS relaunch (empty module) would
overwrite the real captured track. Foreground-only path mirrors via
`persistForegroundRide`. Store cleared only on save/reset/discard (NOT on stop),
so a crash between stop and save can't lose it. Hook exposes `recoverable` +
`discardRecovered`; record.tsx offers "Onafgemaakte rit gevonden → Opslaan/
Verwijderen". Honesty: recovery needs ≥2 real fixes, never fabricated.

Sensor samples ride along: the persisted snapshot also carries `sensorSamples`
(mirrored from the hook via `persistRideSensorSamples`, hydration restores it
too so a headless relaunch never clobbers it), and both recovered-save paths
pass `recoverable.sensorSamples` into the GPX save. Background/lockscreen
stretches stay honestly sensor-less (JS interval pauses).

**Test-harness gotcha:** the ride-tracker test's `?fresh=N` cache-busting
import does NOT re-evaluate the module under tsx — module state (buffers,
one-shot hydration) is shared across "fresh" imports. Any assertion that needs
genuine hydration must live in the FIRST test (the only true evaluation).
