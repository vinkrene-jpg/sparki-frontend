---
name: Sparki web live navigation
description: Where live turn-by-turn navigation runs (web vs phone) and the honesty boundary between them.
---

# Web vs phone navigation boundary

The web app (users call it "de Sparki app") can now navigate a saved route live
in the browser via the Geolocation API — it is NOT phone-only. Turn-by-turn on
the map works on web; the phone app is only needed to RECORD the rit as a
training on the background.

**Why:** users navigate from wherever they open the app; a web route card that
only exported GPX + linked to the phone was a dead-end.

**How to apply:** any route-card / navigation copy must not claim "navigeren doe
je in de telefoon-app". Frame the phone app strictly as the ride-RECORDER /
background-capture path, and keep "phone required" language conditional to
permission-denied / unsupported-browser fallbacks. Honesty: never fabricate a
position; off-route + permission states must stay explicit.
