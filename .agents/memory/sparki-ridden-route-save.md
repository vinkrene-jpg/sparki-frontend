---
name: Save ridden ride as re-ridable route
description: Where ridden-ride geometry lives and how "save as route to ride again" works honestly.
---

- Ridden-ride GPS geometry is NOT stored in canonical tables (`training_sessions` has only summary metrics; Strava summary activities carry no polyline; `connector_activities.raw` may or may not contain a track). The ONLY honest source of a re-ridable track is a GPX ingest (file upload or the mobile recorder, which serializes RidePoint[] → GPX and POSTs to `/api/activity-imports`).

- To make ridden rides re-ridable, GPX ingest persists the real track shape into `activity_imports.parsedSummary.route` (`{geometry, profile, climbs, distanceKm, elevationGainM, trackName}`, derived from `parseGpxRoute`). `parsedSummary` is jsonb so no migration was needed. Only NEW gpx uploads get it — older imports honestly have no `route` and cannot be saved.

- `POST /api/routes/from-activity {importId}` builds a `routes` row (`source:"ridden"`, `nav:null`) from that stored track, owner-checked by clerkId. Honest 422 when geometry is absent/malformed; never fabricates a path.

**Why:** honesty contract — a re-ride must trace the athlete's real ridden line, never an invented one, and gaps must be stated plainly.

**How to apply:** if extending to Strava/other sources, first persist a real geometry at ingest; do not synthesize a track from summary metrics. Ridden GPX has no turn semantics → nav stays null (navigator shows the line without invented directions).
