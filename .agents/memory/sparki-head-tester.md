---
name: Sparki Head Tester (Hoofdtester)
description: Design decisions for the head-tester role — flag early-access precedence and the guaranteed sequential number.
---

# Head Tester (Hoofdtester)

Head Tester is NOT a role (roles stay athlete/coach/parent). It is `isHeadTester`
(bool) + `headTesterNumber` (unique int) on `user_profiles`. Granted via an
admin-minted `head_tester` invite whose accept branch sets the flag and assigns
the number. Label = "Head Tester #001" (zero-pad 3).

## Flag early-access precedence (resolveFlags, lib/flags.ts)
Order: user override → role → global → head-tester early access → false.

**Decision:** for a head tester, a flag that *exists* (has a row) but is not yet
role/global enabled resolves to TRUE. A flag with NO row stays FALSE even for head
testers.
**Why:** every real flag ships with `enabledGlobally=false` (that IS the
"not yet rolled out" state). If `global=false` won over head-tester access, head
testers would get zero early access and the whole feature would be inert. Enabling
no-row flags, conversely, would turn on unregistered/half-built features — unsafe.
**How to apply:** the kill-switch to hide a specific flag from a specific tester is
a user-level override=false (highest precedence) — do NOT add a special "explicit
disable" concept. Don't "fix" this to make global=false win; that breaks the feature.

## headTesterNumber must be backfilled, not trusted from accept
Invite-accept assigns the number best-effort *after* the txn commits (a hiccup must
not fail an otherwise-successful accept), so a profile can transiently be
`isHeadTester=true` with `headTesterNumber=null`.
**Fix/invariant:** `withHeadTesterNumber()` in routes/auth.ts runs on BOTH /sync and
/me and calls the idempotent `assignHeadTesterNumber` (atomic MAX+1, unique-violation
retry) whenever the number is missing. Any new endpoint that surfaces the profile to a
head tester should route through the same backfill, never assume the number is set.
