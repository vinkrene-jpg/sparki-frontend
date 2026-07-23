---
name: Sparki nav HUD layout & off-route choice
description: Mobile turn-by-turn — climb-panel map shrink, free-camera no-snap-back, bounded metrics, 3-choice off-route card with anti-reroute-spam.
---

- Pure layout core (`lib/nav-layout.ts`): climb panel height is measured via onLayout, bounded by `computeNavLayout`, and the map lives in an absolute wrapper with `height: navLayout.mapHeight` — overlay never overlaps the map; null panel restores full height. **Why:** absolutely-positioned overlays on top of MapView silently hide map content; shrinking the container is the only honest fix.
- Free camera: `cameraForLocation` returns null when not following → no `animateCamera` call at all (no snap-back on pinch/pan/rotate). Follow is restored only by the explicit "Terug naar mijn positie" button. Gesture detection needs BOTH `onPanDrag` and `onRegionChange` with `isGesture` (pinch/rotate don't fire onPanDrag).
- Bounded HUD metrics: `chooseMetricLayout(value, unit, widthPx, fontScale)` stacks the unit under the value when it won't fit — always account for `PixelRatio.getFontScale()`, or large accessibility fonts clip digits.
- Off-route: pure state machine in `lib/off-route-choice.ts`. One card per off-route *episode*; "negeren" registers a dismiss that stays silent until the deviation grows materially; `allowNewRejoinRequest` gates rejoin calls on cooldown OR real movement (no reroute loop). Race routes (`usageType === "wedstrijd"`) get return-prioritized option ordering; the stored route is NEVER replaced — detour stays a client-only overlay (backend rejoin mode "bestemming" just targets the route end).
- **How to apply:** any new nav overlay must go through computeNavLayout (measure→bound→shrink map), and any new automatic reroute trigger must pass the episode/dismiss/cooldown gates.
