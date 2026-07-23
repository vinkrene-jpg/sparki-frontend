---
name: Sparki data-trust audit & gegevensbroncontrole
description: How mockdata honesty is guarded app-wide and gotchas in testing the admin gate under dev-bypass.
---

**Rule:** Personal-data surfaces must be honest-empty for empty accounts; the admin "Gegevensbroncontrole" (`/api/admin/data-provenance`) exposes per-surface source table/record-id/count from a fixed constant allowlist — raw SQL identifiers must NEVER come from request data (only `clerkId` is parameterized).

**Why:** Audit requirement: every visible value needs verifiable real provenance; sql.raw with user input would be injectable.

**How to apply:**
- Testing the 403 admin gate under dev-bypass: `isAdmin()` re-reads `DEV_AUTH_BYPASS` per call (unconditionally true when set), but auth's `IS_DEV` is cached at module load — so flip `process.env.DEV_AUTH_BYPASS="false"` mid-test to exercise the real `SPARKI_ADMIN_IDS` list while `x-dev-clerk-id` auth keeps working.
- Older api-server tests leave `user_profiles` residue; full cleanup must delete user+athlete profiles too. World/intel seeds are intentional product features (transparently fictional), not mockdata.
- `test:data-trust` asserts the exact surface-key set to catch silent drift.
