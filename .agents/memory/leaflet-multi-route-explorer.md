---
name: Leaflet full-screen explorer traps
description: Crashes when building multi-route Leaflet overlays (no initial view, queued invalidateSize on removed map)
---

Two Leaflet crash traps hit while building the full-screen kaart-verkenner:

1. **Adding layers to a map without a view crashes `bringToFront`.** A map created with `L.map(el)` but no `setView`/`fitBounds` yet has no panes ready; adding polylines then calling `bringToFront()` throws "Cannot read properties of undefined (reading 'parentNode')".
   **How to apply:** always `map.setView(...)` a placeholder view at creation (fitBounds corrects it right after), and do `bringToFront` after the fit.

2. **Queued `setTimeout(() => map.invalidateSize())` fires on a removed map** in dev StrictMode double-mounts → "_leaflet_pos undefined" crash.
   **How to apply:** guard the timer with `if (mapRef.current === map)`.

**Why:** both surfaced only at runtime (typecheck clean); e2e testing caught them.
