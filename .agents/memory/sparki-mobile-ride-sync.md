---
name: Mobile ride sync & safety-feature lifecycle
description: Durability and lifecycle rules for the mobile upload queue and fall detection
---

Rules:
- Any UI claim "de rit staat veilig op je telefoon" must be backed by a fail-closed persistence write: propagate storage errors from the enqueue path; never swallow setItem failures and still report success. During queue processing a write failure may be tolerated (item already on disk; backend dedupes GPX by content).
- Safety-feature state machines (fall detection) must be fully reset when the ride/session ends, and closing an alert (any phase) must snooze like "Ik ben oké" — otherwise stale fast-phase state or continued stillness re-triggers false alarms in the next session.
- Sprint results dedupe server-side via additive client_key + partial unique index (clerk_id, client_key WHERE NOT NULL) + onConflictDoNothing returning the existing row; client key = route:place:km:10s-bucket assigned at detection.

**Why:** architect review caught both gaps after Golf 8; false crash alarms and silently lost rides are the two worst mobile failures.
