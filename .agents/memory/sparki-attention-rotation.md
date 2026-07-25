---
name: Sparki aandacht-rotatie
description: Rotation of ignored non-critical ride-along messages on Vandaag — design rules, honesty constraints, and the fail-open trap.
---

# Aandacht-rotatie (ignored ride-along messages)

Rule: a non-critical ride-along item (meerijder-nudge, releasekaart, onderhoudssignaal in context "vandaag") shown on 3 distinct Amsterdam calendar days without action pauses; it may return at earliest 4 days after its last showing (snoozedUntil is exclusive — visible again ON that day, so effectively 3 hidden days). Cycle repeats; nothing is ever hidden forever.

**Why:** a "ketting 3800 km" nudge sat unchanged on Vandaag for a week; ignored messages must make room for others (or rest) without dishonestly silencing real situations.

**How to apply:**
- Never rotate: health signals, `vastgesteld_defect`, pilot/consent steps, security/privacy. Enforce BOTH client-side (no key generated) and server-side (key allowlist `nudge:`/`release:`/`onderhoud:` + forbidden fragments → 400).
- Suppression is presentation-only and applies **next visit** — no cache invalidation after reporting seen, a card never disappears mid-view.
- Impressions are idempotent per Amsterdam day via ONE guarded UPDATE (WHERE lastSeenOn < today AND not snoozed) with CASE logic in a single statement — race-safe without transactions.
- Keys carry situation identity (e.g. `onderhoud:<level>:<componentId>`): a worsened level = new key = fresh attention.
- **Fail-open trap:** consumers must treat a query ERROR as "nothing suppressed" (`ready: isSuccess || isError`, empty set on error). Gating render on `isSuccess` alone hides all nudges forever during an endpoint outage — the architect flagged exactly this.
- Report "seen" only for items actually rendered; session-level dedupe Set is fine (server idempotency backs it up).
