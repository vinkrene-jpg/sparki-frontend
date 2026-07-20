---
name: Sparki bordjes-sprinten
description: Town-sign sprint feature — engine, scoring, board detection, and the mid-route retro-award trap.
---

# Bordjes sprinten (town-sign sprints)

Sprint for the town-name signs ("komborden") along a route. Boards are the
NEW place-name transitions detected by reverse-geocoding sampled route points.

## Honesty
- Places come from the routing provider's reverseGeocode. If not a single
  sample geocodes, detection returns `available:false` — never invent towns.
- Watts are only ever real (Bluetooth meter). Absent watts → speed-only
  scoring, never fabricated power.

## Scoring (deterministic)
- base = 10 per board reached; speed bonus = min(30, round(gainKmh*2));
  watt bonus scales 0→20 for peak 1.5×→3× FTP (only when peak AND ftp exist).

## Detection
- `boardsFromSamples()` is the pure, testable transition core; the first known
  place is the START (not a sprint); nulls skipped; labels normalised on the
  town name (strip ", <gemeente>" suffix); re-entering a town (loop) re-counts.

## Gotchas
- **Mid-route retro-award trap:** on the first GPS fix, seed all boards already
  behind the rider as "done" WITHOUT scoring, else entering mid-route awards
  every earlier board in one tick. (`seededBehindRef`.)
- **Ownership on write:** `POST /api/sprints/result` must verify a planned
  `routeId` belongs to the caller — the read/rescan paths do, the write path
  must too, or a client can attach results to another athlete's route.
- Cancel/"Sla over" = discard (skip the board, no row), not a persisted
  cancelled result. Schema still supports `status:"cancelled"` for future use.

## Free-ride, power, ranking, badges (vervolgfasen)
- **Free-ride sprinting** (no planned route): watch GPS, `POST /api/sprints/place`
  reverse-geocodes the live point; a changed place name = a new bordje. First fix
  only anchors (not scored). `placeName:null` ⇒ no bordje (never fabricated).
- **Web Bluetooth power** (`use-power-meter.ts`): GATT Cycling Power Service
  0x1818, measurement char 0x2a63 (int16 watts at byte offset 2, LE). Wired into
  BOTH route-navigator (planned) and free-ride; `peakWatts5s` sent in submit and
  the SERVER reconciles the true total via `onSuccess` (client shows optimistic
  speed-only first). DOM lacks Bluetooth types ⇒ use `any` casts (no @types dep).
  Unsupported (iOS Safari) ⇒ speed-only, stated plainly.
- **Ranking** (`/api/sprints/season` → `ranking`,`myRank`): friends-only, and a
  friend appears ONLY when they explicitly shared (`shared="true"`) a scored
  sprint this season — never expose private tallies. `ranking:[]`+`myRank:null`
  when nobody else shared.
- **Share to Samen**: `POST /api/sprints/result/:id/share` (owner-checked toggle,
  `shared` text "true"/"false"); social circle-feed injects shared+scored sprints
  (own + friends who opted in) as `type:"sprint"` items.
- **Badges** (`engines/sprint/badges.ts`): pure `deriveSprintBadges` over the
  season tally; locked badges show honest progress, cancelled never count.

## Deferred
- KOM/segment timing NOT built — needs a segment model + timing capture;
  fabrication/dead-end risk, so left as a future task.
