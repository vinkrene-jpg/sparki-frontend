---
name: Cross-account isolation testing
description: How athlete-owned :id routes deny cross-account access, plus a DELETE-status quirk.
---

# Cross-account isolation (athlete B on athlete A's records)

Every athlete-owned route resolves its record with an ownership-scoped filter
`and(eq(idCol, id), eq(clerkIdCol, clerkId))`. A route-contract test
(`test:cross-account-isolation`) seeds two disposable athletes via `ensureAccount`
and, for each `:id` surface, proves owner A gets 200 (positive control) and B
gets denied with zero read/mutation.

**DELETE-status convention:** races, routes AND nutrition DELETE all use
`.returning()` and answer **404** when the id isn't owned (ownership-scoped delete
matches nothing). Nutrition was previously a silent 200 no-op; it now returns 404
for a non-owner, so the isolation test asserts strictly 404 (plus A's row must
survive — "zero mutation" is still the primary guarantee).

**Exception — activity-import DELETE:** `DELETE /api/activity-imports/:id` does
NOT use `.returning()` — it always answers **200 `{ok:true}`**, so for a
non-owner it is a silent NO-OP, not a 404. There the guarantee is "zero
mutation" (A's row survives), not the status code — assert the row survives.

**Material POST /:id/photo positive control:** the owner path re-analyses via an
LLM (may 200/400/502), so the owner positive control asserts only
`status !== 404` (ownership gate passed) rather than a specific success code.
B is still hard-denied 404 at the gate before any analysis/upload.

**Why:** a future ownership-filter regression on any of these would silently
become a cross-account data leak/mutation; the positive control stops the test
from passing falsely if everyone starts getting 404.

**How to apply:** when adding a new athlete-owned `:id` route, extend
`artifacts/api-server/src/tests/cross-account-isolation.ts` with an owner-can /
B-denied pair. Photo-serve positive controls need a REAL object upload
(`uploadMaterialPhoto`) because a bogus path 404s the same as a denied owner.

## Coach/parent → athlete LINK isolation (the relationship surfaces)

Complementary to athlete-vs-athlete: coach/parent routes gate on an **accepted**
`coach_athlete_links` / `parent_athlete_links` row (`hasAcceptedCoachLink` /
`hasAcceptedParentLink`, both require `status === "accepted"`), NOT just the
coach/parent role. Denial status here is **403** ("Geen gekoppelde atleet"), not
404 — different from the athlete-owned 404 convention. Covered by
`test:coach-parent-link-isolation` (seeds coach, parent, a LINKED athlete, an
UNLINKED athlete, and a PENDING-link athlete). It asserts linked→success +
unlinked/pending→403 for: coach roster/detail/plan/context/plan-adopt and parent
roster/context, plus cross-role denial (coach on parent surface & vice-versa).
**Pending links must be tested separately** — a regression that treats any link
row as authorized (ignoring `status`) would pass an accepted-only test but leak
to pending. Seeding needs: `ensureAccount` then `update user_profiles.roles` to
add coach/parent (defaults to `["athlete"]`), and for the adopt positive control
an `advisory`-mode `training_plans` row + a non-rest `plan_days` row.
