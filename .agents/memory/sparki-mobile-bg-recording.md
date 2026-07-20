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
- Buffer is in-memory only — an OS kill mid-ride loses it (follow-up: persist).
- Real background behavior only testable in a device dev build, not Expo Go web.
