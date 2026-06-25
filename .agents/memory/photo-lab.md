---
name: Sparki Photo Lab (Sparki-foto)
description: Isolated photo upload + Gemini "Sparki-style" relight flow; ownership-claim takeover guard.
---

# Sparki Photo Lab

Isolated, additive feature: upload a real photo → Gemini relights it into the dark
"Sparki Lab" look (same real person, no cartoon/face distortion) → user keeps
original / styled / re-upload. Two variants stored, never overwritten without choice.
Honest failure: styling failure persists a `failed` row with no styled variant; the
original stays usable (route returns 200 with `styledPath:null`, never a fake green).

## Ownership-claim takeover guard (security)
- **Rule:** an ACL-claim endpoint that takes a client-supplied object path must NOT
  unconditionally reassign the ACL owner. Read the existing ACL first; allow the
  claim only when the object is **unowned** (fresh presigned upload has null ACL) or
  **already owned by the caller**. Reject (403) when another user owns it.
- **Why:** `trySetObjectEntityAclPolicy` blindly sets owner metadata. Without the
  guard, any signed-in user passing a known/guessed `/objects/...` path could take
  over someone else's object. Caught in architect review, not by typecheck/e2e.
- **How to apply:** `getObjectAclPolicy(file)` → if `existing?.owner && !== caller`
  throw a typed error the route maps to 403 (never 500). `getObjectEntityFile`
  throws `ObjectNotFoundError` for bad paths → map to 404.
- Fuller "upload-intent tracking" (persist {clerkId, objectPath} at request-url time)
  is stronger but touches shared storage infra — out of scope for an isolated feature.

## Testing dev-bypass gotcha
- `devAuthBypass` honors `x-dev-clerk-id` ONLY when that id exists in `user_profiles`;
  a bogus id is ignored and falls back to the default dev user. To test multi-user
  access control you MUST use a second *real* seeded clerkId (e.g. `seed_social_anna`),
  otherwise both requests resolve to the same user and the guard looks like it passed.

## esbuild externalization
- api-server `build.mjs` externalizes `@google/*` (alongside `@google-cloud/*`). So
  `@google/genai` is NOT bundled — it must be a **direct dependency of api-server**
  (same pattern as `@google-cloud/storage`) or the dist bundle throws
  ERR_MODULE_NOT_FOUND at boot. Being only a transitive dep of a workspace lib is not
  enough for runtime resolution from `artifacts/api-server/dist/`.
