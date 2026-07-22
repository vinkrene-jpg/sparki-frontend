---
name: Sparki AI-helpdesk & supportautomatisering
description: Golf 27 support engine — deterministic answer matrix, minor fail-closed, ticket dedupe race-safety, keyword-regex stem trap.
---

# Sparki support helpdesk (Golf 27)

- **Deterministic decision matrix first, prose second.** `decideAnswer` decides direct/beperkt/storing_bekend/meer_info/mens deterministically; the LLM (gateway purpose "helpdesk") only verbalizes provided sources and returns null honestly — never invents an answer.
- **Sensitive topics always human.** Privacy/account-deletion/payment/health/minor → `humanRequiredReason`; `humanSendRequired` hard-blocks auto-send in beheer. Minors (or unknown age, fail-closed) only get auto-answers for gebruik/training/mechanieker.
- **Ticket dedupe must be race-safe.** Read-then-insert dedupe on open ticket per (clerkId, errorGroup/knownIssue) creates duplicates under parallel asks. Fix: whole find-or-create in ONE `db.transaction` with `pg_advisory_xact_lock(hashtext(key))` first statement. **Why:** architect flagged duplicate-ticket spam under concurrency; regression test fires 3 parallel asks and asserts one row.
- **Dutch keyword regex stem trap (recurring):** `\b(...|synchronis|verwijder|...)\b` — trailing `\b` after a stem never matches inflected forms ("synchroniseren", "verwijderen"). Always write stems as `stam\w*` inside boundary groups. This silently broke both category classification and known-issue matching (question fell through to a different category so the issue never matched).
- **How to apply:** any new Dutch keyword classifier in Sparki: use `\w*` on stems; any find-or-create with a uniqueness promise: advisory-xact-lock in one transaction (pg Pool driver supports it).
