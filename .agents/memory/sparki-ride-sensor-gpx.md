---
name: Ride Bluetooth sensor values in GPX
description: How live BLE watts/HR/cadence get into saved rides and backend sessions
---

- Recorder samples live sensor values 1×/s into a ref; matched to GPS points by nearest timestamp (≤5s window) at GPX build time. JS timers pause when backgrounded, so screen-locked stretches are honestly GPS-only (never interpolated); UI says so while recording.
- GPX convention: `<power>` element + Garmin `gpxtpx:hr`/`gpxtpx:cad` inside `<extensions>`; declare `xmlns:gpxtpx` only when sensor data is actually written.
- Backend `parseGpx` reads these prefix-agnostically and feeds avgPower/HR/cadence + powerBests (same collector as FIT/TCX) into the canonical activity → TSS derivation works for phone rides.
- **Gotcha:** `GpxSummary` fields are required (not optional) — adding fields breaks test fixtures constructing summary literals; the api-server test file keeps a MIRROR of the mobile `buildRideGpx` that must be updated in lockstep.
