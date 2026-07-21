---
name: Sparki route-paspoort
description: Overpass and Open-Meteo gotchas behind the route insight endpoint
---

# Route-paspoort (route insight)

- **Overpass around-linestring queries time out (504).** `around:R,lat1,lon1,lat2,...` chains over route points are too heavy for overpass-api.de even with few points. **How to apply:** query a padded bounding box of the route instead (cheap, reliable) and filter locally by haversine distance to dense route samples (signals ≤35m of a sampled point; forest share from bbox way vertices). Skip honestly (null) when the bbox spans >~1°. Overpass also requires a `User-Agent` header (406 without).
- **Open-Meteo hourly `time` is local ISO without offset.** Never match it against a hardcoded `Europe/Amsterdam` hour key. **Why:** wrong forecast hour outside NL. **How to apply:** compute `epochMs = Date.parse(time+":00Z") - utc_offset_seconds*1000` per slot and pick the nearest slot to the requested epoch (honest null when >90 min away).
- Dev smoke tests against owner-checked routes must seed rows for the dev-bypass user (`/api/auth/me` clerkId), not the first `user_profiles` row.
