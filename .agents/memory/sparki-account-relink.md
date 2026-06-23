---
name: Sparki account re-link on email collision
description: Why /api/auth/sync re-links a re-created Clerk account to the existing profile, and the identity rules that make it safe.
---

# Account re-link on email collision (auth/sync)

When the same person re-creates their Clerk account they get a NEW clerkId but the
SAME verified email. The old `user_profiles` row still points at the now-defunct
clerkId, and the email unique constraint blocks a fresh insert — so without
re-linking the user has no profile, onboarding shows anyway (it gates only on
`onboarding_state`, not profile presence), and `quick-start` FK-crashes.

**Decision:** on sync, if no row exists for the caller's clerkId but a row exists
for their email under a different clerkId, RE-LINK by updating that row's
`clerk_id` to the caller. Child rows follow via `ON UPDATE CASCADE` (all 29
`clerk_id` FKs carry it — keep it that way; a re-link without it orphans data).

**Why safe:** Clerk enforces unique *verified* emails per instance, so a collision
means the old clerkId is dead and the caller provably owns the email.

**How to apply / non-negotiable rules:**
- Identity email MUST come from Clerk server-side (`getClerkVerifiedEmail` →
  `clerkClient.users.getUser`, primary address, only if `verification.status==='verified'`).
  NEVER trust `req.body.email` for any identity/re-link decision — doing so is an
  account-takeover vector (attacker posts victim's email to claim their profile).
  Body email is acceptable ONLY in the dev auth-bypass path (no Clerk session; not
  a security boundary).
- Re-link must be a conditional update `WHERE clerk_id=old AND email=verifiedEmail`
  with `.returning()` and proceed only when exactly 1 row comes back.
- Defense in depth: `onboarding/quick-start` checks the parent `user_profiles` row
  exists first and returns a clean 409 instead of a raw FK 500.

**Prod deploy gotcha:** the `ON UPDATE CASCADE` schema change is dev-pushed only;
it must be synced to the production DB before/with the rollout or re-link UPDATEs
fail in prod (see database skill "push dev to prod").
