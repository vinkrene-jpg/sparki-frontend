---
name: Feature-flag fetch vs Clerk handshake race
description: Why a signed-in prod user can see every flag-gated feature as "niet beschikbaar" and how flag fetching must behave.
---

# Flag fetch race → everything looks disabled

Symptom: a production user (even Head Tester #1, flag globally ON, no override)
sees "Routeplanner nog niet beschikbaar". DB state was fine — the client was the
problem: `/api/flags` was fetched once right after page load, got 403 because
the Clerk session cookie was still settling, and the context silently fell back
to all-flags-false with NO retry. Every other query recovered (they retry /
refetch), flags did not — so the whole app looked feature-disabled until a
lucky reload.

**Rule:** the feature-flag fetch must never give up on a transient failure.
- Retry with backoff on error; never downgrade already-resolved flags on a blip.
- Refetch once `/api/auth/sync` has succeeded (profile in UserContext) — that
  proves the session server-side, correcting any lost handshake race.

**How to apply:** any new bootstrap fetch that gates UI availability (flags,
capabilities, release channel) needs the same treatment: retry + refetch-after-
sync, never a one-shot with a silent all-off fallback.

**Diagnosis path:** prod deployment logs — grep `/api/flags"` and look for 403s
with no later 200 in the same session.
