---
name: Leaflet divIcon HTML sink (XSS)
description: L.divIcon({html}) is a raw HTML sink; user-authored map-marker labels must be escaped + server-sanitised.
---

# Leaflet `L.divIcon({ html })` is a raw HTML injection sink

Any value interpolated into the `html` string of a Leaflet `divIcon` (or
`bindPopup`/`bindTooltip` HTML) is rendered as raw HTML. If that value is
user-authored (e.g. a meeting-point / "verzamelpunt" name typed by the user),
a payload like `<img src=x onerror=...>` executes when the marker renders.

**Rule:** never interpolate untrusted text into divIcon/popup HTML unescaped.

**How to apply:**
- Client: HTML-escape the label before interpolation (escape `& < > " '`), or
  build the DOM node and set `textContent`. In Sparki this lives in
  `route-map.tsx` `mpIcon`.
- Server: defence-in-depth — strip/normalise markup when persisting the field
  (Sparki `parseMeetpoints` strips `< >` from name/note). Don't rely on a single
  layer; the same stored string can later flow into another HTML sink.

**Why:** found in T006 route-builder review — meetpoint names rendered into a
divIcon without escaping. Both layers (escape at sink + sanitise at store) are
required because sanitisation alone can be bypassed by reuse and escaping alone
leaves dirty data in the DB.
