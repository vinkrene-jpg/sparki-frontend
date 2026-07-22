---
name: Sparki gezondheids- & herstelflow
description: Golf 26 unified health/injury/recovery flow — status raises-only, recovery only via explicit resume step, resumption window, honest check-in context.
---

# Sparki gezondheids- & herstelflow (Golf 26)

- **Raises-only statussync**: complaints with training impact raise `athlete_profiles.health_status` (ziekte>blessure); nothing ever lowers it implicitly. "Hersteld" via an interim complaint update is a hard 400.
- **Recovery is one explicit gate**: `POST /api/health-flow/resume` is the ONLY path back to ok. It 409s while an active niet_trainen complaint is open AND 409s when status is already ok with no open complaints (no sneaky opbouwvenster from a no-op call); otherwise closes complaints and starts the opbouwvenster (7 days, loadFactor < 1, honest day counter).
- **Why**: a single gate prevents the status silently flipping healthy from side paths (quick-set, updates, syncs) while the athlete is still ill.
- **Check-in asks only what's missing** today (`/checkin-context` ask[]); the sheet renders only the 5 question keys (feel/fatigue/sleep/soreness/stress), never derived signals like hrv.
- **Safety info default share OFF** — sharing emergency medical info is opt-in, fail-closed.
- **Mobile customFetch returns parsed JSON**, not a Response — no `.ok`/`.json()`; type via `customFetch<T>()`.
- Quick-set `HealthStatusControl` stays on day-homes; the detailed flow lives only on `/lichaam` (deliberate split).
