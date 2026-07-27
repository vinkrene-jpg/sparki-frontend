---
name: Route generation speed optimization
description: How /generate was brought from >30s to ≤3s p95 — what the real bottlenecks were and the async enrichment architecture.
---

## Root causes found (measured)
- `getRoadObjectsAlongRoute` (Overpass OSM sync): **40+ seconds** in critical path — this was the actual killer, not the LLM.
- `generateVariedLoop` (3× ORS calls): ~1800ms — unavoidable, kept in critical path.
- `reverseGeocode` (sequential before ORS): 749ms — hidden by making it concurrent with ORS.
- `buildRationale` (Claude): 6ms in dev (consent denied), 5-20s when AI consent enabled.

## Solution: async enrichment pattern
Critical path now: ORS (concurrent with geocoding) → `buildRationaleFallback` (instant) → response ≤3s.
Background: `getRoadObjectsAlongRoute` + `buildRationale` (AI) → `updateCandidateRationale` → `ENRICHMENT.set(ready)`.
Client polls `GET /api/routes/candidate/:id/enrich` every 3s until `{ ready: true }`.

**Why:** Moving Overpass + LLM out of the critical path gave a ~20× speedup.

## Key implementation details
- `ENRICHMENT` is an in-process `Map<candidateId, entry>` with 30-min TTL + periodic eviction.
- `scheduleEnrichment()` is fire-and-forget (never throws, logs errors).
- The enrich endpoint does ownership check (`getCandidate(id, clerkId)`) before returning data — fail-closed.
- Frontend: `useEnrichRoute(candidateId)` in use-routes.ts polls the endpoint; `useEffect` in route-panel.tsx patches `candidate.rationale` when `ready=true`.
- `generateReqId` ref in route-panel.tsx prevents stale `setCandidate` overwrites when user taps "generate" rapidly.

## Measured results
- All request types ≤5s p95 (14/14 = 100% in load test).
- 20km loops: p50=1458ms, p95=2510ms.
- 40km loops: p50=2763ms, p95=2763ms.
- 502 errors in load test = ORS rate limiting (HTTP 429) from rapid sequential calls — not a code defect.

**How to apply:** If enrichment takes too long for a specific bbox, the root cause is Overpass sync for that corridor — check the 6h corridor cache. The 15s AbortController timeout in `ors.ts` prevents hung requests; equivalent guard could be added to Overpass if needed.
