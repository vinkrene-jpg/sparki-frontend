---
name: Sparki Input Center & object-storage ACL timing
description: The one central upload/ask component, and the hard rule that object ACLs can only be set after the bytes exist in storage.
---

# Sparki Input Center

One central composer (feed "Sparki" tab) where athletes give Sparki photos, images, PDFs, files, links and typed questions. No scattered upload buttons. The whole conversation (with uploaded items) is persisted and stays visible.

## Object-storage ACL timing (the trap)
**Rule:** With the Replit object-storage template, you CANNOT set an object's ACL until the bytes actually exist in the bucket. `trySetObjectEntityAclPolicy` → `getObjectEntityFile` calls `file.exists()` and throws `ObjectNotFoundError` for a not-yet-uploaded object.

**Why:** ACLs are stored as object metadata, so the object must exist first. The presign step only mints a PUT URL — nothing is uploaded yet.

**How to apply:** Presigned-upload flow has three phases:
1. `POST .../uploads/request-url` — return `{ uploadURL, objectPath }`. Use `normalizeObjectEntityPath(uploadURL)` for the path; do NOT set ACL here.
2. Client PUTs bytes straight to `uploadURL` (raw `fetch`, not the json-forcing `apiFetch`).
3. When persisting the message that references the object, set the ACL (`trySetObjectEntityAclPolicy(objectPath, { owner: clerkId, visibility: "private" })`) — the object now exists. Only then can the owner-gated serve route / byte loader authorise reads.

Until the ACL is set, the serve route fails closed (403) — correct, because no message references the object yet.

## Anthropic content-block typing
- Image blocks need `media_type` typed as the literal union `"image/jpeg"|"image/png"|"image/gif"|"image/webp"` (a plain `string` won't assign to `ImageBlockParam`). Validate against the set, then cast.
- Don't write a type predicate `(b): b is {type:"text";text:string}` over `ContentBlock` — `TextBlock` requires `citations`. Just `.map(b => b.type === "text" ? b.text : "")`.

## Serving URL
Owner-gated GET serve is `${API_BASE}/api/storage/objects/<id>`; the route is `/storage/objects/*path` (Express 5 named wildcard). `objectPath` from the API is `/objects/...`, so the client URL is `${API_BASE}/api/storage${objectPath}`.
