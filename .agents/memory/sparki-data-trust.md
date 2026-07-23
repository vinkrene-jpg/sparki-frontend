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

**Opdracht 0A.1 lessen (FTP/schattingen):**
- Elke importbron die een ECHTE meting schrijft (bv. Strava-FTP) moet de bijbehorende `*_estimated`-vlag expliciet op false zetten, anders blijft de schattingsmotor (FTP-vloer) eroverheen "verbeteren".
- Boot-self-heal in `recalibrateEstimatedFtp`: nieuwste niet-afgeleide ftp_history-rij wint van afgeleide; een nieuwere echte invoer blokkeert auto-raise (alleen voorstel). Prod is read-only voor de agent → herstel loopt via boot/engine of admin-endpoint `POST /api/admin/data-trust/cleanup` (droogdraai standaard, `apply=true`).
- Cleanup-verwijderingen strikt beperken tot importbronnen (`test_type='strava'`); handmatige/coach-rijen nooit aanraken, ook dubbele niet.
- Fiets-autokoppeling: `bikeLinkSource='auto'`-sessies vóór de registratiedatum van de fiets zijn vervuiling; single-bike fallback alleen ≥ registratiedatum.
