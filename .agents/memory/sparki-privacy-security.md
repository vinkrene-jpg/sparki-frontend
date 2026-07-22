---
name: Sparki privacy & accountbeheer (Afbouwgolf 3)
description: Durable rules for export/deletion, audit log, rate limiting, legal versioning, minor fail-closed sharing.
---

- **Export is schema-driven**: account export walks information_schema for tables with a clerk_id column, so new tables are auto-included — but token/secret-like column values must be masked at the export layer, never trusted per-table.
- **Deletion honesty**: 14-day recovery window via privacy_settings.deleteRequestedAt; execution writes a REQUIRED audit row with an explicit *exceptions register* (things that cannot be deleted, e.g. object-storage bytes have no delete API). Clerk deleteUser is guarded to ids starting `user_` so test/dev seeds never hit Clerk.
- **Audit writes are fire-and-forget** (`void writeAudit`) — tests must sleep ~300ms before asserting the row exists. Audit table timestamp column is `at`, not createdAt.
- **Rate limiter** is in-memory per-process sliding window; audit on block is damped (1/min per bucket). Test hook: `SPARKI_RATE_LIMIT_MULTIPLIER`. Cheapest way to test 429: hammer a low-max scope with intentionally-invalid bodies (each still counts).
- **Minor fail-closed rule**: <16 (from birthDate; unknown age is NOT minor) forces coachSharingLevel to "none" unless parentConsentStatus==="accepted" — enforced in the sharing resolver, so every coach surface inherits it.
- **Legal texts** are lazy-seeded on first GET with a version; acceptance stores acceptedXVersion+date and a consent_change audit — re-accept needed per new version, UI compares acceptedVersion===doc.version.
- **Why**: privacy law (AVG) + honesty doctrine — never claim deletion/export coverage that isn't real; unremovable data must be named, not hidden.
