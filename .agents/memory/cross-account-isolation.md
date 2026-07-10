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

**Non-obvious DELETE-status quirk:** races DELETE and routes DELETE use
`.returning()` and answer **404** when the id isn't owned. But nutrition DELETE
(`DELETE /api/nutrition/:id`) runs the ownership-scoped delete and always answers
**200 `{ok:true}`** — for a non-owner it is a silent NO-OP, not a 404. The
security guarantee there is "zero mutation" (A's row survives), not the status
code. Assert the row survives, not a 404, for that endpoint.

**Why:** a future ownership-filter regression on any of these would silently
become a cross-account data leak/mutation; the positive control stops the test
from passing falsely if everyone starts getting 404.

**How to apply:** when adding a new athlete-owned `:id` route, extend
`artifacts/api-server/src/tests/cross-account-isolation.ts` with an owner-can /
B-denied pair. Photo-serve positive controls need a REAL object upload
(`uploadMaterialPhoto`) because a bogus path 404s the same as a denied owner.
