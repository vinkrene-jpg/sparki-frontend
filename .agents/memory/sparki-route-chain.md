---
name: Sparki routeketen (bibliotheek, delen, versies, vergelijken)
description: Route library/share/version-usage design decisions and Postgres NULL-uniqueness trap
---

- **Postgres unique + NULL trap:** a unique index on (routeId, audience, targetClerkId) is NOT idempotent for audience-level shares because NULL targets are distinct. Fix at DB level with `unique(...).nullsNotDistinct()` (drizzle `unique()` constraint — `uniqueIndex()` has no `.nullsNotDistinct()` in drizzle-orm 0.45). Dedupe existing rows before push.
  **Why:** repeat share POSTs silently created duplicate rows; app-level check-first has a race.
- **Version semantics:** only inhoudelijke wijzigingen (name/geometry/etc.) bump `routes.version`; presentation flags (favorite, status) never do. Usage rows (`route_version_usages`) snapshot route name + version so history survives route deletion.
- **Soft vs hard delete:** DELETE soft-deletes (deletedAt) only when usage history exists; otherwise hard delete. All read paths must filter `isNull(deletedAt)`.
- **Viewer privacy projection:** shared-route detail nulls nav/waypoints/profile and returns simplified geometry + privacyNote; non-eligible viewers get 404 (fail-closed), including write-ish endpoints like navigatie-start.
- **Ridden-track source:** vergelijk endpoint reads `activity_imports.parsedSummary.route.geometry` (GpxRoutePayload object), not a bare array — support both shapes, honest 422 when neither.
