---
name: Sparki Journey & wedstrijddossier
description: Composed timeline + race dossier — composition-not-duplication, minor fail-closed media, share-card server-side policy.
---

# Sparki Journey

- The Journey timeline is **composed at read time** from existing tables (races, training_sessions, goal_events, garage_components) plus three Journey-only tables (journey_items, journey_media, journey_reflections). Never duplicate races/sessions into journey rows.
- **Why:** afbouwregels forbid parallel data systems; one source of truth per fact.
- Activity link resolution order: manual > none > auto (longest session on raceDate). "none" is an honest user choice, not a missing value.
- Reflection is a per-race upsert (unique clerkId+raceId) — PUT twice must stay one row.
- **Minor media rule is fail-closed:** age <18 OR unknown birthDate ⇒ 403 on setting visibility "gedeeld". Default visibility is always "prive".
- **Share-card policy is server-side, not UI-only:** the share-card endpoint must reject (400) any requested mediaId whose visibility ≠ "gedeeld" — silently filtering was flagged by review as a privacy bypass (minors could share private media via direct API calls). UI filtering to shareable media is only a UX aid.
- Share-card fields go through a whitelist; empty field selection is 400 (never silently share everything).
- Media POST sets object ACL AFTER upload (presign→PUT→claim), consistent with Input Center pattern; tests seed media rows directly in DB because the ACL flow needs real object storage.
