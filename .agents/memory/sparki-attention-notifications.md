---
name: Sparki contextuele aandacht & meldingen
description: Central notification layer contract — category registry, critical categories, resolutionKey lifecycle, quiet hours channel semantics.
---

# Sparki contextuele aandacht & meldingen

**Rule:** every notification type maps to exactly ONE category in a central registry (`TYPE_CATEGORY`); preferences, quiet hours and the read path all consult that single source. Critical categories (privacy, veiligheid) can never be switched off.

**Why:** per-producer ad-hoc categories drift and make "kan ik dit uitzetten?" unanswerable; safety/privacy signals must always reach the user.

**How to apply:**
- New notification producers must pass `category` implicitly via type (registry) and set `source`; role-directed ones set `audience`.
- Situational notifications (a fixable problem: sync down, reconfirmation needed, maintenance due) get a `resolutionKey`; the fix path calls `resolveNotifications`. One open situation = one row (open-dedupe in create). After resolve, a NEW occurrence may create a new row — that's intended.
- Informational notifications that go stale get `expiresAt` instead. Read path/counters must always apply `activeNotificationFilter` (not resolved, not expired). Rows are never deleted — history stays.
- Quiet hours (Europe/Amsterdam local, midnight-spanning windows work) suppress ONLY push+email for non-critical; in-app rows always exist (in-app is the baseline channel — `channelInApp` toggle exists but rows are always created by design). Critical: push always delivers (even with channelPush off), email follows the email toggle. Email skipped during quiet hours keeps `sentAt` NULL so a later run retries.
- HH:MM prefs validated at PUT (regex + paired window 400); invalid/equal start=end means "no window".

**Gotcha:** deduping by `resolutionKey` checks open rows only (`resolvedAt IS NULL`) — do not also add a dedupeKey for the same situation or the post-resolve re-notification breaks.
