---
name: Deployment liveness probes the bare service base path
description: Why the api-server must answer 200 on its bare mount root ("/api"), not only the configured startup health path
---

# Deployment liveness probes the bare service base path

The Replit autoscale deployment platform probes the **bare service base path**
(the artifact's `paths = ["/api"]` root) as an ongoing liveness check, in
addition to the configured `[services.production.health.startup] path`
(e.g. `/api/healthz`).

If the bare path has no handler it returns 404 locally / 500 in production, the
platform marks the deploy unhealthy and keeps terminating+restarting the
process. Symptom in deploy logs: repeated `healthcheck /api returned status 500`
interleaved with `artifact process exited with error signal: terminated`, even
though `/api/healthz` returns 200 and the app clearly boots (seed/backfill logs
run).

**Rule:** the api router must answer 200 on BOTH its mount root and its
`/healthz` path. Concretely, the health router (mounted at the `/api` router
root via `router.use(healthRouter)`) needs `router.get("/", ok)` in addition to
`router.get("/healthz", ok)`.

**Why:** the configured startup path only gates first-boot readiness; the
liveness probe on the bare path is separate and will flap the deploy forever if
it never gets a 200.

**How to apply:** when a fullstack publish "won't stay up" / "republish gives
problems" but the app runs fine in dev, check deploy logs for
`healthcheck <service-base-path> returned status 500` and confirm the bare path
returns 200 (`curl localhost:8080/api`), not just the healthz path.
