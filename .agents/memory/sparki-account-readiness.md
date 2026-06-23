---
name: Sparki account-readiness gate + provisioning chain
description: Why signed-in route rendering must gate on profile readiness (not Clerk auth alone), and how the auth→sync→onboarding provisioning chain self-heals.
---

# Account readiness must gate EVERY signed-in surface

**Rule:** No signed-in surface may render app content (or onboarding) based on
Clerk auth alone. Every signed-in route renders through one shared `AccountGate`
that requires a provisioned `user_profiles` profile: dark splash while sync is in
flight, a Dutch `AccountNotReady` retry screen on failure, children only with a
real profile. `SignedInHome` reuses the same gate (wraps `SignedInHomeReady`) so
readiness logic has a single source of truth.

**Why:** The original onboarding-state bug was two racing chains — `UserContext`
provisioned the account while `SignedInHome`/route wrappers independently decided
onboarding/app from Clerk auth + `onboarding_state.isComplete`, never verifying
`user_profiles`/`athlete_profiles` exist. On sync failure they fell back to
localStorage, pushing users into onboarding or a `RoleHome` that crashes on a
null profile. Gating only the home path leaves deep-links (`/train`, invite, …)
open to the same failure — the gate MUST be global.

**How to apply:** When adding any new signed-in route/wrapper, wrap its
signed-in branch in `<AccountGate>`. Never gate app content on `<Show
when="signed-in">` alone.

# Provisioning chain (ensureAccount) is the single source of truth

`artifacts/api-server/src/lib/account.ts` owns provisioning, kept Express/Clerk-
free (identity passed in) so it is unit-testable. `POST /api/auth/sync` calls it
on EVERY login and returns the ready profile directly (frontend no longer does a
separate `/me` round-trip — that was a race). It is idempotent + self-healing:

- creates `user_profiles` if absent;
- **re-links by Clerk-verified email**: if the email exists under a different
  (defunct) clerkId — same person re-created their Clerk account — reassign the
  row to the new clerkId (conditional update + rowcount check for races; child
  rows follow via ON UPDATE CASCADE). Safe ONLY because email is Clerk-verified;
  never trust a client-supplied email for this.
- creates `athlete_profiles` if absent;
- `reconcileRoles` is **additive**: always keeps `athlete` baseline, re-adds
  `coach`/`parent` from ACCEPTED links only (pending grants nothing), repairs
  `active_role` drift to a role within `roles[]` (fallback `athlete`).

**Tests:** `src/tests/account.ts` (`pnpm --filter @workspace/api-server run
test:account`, wired into build.mjs entryPoints) runs 8 scenarios against the dev
DB with namespaced fixtures + full cleanup, exits non-zero on failure. Mirrors
the `smoke.ts` harness pattern.
