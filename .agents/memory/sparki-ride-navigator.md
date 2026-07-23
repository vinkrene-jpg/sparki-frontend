---
name: Sparki ride-navigator upgrades
description: How the live route-follow screen handles cadence, avg speed, route visibility, and per-ride group gating.
---

# Ride-navigator (route-navigator.tsx + use-power-meter.ts)

- **Cadence is derived from Cycling Power Service crank data (0x2A63), not a separate CSC service.** The crank fields (cumulative crank revs + last crank event time, 1/1024 s) sit AFTER the optional pedal-balance/torque/wheel fields, so the byte offset must be computed from the flags bitfield (bit0=+1, bit2=+2, bit4=+6, bit5=crank present). cadence = dRevs*1024*60/dTime with both values wrapping at 65536. Many meters don't report crank data → cadence stays null (honest, never fabricated).
- **Any unexpected BT disconnect (`gattserverdisconnected`) must clear watts, cadence AND crankRef** — otherwise stale metrics linger and the first cadence after reconnect is computed against an old crank baseline. Keep symmetric with manual `disconnect()`.
- **Average speed is a MOVING average** (accumulate distance/time only when instantaneous ≥3 km/h, skip dt>15s signal gaps). This is the honest interpretation of the user's "don't count the last meters before a traffic light" — there is no traffic-light data source, and excluding near-stationary time covers the stop itself. Do NOT fabricate traffic-signal geofencing.
- **Bordjes/sprint game is gated behind a per-ride "met anderen" (group) toggle** (default solo). Solo hides the card, board markers, and disables arming/scoring.
  - **Gotcha:** flipping the toggle mid-ride must reset the sprint refs (`seededBehindRef=false`, `doneBoardsRef=new Set()`, `spokenBoardRef=null`, clear armedBoard) via an effect on `withOthers`. Without this, re-enabling group mode retro-awards boards passed while solo.
- **Route line = dark casing (#0a1420 w9) UNDER a bright line (#22d3ee w5)** so it stays visible on satellite; plain cyan `ACCENT` was too faint. Direction chevrons (white, dark outline) placed every ~0.35 km along the path, rotated to local `bearingDeg`.
- **Map-style + group + sensor pairing live behind one collapsible "Instellen" panel** (`setupOpen`) — treated as one-time per-ride setup, not permanently on screen.
- **Ritafronding & herstel (2026-07):** pure helpers (avg-speed, klimfases komt/op/top/einde, snapBarOffset, summarizeRide, buildRideGpx) live in `lib/nav-live.ts` with own tests — the navigator must call them, not re-implement inline math. Ride restore uses sessionStorage SavedRide; EVERY successful "klaar met rit" path (opslaan in Sparki én bewaar-als-route) must `clearSavedRide()` or a next session ghost-restores an old ride; a `pagehide` + unmount persist is the last-resort save between periodic persists.
- **API contract for ride save:** POST `/api/activity-imports` {fileName,content} → `sessionId: number|null` (number, not string); Strava availability comes honestly from GET `/api/share/session/:id` capabilities — never assume.

## Uitlegkaart "Navigeren met Sparki" (route-panel)
- Marketing/uitleg-copy over navigatie moet uit de CODE afgeleid zijn, niet uit aannames: web/PWA-navigator kan live volgen + schermaanwijzingen + afwijkingswaarschuwing + ritregistratie (auto-pauze/hervat, tussentijdse persist ⇒ geen dubbele rit), maar GEEN achtergrond/scherm-uit (geen wake lock) en GEEN gesproken afslagen (speech alleen val-check + bordjes). Toestemming wordt pas bij navigatiestart gevraagd. Nooit "de Sparki-app op je telefoon" noemen vanaf web — de Expo-app is daar niet te openen.
