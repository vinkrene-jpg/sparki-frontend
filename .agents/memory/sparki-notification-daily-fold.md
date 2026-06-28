---
name: Sparki daily notification fold
description: In-app notification bell groups to at-most-one entry per calendar day; emails/push unchanged.
---
The in-app notification center (bell) folds notification rows into at-most-one
entry per athlete calendar day (Europe/Amsterdam), purely at presentation time.

**Why:** athletes were getting multiple in-app notifications on busy days and it
felt like spam. Requirement: max one in-app entry per day.

**How to apply:**
- Grouping is pure/presentation-only — the underlying `notifications` rows are
  NEVER mutated or collapsed. They stay for email delivery, dedupe, and history.
- This applies to in-app ONLY. Email stays one-per-subject with its
  idempotency/sentAt logic; push is a separate channel — leave both alone.
- Single-notification day → returned unwrapped (no "1 ding" wrapper). Multi → one
  combined entry ("Je hebt N dingen voor vandaag" today / "N meldingen" + date
  earlier), members listed under it.
- The unread badge counts DAYS with unread notifications (max 1/day), via a
  DISTINCT-date-in-Ams-tz SQL count — not the raw unread row total.
- Marking a combined day read = batch-mark all that day's member ids
  (POST /api/notifications/read-batch { ids }), so the whole day flips at once.
- Day boundary uses Europe/Amsterdam (Intl en-CA day key), matching the Dutch
  audience's "vandaag" — not UTC slicing.
