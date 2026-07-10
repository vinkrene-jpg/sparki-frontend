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

**Why:** a future ownership-filter regression on any of these would silently
become a cross-account data leak/mutation; the positive control stops the test
from passing falsely if everyone starts getting 404.

**How to apply:** when adding a new athlete-owned `:id` route, extend
`artifacts/api-server/src/tests/cross-account-isolation.ts` with an owner-can /
B-denied pair. Photo-serve positive controls need a REAL object upload
(`uploadMaterialPhoto`) because a bogus path 404s the same as a denied owner.
