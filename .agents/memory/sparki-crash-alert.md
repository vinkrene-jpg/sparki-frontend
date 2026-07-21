---
name: Sparki val-alarm (web navigator)
description: Crash-alert detection + honesty rules for the web route navigator
---
- The 30 s "was fast" window must be tested only when the stillness latch STARTS; once latched, count stillness freely — re-checking the window at fire time misses stops that begin 20–29 s after the last fast fix.
- **Why:** architect review caught real incidents being skipped; the state machine fired only if the fast fix was still <30 s old after 15 s stillness.
- Honesty: backend `notified` counts targeted links (notification rows created), NOT confirmed deliveries — UI copy must say "melding klaargezet voor X" and always point to 112, never "X personen gewaarschuwd".
- Dismiss = 5-min snooze or every traffic light after a sprint re-triggers the modal.
