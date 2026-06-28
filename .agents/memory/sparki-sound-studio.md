---
name: Sparki Sound Studio
description: Original royalty-free audio identity + in-app wekker (alarm) — architecture, honesty boundary, and web-alarm pitfalls.
---

# Sparki Sound Studio (Phase 1)

Original, royalty-free Sparki audio identity ("Sparki Pulse") + a working in-app
configurable wekker. Foundation + first "Performance" pack (6 sounds).

## Layout
- Sounds: `artifacts/sparki/public/sounds/sparki/<pack>/<file>.mp3`, served at
  `${BASE_URL}sounds/sparki/<pack>/<file>` (BASE_URL has trailing slash).
- Registry SSOT: `artifacts/sparki/src/lib/sound/registry.ts` (pack → event/alarm map).
  Adding a pack/sound = registry + files only; backend just stores the chosen string id.
- Player: `lib/sound/manager.ts` (singleton: autoplay-unlock on first gesture, master
  enabled/volume, play(event)/preview, alarm loop + stop).
- Prefs: per-athlete `audio_preferences` (clerkId PK, cascade FK); engine
  `engines/audio` + `routes/audio.ts` (GET/PUT `/api/audio/preferences`, requireAuth).

## Honesty boundary (do NOT fake)
A web app CANNOT reliably ring on a locked phone / when the tab is closed. The
in-app wekker only fires while the app is open. This must be stated plainly on
`/geluid` (lock-screen note) — push is best-effort/future phase. Never imply a
real alarm-clock guarantee.

## Pitfalls learned
- **Wekker dedupe must use LOCAL date components**, not `toISOString()` (UTC).
  The trigger compares local `getHours()/getMinutes()/getDay()`, so the
  "already fired today" guard must key on `getFullYear/getMonth/getDate` or it
  mis-keys around timezone offsets / day boundaries.
- **Optimistic prefs mutation must capture a concrete restore value even on the
  first write** (no prior cache). Return `prev ?? {preferences: base}` from
  `onMutate`, restore it in `onError`, and `invalidateQueries` in `onSettled` so a
  failed PUT never leaves the optimistic change stuck on screen.
- **Sanitize pack/alarmSound as path-segment ids** (`/^[a-z0-9-]{1,40}$/`) — they
  become URL path segments on the client; reject anything else (no `../`).
- New page must be wired in BOTH `App.tsx` (route + SoundProvider mount) AND
  `dev-preview.tsx` (view branch + VIEWS pill) or it won't render in dev preview.
