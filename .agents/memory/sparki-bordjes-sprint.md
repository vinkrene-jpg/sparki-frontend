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

## Still pending (follow-up phases)
- Free-ride live board detection (client reverse-geocode; nav currently
  planned-route only), real Web Bluetooth power (Cycling Power Service 0x1818),
  the live 5s wattage overlay on a power+speed rise, and extras
  (season ranking UI, share to Samen, KOM segments, badges).
